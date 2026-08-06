import { useCallback, useEffect, useState } from 'react';
import { useRadioStore } from '../lib/store';
import {
  SONOS_ENABLED,
  connect,
  disconnect,
  getGroups,
  playStream,
  pauseGroup,
  isConnected,
  setActiveSonos,
  getActiveSonos,
  clearActiveSonos,
  type SonosGroup,
} from '../lib/sonos';
import type { SonosSession } from '../types';
import PanelHeader from './PanelHeader';

export default function SonosPanel({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { currentStation, selectedCity, pausePlayback, sonosSession, setSonosSession } = useRadioStore();
  const [connected, setConnected] = useState(isConnected());
  const [connecting, setConnecting] = useState(false);
  const [groups, setGroups] = useState<SonosGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    setError(null);
    try {
      setGroups(await getGroups());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load Sonos speakers';
      setError(msg);
      if (/not connected|session expired|expired/i.test(msg)) setConnected(false);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await connect();
      setConnected(true);
      void loadGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, [loadGroups]);

  const handleHandoff = useCallback(
    async (group: SonosGroup) => {
      if (!currentStation) return;
      setBusyGroup(group.id);
      setError(null);
      try {
        await playStream(group.id, currentStation.url, currentStation.name);
        const session: SonosSession = {
          id: group.id,
          name: group.name,
          stationName: currentStation.name,
          stationUrl: currentStation.url,
          city: selectedCity?.city,
          country: selectedCity?.country,
          lat: selectedCity?.lat,
          lon: selectedCity?.lon,
          startedAt: Date.now(),
        };
        setActiveSonos(session);
        pausePlayback();
        setSonosSession(session);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Playback failed on Sonos');
      } finally {
        setBusyGroup(null);
      }
    },
    [currentStation, selectedCity, pausePlayback, setSonosSession, onClose]
  );

  const handleStop = useCallback(async () => {
    setError(null);
    try {
      const active = getActiveSonos();
      if (active?.id) await pauseGroup(active.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop Sonos');
    }
    clearActiveSonos();
    setSonosSession(null);
    onClose();
  }, [setSonosSession, onClose]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setConnected(false);
    setGroups([]);
    setSonosSession(null);
    onClose();
  }, [setSonosSession, onClose]);

  if (!SONOS_ENABLED) return null;

  const activeName = sonosSession?.name ?? null;

  return (
    <>
      <PanelHeader title="Sonos Stream" onBack={onBack} />

      {error && (
        <div className="text-[12px] mb-2" style={{ color: '#ff5555' }}>{error}</div>
      )}

      {!connected && (
        <button
          onClick={() => void handleConnect()}
          disabled={connecting}
          className="w-full rounded-lg text-[13px] font-medium py-2 transition-colors"
          style={{
            background: '#00C864',
            color: '#0a0a0a',
            cursor: connecting ? 'wait' : 'pointer',
            opacity: connecting ? 0.6 : 1,
          }}
        >
          {connecting ? 'Opening Sonos sign-in…' : 'Connect Sonos'}
        </button>
      )}

      {connected && (
        <>
          {loadingGroups && (
            <div className="text-[12px] text-white/60 py-2">Finding your Sonos speakers…</div>
          )}
          {!loadingGroups && groups.length === 0 && (
            <div className="text-[12px] text-white/60 py-2">No Sonos speakers found on this account.</div>
          )}
          {groups.map((g) => (
            <div key={g.id} className="flex items-center gap-2 py-1.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] truncate">{g.name}</div>
                <div className="text-[11px]" style={{ color: activeName === g.name ? '#00C864' : 'rgba(255,255,255,0.4)' }}>
                  {activeName === g.name ? 'Streaming here' : 'Sonos'}
                </div>
              </div>
              <button
                onClick={() => void handleHandoff(g)}
                disabled={!!busyGroup || !currentStation}
                className="text-[12px] font-medium rounded-full px-3 py-1 transition-colors"
                style={{
                  background: activeName === g.name ? 'rgba(0,200,100,0.2)' : 'rgba(255,255,255,0.1)',
                  color: activeName === g.name ? '#00C864' : '#fff',
                  cursor: !currentStation || busyGroup ? 'not-allowed' : 'pointer',
                  opacity: !currentStation || busyGroup ? 0.5 : 1,
                  border: 'none',
                }}
              >
                {busyGroup === g.id ? '…' : activeName === g.name ? 'Playing' : 'Play here'}
              </button>
            </div>
          ))}

          {!currentStation && (
            <div className="text-[11px] text-white/40 mt-2">Pick a station first, then send it to a speaker.</div>
          )}
        </>
      )}

      <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {connected && (
          <button
            onClick={handleDisconnect}
            className="text-[12px] transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Disconnect
          </button>
        )}
        {activeName && (
          <button
            onClick={() => void handleStop()}
            className="text-[12px] font-medium rounded-full px-3 py-1"
            style={{ background: 'rgba(255,85,85,0.15)', color: '#ff5555', border: '1px solid rgba(255,85,85,0.4)', cursor: 'pointer' }}
          >
            Stop on Sonos
          </button>
        )}
      </div>
    </>
  );
}
