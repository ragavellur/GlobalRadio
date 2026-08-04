import { useState, useEffect, useRef, useCallback } from 'react';
import { useRadioStore } from '../lib/store';
import { findStationsForCity, filterValidStations, sortStations } from '../lib/stations';
import { useAuth } from '../lib/auth';
import { useFavorites } from '../lib/favorites';
import type { NewFavorite } from '../lib/supabase';
import { useSignInDialog } from './SignInDialog';
import type { Station, City } from '../types';
import { useListenerCounts } from '../hooks/useListenerCounts';
import { cityRoomId, stationRoomId, cityKeyOf } from '../lib/social';
import { stopStreaming } from '../lib/sonos';
import { sendToAlexa } from '../lib/alexa';
import SonosButton from './SonosButton';

export default function BottomPanel() {
  const {
    selectedCity, currentStation, isPlaying, pendingStationUrl, sonosSession, drawerOpen,
    playStation, pausePlayback, setPendingStationUrl, setStationSilent, setSonosSession, openSocialRoom, setDrawerOpen,
  } = useRadioStore();

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'loading' | 'playing' | 'offline'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sonosSessionRef = useRef(sonosSession);
  const counts = useListenerCounts(selectedCity, !!selectedCity && drawerOpen);

  useEffect(() => {
    sonosSessionRef.current = sonosSession;
  }, [sonosSession]);

  useEffect(() => {
    if (selectedCity) {
      setLoadingStations(true);
      setDrawerOpen(true);
      findStationsForCity(selectedCity.country, selectedCity.city)
        .then((data) => {
          const filtered = sortStations(filterValidStations(data));
          setStations(filtered);
          setLoadingStations(false);
          setPendingStationUrl(null);
          if (filtered.length > 0) {
            const pending = pendingStationUrl
              ? filtered.find((s) => s.url === pendingStationUrl)
              : null;
            if (sonosSessionRef.current) {
              setStationSilent(pending ?? filtered[0]);
            } else {
              playStation(pending ?? filtered[0]);
            }
          }
        })
        .catch(() => { setStations([]); setLoadingStations(false); setPendingStationUrl(null); });
    } else {
      setStations([]);
    }
  }, [selectedCity, playStation, setStationSilent]);

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

  const stopSonosIfActive = useCallback(async () => {
    if (!sonosSessionRef.current) return;
    try {
      await stopStreaming();
    } finally {
      setSonosSession(null);
    }
  }, [setSonosSession]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else if (currentStation) {
      if (sonosSessionRef.current) {
        void stopSonosIfActive().then(() => playStation(currentStation));
      } else {
        playStation(currentStation);
      }
    }
  }, [isPlaying, currentStation, pausePlayback, playStation, stopSonosIfActive]);

  const handlePlayStation = useCallback(
    (station: Station) => {
      if (sonosSessionRef.current) {
        void stopSonosIfActive().then(() => playStation(station));
      } else {
        playStation(station);
      }
    },
    [playStation, stopSonosIfActive]
  );

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
    setDrawerOpen(!drawerOpen);
  }, [drawerOpen, setDrawerOpen]);

  const handleOpenCityChat = useCallback(
    (city: any) => {
      void cityRoomId(cityKeyOf(city)).then((id) =>
        openSocialRoom({ roomId: id, roomName: `${city.city}, ${city.country}` })
      );
    },
    [openSocialRoom]
  );

  const handleOpenStationChat = useCallback(
    (station: Station) => {
      void stationRoomId(station.url).then((id) =>
        openSocialRoom({ roomId: id, roomName: station.name })
      );
    },
    [openSocialRoom]
  );

  return (
    <>
      {/* === Desktop panel (left side, 325px) === */}
      <div
        className="absolute z-10 flex-col hidden sm:flex"
        style={{ bottom: 0, left: 15, width: 325, height: 'calc(100vh - 30px)' }}
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
          playStation={handlePlayStation}
          togglePlayback={togglePlayback}
          counts={counts}
          sonosActive={!!sonosSession}
          sonosName={sonosSession?.name ?? null}
          onOpenCityChat={handleOpenCityChat}
          onOpenStationChat={handleOpenStationChat}
        />
      </div>

      {/* === Mobile panel (bottom sheet) === */}
      <div
        className="sm:hidden absolute inset-x-0 z-10 pointer-events-none flex flex-col justify-end"
        style={{ top: 0, bottom: currentStation ? 102 : 0, overflow: 'hidden' }}
      >
        <MobileDrawer
          selectedCity={selectedCity}
          stations={stations}
          loadingStations={loadingStations}
          drawerOpen={drawerOpen}
          currentStation={currentStation}
          localTime={localTime}
          handleToggleDrawer={handleToggleDrawer}
          playStation={handlePlayStation}
          hasPlayer={!!currentStation}
          counts={counts}
          onOpenCityChat={handleOpenCityChat}
          onOpenStationChat={handleOpenStationChat}
        />
      </div>

      {currentStation && (
        <div className="sm:hidden absolute inset-x-0 bottom-0 z-20 pointer-events-auto">
          <MobileNowPlaying
            currentStation={currentStation}
            selectedCity={selectedCity}
            audioStatus={audioStatus}
            isPlaying={isPlaying}
            playStation={handlePlayStation}
            stations={stations}
            togglePlayback={togglePlayback}
            sonosActive={!!sonosSession}
            sonosName={sonosSession?.name ?? null}
          />
        </div>
      )}
    </>
  );
}

/* ===== Shared drawer content ===== */
function DrawerContent({
  selectedCity, stations, loadingStations, drawerOpen, currentStation,
  isPlaying, audioStatus, localTime, handleToggleDrawer, playStation, togglePlayback, counts,
  sonosActive, sonosName, onOpenCityChat, onOpenStationChat,
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
  counts: ReturnType<typeof useListenerCounts>;
  sonosActive: boolean;
  sonosName: string | null;
  onOpenCityChat: (city: any) => void;
  onOpenStationChat: (station: Station) => void;
}) {
  const toggleFavoriteAction = useFavoriteAction();
  const { isFavorite } = useFavorites();
  const currentFav = currentStation && selectedCity ? isFavorite(currentStation.url) : false;

  return (
    <>
      {/* Drawer area — flex-end so content sits at bottom */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{ flex: '1 1 auto', justifyContent: 'flex-end' }}
      >
        {selectedCity && (
          <>
            {/* Handle + City banner — click anywhere to toggle */}
            <div className="relative shrink-0 z-10">
              <button
                onClick={handleToggleDrawer}
                className="w-full text-left"
                aria-label={drawerOpen ? 'Collapse drawer' : 'Open drawer'}
                style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
              >
                {/* Handle — always on top */}
                <div className="flex items-center justify-center" style={{ height: 10 }}>
                  <div className="rounded-full" style={{ width: 36, height: 5, background: 'rgba(255,255,255,0.75)' }} />
                </div>

                {/* City banner — transparent like radio.garden */}
                <div className="flex items-center gap-3 px-1 py-2" style={{ paddingRight: 42 }}>
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
                      {counts.cityCount > 0 && (
                        <span className="text-[12px] font-medium" style={{ color: '#00C864' }}>
                          {counts.cityCount} listening now
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
              <div style={{ position: 'absolute', top: 22, right: 4 }}>
                <ChatIconButton onClick={() => onOpenCityChat(selectedCity)} label={`Chat about ${selectedCity.city}`} />
              </div>
            </div>

            {/* Station list — scrollable */}
            {drawerOpen && (
              <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100% - 250px)' }}>
                {stations.length > 0 && (
                  <div style={{ background: 'rgba(25,25,25,0.95)', borderRadius: 8 }}>
                    <div className="p-3 pb-1">
                      <span className="text-[13px] text-white/70 font-medium">Stations in {selectedCity.city}</span>
                    </div>
                    <div>
                      {stations.map((station, i) => (
                        <StationRow
                          key={`${station.url}-${i}`}
                          station={station}
                          city={selectedCity}
                          isCurrent={currentStation?.url === station.url}
                          onPlay={() => playStation(station)}
                          onToggleFavorite={() => toggleFavoriteAction(station, selectedCity)}
                          onChat={() => onOpenStationChat(station)}
                          count={counts.byStation[station.url]}
                        />
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
                {sonosActive && <span style={{ color: '#00C864', marginLeft: 6 }}>Playing on {sonosName}</span>}
                {!sonosActive && audioStatus === 'offline' && <span style={{ color: '#ff5555', marginLeft: 6 }}>(Offline)</span>}
                {!sonosActive && audioStatus === 'loading' && isPlaying && <span style={{ color: '#ffaa00', marginLeft: 6 }}>(Loading...)</span>}
              </div>
            </div>
            <SendToAlexaButton station={currentStation} city={selectedCity} />
            <SonosButton size={18} />
            <button
              onClick={() => toggleFavoriteAction(currentStation, selectedCity)}
              className="ml-3 p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              title={currentFav ? 'Remove from favorites' : 'Add to favorites'}
              aria-label="Add to favorites"
            >
              <svg width="20" height="20" viewBox="0 0 32 32" fill={currentFav ? '#00C864' : 'none'} stroke={currentFav ? '#00C864' : 'white'} strokeWidth="2">
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
  playStation, stations, togglePlayback, sonosActive, sonosName,
}: {
  currentStation: Station;
  selectedCity: any;
  audioStatus: string;
  isPlaying: boolean;
  playStation: (s: Station) => void;
  stations: Station[];
  togglePlayback: () => void;
  sonosActive: boolean;
  sonosName: string | null;
}) {
  const toggleFavoriteAction = useFavoriteAction();
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
            {sonosActive && <span style={{ color: '#00C864', marginLeft: 4 }}>Playing on {sonosName}</span>}
            {!sonosActive && audioStatus === 'offline' && <span style={{ color: '#ff5555', marginLeft: 4 }}>(Offline)</span>}
            {!sonosActive && audioStatus === 'loading' && isPlaying && <span style={{ color: '#ffaa00', marginLeft: 4 }}>(Loading...)</span>}
          </div>
        </div>
        <FavoriteHeart
          url={currentStation.url}
          onToggle={() => toggleFavoriteAction(currentStation, selectedCity)}
          size={20}
        />
        <SendToAlexaButton station={currentStation} city={selectedCity} />
        <SonosButton size={15} />
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
  localTime, handleToggleDrawer, playStation, hasPlayer, counts,
  onOpenCityChat, onOpenStationChat,
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
  counts: ReturnType<typeof useListenerCounts>;
  onOpenCityChat: (city: any) => void;
  onOpenStationChat: (station: Station) => void;
}) {
  const toggleFavoriteAction = useFavoriteAction();
  const maxH = hasPlayer ? '50%' : '50%';

  return (
    <div
      className="shrink-0 rounded-t-lg overflow-hidden flex flex-col"
      style={{
        maxHeight: drawerOpen ? maxH : 72,
        transition: 'max-height 0.2s ease',
      }}
    >
      {selectedCity && (
        <>
          {/* Handle + Banner — click anywhere to toggle */}
          <div className="relative shrink-0 pointer-events-auto">
            <button
              onClick={handleToggleDrawer}
              className="w-full text-left"
              aria-label={drawerOpen ? 'Collapse drawer' : 'Open drawer'}
              style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
            >
              {/* Handle */}
              <div className="flex items-center justify-center" style={{ height: 10 }}>
                <div className="rounded-full" style={{ width: 36, height: 5, background: 'rgba(255,255,255,0.75)' }} />
              </div>

              {/* Banner */}
              <div className="px-2 py-2" style={{ paddingRight: 40 }}>
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
                      {counts.cityCount > 0 && (
                        <span className="text-[11px] font-medium" style={{ color: '#00C864' }}>
                          {counts.cityCount} listening
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
            <div style={{ position: 'absolute', top: 20, right: 6 }}>
              <ChatIconButton onClick={() => onOpenCityChat(selectedCity)} label={`Chat about ${selectedCity.city}`} size={15} />
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
                      <StationRow
                        key={`${station.url}-${i}`}
                        station={station}
                        city={selectedCity}
                        isCurrent={currentStation?.url === station.url}
                        onPlay={() => playStation(station)}
                        onToggleFavorite={() => toggleFavoriteAction(station, selectedCity)}
                        onChat={() => onOpenStationChat(station)}
                        count={counts.byStation[station.url]}
                      />
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

/* ===== Favorite helpers ===== */
function useFavoriteAction() {
  const { user } = useAuth();
  const { toggleFavorite } = useFavorites();
  const { openSignInDialog } = useSignInDialog();

  return useCallback(
    (station: Station, city: any) => {
      if (!city) return;
      const fav: NewFavorite = {
        country_code: city.country,
        city: city.city,
        city_key: `${city.city},${city.country}`,
        station_name: station.name,
        station_url: station.url,
      };
      if (!user) {
        openSignInDialog(fav);
        return;
      }
      toggleFavorite(fav);
    },
    [user, toggleFavorite, openSignInDialog]
  );
}

function FavoriteHeart({
  url, onToggle, size = 18,
}: {
  url: string;
  onToggle: () => void;
  size?: number;
}) {
  const { isFavorite } = useFavorites();
  const active = isFavorite(url);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
      className="flex items-center justify-center shrink-0 rounded-full hover:bg-white/10 transition-colors"
      style={{ width: size + 12, height: size + 12, cursor: 'pointer', border: 'none', background: 'transparent' }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill={active ? '#00C864' : 'none'} stroke={active ? '#00C864' : 'rgba(255,255,255,0.55)'} strokeWidth="2">
        <path d="M10.4 7.5C7.66 7.5 5.5 9.63 5.5 12.33c0 3.52 2.24 6.55 10.5 13.17 8.26-6.63 10.5-9.66 10.5-13.17 0-2.7-2.16-4.83-4.9-4.83-2.45 0-3.78 1.43-4.81 2.62l-.79.9-.79-.9C14.17 8.97 12.85 7.5 10.4 7.5z" />
      </svg>
    </button>
  );
}

/* ===== Send to Alexa ===== */
function SendToAlexaButton({
  station, city, size = 15,
}: {
  station: Station;
  city: any;
  size?: number;
}) {
  const { user } = useAuth();
  const { openSignInDialog } = useSignInDialog();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleClick = useCallback(async () => {
    if (!user) {
      openSignInDialog();
      return;
    }
    if (!city) return;
    setState('sending');
    try {
      await sendToAlexa({
        user_id: user.id,
        station_name: station.name,
        station_url: station.url,
        city: city.city ?? '',
        country: city.country ?? '',
      });
      setState('sent');
    } catch {
      setState('error');
    }
    window.setTimeout(() => setState('idle'), 2500);
  }, [user, city, station, openSignInDialog]);

  const title =
    state === 'sent'
      ? "Sent! Say 'Alexa, play global radio'"
      : state === 'error'
        ? 'Failed to send to Alexa'
        : !user
          ? 'Sign in to send this station to your Alexa'
          : 'Send to Alexa';

  const color = state === 'sent' ? '#00C864' : state === 'error' ? '#ff5555' : 'rgba(255,255,255,0.55)';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); void handleClick(); }}
      aria-label="Send to Alexa"
      title={title}
      className="flex items-center justify-center shrink-0 rounded-full hover:bg-white/10 transition-colors"
      style={{
        width: size + 14,
        height: size + 14,
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
        color,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </button>
  );
}

function StationRow({
  station, city, isCurrent, onPlay, onToggleFavorite, onChat, count,
}: {
  station: Station;
  city: any;
  isCurrent: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onChat: () => void;
  count?: number;
}) {
  return (
    <div
      className="w-full flex items-center gap-1 px-4 py-2 transition-colors"
      style={{
        background: isCurrent ? 'rgba(0,200,100,0.15)' : 'transparent',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <button
        onClick={onPlay}
        className="flex-1 min-w-0 text-left"
        style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
        aria-label={`Play ${station.name}`}
      >
        <div className="text-[14px] truncate" style={{ color: isCurrent ? '#00C864' : 'white' }} dir="auto">
          {station.name}
        </div>
      </button>
      {typeof count === 'number' && count > 0 && (
        <span
          className="flex items-center justify-center rounded-full text-[11px] font-bold shrink-0"
          style={{ minWidth: 22, height: 20, padding: '0 7px', background: 'rgba(0,200,100,0.15)', color: '#00C864' }}
          title={`${count} listening now`}
        >
          {count}
        </span>
      )}
      <ChatIconButton onClick={onChat} label={`Chat about ${station.name}`} size={13} />
      <FavoriteHeart url={station.url} onToggle={onToggleFavorite} />
    </div>
  );
}

function ChatIconButton({ onClick, label, size = 13 }: { onClick: () => void; label: string; size?: number }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex items-center justify-center shrink-0 rounded-full"
      style={{
        width: size + 12,
        height: size + 12,
        background: 'rgba(0,200,100,0.12)',
        border: '1px solid rgba(0,200,100,0.35)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#00C864" strokeWidth="2">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
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
