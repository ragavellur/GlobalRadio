import { useState, useEffect, useRef, useCallback } from 'react';
import { useRadioStore } from '../lib/store';
import { findStationsForCity, filterValidStations, sortStations } from '../lib/stations';
import type { Station } from '../types';

export default function BottomPanel() {
  const {
    selectedCity, currentStation, isPlaying,
    playStation, pausePlayback,
  } = useRadioStore();

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'loading' | 'playing' | 'offline'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (selectedCity) {
      setLoadingStations(true);
      setDrawerOpen(true);
      findStationsForCity(selectedCity.country, selectedCity.city)
        .then((data) => {
          const filtered = sortStations(filterValidStations(data));
          setStations(filtered);
          setLoadingStations(false);
          if (filtered.length > 0) {
            playStation(filtered[0]);
          }
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

    if (audio.src === station.url && audio.paused && audio.currentTime > 0) {
      setAudioStatus('loading');
      audio.play().catch(() => setAudioStatus('offline'));
      return;
    }

    setAudioStatus('loading');

    audio.onerror = () => {
      setAudioStatus('offline');
    };

    audio.onplaying = () => {
      setAudioStatus('playing');
    };

    audio.onwaiting = () => {
      setAudioStatus('loading');
    };

    audio.src = station.url;
    audio.volume = 1;
    audio.play().catch((err) => {
      console.error('Audio play failed:', err);
      setAudioStatus('offline');
    });
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else if (currentStation) {
      playStation(currentStation);
    }
  }, [isPlaying, currentStation, pausePlayback, playStation]);

  useEffect(() => {
    if (isPlaying && currentStation) {
      startAudio(currentStation);
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentStation, startAudio]);

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
    <>
      {/* === Desktop panel (left side, 325px) === */}
      <div
        className="absolute z-10 flex-col hidden sm:flex"
        style={{ top: 15, left: 15, width: 325, height: 'calc(100vh - 30px)' }}
      >
        <DrawerContent
          selectedCity={selectedCity}
          stations={stations}
          loadingStations={loadingStations}
          drawerOpen={drawerOpen}
          currentStation={currentStation}
          isPlaying={isPlaying}
          audioStatus={audioStatus}
          localTime={localTime}
          handleToggleDrawer={handleToggleDrawer}
          playStation={playStation}
          togglePlayback={togglePlayback}
        />
      </div>

      {/* === Mobile panel (bottom sheet) === */}
      <div className="flex flex-col sm:hidden absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Mobile drawer — slides up from bottom */}
        <MobileDrawer
          selectedCity={selectedCity}
          stations={stations}
          loadingStations={loadingStations}
          drawerOpen={drawerOpen}
          currentStation={currentStation}
          localTime={localTime}
          handleToggleDrawer={handleToggleDrawer}
          playStation={playStation}
          hasPlayer={!!currentStation}
        />

        {/* Now playing bar — mobile, always visible when station selected */}
        {currentStation && (
          <MobileNowPlaying
            currentStation={currentStation}
            selectedCity={selectedCity}
            audioStatus={audioStatus}
            isPlaying={isPlaying}
            playStation={playStation}
            stations={stations}
            togglePlayback={togglePlayback}
          />
        )}
      </div>
    </>
  );
}

/* ===== Shared drawer content ===== */
function DrawerContent({
  selectedCity, stations, loadingStations, drawerOpen, currentStation,
  isPlaying, audioStatus, localTime, handleToggleDrawer, playStation, togglePlayback,
}: {
  selectedCity: any;
  stations: Station[];
  loadingStations: boolean;
  drawerOpen: boolean;
  currentStation: Station | null;
  isPlaying: boolean;
  audioStatus: string;
  localTime: string;
  handleToggleDrawer: () => void;
  playStation: (s: Station) => void;
  togglePlayback: () => void;
}) {
  return (
    <>
      {/* Drawer area — flex-end so content sits at bottom */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{ flex: '1 1 auto', justifyContent: 'flex-end' }}
      >
        {selectedCity && (
          <>
            {/* Handle — always on top */}
            <button
              onClick={handleToggleDrawer}
              className="flex items-center justify-center shrink-0 z-20"
              style={{ height: 10, cursor: 'pointer', flexShrink: 0 }}
              aria-label={drawerOpen ? 'Collapse drawer' : 'Open drawer'}
            >
              <div className="rounded-full" style={{ width: 36, height: 5, background: 'rgba(255,255,255,0.75)' }} />
            </button>

            {/* City banner — transparent like radio.garden */}
            <div className="shrink-0 z-10">
              <div className="flex items-center gap-3 px-1 py-2">
                <div
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.12)' }}
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
            </div>

            {/* Station list — scrollable */}
            {drawerOpen && (
              <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                {stations.length > 0 && (
                  <div style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
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
                {loadingStations && (
                  <div className="p-4 text-center text-white/50 text-sm" style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
                    Loading stations...
                  </div>
                )}
                {!loadingStations && stations.length === 0 && (
                  <div className="p-4 text-center text-white/50 text-sm" style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
                    No stations available
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!selectedCity && (
          <div className="flex-1 flex items-center justify-center px-2 text-center text-white/40 text-sm">
            Click a green dot on the globe to explore radio stations
          </div>
        )}
      </div>

      {/* Desktop now playing bar */}
      {currentStation && (
        <div
          className="flex flex-col shrink-0 rounded-lg overflow-hidden"
          style={{ background: '#191919', height: 100, marginTop: 15 }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] truncate" style={{ color: '#00C864' }} dir="auto">
                {currentStation.name}
              </div>
              <div className="text-[11px] text-white/50 truncate">
                {selectedCity?.city}, {selectedCity?.country}
                {audioStatus === 'offline' && <span style={{ color: '#ff5555', marginLeft: 6 }}>(Offline)</span>}
                {audioStatus === 'loading' && isPlaying && <span style={{ color: '#ffaa00', marginLeft: 6 }}>(Loading...)</span>}
              </div>
            </div>
            <button className="ml-3 p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0" title="Add to favorites">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2">
                <path d="M10.4 7.5C7.66 7.5 5.5 9.63 5.5 12.33c0 3.52 2.24 6.55 10.5 13.17 8.26-6.63 10.5-9.66 10.5-13.17 0-2.7-2.16-4.83-4.9-4.83-2.45 0-3.78 1.43-4.81 2.62l-.79.9-.79-.9C14.17 8.97 12.85 7.5 10.4 7.5z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-center px-2 pb-2 gap-2">
            <PlayButton
              onClick={() => {
                if (stations.length > 0 && currentStation) {
                  const idx = stations.findIndex(s => s.url === currentStation.url);
                  playStation(idx > 0 ? stations[idx - 1] : stations[stations.length - 1]);
                }
              }}
              aria-label="previous"
            >
              <svg width="20" height="20" viewBox="0 0 50 50" fill="white">
                <path d="M37.66 18.72v12.56a1 1 0 0 1-1.5.87l-10.52-6.02v5.08c0 .55-.45 1-1 1H24c-.55 0-1-.45-1-1v-12.38c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1v5.04l10.52-6.01c.48-.28 1.09-.11 1.37.37.08.15.13.32.13.49z"/>
              </svg>
            </PlayButton>

            <PlayButton
              onClick={togglePlayback}
              aria-label={isPlaying ? 'pause' : 'play'}
              large
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 50 50" fill="white">
                  <path d="M15 10h5v30h-5zm15 0h5v30h-5z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 50 50" fill="white">
                  <path d="M35.66 25.85L19.53 36.03c-.47.3-1.08.14-1.38-.37-.1-.16-.15-.34-.15-.52V14.86c0-.55.45-1 1-1 .19 0 .37.05.53.16l16.13 10.19c.47.3.61.91.31 1.38a1.01 1.01 0 0 1-.31.3z"/>
                </svg>
              )}
            </PlayButton>

            <PlayButton
              onClick={() => {
                if (stations.length > 0 && currentStation) {
                  const idx = stations.findIndex(s => s.url === currentStation.url);
                  playStation(idx < stations.length - 1 ? stations[idx + 1] : stations[0]);
                }
              }}
              aria-label="next"
            >
              <svg width="20" height="20" viewBox="0 0 50 50" fill="white">
                <path d="M27.66 18.79v12.38c0 .55-.45 1-1 1h-.64c-.55 0-1-.45-1-1v-5.04L14.5 32.15c-.48.27-1.09.1-1.37-.38-.08-.15-.13-.32-.13-.49V18.72c0-.55.45-1 1-1 .17 0 .35.05.5.14l10.52 6.01v-5.08c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1z"/>
              </svg>
            </PlayButton>
          </div>
        </div>
      )}
    </>
  );
}

/* ===== Mobile now playing bar ===== */
function MobileNowPlaying({
  currentStation, selectedCity, audioStatus, isPlaying,
  playStation, stations, togglePlayback,
}: {
  currentStation: Station;
  selectedCity: any;
  audioStatus: string;
  isPlaying: boolean;
  playStation: (s: Station) => void;
  stations: Station[];
  togglePlayback: () => void;
}) {
  return (
    <div
      className="shrink-0 rounded-t-lg overflow-hidden pointer-events-auto"
      style={{ background: '#191919' }}
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] truncate" style={{ color: '#00C864' }} dir="auto">
            {currentStation.name}
          </div>
          <div className="text-[11px] text-white/50 truncate">
            {selectedCity?.city}, {selectedCity?.country}
            {audioStatus === 'offline' && <span style={{ color: '#ff5555', marginLeft: 4 }}>(Offline)</span>}
            {audioStatus === 'loading' && isPlaying && <span style={{ color: '#ffaa00', marginLeft: 4 }}>(Loading...)</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-2 pb-2 gap-2">
        <PlayButton
          onClick={() => {
            if (stations.length > 0 && currentStation) {
              const idx = stations.findIndex(s => s.url === currentStation.url);
              playStation(idx > 0 ? stations[idx - 1] : stations[stations.length - 1]);
            }
          }}
          aria-label="previous"
        >
          <svg width="18" height="18" viewBox="0 0 50 50" fill="white">
            <path d="M37.66 18.72v12.56a1 1 0 0 1-1.5.87l-10.52-6.02v5.08c0 .55-.45 1-1 1H24c-.55 0-1-.45-1-1v-12.38c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1v5.04l10.52-6.01c.48-.28 1.09-.11 1.37.37.08.15.13.32.13.49z"/>
          </svg>
        </PlayButton>

        <PlayButton
          onClick={togglePlayback}
          aria-label={isPlaying ? 'pause' : 'play'}
          large
        >
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 50 50" fill="white">
              <path d="M15 10h5v30h-5zm15 0h5v30h-5z"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 50 50" fill="white">
              <path d="M35.66 25.85L19.53 36.03c-.47.3-1.08.14-1.38-.37-.1-.16-.15-.34-.15-.52V14.86c0-.55.45-1 1-1 .19 0 .37.05.53.16l16.13 10.19c.47.3.61.91.31 1.38a1.01 1.01 0 0 1-.31.3z"/>
            </svg>
          )}
        </PlayButton>

        <PlayButton
          onClick={() => {
            if (stations.length > 0 && currentStation) {
              const idx = stations.findIndex(s => s.url === currentStation.url);
              playStation(idx < stations.length - 1 ? stations[idx + 1] : stations[0]);
            }
          }}
          aria-label="next"
        >
          <svg width="18" height="18" viewBox="0 0 50 50" fill="white">
            <path d="M27.66 18.79v12.38c0 .55-.45 1-1 1h-.64c-.55 0-1-.45-1-1v-5.04L14.5 32.15c-.48.27-1.09.1-1.37-.38-.08-.15-.13-.32-.13-.49V18.72c0-.55.45-1 1-1 .17 0 .35.05.5.14l10.52 6.01v-5.08c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1z"/>
          </svg>
        </PlayButton>
      </div>
    </div>
  );
}

/* ===== Mobile drawer (bottom sheet) ===== */
function MobileDrawer({
  selectedCity, stations, loadingStations, drawerOpen, currentStation,
  localTime, handleToggleDrawer, playStation, hasPlayer,
}: {
  selectedCity: any;
  stations: Station[];
  loadingStations: boolean;
  drawerOpen: boolean;
  currentStation: Station | null;
  localTime: string;
  handleToggleDrawer: () => void;
  playStation: (s: Station) => void;
  hasPlayer: boolean;
}) {
  const maxH = hasPlayer ? 'calc(50vh - 60px)' : '50vh';

  return (
    <div
      className="shrink-0 rounded-t-lg overflow-hidden flex flex-col"
      style={{
        maxHeight: drawerOpen ? maxH : (hasPlayer ? 50 : 60),
        transition: 'max-height 0.2s ease',
      }}
    >
      {selectedCity && (
        <>
          {/* Handle */}
          <button
            onClick={handleToggleDrawer}
            className="flex items-center justify-center shrink-0 pointer-events-auto"
            style={{ height: 10, cursor: 'pointer' }}
            aria-label={drawerOpen ? 'Collapse drawer' : 'Open drawer'}
          >
            <div className="rounded-full" style={{ width: 36, height: 5, background: 'rgba(255,255,255,0.75)' }} />
          </button>

          {/* Banner */}
          <div className="shrink-0 px-2 py-2">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center shrink-0 rounded-full"
                style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.12)' }}
              >
                <span className="text-[12px] font-bold" style={{ color: '#00C864' }}>{selectedCity.stationCount}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-[20px] font-normal text-white leading-tight truncate">{selectedCity.city}</h1>
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] text-white/80">{selectedCity.country}</h2>
                  {localTime && <span className="text-[11px] text-white/40">{localTime}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Station list — scrollable */}
          {drawerOpen && (
            <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 pointer-events-auto">
              {stations.length > 0 && (
                <div style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
                  <div className="px-3 pb-1">
                    <span className="text-[12px] text-white/70 font-medium">Stations in {selectedCity.city}</span>
                  </div>
                  <div>
                    {stations.map((station, i) => (
                      <button
                        key={`${station.url}-${i}`}
                        onClick={(e) => { e.stopPropagation(); playStation(station); }}
                        className="w-full text-left px-4 py-[10px] transition-colors"
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
              {loadingStations && (
                <div className="p-4 text-center text-white/50 text-sm">Loading stations...</div>
              )}
              {!loadingStations && stations.length === 0 && (
                <div className="p-4 text-center text-white/50 text-sm">No stations available</div>
              )}
            </div>
          )}
        </>
      )}

      {!selectedCity && (
        <div className="flex items-center justify-center px-2 py-6 text-center text-white/40 text-sm">
          Tap a green dot on the globe to explore radio stations
        </div>
      )}
    </div>
  );
}

/* ===== Shared play button ===== */
function PlayButton({
  onClick, children, ariaLabel, large,
}: {
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  large?: boolean;
}) {
  const size = large ? 44 : 36;
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full transition-colors"
      style={{
        width: size,
        height: size,
        background: 'rgba(255,255,255,0.1)',
      }}
      aria-label={ariaLabel}
    >
      {children}
    </button>
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
