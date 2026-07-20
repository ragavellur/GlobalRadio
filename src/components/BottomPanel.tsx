import { useState, useEffect, useRef, useCallback } from 'react';
import { useRadioStore } from '../lib/store';
import { findStationsForCity, filterValidStations, sortStations } from '../lib/stations';
import type { Station } from '../types';

export default function BottomPanel() {
  const {
    selectedCity, currentStation, isPlaying,
    playStation, pausePlayback, setVolume, audioVolume,
  } = useRadioStore();

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (selectedCity) {
      setLoadingStations(true);
      setDrawerOpen(true);
      findStationsForCity(selectedCity.country, selectedCity.city)
        .then((data) => {
          setStations(sortStations(filterValidStations(data)));
          setLoadingStations(false);
        })
        .catch(() => { setStations([]); setLoadingStations(false); });
    } else {
      setStations([]);
    }
  }, [selectedCity]);

  const startAudio = useCallback((station: Station) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
    }
    const audio = audioRef.current;
    audio.src = station.url;
    audio.volume = audioVolume;
    audio.play().catch((err) => {
      console.error('Audio play failed:', err);
    });
  }, [audioVolume]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  useEffect(() => {
    if (isPlaying && currentStation) {
      startAudio(currentStation);
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentStation, startAudio]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const localTime = selectedCity ? getLocalTime(selectedCity.lon) : '';

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  return (
    <div
      className="absolute z-10 flex flex-col"
      style={{ top: 15, left: 15, width: 325, height: 'calc(100vh - 30px)' }}
    >
      {/* === Wide Browser Container (drawer area) === */}
      <div
        className="relative flex flex-col"
        style={{ flex: '1 1 auto', overflow: 'hidden' }}
      >
        {/* Drawer handle (drag bar) — only when city selected */}
        {selectedCity && (
          <button
            onClick={handleToggleDrawer}
            className="flex items-center justify-center shrink-0 z-20"
            style={{ height: 10, cursor: 'pointer' }}
            aria-label={drawerOpen ? 'Collapse drawer' : 'Open drawer'}
          >
            <div
              className="rounded-full"
              style={{ width: 36, height: 5, background: 'rgba(255,255,255,0.75)' }}
            />
          </button>
        )}

        {/* City banner — sticky header */}
        {selectedCity && (
          <div
            className="flex items-center gap-3 px-1 py-2 shrink-0 z-10"
            style={{ background: 'rgba(43,43,43,0.95)' }}
          >
            <div
              className="flex items-center justify-center min-w-[47px] h-[57px] rounded-full"
              style={{ background: 'rgba(0,200,100,0.15)' }}
            >
              <span className="text-[13px] font-bold" style={{ color: '#00C864' }}>{selectedCity.stationCount}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[24px] font-normal text-white leading-tight truncate">{selectedCity.city}</h1>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] text-white/80">{selectedCity.country}</h2>
                {localTime && <span className="text-[13px] text-white/40">{localTime}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable station content — snaps to bottom */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            transition: 'opacity 0.2s',
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? 'auto' : 'none',
          }}
        >
          {/* Station list */}
          {selectedCity && stations.length > 0 && (
            <div className="mb-3" style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
              <div className="p-3 pb-1">
                <span className="text-[13px] text-white/70 font-medium">Stations in {selectedCity.city}</span>
              </div>
              <div>
                {stations.map((station, i) => (
                  <button
                    key={`${station.url}-${i}`}
                    onClick={(e) => { e.stopPropagation(); playStation(station); }}
                    className="w-full text-left px-4 py-[8px] transition-colors"
                    style={{
                      background: currentStation?.url === station.url ? 'rgba(0,200,100,0.15)' : 'transparent',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      className="text-[14px] truncate"
                      style={{ color: currentStation?.url === station.url ? '#00C864' : 'white' }}
                    >
                      {station.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {selectedCity && loadingStations && (
            <div className="p-4 text-center text-white/50 text-sm mb-3" style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
              Loading stations...
            </div>
          )}

          {/* Empty state */}
          {selectedCity && !loadingStations && stations.length === 0 && (
            <div className="p-4 text-center text-white/50 text-sm mb-3" style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
              No stations available
            </div>
          )}
        </div>

        {/* Default explore content when no city selected */}
        {!selectedCity && (
          <div className="flex-1 flex items-center justify-center px-2 text-center text-white/40 text-sm">
            Click a green dot on the globe to explore radio stations
          </div>
        )}
      </div>

      {/* === Nav bar === */}
      <nav
        className="flex shrink-0"
        style={{ background: '#191919', borderRadius: '0 0 8px 8px', height: 61 }}
        aria-label="Main navigation"
      >
        {([
          { key: 'explore', label: 'Explore', active: true },
          { key: 'favorites', label: 'Favorites', active: false },
          { key: 'browse', label: 'Browse', active: false },
          { key: 'search', label: 'Search', active: false },
          { key: 'settings', label: 'Settings', active: false },
        ] as const).map((tab) => (
          <a
            key={tab.key}
            role="button"
            tabIndex={0}
            className="flex-1 flex flex-col items-center justify-center transition-colors"
            style={{ height: 61, color: tab.active ? '#00C864' : 'white' }}
          >
            <NavIcon type={tab.key} />
            <span className="text-[10px] mt-[2px]">{tab.label}</span>
          </a>
        ))}
      </nav>

      {/* === Now playing bar === */}
      {currentStation && (
        <div
          className="flex flex-col shrink-0 rounded-lg overflow-hidden"
          style={{ background: '#191919', height: 100, marginTop: 15 }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] truncate" style={{ color: '#00C864' }} dir="auto">
                {currentStation.name}
              </div>
              <div className="text-[11px] text-white/50 truncate">
                {selectedCity?.city}, {selectedCity?.country}
              </div>
            </div>
            <button
              className="ml-3 p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              title="Add to favorites"
            >
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2">
                <path d="M10.4 7.5C7.66 7.5 5.5 9.63 5.5 12.33c0 3.52 2.24 6.55 10.5 13.17 8.26-6.63 10.5-9.66 10.5-13.17 0-2.7-2.16-4.83-4.9-4.83-2.45 0-3.78 1.43-4.81 2.62l-.79.9-.79-.9C14.17 8.97 12.85 7.5 10.4 7.5z" />
              </svg>
            </button>
          </div>

          {/* Controls row */}
          <div className="flex items-center px-2 pb-2 gap-0">
            <button
              onClick={() => {
                if (stations.length > 0 && currentStation) {
                  const idx = stations.findIndex(s => s.url === currentStation.url);
                  const prev = idx > 0 ? stations[idx - 1] : stations[stations.length - 1];
                  playStation(prev);
                }
              }}
              className="flex items-center justify-center w-[50px] h-[50px] hover:bg-white/10 rounded-full transition-colors"
              aria-label="previous"
            >
              <svg width="50" height="50" viewBox="0 0 50 50" fill="white">
                <path d="M37.66 18.72v12.56a1 1 0 0 1-1.5.87l-10.52-6.02v5.08c0 .55-.45 1-1 1H24c-.55 0-1-.45-1-1v-12.38c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1v5.04l10.52-6.01c.48-.28 1.09-.11 1.37.37.08.15.13.32.13.49z"/>
              </svg>
            </button>

            <button
              onClick={() => {
                if (isPlaying) {
                  pauseAudio();
                  pausePlayback();
                } else {
                  startAudio(currentStation);
                  playStation(currentStation);
                }
              }}
              className="flex items-center justify-center w-[50px] h-[50px] hover:bg-white/10 rounded-full transition-colors"
              aria-label={isPlaying ? 'pause' : 'play'}
            >
              {isPlaying ? (
                <svg width="50" height="50" viewBox="0 0 50 50" fill="white">
                  <path d="M15 10h5v30h-5zm15 0h5v30h-5z"/>
                </svg>
              ) : (
                <svg width="50" height="50" viewBox="0 0 50 50" fill="white">
                  <path d="M35.66 25.85L19.53 36.03c-.47.3-1.08.14-1.38-.37-.1-.16-.15-.34-.15-.52V14.86c0-.55.45-1 1-1 .19 0 .37.05.53.16l16.13 10.19c.47.3.61.91.31 1.38a1.01 1.01 0 0 1-.31.3z"/>
                </svg>
              )}
            </button>

            <button
              onClick={() => {
                if (stations.length > 0 && currentStation) {
                  const idx = stations.findIndex(s => s.url === currentStation.url);
                  const next = idx < stations.length - 1 ? stations[idx + 1] : stations[0];
                  playStation(next);
                }
              }}
              className="flex items-center justify-center w-[50px] h-[50px] hover:bg-white/10 rounded-full transition-colors"
              aria-label="next"
            >
              <svg width="50" height="50" viewBox="0 0 50 50" fill="white">
                <path d="M27.66 18.79v12.38c0 .55-.45 1-1 1h-.64c-.55 0-1-.45-1-1v-5.04L14.5 32.15c-.48.27-1.09.1-1.37-.38-.08-.15-.13-.32-.13-.49V18.72c0-.55.45-1 1-1 .17 0 .35.05.5.14l10.52 6.01v-5.08c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1z"/>
              </svg>
            </button>

            {/* Volume */}
            <div className="flex items-center flex-1 ml-2 gap-2">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="white" opacity="0.6">
                <polygon points="28 8 21.714 12.645 17 12.645 17 19.355 21.189 19.355 28 24"/>
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audioVolume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-[3px] rounded-lg appearance-none cursor-pointer"
                style={{ background: '#444', accentColor: '#00C864' }}
                aria-label="Set Volume"
              />
              <svg width="18" height="18" viewBox="0 0 32 32" fill="white" opacity="0.6">
                <path d="M16.49 11.13c-.27.22-.47.62-.24 1 .97 1.11 1.5 2.53 1.5 4s-.53 2.89-1.5 4c-.23.27-.03.66.24.89.12.1.26.15.4.15.18 0 .36-.08.5-.23 1.16-1.34 1.81-3.05 1.81-4.81s-.64-3.47-1.81-4.81c-.23-.26-.63-.3-1-.18zM12.89 8.68L7.23 13.01H3v6.5h4.03l5.86 4.48c.22.16.39.07.39-.21V8.88c0-.28-.17-.37-.39-.2z M24.39 5.3c-.22-.28-.7-.42-.97-.2-.27.22-.41.72-.2 1 2.18 2.84 3.34 6.27 3.34 9.92 0 3.65-1.16 7.08-3.34 9.93-.21.28-.07.78.2.93.12.09.26.1.35.1.18 0 .36-.1.49-.26C26.75 23.67 28 19.96 28 16.02c0-3.94-1.25-7.65-3.61-10.72z"/>
              </svg>
            </div>

            {/* More options */}
            <button
              className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0 ml-1"
              aria-label="show more channel options"
            >
              <svg width="20" height="20" viewBox="0 0 32 32" fill="white" opacity="0.6">
                <circle cx="22.5" cy="16.5" r="1.5"/>
                <circle cx="16.5" cy="16.5" r="1.5"/>
                <circle cx="10.5" cy="16.5" r="1.5"/>
              </svg>
            </button>
          </div>
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
  const size = 20;
  const color = type === 'explore' ? '#00C864' : 'currentColor';
  switch (type) {
    case 'explore':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2"><circle cx="16" cy="16" r="10"/></svg>;
    case 'favorites':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2"><path d="M10.4 7.5C7.66 7.5 5.5 9.63 5.5 12.33c0 3.52 2.24 6.55 10.5 13.17 8.26-6.63 10.5-9.66 10.5-13.17 0-2.7-2.16-4.83-4.9-4.83-2.45 0-3.78 1.43-4.81 2.62l-.79.9-.79-.9C14.17 8.97 12.85 7.5 10.4 7.5z"/></svg>;
    case 'browse':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2"><path d="M20.66 10.6l-9.31-3.84-8.8 3.47v16.09l8.8-3.54 9.31 3.84 8.8-3.55V7.05zM11.36 7.29v4.86M20.66 10.94v3.97M20.66 21.19v5.06M11.37 18.55v3.97"/></svg>;
    case 'search':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2"><circle cx="14" cy="14" r="8"/><path d="M20 20l5 5" strokeLinecap="round"/></svg>;
    case 'settings':
      return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2"><path d="M6.56 19.62H26m-19.44-7H26"/></svg>;
    default:
      return null;
  }
}
