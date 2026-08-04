import Fuse from 'fuse.js';

export interface StationHit {
  name: string;
  url: string;
  cityIdx: number;
}

type RawRow = [string, string, number];

let fuse: Fuse<StationHit> | null = null;
let loading: Promise<void> | null = null;

/**
 * Loads the global station search index once, lazily, on first search.
 * Not part of the SW precache, so the ~600KB gzipped index is only
 * fetched when the user actually starts searching.
 */
function loadIndex(): Promise<void> {
  if (fuse) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const res = await fetch('/data/stations_search.json');
      if (!res.ok) throw new Error(`Failed to load station index: ${res.status}`);
      const rows = (await res.json()) as RawRow[];
      const items: StationHit[] = rows.map(([name, url, cityIdx]) => ({ name, url, cityIdx }));
      fuse = new Fuse(items, {
        keys: [{ name: 'name', weight: 1 }],
        threshold: 0.35,
        distance: 120,
        includeScore: true,
      });
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

export function isStationIndexLoading(): boolean {
  return loading !== null;
}

export function isStationIndexReady(): boolean {
  return fuse !== null;
}

export async function searchStations(query: string, limit = 6): Promise<StationHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    await loadIndex();
  } catch (err) {
    console.error('station search failed:', err);
    return [];
  }
  if (!fuse) return [];
  return fuse.search(q).slice(0, limit).map((r) => r.item);
}
