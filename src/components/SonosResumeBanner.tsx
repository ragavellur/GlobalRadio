import { createPortal } from 'react-dom';
import type { SonosSession } from '../types';

export default function SonosResumeBanner({
  session,
  onKeep,
  onPlayHere,
}: {
  session: SonosSession;
  onKeep: () => void;
  onPlayHere: () => void;
}) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 'min(380px, calc(100vw - 24px))',
      }}
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: '#202020',
          border: '1px solid rgba(var(--gr-accent-rgb),0.45)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          color: '#fff',
          fontFamily: 'inherit',
          padding: '12px 14px',
        }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M2 10v4h3l4 4V6L5 10H2z" />
            <path d="M15 8a5 5 0 0 1 0 8" />
            <path d="M17.5 5.5a9 9 0 0 1 0 13" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--gr-accent)' }} dir="auto">
              {session.stationName}
            </div>
            <div className="text-[12px] text-white/60 truncate">
              is playing on <span style={{ color: '#fff' }}>{session.name}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onKeep}
            className="flex-1 rounded-lg text-[13px] font-medium py-1.5 transition-colors"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Keep on Sonos
          </button>
          <button
            onClick={onPlayHere}
            className="flex-1 rounded-lg text-[13px] font-medium py-1.5 transition-colors"
            style={{
              background: 'var(--gr-accent)',
              color: '#0a0a0a',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Play here instead
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
