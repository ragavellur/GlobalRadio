import type { City } from '../types';
import type { Map as MaplibreMap } from 'maplibre-gl';

const SOURCE_ID = 'radio-cities';
const LAYER_ID = 'radio-dots';

export function addDotLayer(map: MaplibreMap, cities: City[]) {
  const features = cities.map((city) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [city.lon, city.lat] as [number, number],
    },
    properties: {
      cityId: city.cityId,
      stationCount: city.stationCount || 1,
    },
  }));

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features,
    },
  });

  map.addLayer({
    id: LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': [
        'case',
        ['>', ['get', 'stationCount'], 50],
        5,
        ['>', ['get', 'stationCount'], 10],
        3.5,
        2,
      ],
      'circle-color': '#00C864',
      'circle-opacity': 0.85,
      'circle-blur': 0.3,
      'circle-stroke-width': 0,
    },
  });
}

export function highlightCity(map: MaplibreMap, cityId: number | null) {
  if (cityId !== null) {
    map.setPaintProperty(LAYER_ID, 'circle-color', [
      'case',
      ['==', ['get', 'cityId'], cityId],
      '#ffffff',
      '#00C864',
    ]);
  } else {
    map.setPaintProperty(LAYER_ID, 'circle-color', '#00C864');
  }
}
