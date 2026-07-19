import Fuse from 'fuse.js';
import type { City } from '../types';

let fuse: Fuse<City> | null = null;

export function initSearch(cities: City[]) {
  fuse = new Fuse(cities, {
    keys: [
      { name: 'city', weight: 0.6 },
      { name: 'country', weight: 0.4 },
    ],
    threshold: 0.3,
    distance: 100,
    includeScore: true,
  });
}

export function searchCities(query: string): City[] {
  if (!fuse || !query.trim()) return [];

  const results = fuse.search(query);
  return results.map((r) => r.item);
}

export function isSearchInitialized(): boolean {
  return fuse !== null;
}
