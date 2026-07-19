import { useEffect, useState } from 'react';
import type { City, Station, CityData } from '../types';

const DATA_BASE = '/data';

export function useCityIndex() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadIndex() {
      try {
        const response = await fetch(`${DATA_BASE}/index.json`);
        if (!response.ok) {
          throw new Error(`Failed to load index: ${response.status}`);
        }
        const data: City[] = await response.json();
        setCities(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load city index');
        setLoading(false);
      }
    }

    loadIndex();
  }, []);

  return { cities, loading, error };
}

export function useCityStations(countryId: number | null) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countryId === null) {
      setStations([]);
      return;
    }

    async function loadStations() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${DATA_BASE}/stations/${countryId}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load stations: ${response.status}`);
        }
        const data: CityData[] = await response.json();
        // Flatten all stations from all cities in this country
        const allStations = data.flatMap((city) => city.stations);
        setStations(allStations);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stations');
        setLoading(false);
      }
    }

    loadStations();
  }, [countryId]);

  return { stations, loading, error };
}
