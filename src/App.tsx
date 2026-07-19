import { useEffect } from 'react';
import Globe from './components/Globe';
import SearchPanel from './components/SearchPanel';
import BottomPanel from './components/BottomPanel';
import GlobeControls from './components/GlobeControls';
import LoadingIndicator from './components/LoadingIndicator';
import { RadioProvider, useRadioStore } from './lib/store';
import { useRouter } from './hooks/useRouter';

function AppContent() {
  const { isPlaying, selectCity } = useRadioStore();
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
      <GlobeControls />
      <SearchPanel />
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
