export const SONOS_CLIENT_ID = import.meta.env.VITE_SONOS_CLIENT_ID as string | undefined;
export const SONOS_REDIRECT_URI = import.meta.env.VITE_SONOS_REDIRECT_URI as string | undefined;
export const SONOS_FUNCTION_URL = import.meta.env.VITE_SONOS_FUNCTION_URL as string | undefined;

export const SONOS_ENABLED = !!(SONOS_CLIENT_ID && SONOS_REDIRECT_URI && SONOS_FUNCTION_URL);

const AUTH_URL = 'https://api.sonos.com/login/v3/oauth';
const CONTROL_BASE = 'https://api.ws.sonos.com/control/api/v1';

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

export interface ActiveSonos {
  id: string;
  name: string;
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

export function connect(): Promise<SonosTokens> {
  const stateObj = {
    csrf: Math.random().toString(36).slice(2) + Date.now().toString(36),
    fn: SONOS_FUNCTION_URL,
  };
  const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: SONOS_CLIENT_ID!,
    response_type: 'code',
    state,
    scope: 'playback-control-all',
    redirect_uri: SONOS_REDIRECT_URI!,
  });

  return new Promise<SonosTokens>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; status?: string; tokens?: SonosTokens; message?: string };
      if (!data || data.source !== 'sonos-callback') return;
      window.removeEventListener('message', onMessage);
      sessionStorage.removeItem(STATE_KEY);
      if (data.status === 'success' && data.tokens?.access_token) {
        saveTokens(data.tokens);
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
  return body.access_token as string;
}

/* ============ Sonos Control API ============ */

async function apiFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await ensureAccessToken();
  const res = await fetch(`${CONTROL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Sonos-Api-Key': SONOS_CLIENT_ID!,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Sonos API error (${res.status})`;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (body?.errorCode) {
        code = body.errorCode;
        message = body.reason || code;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new SonosError(message, code);
  }

  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
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

export function setActiveSonos(active: ActiveSonos) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
}

export function getActiveSonos(): ActiveSonos | null {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearActiveSonos() {
  localStorage.removeItem(ACTIVE_KEY);
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
