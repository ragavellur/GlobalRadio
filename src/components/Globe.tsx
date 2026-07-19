import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadioStore } from '../lib/store';
import { buildSpatialIndex, findNearestCityFromPoint } from '../lib/spatialIndex';
import { createDotLayer } from '../lib/dotLayer';
import { initSearch } from '../lib/search';
import { transformCities } from '../lib/transform';
import type { City } from '../types';

export default function Globe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const dotLayerRef = useRef<any>(null);
  const citiesRef = useRef<City[]>([]);
  const { setCities, setIndexLoaded, selectCity, setSidebarOpen, setSidebarTab } = useRadioStore();

  const handleCityClick = useCallback((city: City) => {
    if (!city) return;

    selectCity(city);
    setSidebarOpen(true);
    setSidebarTab('station');

    if (map.current) {
      map.current.flyTo({
        center: [city.lon, city.lat],
        zoom: 5,
        pitch: 45,
        bearing: Math.random() * 30 - 15,
        duration: 2000,
      });
    }
  }, [selectCity, setSidebarOpen, setSidebarTab]);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-raster': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm-raster',
            paint: {
              'raster-brightness-max': 0.15,
              'raster-contrast': 0.3,
              'raster-saturation': -1,
            },
          },
        ],
      },
      center: [0, 20],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
      canvasContextAttributes: { antialias: true },
    });

    map.current.on('load', () => {
      if (!map.current) return;

      try {
        map.current.setProjection({ type: 'globe' });
      } catch (e) {
        console.warn('setProjection failed:', e);
      }

      loadCityIndex();
    });

    map.current.on('click', (e: maplibregl.MapMouseEvent) => {
      const city = findNearestCityFromPoint(
        e.point.x,
        e.point.y,
        map.current,
        citiesRef.current,
        10
      );
      if (city) {
        handleCityClick(city);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const loadCityIndex = async () => {
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

      if (map.current) {
        const dotLayer = createDotLayer(data, handleCityClick);
        dotLayerRef.current = dotLayer;
        map.current.addLayer(dotLayer as any);
      }
    } catch (err) {
      console.error('Failed to load city index:', err);
    }
  };

  return (
    <div
      ref={mapContainer}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#0a0a0a' }}
    />
  );
}
