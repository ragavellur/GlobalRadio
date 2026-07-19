import type { CityData, Station } from '../types';

const DATA_BASE = '/data';

export async function loadCityStations(countryId: number): Promise<CityData[]> {
  const response = await fetch(`${DATA_BASE}/stations/${countryId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load stations for country ${countryId}`);
  }
  return response.json();
}

export async function findStationsForCity(
  countryId: number,
  cityName: string
): Promise<Station[]> {
  const allCityData = await loadCityStations(countryId);
  const cityData = allCityData.find(
    (cd) => cd.city.toLowerCase() === cityName.toLowerCase()
  );
  return cityData?.stations || [];
}

export function filterValidStations(stations: Station[]): Station[] {
  return stations.filter(
    (s) => s.url && s.url.startsWith('http') && s.lastCheckOK !== false
  );
}

export function sortStations(stations: Station[]): Station[] {
  return [...stations].sort((a, b) => {
    if (a.lastCheckOK && !b.lastCheckOK) return -1;
    if (!a.lastCheckOK && b.lastCheckOK) return 1;
    return (b.votes || 0) - (a.votes || 0);
  });
}
