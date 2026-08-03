import { useEffect, useState } from 'react';
import type { City } from '../types';
import { fetchCityListeners, cityKeyOf, SUPABASE_ENABLED, type Listener } from '../lib/social';

const POLL_INTERVAL = 10_000;

export interface ListenerCounts {
  cityCount: number;
  byStation: Record<string, number>;
  listeners: Listener[];
}

const EMPTY: ListenerCounts = { cityCount: 0, byStation: {}, listeners: [] };

/**
 * Polls active presence for a city every 10s while a city is selected and the
 * UI is active. Returns city-wide count, per-station counts, and listener list.
 */
export function useListenerCounts(city: City | null, active = true): ListenerCounts {
  const [counts, setCounts] = useState<ListenerCounts>(EMPTY);

  useEffect(() => {
    if (!city || !active || !SUPABASE_ENABLED) {
      setCounts(EMPTY);
      return;
    }
    const ck = cityKeyOf(city);
    let mounted = true;

    const load = async () => {
      const listeners = await fetchCityListeners(ck);
      if (!mounted) return;
      const byStation: Record<string, number> = {};
      for (const l of listeners) {
        byStation[l.stationUrl] = (byStation[l.stationUrl] ?? 0) + 1;
      }
      setCounts({ cityCount: listeners.length, byStation, listeners });
    };

    load();
    const t = setInterval(load, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [city, active]);

  return counts;
}
