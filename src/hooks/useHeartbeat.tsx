import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useRadioStore } from '../lib/store';
import { sendHeartbeat, cityKeyOf, SUPABASE_ENABLED, type Listener, type HeartbeatUnread } from '../lib/social';

const HEARTBEAT_INTERVAL = 10_000;

export interface HeartbeatState {
  cityKey: string | null;
  cityCount: number;
  byStation: Record<string, number>;
  listeners: Listener[];
  unread: HeartbeatUnread[];
  unreadDmCount: number;
  unreadChangedAt: number;
}

const INITIAL: HeartbeatState = {
  cityKey: null,
  cityCount: 0,
  byStation: {},
  listeners: [],
  unread: [],
  unreadDmCount: 0,
  unreadChangedAt: 0,
};

const HeartbeatContext = createContext<HeartbeatState>(INITIAL);

/**
 * Runs a single consolidated heartbeat while anything on screen can use its
 * data: a station is playing (presence), a city is selected (listener counts),
 * or the user is signed in (unread DMs). Skips ticks while the tab is hidden.
 */
export function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentStation, selectedCity, isPlaying } = useRadioStore();
  const [state, setState] = useState<HeartbeatState>(INITIAL);
  const unreadSignalRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (!isPlaying && !selectedCity && !user) return;

    let mounted = true;
    const beat = async () => {
      if (document.visibilityState === 'hidden') return;
      const result = await sendHeartbeat(currentStation, selectedCity, !isPlaying);
      if (!mounted || !result) return;
      const signal = result.unread.map((u) => `${u.conversation_id}:${u.unread}`).join(',');
      setState((prev) => ({
        cityKey: selectedCity ? cityKeyOf(selectedCity) : null,
        cityCount: result.city.count,
        byStation: result.city.byStation,
        listeners: result.city.listeners,
        unread: result.unread,
        unreadDmCount: result.unread.reduce((n, u) => n + u.unread, 0),
        unreadChangedAt:
          signal === unreadSignalRef.current ? prev.unreadChangedAt : Date.now(),
      }));
      unreadSignalRef.current = signal;
    };

    void beat();
    const t = setInterval(beat, HEARTBEAT_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [isPlaying, currentStation, selectedCity, user?.id]);

  return <HeartbeatContext.Provider value={state}>{children}</HeartbeatContext.Provider>;
}

export function useHeartbeat() {
  return useContext(HeartbeatContext);
}
