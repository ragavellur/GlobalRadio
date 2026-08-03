import { useEffect, useState } from 'react';
import { isUpdateAvailable, subscribeUpdate, applyUpdate, dismissUpdate } from '../lib/update';

export default function UpdateToast() {
  const [available, setAvailable] = useState(isUpdateAvailable());

  useEffect(() => subscribeUpdate(setAvailable), []);

  if (!available) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md">
      <div
        className="flex items-center gap-3 rounded-2xl py-3 pl-4 pr-2 shadow-xl"
        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <p className="flex-1 text-white text-[13px] leading-tight">
          A new version of the app is available!
        </p>
        <button
          onClick={applyUpdate}
          className="py-2 px-4 rounded-full text-[13px] text-white font-medium whitespace-nowrap transition-colors"
          style={{ background: '#00C864', cursor: 'pointer', border: 'none' }}
        >
          Update Now
        </button>
        <button
          onClick={dismissUpdate}
          aria-label="Dismiss update"
          className="flex items-center justify-center rounded-full text-white/50 hover:text-white transition-colors"
          style={{ width: 32, height: 32, background: 'transparent', cursor: 'pointer', border: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
