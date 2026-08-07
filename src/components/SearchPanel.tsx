import { useState, useRef, useEffect } from 'react';
import { useRadioStore } from '../lib/store';
import { searchCities } from '../lib/search';
import { searchStations, type StationHit } from '../lib/stationSearch';
import { countryName } from '../lib/countryNames';
import type { City } from '../types';

interface CityHit extends City {}

export default function SearchPanel() {
  const {
    selectCity, drawerOpen, selectedCity, cities, indexLoaded,
    selectStation, setPendingStationUrl,
  } = useRadioStore();
  const [query, setQuery] = useState('');
  const [cityResults, setCityResults] = useState<CityHit[]>([]);
  const [stationResults, setStationResults] = useState<StationHit[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hideOnMobile = drawerOpen && !!selectedCity;

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.length > 1) {
      setIsOpen(true);
      setCityResults(searchCities(q).slice(0, 10));
      setStationsLoading(true);
      searchStations(q, 6).then((s) => {
        setStationResults(s);
        setStationsLoading(false);
      });
    } else {
      setCityResults([]);
      setStationResults([]);
      setStationsLoading(false);
      setIsOpen(false);
    }
  };

  const closeSearch = () => {
    setQuery('');
    setCityResults([]);
    setStationResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleSelectCity = (city: City) => {
    closeSearch();
    selectCity(city);
    if ((window as any).__flyToCity) {
      (window as any).__flyToCity(city);
    }
  };

  const handleSelectStation = (hit: StationHit) => {
    closeSearch();
    const city = cities[hit.cityIdx] ?? null;
    const station = { name: hit.name, url: hit.url };
    if (!city || (selectedCity && selectedCity.cityId === city.cityId)) {
      selectStation(station);
      return;
    }
    setPendingStationUrl(hit.url);
    if ((window as any).__flyToCity) {
      (window as any).__flyToCity(city);
    } else {
      selectCity(city);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const showResults = isOpen && query.length > 1 && (cityResults.length > 0 || stationResults.length > 0 || stationsLoading);

  return (
    <>
      <div
        className={`absolute top-2 sm:top-[15px] left-1/2 -translate-x-1/2 z-20 w-[calc(100%-16px)] sm:w-auto max-w-[340px] ${hideOnMobile ? 'hidden sm:block' : ''}`}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length > 1 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search city or station..."
          className="w-full sm:w-[280px] px-4 py-2 rounded-full text-base text-white placeholder-white/40 outline-none transition-all sm:focus:w-[340px]"
          style={{ background: 'rgba(25,25,25,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
      </div>

      {showResults && (
        <div
          className={`absolute top-[44px] sm:top-[55px] left-1/2 -translate-x-1/2 z-30 w-[calc(100%-16px)] sm:w-[340px] max-h-[400px] overflow-y-auto rounded-lg ${hideOnMobile ? 'hidden sm:block' : ''}`}
          style={{ background: '#191919', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {!indexLoaded && (
            <div className="px-4 py-3 text-[13px] text-white/40">Loading city index…</div>
          )}

          {cityResults.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-white/30">Cities</div>
              {cityResults.map((city, i) => (
                <button
                  key={`c-${city.cityId}-${i}`}
                  onMouseDown={() => handleSelectCity(city)}
                  onTouchEnd={(e) => { e.preventDefault(); handleSelectCity(city); }}
                  className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors"
                >
                  <div className="text-[14px] text-white">{city.city}</div>
                  <div className="text-[12px] text-white/50">{countryName(city.country)}</div>
                </button>
              ))}
            </>
          )}

          {stationResults.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-white/30 border-t border-white/5">Stations</div>
              {stationResults.map((hit, i) => {
                const city = cities[hit.cityIdx];
                return (
                  <button
                    key={`s-${hit.url}-${i}`}
                    onMouseDown={() => handleSelectStation(hit)}
                    onTouchEnd={(e) => { e.preventDefault(); handleSelectStation(hit); }}
                    className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="text-[14px] text-white truncate" dir="auto">{hit.name}</div>
                    <div className="text-[12px] text-white/50 truncate">
                      {city ? `${city.city}, ${countryName(city.country)}` : ''}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {stationsLoading && stationResults.length === 0 && (
            <div className="px-4 py-3 text-[13px] text-white/40">Searching stations…</div>
          )}

          {indexLoaded && !stationsLoading && cityResults.length === 0 && stationResults.length === 0 && (
            <div className="px-4 py-3 text-[13px] text-white/40">No results for “{query}”</div>
          )}
        </div>
      )}
    </>
  );
}
