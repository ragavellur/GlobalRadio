import type { Station } from '../types';

const DATA_BASE = '/data';

type RawStation = [string, string];
type StationFile = Record<string, RawStation[]>;

export async function findStationsForCity(
  countryCode: string,
  cityName: string
): Promise<Station[]> {
  const response = await fetch(`${DATA_BASE}/stations/${countryCode.toLowerCase()}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load stations for country ${countryCode}`);
  }
  const data: StationFile = await response.json();

  // Find the key that matches the city name (format: "CityName,CC")
  const key = Object.keys(data).find((k) => {
    const parts = k.split(',');
    return parts[0].toLowerCase() === cityName.toLowerCase();
  });

  if (!key) return [];

  return data[key].map(([name, url]) => ({
    name,
    url,
    lastCheckOK: true,
  }));
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
