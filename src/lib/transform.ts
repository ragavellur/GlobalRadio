import type { City } from '../types';

type RawCity = [string, string, number, number, number];

export function transformCities(raw: RawCity[]): City[] {
  return raw.map((row, index) => ({
    city: row[0],
    country: row[1],
    lat: row[2],
    lon: row[3],
    stationCount: row[4],
    countryId: 0,
    cityId: index,
  }));
}
