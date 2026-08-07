import { useEffect, useRef, useState } from 'react';
import { THEMES } from '../lib/themes';
import { useRadioStore } from '../lib/store';

export default function ThemeButton() {
  const { themeId, setTheme } = useRadioStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme"
        title="Theme"
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          background: 'rgba(25,25,25,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2">
          <path d="M12 22a10 10 0 1 1 10-10c0 2.49-1.51 3-3 3h-2a2 2 0 0 0-1.5 3.3c.4.5.47 1.3.18 1.95-.4 1.04-1.28 1.75-2.42 1.75z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-2 rounded-lg p-3"
            style={{ background: '#191919', border: '1px solid rgba(255,255,255,0.1)', zIndex: 31 }}
          >
            <div className="text-[12px] font-semibold text-white/70 mb-2">Theme</div>
            <div className="flex flex-wrap gap-2" style={{ width: 140 }}>
              {THEMES.map((t) => {
                const selected = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setOpen(false); }}
                    title={t.name}
                    aria-label={`${t.name} theme`}
                    className="flex items-center justify-center rounded-full transition-transform hover:scale-110"
                    style={{
                      width: 26,
                      height: 26,
                      background: t.accent,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: selected
                        ? '0 0 0 2px #191919, 0 0 0 3.5px #ffffff'
                        : 'inset 0 0 0 1px rgba(255,255,255,0.15)',
                    }}
                  >
                    {selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3.5">
                        <path d="M5 12l5 5 9-11" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
