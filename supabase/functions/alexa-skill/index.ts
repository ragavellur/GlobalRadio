// Alexa custom-skill backend for Global Radio Explorer.
//
// Implements the AudioPlayer interface: resolves a station (by name / city /
// country) and responds with an AudioPlayer.Play directive so an Echo device
// streams it directly. AudioPlayer lifecycle events are persisted to the
// now_playing table keyed by the Alexa userId so other devices (web, Sonos)
// can pick up what's playing.
//
// Voice model (import these into the Alexa Developer Console):
//   invocation: "global radio"
//   intents:    Playstation, PlayFavorites, PlayOnSonos
//   slots:      station (free text), city (free text)
//
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected),
//               ALEXA_SKILL_ID (optional; app-id guard).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SKILL_ID = Deno.env.get('ALEXA_SKILL_ID') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const DATA_BASE = 'https://radio.vellur.in/data';
const RADIO_BROWSER = [
  'https://de1.api.radio-browser.info',
  'https://fr1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];
const STREAM_PROXY = `${SUPABASE_URL}/functions/v1/stream-proxy`;
const SONOS_AUTH = `${SUPABASE_URL}/functions/v1/sonos-auth`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const speech = (text: string) => ({ type: 'SSML', ssml: `<speak>${text}</speak>` });

function alexaResponse(
  outputSpeech: unknown = null,
  directives: unknown[] = [],
  shouldEndSession = true
) {
  const response: Record<string, unknown> = { shouldEndSession };
  if (outputSpeech) response.outputSpeech = outputSpeech;
  if (directives.length) response.directives = directives;
  return { version: '1.0', response };
}

const emptyResponse = () => alexaResponse();

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GlobalRadioExplorer/1.0 (alexa skill)' },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.json();
}

function sanitizeStreamUrl(url: string): string {
  let u = (url || '').trim().replace(/;.*$/, '');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

// Alexa requires HTTPS on 443. Route non-HTTPS streams through stream-proxy.
function playableUrl(url: string): string {
  const u = sanitizeStreamUrl(url);
  if (u.startsWith('https://')) return u;
  return `${STREAM_PROXY}?url=${encodeURIComponent(u)}`;
}

interface ResolvedStation {
  name: string;
  url: string;
  city: string;
  country: string;
}

async function resolveStation(
  stationName: string,
  city: string,
  country: string
): Promise<ResolvedStation | null> {
  // 1) Exact curated data when we know both city and country.
  if (city && country) {
    try {
      const cc = country.trim().toLowerCase();
      const data = (await fetchJson(`${DATA_BASE}/stations/${cc}.json`)) as Record<string, unknown>;
      const key = Object.keys(data).find((k) => {
        const parts = k.split(',');
        return parts[0].trim().toLowerCase() === city.trim().toLowerCase();
      });
      if (key) {
        const list = data[key] as [string, string][];
        if (Array.isArray(list) && list.length) {
          return {
            name: list[0][0],
            url: String(list[0][1]),
            city,
            country: cc.toUpperCase(),
          };
        }
      }
    } catch {
      // fall through to radio-browser
    }
  }

  // 2) Name search, optionally narrowed by city.
  if (stationName) {
    for (const base of RADIO_BROWSER) {
      try {
        const q = encodeURIComponent(stationName.trim());
        let results = (await fetchJson(
          `${base}/json/stations/search?name=${q}&limit=15&hidebroken=true&order=votes&reverse=true`
        )) as Record<string, unknown>[];
        if (!Array.isArray(results) || results.length === 0) continue;
        if (city) {
          const c = city.toLowerCase();
          const filtered = results.filter((r) =>
            `${r.tags ?? ''} ${r.state ?? ''} ${r.city ?? ''}`.toLowerCase().includes(c)
          );
          if (filtered.length) results = filtered;
        }
        const picked = results[0];
        return {
          name: String(picked.name),
          url: String(picked.url),
          city: typeof picked.city === 'string' ? picked.city : city ?? '',
          country: typeof picked.country === 'string' ? picked.country : country ?? '',
        };
      } catch {
        // try the next radio-browser mirror
      }
    }
  }

  // 3) City-only search.
  if (city) {
    for (const base of RADIO_BROWSER) {
      try {
        const q = encodeURIComponent(city.trim());
        const results = (await fetchJson(
          `${base}/json/stations/search?city=${q}&limit=15&hidebroken=true&order=votes&reverse=true`
        )) as Record<string, unknown>[];
        if (Array.isArray(results) && results.length) {
          const picked = results[0];
          return {
            name: String(picked.name),
            url: String(picked.url),
            city: typeof picked.city === 'string' ? picked.city : city,
            country: typeof picked.country === 'string' ? picked.country : country ?? '',
          };
        }
      } catch {
        // try the next radio-browser mirror
      }
    }
  }

  return null;
}

async function playStationHandler(
  stationName: string,
  city: string,
  country: string
) {
  const resolved = await resolveStation(stationName, city, country);
  if (!resolved) {
    const what = stationName ? ` called ${stationName}` : '';
    return alexaResponse(
      speech(`I couldn't find a station${what}. Try again with a station name or a city.`),
      [],
      true
    );
  }
  return alexaResponse(
    speech(`Playing ${resolved.name}.`),
    [playDirective(resolved.name, resolved.url, resolved.city, resolved.country)],
    true
  );
}

function playDirective(name: string, url: string, city: string, country: string) {
  const stream = {
    url: playableUrl(url),
    token: `station:${url}`,
    offsetInMilliseconds: 0,
  };
  const metadata: Record<string, unknown> = { title: name };
  if (city) {
    metadata.subtitle = country ? `${city}, ${country}` : city;
  }
  return {
    type: 'AudioPlayer.Play',
    playBehavior: 'REPLACE_ALL',
    audioItem: { stream, metadata },
  };
}

// With account linking, session.user.accessToken is the user's Supabase JWT.
function accessToken(event: unknown): string {
  return (event as any)?.session?.user?.accessToken ?? '';
}

async function linkedUserId(event: unknown): Promise<string | null> {
  const jwt = accessToken(event);
  if (!jwt) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(jwt);
  return error ? null : (data.user?.id ?? null);
}

async function playFavorites(event: unknown) {
  const uid = await linkedUserId(event);
  if (!uid) {
    return alexaResponse(
      speech('Please link your Global Radio account in the Alexa app to play your favorites.'),
      [],
      true
    );
  }
  const { data, error } = await supabaseAdmin()
    .from('favorites')
    .select('station_name, station_url, city, country_code')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error || !data?.length) {
    return alexaResponse(
      speech("You don't have any favorites yet. Save a station from the Global Radio web app and try again."),
      [],
      true
    );
  }
  const fav = data[0];
  return alexaResponse(
    speech(`Playing your favorite, ${fav.station_name}.`),
    [playDirective(fav.station_name, fav.station_url, fav.city, fav.country_code)],
    true
  );
}

/* ============ Sonos control (via sonos-auth proxy) ============ */

interface SonosTokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  obtained_at: string;
}

async function sonosProxy(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: any }> {
  const res = await fetch(SONOS_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'proxy', access_token: accessToken, method, path, body }),
  });
  const parsed = await res.json().catch(() => ({}));
  return { status: res.status, body: parsed };
}

async function refreshSonosToken(row: SonosTokenRow): Promise<SonosTokenRow | null> {
  const res = await fetch(SONOS_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refresh', refresh_token: row.refresh_token }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) return null;
  const fresh: SonosTokenRow = {
    ...row,
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? row.refresh_token,
    expires_in: Number(body.expires_in) || 0,
    obtained_at: new Date().toISOString(),
  };
  await supabaseAdmin()
    .from('sonos_tokens')
    .update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_in: fresh.expires_in,
      obtained_at: fresh.obtained_at,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', row.user_id)
    .then(() => {});
  return fresh;
}

async function currentSonosToken(uid: string): Promise<SonosTokenRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('sonos_tokens')
    .select('user_id, access_token, refresh_token, expires_in, obtained_at')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return null;
  const obtained = new Date(data.obtained_at).getTime() / 1000;
  const expiresIn = Number(data.expires_in) || 0;
  if (expiresIn && Date.now() / 1000 > obtained + expiresIn - 60) {
    return refreshSonosToken(data);
  }
  return data;
}

async function playOnSonos(event: unknown) {
  const uid = await linkedUserId(event);
  if (!uid) {
    return alexaResponse(
      speech('Please link your Global Radio account in the Alexa app to control your Sonos.'),
      [],
      true
    );
  }

  const slots = (event as any)?.request?.intent?.slots ?? {};
  const slot = (n: string) => slots[n]?.value ?? '';
  const resolved = await resolveStation(slot('station'), slot('city'), slot('country'));
  if (!resolved) {
    return alexaResponse(
      speech("I couldn't find a station to play on your Sonos. Try again with a station name or a city."),
      [],
      true
    );
  }

  const token = await currentSonosToken(uid);
  if (!token) {
    return alexaResponse(
      speech('No Sonos is connected to your Global Radio account yet. Connect it from the Global Radio web app, then try again.'),
      [],
      true
    );
  }

  try {
    const households = await sonosProxy(token.access_token, 'GET', '/households');
    const householdId = households?.body?.households?.[0]?.id;
    if (!householdId) {
      return alexaResponse(speech("I couldn't find a Sonos system on your account."), [], true);
    }
    const groups = await sonosProxy(token.access_token, 'GET', `/households/${householdId}/groups`);
    const groupId = groups?.body?.groups?.[0]?.id;
    if (!groupId) {
      return alexaResponse(speech('No Sonos speakers are available right now.'), [], true);
    }
    const play = await sonosProxy(token.access_token, 'POST', `/groups/${groupId}/playback`, {
      streamUrl: sanitizeStreamUrl(resolved.url),
      playModes: { repeat: false, shuffle: false, crossfade: false },
      positionMillis: 0,
    });
    if (play.status >= 200 && play.status < 300) {
      await supabaseAdmin()
        .from('now_playing')
        .upsert({
          owner_key: uid,
          source: 'sonos',
          station_url: resolved.url,
          station_name: resolved.name,
          state: 'playing',
          updated_at: new Date().toISOString(),
        })
        .then(() => {});
      return alexaResponse(speech(`Playing ${resolved.name} on your Sonos.`), [], true);
    }
    return alexaResponse(
      speech(`Sonos refused to play ${resolved.name}. Make sure a speaker is turned on.`),
      [],
      true
    );
  } catch {
    return alexaResponse(
      speech('There was a problem talking to your Sonos. Please try again.'),
      [],
      true
    );
  }
}

// Persist what's playing so other devices can pick it up later.
async function recordPlayback(event: unknown, userId: string) {
  if (userId) {
    try {
      const type = (event as any)?.request?.type ?? '';
      const token: string = (event as any)?.request?.token ?? '';
      const state = type === 'AudioPlayer.PlaybackStarted' ? 'playing' : 'stopped';
      const stationUrl = token.startsWith('station:') ? token.slice('station:'.length) : '';
      await supabaseAdmin()
        .from('now_playing')
        .upsert({
          owner_key: userId,
          source: 'alexa',
          station_url: stationUrl,
          station_name: '',
          state,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // non-fatal
    }
  }
  return emptyResponse();
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  let event: unknown;
  try {
    event = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (SKILL_ID) {
    const appId = (event as any)?.context?.System?.application?.applicationId;
    if (appId && appId !== SKILL_ID) return json({ error: 'unknown skill' }, 401);
  }

  const request = (event as any)?.request ?? {};
  const type = request.type ?? '';
  const userId = (event as any)?.context?.System?.user?.userId ?? '';

  let result: unknown;

  switch (type) {
    case 'LaunchRequest': {
      const uid = await linkedUserId(event);
      if (uid) {
        const { data: queued } = await supabaseAdmin()
          .from('play_queue')
          .select('id, station_name, station_url, city, country')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (queued?.id && queued.station_name && queued.station_url) {
          await supabaseAdmin().from('play_queue').delete().eq('id', queued.id).then(() => {});
          result = alexaResponse(
            speech(`Playing ${queued.station_name}, sent from your web app.`),
            [playDirective(queued.station_name, queued.station_url, queued.city ?? '', queued.country ?? '')],
            true
          );
          break;
        }
      }
      result = alexaResponse(
        speech('Welcome to Global Radio. Ask me to play a station, for example, play Chennai radio.'),
        [],
        true
      );
      break;
    }

    case 'IntentRequest': {
      const intent = request.intent?.name ?? '';
      const slots = request.intent?.slots ?? {};
      const slot = (n: string) => slots[n]?.value ?? '';

      if (intent === 'PlayStationIntent') {
        result = await playStationHandler(slot('station'), slot('city'), slot('country'));
      } else if (intent === 'PlayFavoritesIntent') {
        result = await playFavorites(event);
      } else if (intent === 'PlayOnSonosIntent') {
        result = await playOnSonos(event);
      } else if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') {
        result = alexaResponse(speech('Stopping.'), [{ type: 'AudioPlayer.Stop' }], true);
      } else if (intent === 'AMAZON.HelpIntent') {
        result = alexaResponse(
          speech('Say play, followed by a station name or a city, and I will stream it here on your speaker.'),
          [],
          true
        );
      } else {
        result = alexaResponse(
          speech('I did not understand that. Ask me to play a station by name or city.'),
          [],
          true
        );
      }
      break;
    }

    case 'AudioPlayer.PlaybackStarted':
    case 'AudioPlayer.PlaybackStopped':
    case 'AudioPlayer.PlaybackFinished':
    case 'AudioPlayer.PlaybackFailed':
      result = await recordPlayback(event, userId);
      break;

    case 'PlaybackController.PlayCommandIssued':
    case 'PlaybackController.PauseCommandIssued':
    case 'PlaybackController.NextCommandIssued':
    case 'PlaybackController.PreviousCommandIssued':
    case 'SessionEndedRequest':
    default:
      result = emptyResponse();
      break;
  }

  return json(result);
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (err) {
    console.error('alexa-skill error:', err);
    return json({
      version: '1.0',
      response: {
        outputSpeech: speech('Sorry, something went wrong. Please try again.'),
        shouldEndSession: true,
      },
    });
  }
});
