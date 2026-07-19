import { useState, useEffect } from 'react';
import { useRadioStore } from '../lib/store';
import { findStationsForCity, filterValidStations, sortStations } from '../lib/stations';
import type { Station } from '../types';

export default function Sidebar() {
  const store = useRadioStore();
  const { sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, selectedCity, searchQuery, searchResults, playStation, currentStation, selectCity } = store;
  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  useEffect(() => {
    if (selectedCity) {
      setLoadingStations(true);
      findStationsForCity(selectedCity.countryId, selectedCity.city)
        .then((data) => {
          const valid = filterValidStations(data);
          setStations(sortStations(valid));
          setLoadingStations(false);
        })
        .catch(() => {
          setStations([]);
          setLoadingStations(false);
        });
    } else {
      setStations([]);
    }
  }, [selectedCity]);

  if (!sidebarOpen) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-black/80 backdrop-blur-sm border-r border-white/10 z-10 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Radio Explorer</h2>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setSidebarTab('search')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            sidebarTab === 'search' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setSidebarTab('browse')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            sidebarTab === 'browse' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          Browse
        </button>
        <button
          onClick={() => setSidebarTab('station')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            sidebarTab === 'station' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          Station
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {sidebarTab === 'search' && (
          <div className="text-gray-400">
            {searchResults.length > 0 ? (
              <ul className="space-y-2">
                {searchResults.map((city, index) => (
                  <li key={`${city.cityId}-${index}`}>
                    <button 
                      onClick={() => {
                        selectCity(city);
                        setSidebarTab('station');
                      }}
                      className="w-full text-left p-3 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-white">{city.city}</div>
                      <div className="text-sm text-gray-400">{city.country}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center py-8">Type in the search bar to find cities</p>
            )}
          </div>
        )}

        {sidebarTab === 'browse' && (
          <div className="text-gray-400">
            <p className="text-center py-8">Browse countries and cities</p>
          </div>
        )}

        {sidebarTab === 'station' && (
          <div className="text-gray-400">
            {selectedCity ? (
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">{selectedCity.city}</h3>
                <p className="text-sm text-gray-400 mb-4">{selectedCity.country}</p>
                
                {loadingStations ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : stations.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-3">{stations.length} stations available</p>
                    {stations.map((station, index) => (
                      <button
                        key={`${station.url}-${index}`}
                        onClick={() => playStation(station)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          currentStation?.url === station.url
                            ? 'bg-green-500/20 border border-green-500/50'
                            : 'hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        <div className="font-medium text-white text-sm truncate">{station.name}</div>
                        {station.codec && (
                          <div className="text-xs text-gray-500 mt-1">
                            {station.codec}{station.bitrate ? ` • ${station.bitrate} kbps` : ''}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No stations available</p>
                )}
              </div>
            ) : (
              <p className="text-center py-8">Select a city to see stations</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
