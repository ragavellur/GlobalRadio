import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadioStore } from '../lib/store';
import { buildSpatialIndex, findNearestCityFromPoint, findNearestCity } from '../lib/spatialIndex';
import { addDotLayer, highlightCity } from '../lib/dotRenderer';
import { initSearch } from '../lib/search';
import { transformCities } from '../lib/transform';
import type { City } from '../types';

export default function Globe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const citiesRef = useRef<City[]>([]);
  const rotationRef = useRef<number | null>(null);
  const rotationActiveRef = useRef(false);
  const { setCities, setIndexLoaded, selectCity } = useRadioStore();

  const handleCityClick = useCallback((city: City) => {
    if (!city || !mapRef.current) return;

    rotationActiveRef.current = false;
    if (rotationRef.current) {
      cancelAnimationFrame(rotationRef.current);
      rotationRef.current = null;
    }

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

    const stopRotation = () => {
      rotationActiveRef.current = false;
      if (rotationRef.current) {
        cancelAnimationFrame(rotationRef.current);
        rotationRef.current = null;
      }
    };

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
      center: [78, 20],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
    });
    mapRef.current = m;
    (window as any).__map = m;

    m.on('mousedown', stopRotation);
    m.on('touchstart', stopRotation);
    m.on('dragstart', stopRotation);

    m.on('load', () => {
      try { m.setProjection({ type: 'globe' }); } catch {}
      loadCityIndex(m);

      setTimeout(() => {
        rotationActiveRef.current = true;
        const rotate = () => {
          if (!rotationActiveRef.current || !mapRef.current) return;
          const c = mapRef.current.getCenter();
          c.lng -= 0.02;
          mapRef.current.setCenter(c);
          rotationRef.current = requestAnimationFrame(rotate);
        };
        rotationRef.current = requestAnimationFrame(rotate);
      }, 5000);
    });

    m.on('click', (e: maplibregl.MapMouseEvent) => {
      const city = findNearestCityFromPoint(e.point.x, e.point.y, m, citiesRef.current, 10);
      if (city) handleCityClick(city);
    });

    (window as any).__flyToCity = (city: City) => {
      handleCityClick(city);
    };

    (window as any).__playNearestCity = () => {
      stopRotation();

      if (citiesRef.current.length === 0) return;

      const flyToCity = (city: City) => {
        handleCityClick(city);
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const city = findNearestCity(longitude, latitude, 500);
            if (city) {
              flyToCity(city);
            } else {
              const fallback = findNearestCity(73.8567, 18.5204, 500);
              if (fallback) flyToCity(fallback);
            }
          },
          () => {
            const fallback = findNearestCity(73.8567, 18.5204, 500);
            if (fallback) flyToCity(fallback);
          },
          { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
        );
      } else {
        const fallback = findNearestCity(73.8567, 18.5204, 500);
        if (fallback) flyToCity(fallback);
      }
    };

    return () => {
      console.warn = origWarn;
      console.error = origError;
      stopRotation();
      m.off('mousedown', stopRotation);
      m.off('touchstart', stopRotation);
      m.off('dragstart', stopRotation);
      m.remove();
      mapRef.current = null;
      delete (window as any).__flyToCity;
      delete (window as any).__playNearestCity;
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
