import { useEffect, useRef } from 'react';
import { useRouter } from './useRouter';
import { useRadioStore } from '../lib/store';
import { decodeStationPayload } from '../lib/router';

export function useStationDeepLink() {
  const { currentRoute } = useRouter();
  const {
    cities, indexLoaded, selectedCity, currentStation,
    selectCity, setPendingStationUrl, playStation, setDrawerOpen,
  } = useRadioStore();
  const handledRef = useRef<string | null>(null);
  const collapsedRef = useRef(false);

  useEffect(() => {
    if (currentRoute.type !== 'listen') {
      handledRef.current = null;
      collapsedRef.current = false;
      return;
    }
    if (!indexLoaded || cities.length === 0) return;

    const payload = decodeStationPayload(currentRoute.params?.stationId ?? '');
    if (!payload || !payload.u) return;

    if (currentStation?.url === payload.u) {
      if (!collapsedRef.current) {
        collapsedRef.current = true;
        setDrawerOpen(false);
      }
      handledRef.current = payload.u;
      return;
    }
    if (handledRef.current === payload.u) return;

    const city = cities.find((c) => c.city === payload.c && c.country === payload.y);
    if (!city) return;

    handledRef.current = payload.u;

    if (selectedCity && selectedCity.cityId === city.cityId) {
      playStation({ name: payload.n, url: payload.u });
      return;
    }

    setPendingStationUrl(payload.u);
    if (typeof (window as any).__flyToCity === 'function') {
      (window as any).__flyToCity(city);
    } else {
      selectCity(city);
    }
  }, [currentRoute, indexLoaded, cities, selectedCity, currentStation, selectCity, setPendingStationUrl, playStation, setDrawerOpen]);
}
