// Sonos OAuth + Control API proxy edge function.
//
// Holds the Sonos client secret (never shipped to the browser) and performs the
// token exchange / refresh / API proxying that the GitHub Pages frontend cannot
// do on its own (the Sonos Control API does not send CORS headers).
//
// Routes (all POST, JSON body):
//   { action: 'token', code, redirect_uri }       -> exchange auth code
//   { action: 'refresh', refresh_token }          -> refresh access token
//   { action: 'proxy', access_token, method, path, body }
//                                                 -> forward to Sonos Control API
//   { action: 'save_tokens', access_token (supabase jwt), sonos_tokens }
//                                                 -> store the user's Sonos tokens
//   { action: 'get_tokens', access_token (supabase jwt) }
//                                                 -> return the user's Sonos tokens
//   { action: 'clear_tokens', access_token (supabase jwt) }
//                                                 -> delete the user's Sonos tokens
//   POST .../events                               -> 200 {} (Sonos event callback stub)
//
// Secrets required: SONOS_CLIENT_ID, SONOS_CLIENT_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SONOS_CLIENT_ID = Deno.env.get('SONOS_CLIENT_ID') ?? '';
const SONOS_CLIENT_SECRET = Deno.env.get('SONOS_CLIENT_SECRET') ?? '';
const TOKEN_URL = 'https://api.sonos.com/login/v3/oauth/access';
const CONTROL_BASE = 'https://api.ws.sonos.com/control/api/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

async function userIdFromSupabaseJwt(jwt: string): Promise<string | null> {
  if (!jwt) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(jwt);
  return error ? null : (data.user?.id ?? null);
}

async function exchange(params: URLSearchParams): Promise<Record<string, unknown>> {
  const basic = btoa(`${SONOS_CLIENT_ID}:${SONOS_CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      (body as any).error_description ?? (body as any).error ?? `Sonos token request failed (${res.status})`;
    throw new Error(detail);
  }
  return body as Record<string, unknown>;
}

// Sonos Control API requires an X-Sonos-User-Id header; it lives in the user_id
// claim of the access token JWT.
function sonosUserId(accessToken: string): string | null {
  try {
    const part = accessToken.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    );
    const data = JSON.parse(decoded);
    return typeof data?.user_id === 'string' ? data.user_id : null;
  } catch {
    return null;
  }
}

async function controlApi(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'X-Sonos-Api-Key': SONOS_CLIENT_ID,
    'Content-Type': 'application/json',
  };
  const userId = sonosUserId(accessToken);
  if (userId) headers['X-Sonos-User-Id'] = userId;

  const res = await fetch(`${CONTROL_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.pathname.endsWith('/events')) {
    return json({});
  }

  try {
    if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

    const payload = await req.json().catch(() => null);
    if (!payload) return json({ error: 'invalid JSON body' }, 400);

    if (!SONOS_CLIENT_ID || !SONOS_CLIENT_SECRET) {
      return json({ error: 'SONOS_CLIENT_ID / SONOS_CLIENT_SECRET not configured' }, 500);
    }

    if (payload.action === 'token') {
      if (!payload.code || !payload.redirect_uri) {
        return json({ error: 'code and redirect_uri are required' }, 400);
      }
      const body = await exchange(
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: payload.code,
          redirect_uri: payload.redirect_uri,
        })
      );
      return json(body);
    }

    if (payload.action === 'refresh') {
      if (!payload.refresh_token) {
        return json({ error: 'refresh_token is required' }, 400);
      }
      const body = await exchange(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: payload.refresh_token,
        })
      );
      return json(body);
    }

    if (payload.action === 'proxy') {
      if (!payload.access_token) {
        return json({ error: 'access_token is required' }, 400);
      }
      if (!payload.path || typeof payload.path !== 'string') {
        return json({ error: 'path is required' }, 400);
      }
      const method = typeof payload.method === 'string' ? payload.method.toUpperCase() : 'GET';
      const result = await controlApi(payload.access_token, method, payload.path, payload.body);
      return json({ status: result.status, body: result.body });
    }

    if (payload.action === 'save_tokens') {
      const uid = await userIdFromSupabaseJwt(payload.access_token);
      if (!uid) return json({ error: 'invalid access_token' }, 401);
      const st = payload.sonos_tokens;
      if (!st?.access_token || !st?.refresh_token) {
        return json({ error: 'sonos_tokens.access_token and refresh_token are required' }, 400);
      }
      const { error } = await supabaseAdmin()
        .from('sonos_tokens')
        .upsert({
          user_id: uid,
          access_token: String(st.access_token),
          refresh_token: String(st.refresh_token),
          expires_in: Number(st.expires_in) || 0,
          updated_at: new Date().toISOString(),
        });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (payload.action === 'get_tokens') {
      const uid = await userIdFromSupabaseJwt(payload.access_token);
      if (!uid) return json({ error: 'invalid access_token' }, 401);
      const { data, error } = await supabaseAdmin()
        .from('sonos_tokens')
        .select('access_token, refresh_token, expires_in, obtained_at')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ tokens: data ?? null });
    }

    if (payload.action === 'clear_tokens') {
      const uid = await userIdFromSupabaseJwt(payload.access_token);
      if (!uid) return json({ error: 'invalid access_token' }, 401);
      const { error } = await supabaseAdmin()
        .from('sonos_tokens')
        .delete()
        .eq('user_id', uid);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: `unknown action: ${payload.action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected error' }, 500);
  }
});
