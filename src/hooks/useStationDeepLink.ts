import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from './useRouter';
import { useRadioStore } from '../lib/store';
import { decodeStationPayload, slugify } from '../lib/router';
import { findStationsForCity } from '../lib/stations';

export function useStationDeepLink() {
  const { currentRoute } = useRouter();
  const {
    cities, indexLoaded, selectedCity, currentStation,
    selectCity, setPendingStationUrl, playStation, setDrawerOpen,
  } = useRadioStore();
  const handledRef = useRef<string | null>(null);
  const collapsedRef = useRef(false);

  const resolveStation = useCallback(
    (url: string, name: string, cityName: string, countryCode: string) => {
      if (currentStation?.url === url) {
        if (!collapsedRef.current) {
          collapsedRef.current = true;
          setDrawerOpen(false);
        }
        handledRef.current = url;
        return;
      }
      if (handledRef.current === url) return;

      const city = cities.find((c) => c.city === cityName && c.country === countryCode);
      if (!city) return;

      handledRef.current = url;

      if (selectedCity && selectedCity.cityId === city.cityId) {
        playStation({ name, url });
        return;
      }

      setPendingStationUrl(url);
      if (typeof (window as any).__flyToCity === 'function') {
        (window as any).__flyToCity(city);
      } else {
        selectCity(city);
      }
    },
    [cities, selectedCity, currentStation, selectCity, setPendingStationUrl, playStation, setDrawerOpen]
  );

  useEffect(() => {
    if (currentRoute.type !== 'listen') {
      handledRef.current = null;
      collapsedRef.current = false;
      return;
    }
    if (!indexLoaded || cities.length === 0) return;

    const params = currentRoute.params ?? {};

    // Legacy share links embed an encoded JSON payload with name + url directly.
    const legacy = decodeStationPayload(params.stationId ?? '');
    if (legacy?.u) {
      resolveStation(legacy.u, legacy.n, legacy.c, legacy.y);
      return;
    }

    // Current share links: /listen/<countryCode>/<citySlug>/<stationSlug>.
    // The city is resolved from the index (lat/lon), the station URL from the
    // country's station file by slug.
    const { countryCode, citySlug, stationSlug } = params;
    if (!countryCode || !citySlug || !stationSlug) return;

    const cc = countryCode.toUpperCase();
    const city = cities.find((c) => c.country.toUpperCase() === cc && slugify(c.city) === citySlug);
    if (!city) return;

    void findStationsForCity(city.country, city.city)
      .then((stations) => {
        const station = stations.find((s) => slugify(s.name) === stationSlug);
        if (!station) return;
        resolveStation(station.url, station.name, city.city, city.country);
      })
      .catch(() => {});
  }, [currentRoute, indexLoaded, cities, resolveStation]);
}
