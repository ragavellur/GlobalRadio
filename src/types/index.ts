export interface City {
  country: string;
  city: string;
  lat: number;
  lon: number;
  stationCount: number;
  countryId: number;
  cityId: number;
}

export interface Station {
  name: string;
  url: string;
  codec?: string;
  bitrate?: number;
  votes?: number;
  lastCheckOK?: boolean;
}

export interface CityData {
  city: string;
  country: string;
  stations: Station[];
  coords: {
    lat: number;
    lon: number;
  };
}

export interface Viewport {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface RadioState {
  cities: City[];
  indexLoaded: boolean;
  selectedCity: City | null;
  currentStation: Station | null;
  isPlaying: boolean;
  audioVolume: number;
  searchQuery: string;
  searchResults: City[];
  sidebarOpen: boolean;
  sidebarTab: 'search' | 'browse' | 'station';
}

export type TabName = 'search' | 'browse' | 'station';
