import { useState, useCallback, createContext, useContext } from 'react';
import type { City, Station, RadioState } from '../types';

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
    searchQuery: '',
    searchResults: [],
    sidebarOpen: false,
    sidebarTab: 'search',
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
