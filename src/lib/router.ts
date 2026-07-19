export interface Route {
  type: 'home' | 'visit' | 'listen' | 'search' | 'browse' | 'settings';
  params?: {
    citySlug?: string;
    cityId?: string;
    stationSlug?: string;
    stationId?: string;
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
      if (segments.length >= 3) {
        return {
          type: 'listen',
          params: {
            stationSlug: segments[1],
            stationId: segments[2],
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
      if (route.params?.stationSlug && route.params?.stationId) {
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
