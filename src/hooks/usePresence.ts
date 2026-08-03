import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useRadioStore } from '../lib/store';
import { sendHeartbeat, SUPABASE_ENABLED } from '../lib/social';

const HEARTBEAT_INTERVAL = 10_000;

/**
 * Sends a presence heartbeat every 10s while a station is actually playing.
 * Stops automatically on pause/stop/close.
 */
export function usePresence() {
  const { user } = useAuth();
  const { currentStation, selectedCity, isPlaying } = useRadioStore();

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (!isPlaying || !currentStation || !selectedCity) return;

    const station = currentStation;
    const city = selectedCity;
    const beat = () => {
      void sendHeartbeat(station, city, user);
    };
    beat();
    const t = setInterval(beat, HEARTBEAT_INTERVAL);
    return () => clearInterval(t);
  }, [isPlaying, currentStation, selectedCity, user]);
}
