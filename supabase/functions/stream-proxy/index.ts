// HTTPS stream relay for Alexa + the web app.
//
// Alexa requires audio at HTTPS on port 443 with a valid certificate, and the
// Sonos player only reliably picks up HTTPS streams too. Many radio-browser
// streams are plain HTTP, so this function re-exposes them over HTTPS and
// forwards Range requests so HTML5 <audio> can seek.
//
// Usage:
//   GET /stream-proxy?url=http%3A%2F%2Fexample.com%2Fstream.mp3
//   (pass through any Range header you would have sent to the origin)
//
// Streams through without buffering; CORS enabled for browser use.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  const target = new URL(req.url).searchParams.get('url') ?? '';
  if (!target || !isAllowedUrl(target)) {
    return new Response('missing or invalid url', { status: 400, headers: corsHeaders });
  }

  const headers = new Headers();
  headers.set('User-Agent', 'GlobalRadioExplorer/1.0 (stream-proxy)');
  headers.set('Connection', 'keep-alive');
  const range = req.headers.get('range');
  if (range) headers.set('range', range);

  try {
    const upstream = await fetch(target, { headers, redirect: 'follow' });

    const out = new Headers(corsHeaders);
    for (const h of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ]) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }

    const body = req.method === 'HEAD' ? null : upstream.body;
    return new Response(body, { status: upstream.status, headers: out });
  } catch (err) {
    console.error('stream-proxy error:', err);
    return new Response('proxy error', { status: 502, headers: corsHeaders });
  }
});
