import KDBush from 'kdbush';
import type { City } from '../types';

let index: KDBush | null = null;
let citiesData: City[] = [];

export function buildSpatialIndex(cities: City[]): KDBush {
  citiesData = cities;
  index = new KDBush(cities.length, 64, Float64Array);

  for (const city of cities) {
    index.add(city.lon, city.lat);
  }
  index.finish();

  return index;
}

export function findNearestCity(
  lon: number,
  lat: number,
  maxDistanceDeg = 10 // in degrees (~500km at equator)
): City | null {
  if (!index) return null;

  const results = index.within(lon, lat, maxDistanceDeg);
  if (results.length === 0) return null;

  let nearestIdx = results[0];
  let nearestDist = Infinity;

  for (const idx of results) {
    const city = citiesData[idx];
    const dist = haversineDistance(lon, lat, city.lon, city.lat);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = idx;
    }
  }

  return citiesData[nearestIdx];
}

export function findNearestCityFromPoint(
  screenX: number,
  screenY: number,
  map: any,
  _cities: City[],
  maxDistanceDeg = 10
): City | null {
  if (!index || !map) return null;

  const point = map.unproject([screenX, screenY]);
  if (!point) return null;

  const { lng, lat } = point;

  const results = index.within(lng, lat, maxDistanceDeg);
  if (results.length === 0) return null;

  let nearestIdx = results[0];
  let nearestDist = Infinity;

  for (const idx of results) {
    const city = citiesData[idx];
    const dist = haversineDistance(lng, lat, city.lon, city.lat);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = idx;
    }
  }

  return citiesData[nearestIdx];
}

function haversineDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function getIndex(): KDBush | null {
  return index;
}
