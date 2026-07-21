import { useEffect } from 'react';
import Globe from './components/Globe';
import SearchPanel from './components/SearchPanel';
import BottomPanel from './components/BottomPanel';

import LoadingIndicator from './components/LoadingIndicator';
import InstallPrompt from './components/InstallPrompt';
import { RadioProvider, useRadioStore } from './lib/store';
import { useRouter } from './hooks/useRouter';

function IntroPlayButton() {
  const { selectedCity, indexLoaded } = useRadioStore();

  if (selectedCity || !indexLoaded) return null;

  return (
    <button
      onClick={() => {
        if ((window as any).__playNearestCity) {
          (window as any).__playNearestCity();
        }
      }}
      className="absolute z-20 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 pointer-events-auto"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 80,
        height: 80,
        background: 'rgba(0, 200, 100, 0.25)',
        backdropFilter: 'blur(8px)',
        border: '2px solid rgba(0, 200, 100, 0.4)',
        cursor: 'pointer',
        boxShadow: '0 0 30px rgba(0, 200, 100, 0.2)',
      }}
      aria-label="Play radio from nearest city"
    >
      <svg width="36" height="36" viewBox="0 0 50 50" fill="white" style={{ marginLeft: 4 }}>
        <path d="M35.66 25.85L19.53 36.03c-.47.3-1.08.14-1.38-.37-.1-.16-.15-.34-.15-.52V14.86c0-.55.45-1 1-1 .19 0 .37.05.53.16l16.13 10.19c.47.3.61.91.31 1.38a1.01 1.01 0 0 1-.31.3z"/>
      </svg>
    </button>
  );
}

function AppContent() {
  const { selectCity } = useRadioStore();
  const { currentRoute } = useRouter();

  useEffect(() => {
    if (currentRoute.type === 'search') {
      // handled by search panel
    }
  }, [currentRoute, selectCity]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#2b2b2b' }}>
      <LoadingIndicator />
      <Globe />
      <BottomPanel />
      <SearchPanel />
      <IntroPlayButton />
      <InstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <RadioProvider>
      <AppContent />
    </RadioProvider>
  );
}
