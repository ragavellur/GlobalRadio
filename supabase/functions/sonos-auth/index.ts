// Sonos OAuth helper edge function.
//
// Holds the Sonos client secret (never shipped to the browser) and performs the
// token exchange / refresh that the GitHub Pages frontend cannot do on its own.
//
// Routes (all POST, JSON body):
//   { action: 'token', code, redirect_uri }       -> exchange auth code
//   { action: 'refresh', refresh_token }          -> refresh access token
//   POST .../events                               -> 200 {} (Sonos event callback stub)
//
// Secrets required: SONOS_CLIENT_ID, SONOS_CLIENT_SECRET

const SONOS_CLIENT_ID = Deno.env.get('SONOS_CLIENT_ID') ?? '';
const SONOS_CLIENT_SECRET = Deno.env.get('SONOS_CLIENT_SECRET') ?? '';
const TOKEN_URL = 'https://api.sonos.com/login/v3/oauth/access';

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

    return json({ error: `unknown action: ${payload.action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected error' }, 500);
  }
});
