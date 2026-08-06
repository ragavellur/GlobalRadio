import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRadioStore } from '../lib/store';
import { castStation, stopCast, subscribeCast, type CastStateInfo } from '../lib/cast';
import type { CastSession } from '../types';

export default function CastButton({ size = 18 }: { size?: number }) {
  const { currentStation, pausePlayback, castSession, setCastSession } = useRadioStore();
  const [open, setOpen] = useState(false);
  const [castInfo, setCastInfo] = useState<CastStateInfo>({
    available: false,
    connected: false,
    devicesAvailable: false,
    deviceName: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState<{ right: number; bottom: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribeCast(setCastInfo), []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const inRoot = rootRef.current?.contains(e.target as Node);
      const inPopup = popupRef.current?.contains(e.target as Node);
      if (!inRoot && !inPopup) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setPopupPos({
          right: window.innerWidth - rect.right,
          bottom: window.innerHeight - rect.top + 8,
        });
      }
    }
  }, [open]);

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
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cast failed');
    } finally {
      setBusy(false);
    }
  }, [currentStation, setCastSession, pausePlayback]);

  const handleStop = useCallback(() => {
    stopCast();
    setCastSession(null);
    setOpen(false);
  }, [setCastSession]);

  const hasDevices = castInfo.available && (castInfo.devicesAvailable || castInfo.connected);
  if (!hasDevices) return null;

  const activeName = castSession?.deviceName ?? castInfo.deviceName ?? null;

  return (
    <div ref={rootRef} className="relative" style={{ display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label={activeName ? `Streaming on ${activeName}. Manage.` : 'Cast to speaker'}
        title={activeName ? `Streaming on ${activeName}` : 'Cast to speaker'}
        className="flex items-center justify-center shrink-0 rounded-full transition-colors hover:bg-white/10"
        style={{
          width: size + 12,
          height: size + 12,
          background: activeName ? 'rgba(0,200,100,0.25)' : 'rgba(0,200,100,0.12)',
          border: `1px solid ${activeName ? '#00C864' : 'rgba(0,200,100,0.35)'}`,
          cursor: 'pointer',
        }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#00C864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="16" height="12" rx="2" />
          <path d="M7 21h10" />
          {activeName && (
            <>
              <path d="M8 15a4 4 0 0 1 0-6" />
              <path d="M11 15a1 1 0 0 0 0-6" />
            </>
          )}
        </svg>
      </button>

      {open &&
        popupPos &&
        createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: 40 }} onClick={() => setOpen(false)} />
            <div
              ref={popupRef}
              style={{
                position: 'fixed',
                right: popupPos.right,
                bottom: popupPos.bottom,
                zIndex: 41,
                width: 272,
                background: '#202020',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
                color: '#fff',
                fontFamily: 'inherit',
              }}
            >
              <div className="text-[13px] font-semibold mb-2" style={{ color: '#00C864' }}>
                Cast to speaker
              </div>

              {error && (
                <div className="text-[12px] mb-2" style={{ color: '#ff5555' }}>{error}</div>
              )}

              {activeName ? (
                <div className="text-[13px]">
                  <span className="font-medium">{currentStation?.name ?? 'Radio'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}> playing on </span>
                  <span className="font-medium">{activeName}</span>
                  <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Streaming continues even if you close this tab.
                  </div>
                </div>
              ) : (
                <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {currentStation
                    ? 'Pick a device below to play the current station on your speaker.'
                    : 'Pick a station first, then cast it to your speaker.'}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {!activeName && (
                  <button
                    onClick={() => void handleCast()}
                    disabled={busy || !currentStation}
                    className="w-full text-[13px] font-medium rounded-lg py-2 transition-colors"
                    style={{
                      background: '#00C864',
                      color: '#0a0a0a',
                      cursor: busy || !currentStation ? 'not-allowed' : 'pointer',
                      opacity: busy || !currentStation ? 0.5 : 1,
                      border: 'none',
                    }}
                  >
                    {busy ? 'Casting…' : 'Choose device and cast'}
                  </button>
                )}
                {activeName && (
                  <button
                    onClick={handleStop}
                    className="text-[12px] font-medium rounded-full px-3 py-1"
                    style={{ background: 'rgba(255,85,85,0.15)', color: '#ff5555', border: '1px solid rgba(255,85,85,0.4)', cursor: 'pointer' }}
                  >
                    Stop on speaker
                  </button>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
