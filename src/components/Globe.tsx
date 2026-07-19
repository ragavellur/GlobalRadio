import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRadioStore } from '../lib/store';
import { buildSpatialIndex, findNearestCityFromPoint } from '../lib/spatialIndex';
import { createDotLayer } from '../lib/dotLayer';
import { initSearch } from '../lib/search';

export default function Globe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const dotLayerRef = useRef<any>(null);
  const { cities, setCities, setIndexLoaded, selectCity, setSidebarOpen, setSidebarTab } = useRadioStore();

  const handleCityClick = useCallback((city: any) => {
    if (!city) return;

    selectCity(city);
    setSidebarOpen(true);
    setSidebarTab('station');

    // Fly to city
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

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
      },
      center: [0, 20],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
      canvasContextAttributes: { antialias: true },
    });

    // Set globe projection after creation
    map.current.setProjection({ type: 'globe' });

    // Add atmosphere effect
    map.current.on('load', () => {
      if (!map.current) return;

      // Add sky layer for atmosphere
      map.current.addLayer({
        id: 'sky',
        type: 'sky' as any,
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 15,
        },
      } as any);

      // Load city index and build spatial index
      loadCityIndex();
    });

    // Handle click events for city selection
    map.current.on('click', (e: maplibregl.MapMouseEvent) => {
      const city = findNearestCityFromPoint(
        e.point.x,
        e.point.y,
        map.current,
        cities,
        500
      );
      if (city) {
        handleCityClick(city);
      }
    });

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, []);

  const loadCityIndex = async () => {
    try {
      const response = await fetch('/data/index.json');
      if (!response.ok) throw new Error('Failed to load index');
      const data = await response.json();
      setCities(data);
      buildSpatialIndex(data);
      initSearch(data);
      setIndexLoaded(true);

      // Add dot layer after data is loaded
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
