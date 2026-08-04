import type { ReactNode } from 'react';

export default function SlidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 340,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="absolute top-0 bottom-0 grx-slide-panel flex flex-col"
        style={{ width, maxWidth: '92vw', background: '#191919', zIndex: 40 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between pl-4 pr-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="min-w-0">
            <div className="text-white text-[16px] font-semibold truncate">{title}</div>
            {subtitle && <div className="text-[12px] text-white/40 truncate">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-2 rounded-full hover:bg-white/10 shrink-0"
            style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
