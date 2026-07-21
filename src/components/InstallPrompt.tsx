import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsIOS((isSafari || isIPhone) && !isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setInstalled(true);
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const canInstall = deferredPrompt || isIOS;
  if (installed || dismissed || !canInstall) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="pointer-events-auto rounded-2xl p-6 mx-4 max-w-sm w-full text-center"
        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div
          className="mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ width: 72, height: 72, background: 'rgba(0,200,100,0.15)' }}
        >
          <svg width="36" height="36" viewBox="0 0 50 50" fill="#00C864">
            <path d="M35.66 25.85L19.53 36.03c-.47.3-1.08.14-1.38-.37-.1-.16-.15-.34-.15-.52V14.86c0-.55.45-1 1-1 .19 0 .37.05.53.16l16.13 10.19c.47.3.61.91.31 1.38a1.01 1.01 0 0 1-.31.3z"/>
          </svg>
        </div>

        <h2 className="text-white text-[18px] font-semibold mb-1">Install Global Radio</h2>
        <p className="text-white/50 text-[13px] mb-5">
          {isIOS
            ? 'Tap Share then Add to Home Screen'
            : 'Install as an app for the best experience'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 py-2.5 rounded-full text-[14px] text-white/60 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', cursor: 'pointer', border: 'none' }}
          >
            Not now
          </button>
          <button
            onClick={isIOS ? () => setDismissed(true) : handleInstall}
            className="flex-1 py-2.5 rounded-full text-[14px] text-white font-medium transition-colors"
            style={{ background: '#00C864', cursor: 'pointer', border: 'none' }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
