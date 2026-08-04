import { useCallback, useEffect, useRef, useState } from 'react';
import { useRadioStore } from '../lib/store';
import { checkSonosSession, isConnected, restoreTokensFromServer, stopStreaming } from '../lib/sonos';
import type { City, SonosSession } from '../types';

const POLL_INTERVAL = 30_000;

export function useSonosSession() {
  const {
    cities, selectedCity, sonosSession,
    setSonosSession, selectCity, setPendingStationUrl, setStationSilent, playStation,
  } = useRadioStore();
  const [resume, setResume] = useState<SonosSession | null>(null);
  const checkingRef = useRef(false);
  const lastHandledKeyRef = useRef<string | null>(null);
  const sonosSessionRef = useRef(sonosSession);
  useEffect(() => {
    sonosSessionRef.current = sonosSession;
  }, [sonosSession]);

  // Point the UI at the station that's playing on Sonos without starting local audio.
  const applySession = useCallback(
    (session: SonosSession) => {
      setSonosSession(session);
      setPendingStationUrl(session.stationUrl);

      let city: City | null = null;
      if (session.city && session.country) {
        city =
          cities.find((c) => c.city === session.city && c.country === session.country) ?? null;
      }
      const target: City | null =
        city ??
        (session.city && session.country
          ? {
              country: session.country,
              city: session.city,
              lat: session.lat ?? 0,
              lon: session.lon ?? 0,
              stationCount: 0,
              countryId: -1,
              cityId: -1,
            }
          : null);

      if (target) {
        const same =
          selectedCity?.city === target.city && selectedCity?.country === target.country;
        if (same) {
          setStationSilent({ name: session.stationName, url: session.stationUrl });
        } else {
          selectCity(target);
        }
      } else {
        setStationSilent({ name: session.stationName, url: session.stationUrl });
      }
    },
    [cities, selectedCity, selectCity, setPendingStationUrl, setSonosSession, setStationSilent]
  );

  const runCheck = useCallback(
    async (showBanner: boolean) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        await restoreTokensFromServer();
        if (!isConnected()) return;
        const result = await checkSonosSession();
        if (result.status === 'streaming') {
          const s = result.session;
          applySession(s);
          const key = `${s.id}:${s.stationUrl}`;
          if (showBanner && lastHandledKeyRef.current !== key) {
            lastHandledKeyRef.current = key;
            setResume(s);
          } else if (lastHandledKeyRef.current !== key) {
            lastHandledKeyRef.current = key;
          }
        } else if (result.status === 'stopped' || result.status === 'other') {
          lastHandledKeyRef.current = null;
          setResume(null);
          if (sonosSessionRef.current) setSonosSession(null);
        }
        // 'error' | 'none' => leave current state as-is
      } finally {
        checkingRef.current = false;
      }
    },
    [applySession, setSonosSession]
  );

  useEffect(() => {
    let visible = !document.hidden;
    const onVisibility = () => {
      const next = !document.hidden;
      const wasHidden = !visible;
      visible = next;
      if (next && wasHidden) void runCheck(false);
    };
    const onFocus = () => void runCheck(false);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    void runCheck(true);

    const id = setInterval(() => {
      if (visible) void runCheck(false);
    }, POLL_INTERVAL);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      clearInterval(id);
    };
  }, [runCheck]);

  const dismissResume = useCallback(() => setResume(null), []);

  const playHereInstead = useCallback(
    async (session: SonosSession) => {
      setResume(null);
      setSonosSession(null);
      await stopStreaming();
      playStation({ name: session.stationName, url: session.stationUrl });
    },
    [playStation, setSonosSession]
  );

  return { resume, dismissResume, playHereInstead };
}
