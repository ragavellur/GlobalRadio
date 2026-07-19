import { useState, useEffect, useRef } from 'react';
import { useRadioStore } from '../lib/store';

export default function SearchBar() {
  const { searchQuery, setSearchQuery, searchResults, setSearchResults, setSidebarOpen, setSidebarTab, selectCity } = useRadioStore();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // TODO: Implement Fuse.js search in Phase 4
    if (query.length > 2) {
      // Placeholder for search results
      setSearchResults([]);
    } else {
      setSearchResults([]);
    }
  };

  const handleResultClick = (city: any) => {
    selectCity(city);
    setSidebarOpen(true);
    setSidebarTab('station');
    setSearchQuery('');
    setSearchResults([]);
    inputRef.current?.blur();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchQuery, setSearchResults]);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Search for a city... (press /)"
          className="w-full px-4 py-3 pl-10 bg-black/75 backdrop-blur-sm border border-white/10 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/50 transition-all"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Search Results Dropdown */}
        {isFocused && searchResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden shadow-xl">
            {searchResults.slice(0, 10).map((city, index) => (
              <button
                key={`${city.cityId}-${index}`}
                onMouseDown={() => handleResultClick(city)}
                className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
              >
                <div className="font-medium text-white">{city.city}</div>
                <div className="text-sm text-gray-400">{city.country}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
