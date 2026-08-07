import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRadioStore } from '../lib/store';
import { SONOS_ENABLED } from '../lib/sonos';
import { showAirPlayPicker } from '../lib/airplay';
import { sendToAlexa } from '../lib/alexa';
import { useAuth } from '../lib/auth';
import { useSignInDialog } from './SignInDialog';
import type { Station } from '../types';
import SonosPanel from './SonosPanel';
import CastPanel from './CastPanel';

type View = 'menu' | 'sonos' | 'cast';

const STROKE = '#00C864';

function Icon({ d, extra }: { d: string; extra?: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {extra}
    </svg>
  );
}

function MenuRow({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors hover:bg-white/10"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', textAlign: 'left' }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 text-[13px] truncate">{label}</span>
      {sub && <span className="text-[11px] shrink-0" style={{ color: STROKE }}>{sub}</span>}
    </button>
  );
}

const CAST_ICON_D = 'M2 12a10 10 0 0 1 10 10 M2 17a5 5 0 0 1 5 5 M2 22h.01 M16 22h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3';
const AIRPLAY_ICON_D = 'M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1 M12 17l7 5H5l7-5z';
const SONOS_ICON_D = 'M4 6h16 M2 12h20 M6 18h12';
const ALEXA_ICON_D = 'M11 5 6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07 M19.07 4.93a10 10 0 0 1 0 14.14';

export default function OutputButton({
  size = 18,
  trigger,
  triggerLabel,
  station,
  city,
}: {
  size?: number;
  trigger?: ReactNode;
  triggerLabel?: string;
  station?: Station | null;
  city?: any;
}) {
  const { sonosSession, castSession } = useRadioStore();
  const { user } = useAuth();
  const { openSignInDialog } = useSignInDialog();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('menu');
  const [menuError, setMenuError] = useState<string | null>(null);
  const [alexaState, setAlexaState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const sonosActive = sonosSession?.name ?? null;
  const castActive = castSession?.deviceName ?? null;
  const activeName = sonosActive ?? castActive;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const inRoot = rootRef.current?.contains(e.target as Node);
      const inPopup = popupRef.current?.contains(e.target as Node);
      if (!inRoot && !inPopup) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const viewportSize = useCallback(() => {
    const vv = window.visualViewport;
    return {
      width: vv?.width ?? window.innerWidth,
      height: vv?.height ?? window.innerHeight,
    };
  }, []);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next) {
      setView('menu');
      setMenuError(null);
      setAlexaState('idle');
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const { width: vw, height: vh } = viewportSize();
        const gap = 8;
        const estH = 240;
        const openBelow = rect.bottom + gap + estH <= vh - gap;
        setPopupPos({
          top: openBelow ? rect.bottom + gap : Math.max(gap, rect.top - gap - estH),
          left: Math.max(gap, rect.right - 280 - gap),
        });
      }
    }
  }, [open, viewportSize]);

  useLayoutEffect(() => {
    if (!open || !popupRef.current || !buttonRef.current) return;
    const pop = popupRef.current;
    const btn = buttonRef.current;
    const popRect = pop.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const { width: vw, height: vh } = viewportSize();
    const gap = 8;
    const popH = popRect.height;
    const popW = popRect.width;
    let top = btnRect.bottom + gap;
    if (top + popH > vh - gap) top = btnRect.top - gap - popH;
    if (top < gap) top = gap;
    let left = btnRect.right - popW;
    left = Math.max(gap, Math.min(left, vw - popW - gap));
    setPopupPos({ top, left });
  }, [open, view, viewportSize]);

  const handleAirPlay = useCallback(() => {
    const res = showAirPlayPicker();
    if (!res.supported) {
      setMenuError(res.error ?? 'Air Play is not available.');
    } else {
      setOpen(false);
    }
  }, []);

  const handleAlexaCast = useCallback(async () => {
    if (!station || !city) return;
    if (!user) {
      openSignInDialog();
      return;
    }
    setAlexaState('sending');
    try {
      await sendToAlexa({
        user_id: user.id,
        station_name: station.name,
        station_url: station.url,
        city: city.city ?? '',
        country: city.country ?? '',
      });
      setAlexaState('sent');
    } catch {
      setAlexaState('error');
    }
    window.setTimeout(() => setAlexaState('idle'), 3000);
  }, [user, station, city, openSignInDialog]);

  const alexaSub = !user
    ? 'Sign in to send'
    : alexaState === 'sending'
      ? 'Sending...'
      : alexaState === 'sent'
        ? 'Sent! Say "Alexa, play global radio"'
        : alexaState === 'error'
          ? 'Failed to send'
          : undefined;

  return (
    <div ref={rootRef} className="relative" style={{ display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        aria-label={triggerLabel ?? (activeName ? `Streaming on ${activeName}. Manage.` : 'Play on device')}
        title={activeName ? `Streaming on ${activeName}` : 'Play on device'}
        className={
          trigger
            ? 'flex items-center justify-center shrink-0 transition-colors bg-transparent hover:bg-[#494949]'
            : 'flex items-center justify-center shrink-0 rounded-full transition-colors bg-transparent hover:bg-white/10'
        }
        style={
          trigger
            ? {
                width: 50,
                height: 50,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }
            : {
                width: size + 12,
                height: size + 12,
                cursor: 'pointer',
              }
        }
      >
        {trigger ?? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={activeName ? STROKE : '#ffffff'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={CAST_ICON_D} />
          </svg>
        )}
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
                top: popupPos.top,
                left: popupPos.left,
                maxWidth: 'min(272px, calc(100vw - 16px))',
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
              {view === 'menu' && (
                <>
                  <div className="text-[13px] font-semibold mb-2" style={{ color: STROKE }}>
                    Play on device
                  </div>

                  {menuError && (
                    <div className="text-[12px] mb-2" style={{ color: '#ff5555' }}>{menuError}</div>
                  )}

                  {SONOS_ENABLED && (
                    <MenuRow
                      icon={<Icon d={SONOS_ICON_D} />}
                      label="Sonos Stream"
                      sub={sonosActive ? `Playing on ${sonosActive}` : undefined}
                      onClick={() => setView('sonos')}
                    />
                  )}
                  <MenuRow
                    icon={<Icon d={CAST_ICON_D} />}
                    label="Google Cast"
                    sub={castActive ? `Playing on ${castActive}` : undefined}
                    onClick={() => setView('cast')}
                  />
                  <MenuRow
                    icon={<Icon d={AIRPLAY_ICON_D} />}
                    label="Air Play"
                    onClick={handleAirPlay}
                  />
                  <MenuRow
                    icon={<Icon d={ALEXA_ICON_D} />}
                    label="Alexa Cast"
                    sub={alexaSub}
                    onClick={() => void handleAlexaCast()}
                  />
                </>
              )}

              {view === 'sonos' && (
                <SonosPanel onClose={() => setOpen(false)} onBack={() => setView('menu')} />
              )}

              {view === 'cast' && (
                <CastPanel onClose={() => setOpen(false)} onBack={() => setView('menu')} />
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
