import { useEffect, useState } from 'react';
import { fetchLiveStations, SUPABASE_ENABLED, type LiveStation } from '../lib/social';

const POLL_INTERVAL = 10_000;

/**
 * Polls the live-stations rollup while the panel is open.
 */
export function useLiveStations(active: boolean): LiveStation[] {
  const [stations, setStations] = useState<LiveStation[]>([]);

  useEffect(() => {
    setStations([]);
    if (!active || !SUPABASE_ENABLED) return;
    let mounted = true;

    const load = async () => {
      const list = await fetchLiveStations();
      if (mounted) setStations(list);
    };

    load();
    const t = setInterval(load, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [active]);

  return stations;
}
