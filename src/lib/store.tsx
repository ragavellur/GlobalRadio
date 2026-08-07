import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import type { City, Station, SocialRoom, RadioState, SonosSession, CastSession } from '../types';
import { loadThemeId, getTheme, applyThemeVars, THEME_KEY, DEFAULT_THEME_ID } from './themes';

interface RadioStore extends RadioState {
  setCities: (cities: City[]) => void;
  setIndexLoaded: (loaded: boolean) => void;
  selectCity: (city: City | null) => void;
  playStation: (station: Station) => void;
  pausePlayback: () => void;
  stopPlayback: () => void;
  setVolume: (volume: number) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: City[]) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: 'search' | 'browse' | 'station') => void;
  setDrawerOpen: (open: boolean) => void;
  setPendingStationUrl: (url: string | null) => void;
  openSocial: () => void;
  openSocialRoom: (room: SocialRoom) => void;
  closeSocial: () => void;
  setSonosSession: (session: SonosSession | null) => void;
  setCastSession: (session: CastSession | null) => void;
  setStationSilent: (station: Station) => void;
  setTheme: (themeId: string) => void;
}

const RadioContext = createContext<RadioStore | null>(null);

export function RadioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RadioState>({
    cities: [],
    indexLoaded: false,
    selectedCity: null,
    currentStation: null,
    isPlaying: false,
    audioVolume: 0.8,
    themeId: loadThemeId(),
    searchQuery: '',
    searchResults: [],
    sidebarOpen: false,
    sidebarTab: 'search',
    drawerOpen: true,
    pendingStationUrl: null,
    socialOpen: false,
    socialRoom: null,
    sonosSession: null,
    castSession: null,
  });

  const setCities = useCallback((cities: City[]) => {
    setState((prev) => ({ ...prev, cities }));
  }, []);

  const setIndexLoaded = useCallback((loaded: boolean) => {
    setState((prev) => ({ ...prev, indexLoaded: loaded }));
  }, []);

  const selectCity = useCallback((city: City | null) => {
    setState((prev) => ({ ...prev, selectedCity: city }));
  }, []);

  const playStation = useCallback((station: Station) => {
    setState((prev) => ({ ...prev, currentStation: station, isPlaying: true }));
  }, []);

  const stopPlayback = useCallback(() => {
    setState((prev) => ({ ...prev, currentStation: null, isPlaying: false }));
  }, []);

  const pausePlayback = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, audioVolume: volume }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setSearchResults = useCallback((results: City[]) => {
    setState((prev) => ({ ...prev, searchResults: results }));
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, sidebarOpen: open }));
  }, []);

  const setSidebarTab = useCallback((tab: 'search' | 'browse' | 'station') => {
    setState((prev) => ({ ...prev, sidebarTab: tab }));
  }, []);

  const setDrawerOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, drawerOpen: open }));
  }, []);

  const setPendingStationUrl = useCallback((url: string | null) => {
    setState((prev) => ({ ...prev, pendingStationUrl: url }));
  }, []);

  const openSocial = useCallback(() => {
    setState((prev) => ({ ...prev, socialOpen: true, socialRoom: null }));
  }, []);

  const openSocialRoom = useCallback((room: SocialRoom) => {
    setState((prev) => ({ ...prev, socialOpen: true, socialRoom: room }));
  }, []);

  const closeSocial = useCallback(() => {
    setState((prev) => ({ ...prev, socialOpen: false, socialRoom: null }));
  }, []);

  const setSonosSession = useCallback((session: SonosSession | null) => {
    setState((prev) => ({ ...prev, sonosSession: session }));
  }, []);

  const setCastSession = useCallback((session: CastSession | null) => {
    setState((prev) => ({ ...prev, castSession: session }));
  }, []);

  const setStationSilent = useCallback((station: Station) => {
    setState((prev) => ({ ...prev, currentStation: station, isPlaying: false }));
  }, []);

  const setTheme = useCallback((themeId: string) => {
    setState((prev) => ({ ...prev, themeId }));
  }, []);

  useEffect(() => {
    const theme = getTheme(state.themeId) ?? getTheme(DEFAULT_THEME_ID)!;
    applyThemeVars(theme);
    try {
      localStorage.setItem(THEME_KEY, state.themeId);
    } catch {}
  }, [state.themeId]);

  return (
    <RadioContext.Provider
      value={{
        ...state,
        setCities,
        setIndexLoaded,
        selectCity,
        playStation,
        pausePlayback,
        stopPlayback,
        setVolume,
        setSearchQuery,
        setSearchResults,
        setSidebarOpen,
        setSidebarTab,
        setDrawerOpen,
        setPendingStationUrl,
        openSocial,
        openSocialRoom,
        closeSocial,
        setSonosSession,
        setCastSession,
        setStationSilent,
        setTheme,
      }}
    >
      {children}
    </RadioContext.Provider>
  );
}

export function useRadioStore() {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error('useRadioStore must be used within a RadioProvider');
  }
  return context;
}
