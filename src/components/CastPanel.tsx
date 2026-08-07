import { useCallback, useEffect, useState } from 'react';
import { useRadioStore } from '../lib/store';
import { castStation, stopCast, subscribeCast, type CastStateInfo } from '../lib/cast';
import type { CastSession } from '../types';
import PanelHeader from './PanelHeader';

export default function CastPanel({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { currentStation, pausePlayback, castSession, setCastSession } = useRadioStore();
  const [castInfo, setCastInfo] = useState<CastStateInfo>({
    available: false,
    connected: false,
    devicesAvailable: false,
    deviceName: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeCast(setCastInfo), []);

  const handleCast = useCallback(async () => {
    if (!currentStation) return;
    setBusy(true);
    setError(null);
    try {
      const { deviceName } = await castStation(currentStation);
      const session: CastSession = {
        deviceName,
        stationName: currentStation.name,
        stationUrl: currentStation.url,
        startedAt: Date.now(),
      };
      setCastSession(session);
      pausePlayback();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cast failed');
    } finally {
      setBusy(false);
    }
  }, [currentStation, setCastSession, pausePlayback, onClose]);

  const handleStop = useCallback(() => {
    stopCast();
    setCastSession(null);
    onClose();
  }, [setCastSession, onClose]);

  const activeName = castSession?.deviceName ?? castInfo.deviceName ?? null;

  return (
    <>
      <PanelHeader title="Google Cast" onBack={onBack} />

      {error && (
        <div className="text-[12px] mb-2" style={{ color: 'var(--gr-danger)' }}>{error}</div>
      )}

      {activeName ? (
        <div className="text-[13px]">
          <span className="font-medium">{currentStation?.name ?? 'Radio'}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> playing on </span>
          <span className="font-medium">{activeName}</span>
          <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Streaming continues even if you close this tab.
          </div>
          <button
            onClick={handleStop}
            className="text-[12px] font-medium rounded-full px-3 py-1 mt-2"
            style={{ background: 'rgba(var(--gr-danger-rgb),0.15)', color: 'var(--gr-danger)', border: '1px solid rgba(var(--gr-danger-rgb),0.4)', cursor: 'pointer' }}
          >
            Stop on speaker
          </button>
        </div>
      ) : (
        <>
          <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {currentStation
              ? 'Pick a device below to play the current station on your speaker.'
              : 'Pick a station first, then cast it to your speaker.'}
          </div>
          {castInfo.available && !castInfo.devicesAvailable && (
            <div className="text-[12px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              No Chromecast devices found on this network.
            </div>
          )}
          <button
            onClick={() => void handleCast()}
            disabled={busy || !currentStation}
            className="w-full text-[13px] font-medium rounded-lg py-2 mt-3 transition-colors"
            style={{
              background: 'var(--gr-accent)',
              color: '#0a0a0a',
              cursor: busy || !currentStation ? 'not-allowed' : 'pointer',
              opacity: busy || !currentStation ? 0.5 : 1,
              border: 'none',
            }}
          >
            {busy ? 'Casting…' : 'Choose device and cast'}
          </button>
        </>
      )}
    </>
  );
}
