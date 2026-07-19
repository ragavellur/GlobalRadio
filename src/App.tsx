import Globe from './components/Globe';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import NowPlaying from './components/NowPlaying';
import { RadioProvider, useRadioStore } from './lib/store';

function AppContent() {
  const { isPlaying, currentStation } = useRadioStore();

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
