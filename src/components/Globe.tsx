import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadioStore } from '../lib/store';
import { buildSpatialIndex, findNearestCityFromPoint } from '../lib/spatialIndex';
import { addDotLayer, highlightCity } from '../lib/dotRenderer';
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
    highlightCity(mapRef.current, city.cityId);
    mapRef.current.flyTo({
      center: [city.lon, city.lat],
      zoom: 7,
      pitch: 45,
      bearing: Math.random() * 30 - 15,
      duration: 2000,
    });
  }, [selectCity]);

  useEffect(() => {
    if (!mapContainer.current) return;

    const origWarn = console.warn;
    const origError = console.error;
    const suppressCheck = (...args: any[]) => {
      return typeof args[0] === 'string' && args[0].includes('READ-usage buffer');
    };
    console.warn = (...args: any[]) => { if (!suppressCheck(...args)) origWarn.apply(console, args); };
    console.error = (...args: any[]) => { if (!suppressCheck(...args)) origError.apply(console, args); };

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics',
          },
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-brightness-max': 0.65,
              'raster-contrast': 0.1,
              'raster-saturation': -0.2,
            },
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

    (window as any).__flyToCity = (city: City) => {
      handleCityClick(city);
    };

    return () => {
      console.warn = origWarn;
      console.error = origError;
      m.remove();
      mapRef.current = null;
      delete (window as any).__flyToCity;
    };
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
      style={{ background: '#000' }}
    />
  );
}
