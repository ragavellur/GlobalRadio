import type { SonosSession } from '../types';
import { supabase } from './supabase';
import { Browser } from '@capacitor/browser';
import { isNative } from './native';

export const SONOS_CLIENT_ID = import.meta.env.VITE_SONOS_CLIENT_ID as string | undefined;
export const SONOS_REDIRECT_URI = import.meta.env.VITE_SONOS_REDIRECT_URI as string | undefined;
export const SONOS_FUNCTION_URL = import.meta.env.VITE_SONOS_FUNCTION_URL as string | undefined;

export const SONOS_ENABLED = !!(SONOS_CLIENT_ID && SONOS_REDIRECT_URI && SONOS_FUNCTION_URL);

const AUTH_URL = 'https://api.sonos.com/login/v3/oauth';

const TOKEN_KEY = 'globalradio:sonos_tokens';
const STATE_KEY = 'globalradio:sonos_oauth_state';
const CONTEXT_KEY = 'globalradio:sonos_app_context';
const ACTIVE_KEY = 'globalradio:sonos_active';

interface SonosTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  obtained_at: number;
}

export interface SonosGroup {
  id: string;
  name: string;
  playbackState?: string;
}

export class SonosError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SonosError';
    this.code = code;
  }
}

/* ============ token storage ============ */

function loadTokens(): SonosTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as SonosTokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: Partial<SonosTokens>) {
  const prev = loadTokens() ?? ({} as SonosTokens);
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...prev, ...tokens, obtained_at: Date.now() }));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isConnected(): boolean {
  const t = loadTokens();
  return !!t?.access_token;
}

/* ============ OAuth connect (popup) ============ */

// Exchange the OAuth code for tokens via the sonos-auth edge function (the
// client secret lives server-side). Mirrors public/sonos-callback.html.
async function exchangeCode(code: string, redirectUri: string): Promise<SonosTokens> {
  if (!SONOS_FUNCTION_URL) throw new SonosError('Sonos is not configured');
  const res = await fetch(SONOS_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'token', code, redirect_uri: redirectUri }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new SonosError((body as any)?.error || 'Failed to exchange Sonos authorization code');
  }
  return body as SonosTokens;
}

export function connect(): Promise<SonosTokens> {
  // Sonos only accepts HTTPS redirect URIs, so the same public
  // sonos-callback.html page is used for web and native. On native the
  // callback page detects the `native` state flag and bounces back to the
  // globalradio://sonos-callback deep link with the code.
  const native = isNative();
  const redirectUri: string = SONOS_REDIRECT_URI!;
  const stateObj = {
    csrf: Math.random().toString(36).slice(2) + Date.now().toString(36),
    fn: SONOS_FUNCTION_URL,
    redirectUri,
    native,
  };
  const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: SONOS_CLIENT_ID!,
    response_type: 'code',
    state,
    scope: 'playback-control-all',
    redirect_uri: redirectUri,
  });

  // Native: open the auth page in a Custom Tab and complete the flow when the
  // globalradio://sonos-callback deep link returns to the app.
  if (isNative()) {
    return new Promise<SonosTokens>((resolve, reject) => {
      const onNative = async (event: Event) => {
        window.removeEventListener('sonos-callback', onNative);
        sessionStorage.removeItem(STATE_KEY);
        const href = (event as CustomEvent<string>).detail;
        let u: URL;
        try {
          u = new URL(href);
        } catch {
          reject(new SonosError('Sonos connection failed'));
          return;
        }
        const oauthError = u.searchParams.get('error');
        const code = u.searchParams.get('code');
        if (oauthError) {
          reject(new SonosError(`Sonos authorization failed: ${oauthError}`));
          return;
        }
        if (!code) {
          reject(new SonosError('Missing authorization code.'));
          return;
        }
        try {
          const tokens = await exchangeCode(code, redirectUri);
          saveTokens(tokens);
          void syncTokensToServer();
          resolve(tokens);
        } catch (e) {
          reject(e instanceof Error ? e : new SonosError('Sonos connection failed'));
        }
      };
      window.addEventListener('sonos-callback', onNative);
      void Browser.open({ url: `${AUTH_URL}?${params.toString()}` });
    });
  }

  return new Promise<SonosTokens>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; status?: string; tokens?: SonosTokens; message?: string };
      if (!data || data.source !== 'sonos-callback') return;
      window.removeEventListener('message', onMessage);
      sessionStorage.removeItem(STATE_KEY);
      if (data.status === 'success' && data.tokens?.access_token) {
        saveTokens(data.tokens);
        void syncTokensToServer();
        resolve(data.tokens);
      } else {
        reject(new SonosError(data.message || 'Sonos connection failed'));
      }
    };

    window.addEventListener('message', onMessage);

    const w = window.open(`${AUTH_URL}?${params.toString()}`, '_blank', 'width=520,height=720');
    if (!w) {
      window.removeEventListener('message', onMessage);
      reject(new SonosError('Popup blocked. Allow popups for this site, then try again.'));
    }
  });
}

export function disconnect() {
  clearTokens();
  clearActiveSonos();
  void clearServerTokens();
}

/* ============ server-side token sync (cross-device / Alexa) ============ */

async function supabaseJwt(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Pull the user's Sonos tokens from the server (e.g. when they log in on a new
// device that has no local tokens yet). No-op when already connected locally.
export async function restoreTokensFromServer(): Promise<void> {
  if (isConnected() || !SONOS_FUNCTION_URL) return;
  const jwt = await supabaseJwt();
  if (!jwt) return;
  try {
    const res = await fetch(SONOS_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_tokens', access_token: jwt }),
    });
    const body = await res.json().catch(() => ({}));
    const t = body?.tokens;
    if (res.ok && t?.access_token && t?.refresh_token) {
      saveTokens({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_in: Number(t.expires_in) || 0,
      });
    }
  } catch {
    // offline — keep whatever local state exists
  }
}

// Push the current local Sonos tokens to the server for the signed-in user.
export async function syncTokensToServer(): Promise<void> {
  if (!SONOS_FUNCTION_URL) return;
  const jwt = await supabaseJwt();
  if (!jwt) return;
  const tokens = loadTokens();
  if (!tokens?.access_token || !tokens?.refresh_token) return;
  try {
    await fetch(SONOS_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_tokens',
        access_token: jwt,
        sonos_tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
        },
      }),
    });
  } catch {
    // offline — tokens will be pushed next time
  }
}

export async function clearServerTokens(): Promise<void> {
  if (!SONOS_FUNCTION_URL) return;
  const jwt = await supabaseJwt();
  if (!jwt) return;
  try {
    await fetch(SONOS_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_tokens', access_token: jwt }),
    });
  } catch {
    // offline
  }
}

/* ============ access token lifecycle ============ */

export async function ensureAccessToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens?.access_token) throw new SonosError('Sonos not connected');

  const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
  if (Date.now() < expiresAt - 60_000) return tokens.access_token;

  if (!tokens.refresh_token || !SONOS_FUNCTION_URL) {
    throw new SonosError('Sonos session expired. Please reconnect.');
  }

  const res = await fetch(SONOS_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refresh', refresh_token: tokens.refresh_token }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    clearTokens();
    throw new SonosError((body as any)?.error || 'Failed to refresh Sonos token. Please reconnect.');
  }
  saveTokens(body);
  void syncTokensToServer();
  return body.access_token as string;
}

/* ============ Sonos Control API (proxied via edge function; no CORS from Sonos) ============ */

async function apiFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await ensureAccessToken();
  const method = (init.method || 'GET').toUpperCase();

  let body: unknown;
  if (init.body) {
    try {
      body = JSON.parse(init.body as string);
    } catch {
      body = init.body;
    }
  }

  let res: Response;
  try {
    res = await fetch(SONOS_FUNCTION_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'proxy', access_token: token, method, path, body }),
    });
  } catch {
    throw new SonosError('Failed to reach the Sonos bridge. Check your connection.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new SonosError((data as any)?.error || `Sonos bridge error (${res.status})`);
  }
  const status = (data as any)?.status;
  const payload = (data as any)?.body;

  if (status && status >= 400) {
    const err = (payload as any) ?? {};
    throw new SonosError(
      (err as any)?.errorMessage || (err as any)?.message || (err as any)?.reason || `Sonos API error (${status})`,
      (err as any)?.errorCode || (err as any)?.code
    );
  }

  return payload;
}

export async function getGroups(): Promise<SonosGroup[]> {
  const households = await apiFetch('/households');
  const householdId = households?.households?.[0]?.id;
  if (!householdId) throw new SonosError('No Sonos household found for this account');
  const data = await apiFetch(`/households/${householdId}/groups`);
  return (data?.groups || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    playbackState: g.playbackState,
  }));
}

export async function playStream(groupId: string, streamUrl: string, stationName: string): Promise<void> {
  const session = await apiFetch(`/groups/${groupId}/playbackSession`, {
    method: 'POST',
    body: JSON.stringify({
      appId: 'io.github.ragavellur.globalradio',
      appContext: getAppContext(),
      customData: 'Global Radio Explorer',
    }),
  });
  const sessionId = session?.sessionId;
  if (!sessionId) throw new SonosError('Failed to open a Sonos playback session');

  await apiFetch(`/playbackSessions/${sessionId}/playbackSession/loadStreamUrl`, {
    method: 'POST',
    body: JSON.stringify({
      streamUrl: sanitizeStreamUrl(streamUrl),
      playOnCompletion: true,
      stationMetadata: { name: stationName, type: 'radio' },
    }),
  });
}

export async function pauseGroup(groupId: string): Promise<void> {
  await apiFetch(`/groups/${groupId}/playback/pause`, { method: 'POST' });
}

export async function playGroup(groupId: string): Promise<void> {
  await apiFetch(`/groups/${groupId}/playback/play`, { method: 'POST' });
}

/* ============ active handoff tracking (survives reload) ============ */

export function setActiveSonos(active: SonosSession) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
}

export function getActiveSonos(): SonosSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null') as SonosSession | null;
    if (parsed && !parsed.stationName) {
      localStorage.removeItem(ACTIVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveSonos() {
  localStorage.removeItem(ACTIVE_KEY);
}

/* ============ session detection (what's actually playing on Sonos) ============ */

const STREAMING_STATES = new Set([
  'PLAYBACK_STATE_PLAYING',
  'PLAYBACK_STATE_TRANSITIONING',
  'PLAYBACK_STATE_BUFFERING',
  'PLAYBACK_STATE_LOADING',
]);

export function isStreamingPlayback(state: string | null | undefined): boolean {
  return !!state && STREAMING_STATES.has(state);
}

export interface GroupPlayback {
  playbackState: string | null;
  title: string | null;
}

export async function getGroupPlayback(groupId: string): Promise<GroupPlayback> {
  const data = await apiFetch(`/groups/${groupId}/playback`);
  return {
    playbackState: data?.playbackState ?? null,
    title: data?.metadata?.title ?? null,
  };
}

export type SonosCheckResult =
  | { status: 'none' }
  | { status: 'streaming'; session: SonosSession; playbackState: string; title: string | null }
  | { status: 'stopped' }
  | { status: 'other' }
  | { status: 'error'; message: string };

export async function checkSonosSession(): Promise<SonosCheckResult> {
  const session = getActiveSonos();
  if (!session || !isConnected()) return { status: 'none' };

  try {
    const { playbackState, title } = await getGroupPlayback(session.id);

    if (!playbackState || !STREAMING_STATES.has(playbackState)) {
      clearActiveSonos();
      return { status: 'stopped' };
    }

    if (title && session.stationName && !titleMatchesStation(title, session.stationName)) {
      clearActiveSonos();
      return { status: 'other' };
    }

    return { status: 'streaming', session, playbackState, title };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Failed to reach Sonos',
    };
  }
}

function titleMatchesStation(title: string, stationName: string): boolean {
  const t = title.trim().toLowerCase();
  const s = stationName.trim().toLowerCase();
  return t === s || t.includes(s) || s.includes(t);
}

// Stop whatever our app is streaming on Sonos and clear the active marker.
export async function stopStreaming(): Promise<void> {
  const active = getActiveSonos();
  if (active?.id) {
    try {
      await pauseGroup(active.id);
    } catch {
      // ignore — group may already be stopped
    }
  }
  clearActiveSonos();
}

/* ============ helpers ============ */

function getAppContext(): string {
  let ctx = localStorage.getItem(CONTEXT_KEY);
  if (!ctx) {
    ctx = crypto.randomUUID();
    localStorage.setItem(CONTEXT_KEY, ctx);
  }
  return ctx;
}

// Clean up stream URLs before handing them to Sonos:
// - strip trailing ";" / ";..." suffixes (voscast-style URLs)
// - ensure an http(s) scheme
export function sanitizeStreamUrl(url: string): string {
  let u = url.trim().replace(/;.*$/, '');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}
