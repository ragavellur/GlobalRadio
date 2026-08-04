import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setShowIOS(isIOS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setDeferredPrompt(null);
      setShowIOS(false);
      setHintOpen(false);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (!deferredPrompt && !showIOS) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      setHintOpen((v) => !v);
    }
  };

  return (
    <>
      <button
        onClick={handleInstall}
        aria-label="Install app"
        title="Install app"
        className="flex items-center justify-center rounded-full"
        style={{ width: 40, height: 40, background: 'rgba(25,25,25,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M4 19h16" />
        </svg>
      </button>

      {hintOpen && !deferredPrompt && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 31 }} onClick={() => setHintOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-lg p-4 text-center"
            style={{ background: '#191919', border: '1px solid rgba(255,255,255,0.1)', zIndex: 32 }}
          >
            <div className="text-[13px] text-white font-medium mb-1">Install Global Radio</div>
            <div className="text-[12px] text-white/50">Tap Share, then Add to Home Screen</div>
            <button
              onClick={() => setHintOpen(false)}
              className="mt-3 w-full py-2 rounded-full text-[13px] text-white"
              style={{ background: '#00C864', cursor: 'pointer', border: 'none' }}
            >
              Got it
            </button>
          </div>
        </>
      )}
    </>
  );
}
