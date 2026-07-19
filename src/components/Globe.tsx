import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadioStore } from '../lib/store';
import { buildSpatialIndex, findNearestCityFromPoint } from '../lib/spatialIndex';
import { addDotLayer } from '../lib/dotRenderer';
import { initSearch } from '../lib/search';
import { transformCities } from '../lib/transform';
import type { City } from '../types';

export default function Globe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const citiesRef = useRef<City[]>([]);
  const { setCities, setIndexLoaded, selectCity } = useRadioStore();

  const handleCityClick = useCallback((city: City) => {
    if (!city || !mapRef.current) return;
    selectCity(city);
    mapRef.current.flyTo({
      center: [city.lon, city.lat],
      zoom: 5,
      pitch: 45,
      bearing: Math.random() * 30 - 15,
      duration: 2000,
    });
  }, [selectCity]);

  useEffect(() => {
    if (!mapContainer.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'bg',
            type: 'background',
            paint: { 'background-color': '#191919' },
          },
        ],
      },
      center: [0, 20],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
    });
    mapRef.current = m;
    (window as any).__map = m;

    m.on('load', () => {
      try { m.setProjection({ type: 'globe' }); } catch {}
      loadCityIndex(m);
    });

    m.on('click', (e: maplibregl.MapMouseEvent) => {
      const city = findNearestCityFromPoint(e.point.x, e.point.y, m, citiesRef.current, 10);
      if (city) handleCityClick(city);
    });

    return () => { m.remove(); mapRef.current = null; };
  }, []);

  const loadCityIndex = async (m: maplibregl.Map) => {
    try {
      const response = await fetch('/data/index.json');
      if (!response.ok) throw new Error('Failed to load index');
      const rawData = await response.json();
      const data = transformCities(rawData);
      citiesRef.current = data;
      setCities(data);
      buildSpatialIndex(data);
      initSearch(data);
      setIndexLoaded(true);

      addDotLayer(m, data);
    } catch (err) {
      console.error('Failed to load city index:', err);
    }
  };

  return (
    <div
      ref={mapContainer}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#191919' }}
    />
  );
}
