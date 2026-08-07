export interface Route {
  type: 'home' | 'visit' | 'listen' | 'search' | 'browse' | 'settings';
  params?: {
    citySlug?: string;
    cityId?: string;
    stationSlug?: string;
    stationId?: string;
    countryCode?: string;
  };
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { type: 'home' };
  }

  switch (segments[0]) {
    case 'visit':
      if (segments.length >= 3) {
        return {
          type: 'visit',
          params: {
            citySlug: segments[1],
            cityId: segments[2],
          },
        };
      }
      return { type: 'home' };

    case 'listen':
      // Legacy share links embed an encoded JSON payload:
      //   /listen/<stationSlug>/<encoded payload>
      if (segments.length === 3 && isSharePayload(segments[2])) {
        return {
          type: 'listen',
          params: {
            stationSlug: segments[1],
            stationId: segments[2],
          },
        };
      }
      // Current share links:
      //   /listen/<countryCode>/<citySlug>/<stationSlug>
      if (segments.length >= 4) {
        return {
          type: 'listen',
          params: {
            countryCode: segments[1],
            citySlug: segments[2],
            stationSlug: segments[3],
          },
        };
      }
      return { type: 'home' };

    case 'search':
      return { type: 'search' };

    case 'browse':
      return { type: 'browse' };

    case 'settings':
      return { type: 'settings' };

    default:
      return { type: 'home' };
  }
}

export function setRoute(route: Route): string {
  let hash = '';

  switch (route.type) {
    case 'home':
      hash = '/';
      break;
    case 'visit':
      if (route.params?.citySlug && route.params?.cityId) {
        hash = `/visit/${route.params.citySlug}/${route.params.cityId}`;
      }
      break;
    case 'listen':
      if (route.params?.countryCode && route.params?.citySlug && route.params?.stationSlug) {
        hash = `/listen/${route.params.countryCode}/${route.params.citySlug}/${route.params.stationSlug}`;
      } else if (route.params?.stationSlug && route.params?.stationId) {
        hash = `/listen/${route.params.stationSlug}/${route.params.stationId}`;
      }
      break;
    case 'search':
      hash = '/search';
      break;
    case 'browse':
      hash = '/browse';
      break;
    case 'settings':
      hash = '/settings';
      break;
  }

  window.location.hash = hash;
  return hash;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface StationSharePayload {
  n: string;
  u: string;
  c: string;
  y: string;
}

export function decodeStationPayload(stationId: string): StationSharePayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(stationId)) as Partial<StationSharePayload>;
    if (parsed && typeof parsed.n === 'string' && typeof parsed.u === 'string') {
      return { n: parsed.n, u: parsed.u, c: parsed.c ?? '', y: parsed.y ?? '' };
    }
  } catch {
    // malformed share payload
  }
  return null;
}

function isSharePayload(segment: string): boolean {
  return segment.startsWith('%7B') || segment.startsWith('{');
}

export interface StationShareRef {
  name: string;
  city: string;
  countryCode: string;
}

export function stationShareUrl(ref: StationShareRef): string {
  const cc = ref.countryCode.trim().toUpperCase();
  const citySlug = slugify(ref.city) || 'city';
  const stationSlug = slugify(ref.name) || 'station';
  return `https://radio.vellur.in/#/listen/${cc}/${citySlug}/${stationSlug}`;
}
