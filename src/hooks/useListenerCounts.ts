import type { City } from '../types';
import { cityKeyOf, type Listener } from '../lib/social';
import { useHeartbeat } from './useHeartbeat';

export interface ListenerCounts {
  cityCount: number;
  byStation: Record<string, number>;
  listeners: Listener[];
}

const EMPTY: ListenerCounts = { cityCount: 0, byStation: {}, listeners: [] };

/**
 * Reads the current city's active-listener data from the shared heartbeat,
 * so nothing polls separately for counts.
 */
export function useListenerCounts(city: City | null, active = true): ListenerCounts {
  const hb = useHeartbeat();
  if (!city || !active) return EMPTY;
  if (hb.cityKey !== cityKeyOf(city)) return EMPTY;
  return {
    cityCount: hb.cityCount,
    byStation: hb.byStation,
    listeners: hb.listeners,
  };
}
