import { useState, useEffect } from 'react';
import { useRadioStore } from '../lib/store';
import { findStationsForCity, filterValidStations, sortStations } from '../lib/stations';
import type { Station } from '../types';

export default function BottomPanel() {
  const {
    selectedCity, currentStation, isPlaying,
    playStation, stopPlayback, setVolume, audioVolume,
  } = useRadioStore();

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [showStations, setShowStations] = useState(false);

  useEffect(() => {
    if (selectedCity) {
      setLoadingStations(true);
      setShowStations(true);
      findStationsForCity(selectedCity.country, selectedCity.city)
        .then((data) => {
          setStations(sortStations(filterValidStations(data)));
          setLoadingStations(false);
        })
        .catch(() => { setStations([]); setLoadingStations(false); });
    } else {
      setStations([]);
      setShowStations(false);
    }
  }, [selectedCity]);

  const localTime = selectedCity ? getLocalTime(selectedCity.lon) : '';

  return (
    <div className="absolute bottom-[15px] left-[15px] z-10" style={{ width: 325, maxHeight: 'calc(100vh - 30px)' }}>
      {/* Station list panel - scrollable */}
      {selectedCity && showStations && (
        <div className="rounded-lg overflow-hidden mb-1" style={{ background: '#191919' }}>
          <div className="max-h-[280px] overflow-y-auto">
            {loadingStations ? (
              <div className="p-4 text-center text-white/50 text-sm">Loading stations...</div>
            ) : stations.length > 0 ? (
              stations.map((station, i) => (
                <button
                  key={`${station.url}-${i}`}
                  onClick={() => playStation(station)}
                  className="w-full text-left px-4 py-[6px] transition-colors"
                  style={{
                    background: currentStation?.url === station.url ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                >
                  <div className="text-[13px] truncate" style={{ color: currentStation?.url === station.url ? '#00C864' : 'white' }}>
                    {station.name}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-white/50 text-sm">No stations</div>
            )}
          </div>
        </div>
      )}

      {/* City Banner */}
      {selectedCity && (
        <button
          className="w-full flex items-center gap-3 mb-1 px-1 text-left"
          onClick={() => setShowStations(!showStations)}
        >
          <div className="flex items-center justify-center min-w-[36px] h-[36px] rounded-full" style={{ background: 'rgba(0,200,100,0.15)' }}>
            <span className="text-sm font-bold" style={{ color: '#00C864' }}>{selectedCity.stationCount}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-normal text-white leading-tight truncate">{selectedCity.city}</h1>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] text-white/80">{selectedCity.country}</h2>
              {localTime && <span className="text-[12px] text-white/40">{localTime}</span>}
            </div>
          </div>
        </button>
      )}

      {/* Now Playing text */}
      {currentStation && isPlaying && (
        <div className="px-1 mb-1">
          <div className="text-[14px] font-normal truncate" style={{ color: '#00C864' }}>{currentStation.name}</div>
          <div className="text-[11px] text-white/50">{selectedCity?.city}, {selectedCity?.country}</div>
        </div>
      )}

      {/* Navigation Bar */}
      <div className="rounded-t-lg overflow-hidden" style={{ background: '#191919' }}>
        <div className="flex">
          {([
            { key: 'explore', label: 'Explore', icon: 'explore' },
            { key: 'favorites', label: 'Favorites', icon: 'heart' },
            { key: 'browse', label: 'Browse', icon: 'layers' },
            { key: 'search', label: 'Search', icon: 'search' },
            { key: 'settings', label: 'Settings', icon: 'gear' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              className="flex-1 flex flex-col items-center gap-[2px] py-[10px] transition-colors"
              style={{ color: tab.key === 'explore' ? '#00C864' : 'rgba(255,255,255,0.5)' }}
            >
              <NavIcon type={tab.icon} />
              <span className="text-[9px]">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Play Controls Bar */}
      {isPlaying && currentStation && (
        <div className="flex items-center rounded-b-lg overflow-hidden" style={{ background: '#191919' }}>
          <button
            onClick={stopPlayback}
            className="flex items-center justify-center w-[50px] h-[50px] hover:bg-white/10 transition-colors"
          >
            <PauseIcon />
          </button>
          <button
            onClick={stopPlayback}
            className="flex items-center justify-center w-[50px] h-[50px] hover:bg-white/10 transition-colors"
          >
            <NextIcon />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={audioVolume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-[3px] mx-3 rounded-lg appearance-none cursor-pointer"
            style={{ background: '#444', accentColor: '#00C864' }}
          />
        </div>
      )}
    </div>
  );
}

function getLocalTime(lon: number): string {
  try {
    const offset = Math.round(lon / 15);
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const local = new Date(utc + offset * 3600000);
    return local.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

function NavIcon({ type }: { type: string }) {
  const size = 22;
  switch (type) {
    case 'explore':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="16" cy="16" r="10"/></svg>;
    case 'heart':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.4 7.5C7.66 7.5 5.5 9.63 5.5 12.33c0 3.52 2.24 6.55 10.5 13.17 8.26-6.63 10.5-9.66 10.5-13.17 0-2.7-2.16-4.83-4.9-4.83-2.45 0-3.78 1.43-4.81 2.62l-.79.9-.79-.9C14.17 8.97 12.85 7.5 10.4 7.5z"/></svg>;
    case 'layers':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.66 10.6l-9.31-3.84-8.8 3.47v16.09l8.8-3.54 9.31 3.84 8.8-3.55V7.05zM11.36 7.29v4.86M20.66 10.94v3.97M20.66 21.19v5.06M11.37 18.55v3.97"/></svg>;
    case 'search':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="14" cy="14" r="8"/><path d="M20 20l5 5" strokeLinecap="round"/></svg>;
    case 'gear':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="16" cy="16" r="4"/><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.05 7.05l2.12 2.12M22.83 22.83l2.12 2.12M7.05 24.95l2.12-2.12M22.83 9.17l2.12-2.12" strokeLinecap="round"/></svg>;
    default:
      return null;
  }
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M6 4l10 8-10 8V4zm10 0h2v16h-2V4z"/>
    </svg>
  );
}
