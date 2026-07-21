import { useState, useRef, useEffect } from 'react';
import { useRadioStore } from '../lib/store';
import { searchCities } from '../lib/search';
import InstallPrompt from './InstallPrompt';

export default function SearchPanel() {
  const { selectCity } = useRadioStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.length > 1) {
      setResults(searchCities(q).slice(0, 15));
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (city: any) => {
    selectCity(city);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();

    if ((window as any).__flyToCity) {
      (window as any).__flyToCity(city);
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

  return (
    <>
      {/* Search input — responsive positioning */}
      <div className="absolute top-2 sm:top-[15px] left-1/2 -translate-x-1/2 z-20 w-[calc(100%-16px)] sm:w-auto max-w-[340px]">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length > 1 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search city..."
          className="w-full sm:w-[280px] px-4 py-2 rounded-full text-[14px] text-white placeholder-white/40 outline-none transition-all sm:focus:w-[340px]"
          style={{ background: 'rgba(25,25,25,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <div className="flex justify-center mt-1">
          <InstallPrompt />
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute top-[44px] sm:top-[55px] left-1/2 -translate-x-1/2 z-30 w-[calc(100%-16px)] sm:w-[340px] max-h-[400px] overflow-y-auto rounded-lg"
          style={{ background: '#191919', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {results.map((city, i) => (
            <button
              key={`${city.cityId}-${i}`}
              onMouseDown={() => handleSelect(city)}
              onTouchEnd={(e) => { e.preventDefault(); handleSelect(city); }}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
            >
              <div className="text-[14px] text-white">{city.city}</div>
              <div className="text-[12px] text-white/50">{city.country}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
