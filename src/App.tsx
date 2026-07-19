import { useEffect } from 'react';
import Globe from './components/Globe';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import NowPlaying from './components/NowPlaying';
import { RadioProvider, useRadioStore } from './lib/store';
import { useRouter } from './hooks/useRouter';

function AppContent() {
  const { isPlaying, currentStation, selectCity, setSidebarOpen, setSidebarTab } = useRadioStore();
  const { currentRoute, navigate } = useRouter();

  // Handle route changes
  useEffect(() => {
    if (currentRoute.type === 'visit' && currentRoute.params?.cityId) {
      // TODO: Load city by ID and navigate to it
      console.log('Navigate to city:', currentRoute.params.citySlug, currentRoute.params.cityId);
    } else if (currentRoute.type === 'listen' && currentRoute.params?.stationId) {
      // TODO: Load station by ID and start playing
      console.log('Play station:', currentRoute.params.stationSlug, currentRoute.params.stationId);
    } else if (currentRoute.type === 'search') {
      setSidebarOpen(true);
      setSidebarTab('search');
    } else if (currentRoute.type === 'browse') {
      setSidebarOpen(true);
      setSidebarTab('browse');
    }
  }, [currentRoute, selectCity, setSidebarOpen, setSidebarTab]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0a0a]">
      {/* Globe */}
      <Globe />

      {/* Search Bar - Top Center */}
      <SearchBar />

      {/* Sidebar */}
      <Sidebar />

      {/* Now Playing Bar */}
      {isPlaying && currentStation && <NowPlaying />}
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
