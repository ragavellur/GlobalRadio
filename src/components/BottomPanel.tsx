import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRadioStore } from '../lib/store';
import { countryName } from '../lib/countryNames';
import { findStationsForCity, filterValidStations, sortStations } from '../lib/stations';
import { useAuth } from '../lib/auth';
import { useFavorites } from '../lib/favorites';
import type { NewFavorite } from '../lib/supabase';
import { useSignInDialog } from './SignInDialog';
import type { Station, City } from '../types';
import { useListenerCounts } from '../hooks/useListenerCounts';
import { cityRoomId, stationRoomId, cityKeyOf } from '../lib/social';
import { stopCast } from '../lib/cast';
import { registerAudio } from '../lib/airplay';
import OutputButton from './OutputButton';
import { stationShareUrl } from '../lib/router';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export default function BottomPanel() {
  const {
    selectedCity, currentStation, isPlaying, pendingStationUrl, sonosSession, castSession, drawerOpen,
    audioVolume, setVolume,
    playStation, pausePlayback, setPendingStationUrl, setStationSilent, setCastSession, openSocialRoom, setDrawerOpen,
  } = useRadioStore();

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'loading' | 'playing' | 'offline'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sonosSessionRef = useRef(sonosSession);
  const castSessionRef = useRef(castSession);
  const volumeRef = useRef(audioVolume);
  const counts = useListenerCounts(selectedCity, !!selectedCity);

  useEffect(() => {
    volumeRef.current = audioVolume;
  }, [audioVolume]);

  useEffect(() => {
    sonosSessionRef.current = sonosSession;
  }, [sonosSession]);

  useEffect(() => {
    castSessionRef.current = castSession;
  }, [castSession]);

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
      registerAudio(audioRef.current);
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
    audio.volume = volumeRef.current;
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

  const stopCastIfActive = useCallback(() => {
    if (!castSessionRef.current) return;
    stopCast();
    setCastSession(null);
  }, [setCastSession]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else if (currentStation) {
      stopCastIfActive();
      playStation(currentStation);
    }
  }, [isPlaying, currentStation, pausePlayback, playStation, stopCastIfActive]);

  const handlePlayStation = useCallback(
    (station: Station) => {
      stopCastIfActive();
      playStation(station);
    },
    [playStation, stopCastIfActive]
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

  const handleVolumeChange = useCallback(
    (v: number) => {
      volumeRef.current = v;
      setVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
    },
    [setVolume]
  );

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

  const handleShareStation = useCallback(async (station: Station) => {
    const url = stationShareUrl({
      n: station.name,
      u: station.url,
      c: selectedCity?.city ?? '',
      y: selectedCity?.country ?? '',
    });
    const title = `${station.name} — Global Radio`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title, url, dialogTitle: 'Share station' });
      } else if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      if (!Capacitor.isNativePlatform()) {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // clipboard unavailable
        }
      }
    }
  }, [selectedCity]);

  return (
    <>
      {/* === Desktop panel (left side, 325px) === */}
      <div
        className="absolute z-10 flex-col hidden sm:flex"
        style={{ top: 15, left: 15, width: 325, height: 'calc(var(--app-vh) - 30px)' }}
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
          volume={audioVolume}
          onVolumeChange={handleVolumeChange}
          sonosActive={!!sonosSession}
          sonosName={sonosSession?.name ?? null}
          castActive={!!castSession}
          castName={castSession?.deviceName ?? null}
          onOpenCityChat={handleOpenCityChat}
          onOpenStationChat={handleOpenStationChat}
          onShareStation={handleShareStation}
        />
      </div>

      {/* === Mobile panel (bottom sheet) === */}
      <div
        className="sm:hidden absolute inset-x-0 z-10 pointer-events-none flex flex-col justify-end"
        style={{ top: 0, bottom: currentStation ? 'calc(128px + env(safe-area-inset-bottom))' : 0, overflow: 'hidden' }}
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
          castActive={!!castSession}
          castName={castSession?.deviceName ?? null}
          volume={audioVolume}
          onVolumeChange={handleVolumeChange}
          onOpenStationChat={handleOpenStationChat}
          onShareStation={handleShareStation}
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
  volume, onVolumeChange,
  sonosActive, sonosName, castActive, castName, onOpenCityChat, onOpenStationChat, onShareStation,
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
  volume: number;
  onVolumeChange: (v: number) => void;
  sonosActive: boolean;
  sonosName: string | null;
  castActive: boolean;
  castName: string | null;
  onOpenCityChat: (city: any) => void;
  onOpenStationChat: (station: Station) => void;
  onShareStation: (station: Station) => void;
}) {
  const toggleFavoriteAction = useFavoriteAction();
  const { isFavorite } = useFavorites();
  const { cities, selectCity } = useRadioStore();
  const currentFav = currentStation && selectedCity ? isFavorite(currentStation.url) : false;

  const nearby = useMemo(() => {
    if (!selectedCity) return [];
    return cities
      .filter((c) => c.cityId !== selectedCity.cityId)
      .map((c) => ({
        ...c,
        distanceKm: haversineKm(selectedCity.lat, selectedCity.lon, c.lat, c.lon),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }, [selectedCity, cities]);

  const countryCities = useMemo(() => {
    if (!selectedCity) return [];
    return cities
      .filter((c) => c.country === selectedCity.country && c.cityId !== selectedCity.cityId)
      .sort((a, b) => b.stationCount - a.stationCount)
      .slice(0, 8);
  }, [selectedCity, cities]);

  const handleSelectCity = useCallback(
    (city: any) => {
      if ((window as any).__flyToCity) {
        (window as any).__flyToCity(city);
      } else {
        selectCity(city);
      }
    },
    [selectCity]
  );

  const handleShare = useCallback(async () => {
    const title = selectedCity
      ? `${selectedCity.city}, ${countryName(selectedCity.country)} — Global Radio`
      : 'Global Radio Explorer';
    try {
      if (navigator.share) {
        await navigator.share({ title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch {
      // User cancelled or sharing unsupported
    }
  }, [selectedCity]);

  return (
    <div className="flex flex-col w-full h-full rounded-t-lg overflow-hidden">
      {selectedCity ? (
        <>
          {/* Handle + Banner — when collapsed, this block slides down to sit on top of the player */}
          <div className={drawerOpen ? 'shrink-0 rounded-t-lg' : 'mt-auto shrink-0 rounded-t-lg'} style={{ background: '#6a626259' }}>
            {/* Handle — always visible; clicking anywhere in this strip toggles */}
            <div className="flex items-center justify-center" style={{ height: 40, cursor: 'pointer' }} onClick={handleToggleDrawer}>
              <button
                aria-label={drawerOpen ? 'Collapse drawer' : 'Open drawer'}
                title={drawerOpen ? 'Collapse' : 'Expand'}
                className="flex items-center justify-center rounded-full transition-colors bg-transparent hover:bg-white/10"
                style={{ width: 36, height: 18, cursor: 'pointer', border: 'none', padding: 0 }}
              >
                <div className="rounded-full" style={{ width: 36, height: 5, background: 'rgba(255,255,255,0.75)' }} />
              </button>
            </div>

            {/* City banner — always visible; clicking toggles collapse/expand (radio.garden behavior) */}
            <div
              className="flex items-end gap-3 px-5 pb-2"
              onClick={handleToggleDrawer}
              style={{ cursor: 'pointer' }}
            >
              <div
                className="flex items-center justify-center shrink-0 rounded-full"
                style={{ width: 34, height: 34, background: '#ffffff' }}
              >
                <span className="leading-none" style={{ fontSize: 20, color: '#191919', fontWeight: 400 }}>
                  {selectedCity.stationCount}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate leading-tight text-white font-normal" style={{ fontSize: 24.5, lineHeight: 1.3 }} dir="auto">
                  {selectedCity.city}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="text-white" style={{ fontSize: 15.4 }}>{countryName(selectedCity.country)}</span>
                  {localTime && <span className="text-white" style={{ fontSize: 15.4 }}>{localTime}</span>}
                </div>
              </div>
              <div className="flex items-center shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <GIconButton onClick={() => void handleShare()} label="Share" title="Share">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15.97 16.615V5m-5.267 4.459L15.97 5l5.33 4.459m-1.774 3.173H23.5V26h-15V12.632h3.933" />
                  </svg>
                </GIconButton>
                <GIconButton onClick={() => onOpenCityChat(selectedCity)} label={`Chat about ${selectedCity.city}`} title={`Chat about ${selectedCity.city}`}>
                  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M26 13.5a9.5 9.5 0 0 1-9.5 9.5 9.4 9.4 0 0 1-4.3-1L6 24l2-5.6a9.4 9.4 0 0 1-1.5-4.9A9.5 9.5 0 0 1 16 4a9.5 9.5 0 0 1 10 9.5z" />
                  </svg>
                </GIconButton>
              </div>
            </div>

            {/* Listener count — inside banner block, at the bottom */}
            {counts.cityCount > 0 && (
              <div className="shrink-0 px-5 pb-2 text-[12px]" style={{ color: 'var(--gr-accent)' }}>
                {counts.cityCount} listening now
              </div>
            )}
          </div>

          {/* Sections — collapse together when minimized */}
          {drawerOpen && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Scrollable sections */}
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                style={{ background: 'rgb(25 25 25 / 57%)' }}
              >
                {stations.length > 0 && (
                  <>
                    <GSectionTitle>Stations in {selectedCity.city}</GSectionTitle>
                    {stations.map((station, i) => (
                      <GStationRow
                        key={`${station.url}-${i}`}
                        station={station}
                        isCurrent={currentStation?.url === station.url}
                        onPlay={() => playStation(station)}
                        onToggleFavorite={() => toggleFavoriteAction(station, selectedCity)}
                      />
                    ))}
                  </>
                )}
                {loadingStations && (
                  <div className="p-5 text-center text-white/50 text-[13px]">Loading stations…</div>
                )}
                {!loadingStations && stations.length === 0 && (
                  <div className="p-5 text-center text-white/50 text-[13px]">No stations available</div>
                )}

                {nearby.length > 0 && (
                  <>
                    <GSectionTitle>Nearby {selectedCity.city}</GSectionTitle>
                    {nearby.map((c) => (
                      <GCityRow
                        key={c.cityId}
                        title={c.city}
                        right={`${Math.round(c.distanceKm)} km`}
                        onClick={() => handleSelectCity(c)}
                      />
                    ))}
                  </>
                )}

                {countryCities.length > 0 && (
                  <>
                    <GSectionTitle>Cities in {countryName(selectedCity.country)}</GSectionTitle>
                    {countryCities.map((c) => (
                      <GCityRow key={c.cityId} title={c.city} count={c.stationCount} onClick={() => handleSelectCity(c)} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Desktop now playing bar — pinned to bottom, never moves */}
          {currentStation && (
            <PlayerBar
              currentStation={currentStation}
              selectedCity={selectedCity}
              audioStatus={audioStatus}
              isPlaying={isPlaying}
              playStation={playStation}
              stations={stations}
              togglePlayback={togglePlayback}
              volume={volume}
              onVolumeChange={onVolumeChange}
              sonosActive={sonosActive}
              sonosName={sonosName}
              castActive={castActive}
              castName={castName}
              isCurrentFavorite={currentFav}
              onToggleFavorite={() => toggleFavoriteAction(currentStation, selectedCity)}
              onOpenStationChat={onOpenStationChat}
              onShareStation={onShareStation}
            />
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-2 text-center text-white/40 text-sm">
          Click a green dot on the globe to explore radio stations
        </div>
      )}
    </div>
  );
}

/* ===== radio.garden-style helpers ===== */
function GSectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="pt-[22px] pb-1 text-[20px] font-normal text-white">{children}</div>;
}

function GStationRow({
  station, isCurrent, onPlay, onToggleFavorite,
}: {
  station: Station;
  isCurrent: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className="flex items-center transition-colors hover:bg-[#494949]"
      style={{ height: 38 }}
    >
      <button
        onClick={onPlay}
        className="flex-1 min-w-0 h-full flex items-center px-5 text-left"
        style={{
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          padding: 0,
          color: isCurrent ? 'var(--gr-accent)' : '#ffffff',
          fontSize: 15.4,
          fontWeight: 400,
        }}
        aria-label={`Play ${station.name}`}
      >
        <span className="truncate" dir="auto">{station.name}</span>
      </button>
      {isCurrent && (
        <div className="pr-2.5">
          <FavoriteHeart url={station.url} onToggle={onToggleFavorite} size={15} />
        </div>
      )}
    </div>
  );
}

function GCityRow({
  title, count, right, onClick,
}: {
  title: string;
  count?: number;
  right?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-5 text-left transition-colors hover:bg-[#494949]"
      style={{ height: 38, cursor: 'pointer', border: 'none', background: 'transparent' }}
    >
      {typeof count === 'number' && (
        <span
          className="flex items-center justify-center rounded-full shrink-0 mr-3"
          style={{ width: 28, height: 28, background: 'var(--gr-accent)', color: '#2b2b2b', fontSize: 13.8 }}
        >
          {count}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-white" style={{ fontSize: 15.4, fontWeight: 400 }} dir="auto">
        {title}
      </span>
      {right && (
        <span className="shrink-0 text-white" style={{ fontSize: 12.25 }}>{right}</span>
      )}
    </button>
  );
}

function GIconButton({
  onClick, label, title, children,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title || label}
      className="flex items-center justify-center shrink-0 transition-colors bg-transparent hover:bg-white/10"
      style={{ width: 40, height: 40, cursor: 'pointer', border: 'none', padding: 0 }}
    >
      {children}
    </button>
  );
}

/* ===== Desktop player bar (radio.garden-style) ===== */
function PlayerBar({
  currentStation, selectedCity, audioStatus, isPlaying,
  playStation, stations, togglePlayback, volume, onVolumeChange,
  sonosActive, sonosName, castActive, castName,
  isCurrentFavorite, onToggleFavorite, onOpenStationChat, onShareStation,
}: {
  currentStation: Station;
  selectedCity: any;
  audioStatus: string;
  isPlaying: boolean;
  playStation: (s: Station) => void;
  stations: Station[];
  togglePlayback: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  sonosActive: boolean;
  sonosName: string | null;
  castActive: boolean;
  castName: string | null;
  isCurrentFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenStationChat: (station: Station) => void;
  onShareStation: (station: Station) => void;
}) {
  const handleSkip = (dir: 1 | -1) => {
    if (stations.length === 0) return;
    const idx = stations.findIndex((s) => s.url === currentStation.url);
    const next = idx === -1 ? 0 : (idx + dir + stations.length) % stations.length;
    playStation(stations[next]);
  };

  return (
    <div className="flex flex-col shrink-0" style={{ background: '#191919', height: 100 }}>
      <div className="flex items-center" style={{ height: 50 }}>
        <div className="min-w-0 flex-1 pl-4">
          <div className="truncate leading-tight" style={{ color: 'var(--gr-accent)', fontSize: 15.4, fontWeight: 400 }} dir="auto">
            {currentStation.name}
          </div>
          <div className="truncate" style={{ color: '#ffffff', fontSize: 10.5, fontWeight: 400 }}>
            {selectedCity?.city}, {countryName(selectedCity?.country ?? '')}
            {sonosActive && <span style={{ color: 'var(--gr-accent)', marginLeft: 6 }}>· {sonosName}</span>}
            {castActive && <span style={{ color: 'var(--gr-accent)', marginLeft: 6 }}>· {castName}</span>}
            {!sonosActive && !castActive && audioStatus === 'offline' && <span style={{ color: 'var(--gr-danger)', marginLeft: 6 }}>(Offline)</span>}
            {!sonosActive && !castActive && audioStatus === 'loading' && isPlaying && <span style={{ color: 'var(--gr-warning)', marginLeft: 6 }}>(Loading...)</span>}
          </div>
        </div>
        <OutputButton size={22} station={currentStation} city={selectedCity} />
        <button
          onClick={onToggleFavorite}
          aria-label="Add to favorites"
          title={isCurrentFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className="flex items-center justify-center shrink-0 transition-colors bg-transparent hover:bg-[#494949]"
          style={{ width: 50, height: 50, cursor: 'pointer', border: 'none', padding: 0 }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill={isCurrentFavorite ? 'var(--gr-accent)' : 'none'} stroke="var(--gr-accent)" strokeWidth="1.8">
            <path d="M11.198 9C8.85 9 7 10.89 7 13.29c0 3.128 1.92 5.82 9 11.71 7.08-5.89 9-8.582 9-11.71C25 10.89 23.15 9 20.802 9c-2.098 0-3.237 1.273-4.126 2.327l-.676.8-.676-.8C14.434 10.31 13.296 9 11.197 9h0z" />
          </svg>
        </button>
        <button
          onClick={() => onOpenStationChat(currentStation)}
          aria-label={`Chat about ${currentStation.name}`}
          title={`Chat about ${currentStation.name}`}
          className="flex items-center justify-center shrink-0 transition-colors bg-transparent hover:bg-[#494949]"
          style={{ width: 50, height: 50, cursor: 'pointer', border: 'none', padding: 0 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
        <button
          onClick={() => onShareStation(currentStation)}
          aria-label={`Share ${currentStation.name}`}
          title="Share station"
          className="flex items-center justify-center shrink-0 transition-colors bg-transparent hover:bg-[#494949]"
          style={{ width: 50, height: 50, cursor: 'pointer', border: 'none', padding: 0 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>
      <div className="flex items-center" style={{ height: 50 }}>
        <MediaButton onClick={() => handleSkip(-1)} label="previous">
          <svg width="50" height="50" fill="#ffffff">
            <path d="M37.66 18.718v12.56a1.003 1.003 0 0 1-1.5.87l-10.52-6.02v5.08c0 .55-.45 1-1 1H24c-.55 0-1-.45-1-1v-12.38c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1v5.04l10.52-6.01c.48-.28 1.09-.11 1.37.37.08.15.13.32.13.49" />
          </svg>
        </MediaButton>
        <MediaButton onClick={togglePlayback} label={isPlaying ? 'pause' : 'play'}>
          {isPlaying ? (
            <svg width="50" height="50" fill="#ffffff">
              <rect width="18" height="18" x="16" y="16" rx="1" />
            </svg>
          ) : (
            <svg width="50" height="50" fill="#ffffff">
              <path d="M35.6613092,25.8454889 L19.533993,36.0311623 C19.0670424,36.3260785 18.4494273,36.186617 18.1545111,35.7196664 C18.0535739,35.5598493 18,35.3746968 18,35.1856734 L18,14.8143266 C18,14.2620418 18.4477153,13.8143266 19,13.8143266 C19.1890234,13.8143266 19.3741758,13.8679005 19.533993,13.9688377 L35.6613092,24.1545111 C36.1282599,24.4494273 36.2677213,25.0670424 35.9728051,25.533993 C35.8934185,25.6596886 35.7870048,25.7661022 35.6613092,25.8454889 Z" />
            </svg>
          )}
        </MediaButton>
        <MediaButton onClick={() => handleSkip(1)} label="next">
          <svg width="50" height="50" fill="#ffffff">
            <path d="M27.66 18.79v12.38c0 .55-.45 1-1 1h-.64c-.55 0-1-.45-1-1v-5.04L14.5 32.15c-.48.27-1.09.1-1.37-.38-.08-.15-.13-.32-.13-.49V18.72c0-.55.45-1 1-1 .17 0 .35.05.5.14l10.52 6.01v-5.08c0-.55.45-1 1-1h.64c.55 0 1 .45 1 1" />
          </svg>
        </MediaButton>

        {/* Volume control (radio.garden-style: white track + green fill + thumb dot) */}
        <div className="flex items-center justify-center shrink-0" style={{ flex: 1, height: 50, marginRight: 4, minWidth: 120 }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="rgba(255,255,255,0.85)">
            <polygon points="28 8 21.714 12.645 17 12.645 17 19.355 21.189 19.355 28 24" />
          </svg>
          <div
            className="relative flex items-center"
            style={{ flex: 1, height: 50, margin: '0 8px', cursor: 'pointer' }}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              onVolumeChange(pct);
            }}
            onPointerMove={(e) => {
              if ((e.buttons & 1) === 1) {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                onVolumeChange(pct);
              }
            }}
          >
            <div className="absolute" style={{ left: 0, right: 0, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
            <div className="absolute" style={{ left: 0, width: `${Math.round(volume * 100)}%`, height: 2, borderRadius: 1, background: 'var(--gr-accent)', pointerEvents: 'none' }} />
            <div className="absolute rounded-full" style={{ left: `calc(${Math.round(volume * 100)}% - 5px)`, top: '50%', width: 10, height: 10, background: '#ffffff', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Set Volume"
              className="absolute inset-0"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                margin: 0,
                width: '100%',
                height: '100%',
                background: 'transparent',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 1,
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
            />
          </div>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="rgba(255,255,255,0.85)">
            <path d="M24.3923492,5.30137405 C24.1785189,5.02237829 23.7037764,4.8898803 23.4345267,5.11137694 C23.1657675,5.33237358 23.0205983,5.82336613 23.2339382,6.10236189 C25.4178519,8.94981864 26.5723394,12.3807665 26.5723394,16.0242112 C26.5723394,19.6681558 25.4178519,23.0991037 23.2339382,25.9465605 C23.0205983,26.2255562 23.1657675,26.7165488 23.4345267,26.9375454 C23.5492889,27.031544 23.768514,26.9915446 23.9038744,26.9915446 C24.0872977,26.9915446 24.2697401,26.9080459 24.3923492,26.7475483 C26.7523296,23.669595 28,19.9616514 28,16.0242112 C28,12.087271 26.7523296,8.3793273 24.3923492,5.30137405 M20.9700834,8.2738289 C20.7567435,7.99933307 20.3065228,7.9053345 20.0421775,8.12883111 C19.7793036,8.35182772 19.5757724,8.80632081 19.7891123,9.08031665 C21.3065228,11.031287 22.1417361,13.4922496 22.1417361,16.0087114 C22.1417361,18.5256732 21.3065228,20.9861358 19.7891123,22.9371062 C19.5757724,23.211102 19.7631192,23.6655951 20.0259931,23.8885917 C20.1397744,23.9850903 20.3580186,23.9800903 20.4933791,23.9800903 C20.6723884,23.9800903 20.8489456,23.8995916 20.9700834,23.7435939 C22.6635606,21.565127 23.5963708,18.8186687 23.5963708,16.0087114 C23.5963708,13.1992541 22.6635606,10.4522958 20.9700834,8.2738289 M16.4914174,11.1272856 C16.223639,11.3512822 16.0225601,11.7457762 16.250613,12.0082722 C17.2182442,13.1232552 17.7508583,14.5437337 17.7508583,16.0082114 C17.7508583,17.4731892 17.2182442,18.8936676 16.250613,20.0081507 C16.0225601,20.2706467 16.223639,20.6656407 16.4914174,20.8891373 C16.6110839,20.9896358 16.7582148,21.039135 16.903384,21.039135 C17.0833742,21.039135 17.2618931,20.9641361 17.3879353,20.8196383 C18.5512506,19.4791587 19.1922511,17.7701847 19.1922511,16.0082114 C19.1922511,14.2462382 18.5512506,12.5377641 17.3879353,11.1972845 C17.1603727,10.9347885 16.7587052,10.902289 16.4914174,11.1272856 M12.8916135,8.68382268 L7.23001471,13.0122569 L3,13.0122569 L3,19.5121582 L7.03138794,19.5121582 L12.8916135,23.9930901 C13.1074056,24.1580876 13.2839627,24.068089 13.2839627,23.7930932 L13.2839627,8.88381964 C13.1074056,8.60882381 13.2839627,8.51882518 12.8916135,8.68382268" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function MediaButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center transition-colors bg-transparent hover:bg-[#494949]"
      style={{ width: 50, height: 50, cursor: 'pointer', border: 'none', padding: 0 }}
    >
      {children}
    </button>
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ===== Mobile now playing bar ===== */
function MobileNowPlaying({
  currentStation, selectedCity, audioStatus, isPlaying,
  playStation, stations, togglePlayback, sonosActive, sonosName, castActive, castName,
  volume, onVolumeChange, onOpenStationChat, onShareStation,
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
  castActive: boolean;
  castName: string | null;
  volume: number;
  onVolumeChange: (v: number) => void;
  onOpenStationChat: (station: Station) => void;
  onShareStation: (station: Station) => void;
}) {
  const toggleFavoriteAction = useFavoriteAction();
  return (
    <div
      className="shrink-0 rounded-t-lg overflow-hidden pointer-events-auto"
      style={{ background: '#191919', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] truncate" style={{ color: 'var(--gr-accent)' }} dir="auto">
            {currentStation.name}
          </div>
          <div className="text-[11px] text-white/50 truncate">
            {selectedCity?.city}, {selectedCity?.country}
            {sonosActive && <span style={{ color: 'var(--gr-accent)', marginLeft: 4 }}>Playing on {sonosName}</span>}
            {castActive && <span style={{ color: 'var(--gr-accent)', marginLeft: 4 }}>Playing on {castName}</span>}
            {!sonosActive && !castActive && audioStatus === 'offline' && <span style={{ color: 'var(--gr-danger)', marginLeft: 4 }}>(Offline)</span>}
            {!sonosActive && !castActive && audioStatus === 'loading' && isPlaying && <span style={{ color: 'var(--gr-warning)', marginLeft: 4 }}>(Loading...)</span>}
          </div>
        </div>
        <FavoriteHeart
          url={currentStation.url}
          onToggle={() => toggleFavoriteAction(currentStation, selectedCity)}
          size={20}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onShareStation(currentStation); }}
          aria-label={`Share ${currentStation.name}`}
          title="Share station"
          className="flex items-center justify-center shrink-0 rounded-full bg-transparent hover:bg-white/10 transition-colors"
          style={{ width: 32, height: 32, cursor: 'pointer', border: 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenStationChat(currentStation); }}
          aria-label={`Chat about ${currentStation.name}`}
          title={`Chat about ${currentStation.name}`}
          className="flex items-center justify-center shrink-0 rounded-full bg-transparent hover:bg-white/10 transition-colors"
          style={{ width: 32, height: 32, cursor: 'pointer', border: 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
        <OutputButton size={15} station={currentStation} city={selectedCity} />
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

      {/* Volume control */}
      <div className="flex items-center px-3 pb-2 gap-2" style={{ height: 28 }}>
        <svg width="16" height="16" viewBox="0 0 32 32" fill="rgba(255,255,255,0.85)">
          <polygon points="28 8 21.714 12.645 17 12.645 17 19.355 21.189 19.355 28 24" />
        </svg>
        <div
          className="relative flex items-center"
          style={{ flex: 1, height: 28, cursor: 'pointer' }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            onVolumeChange(pct);
          }}
          onPointerMove={(e) => {
            if ((e.buttons & 1) === 1) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              onVolumeChange(pct);
            }
          }}
        >
          <div className="absolute" style={{ left: 0, right: 0, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
          <div className="absolute" style={{ left: 0, width: `${Math.round(volume * 100)}%`, height: 2, borderRadius: 1, background: 'var(--gr-accent)', pointerEvents: 'none' }} />
          <div className="absolute rounded-full" style={{ left: `calc(${Math.round(volume * 100)}% - 5px)`, top: '50%', width: 10, height: 10, background: '#ffffff', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Set Volume"
            className="absolute inset-0"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              margin: 0,
              width: '100%',
              height: '100%',
              background: 'transparent',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 1,
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          />
        </div>
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

  return (
    <div
      className="shrink-0 rounded-t-lg overflow-hidden flex flex-col"
      style={{
        maxHeight: drawerOpen ? 'calc(100% - 24px)' : 72,
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
                    <span className="text-[12px] font-bold" style={{ color: 'var(--gr-accent)' }}>{selectedCity.stationCount}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-[20px] font-normal text-white leading-tight truncate">{selectedCity.city}</h1>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[13px] text-white/80">{selectedCity.country}</h2>
                      {localTime && <span className="text-[11px] text-white/40">{localTime}</span>}
                      {counts.cityCount > 0 && (
                        <span className="text-[11px] font-medium" style={{ color: 'var(--gr-accent)' }}>
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
      className="flex items-center justify-center shrink-0 rounded-full bg-transparent hover:bg-white/10 transition-colors"
      style={{ width: size + 12, height: size + 12, cursor: 'pointer', border: 'none' }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill={active ? 'var(--gr-accent)' : 'none'} stroke={active ? 'var(--gr-accent)' : 'rgba(255,255,255,0.55)'} strokeWidth="2">
        <path d="M10.4 7.5C7.66 7.5 5.5 9.63 5.5 12.33c0 3.52 2.24 6.55 10.5 13.17 8.26-6.63 10.5-9.66 10.5-13.17 0-2.7-2.16-4.83-4.9-4.83-2.45 0-3.78 1.43-4.81 2.62l-.79.9-.79-.9C14.17 8.97 12.85 7.5 10.4 7.5z" />
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
        background: isCurrent ? 'rgba(var(--gr-accent-rgb),0.15)' : 'transparent',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <button
        onClick={onPlay}
        className="flex-1 min-w-0 text-left"
        style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
        aria-label={`Play ${station.name}`}
      >
        <div className="text-[14px] truncate" style={{ color: isCurrent ? 'var(--gr-accent)' : 'white' }} dir="auto">
          {station.name}
        </div>
      </button>
      {typeof count === 'number' && count > 0 && (
        <span
          className="flex items-center justify-center rounded-full text-[11px] font-bold shrink-0"
          style={{ minWidth: 22, height: 20, padding: '0 7px', background: 'rgba(var(--gr-accent-rgb),0.15)', color: 'var(--gr-accent)' }}
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
        background: 'rgba(var(--gr-accent-rgb),0.12)',
        border: '1px solid rgba(var(--gr-accent-rgb),0.35)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2">
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
