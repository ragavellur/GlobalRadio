import { useRadioStore } from '../lib/store';

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, selectedCity, searchQuery, searchResults } = useRadioStore();

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
                    <button className="w-full text-left p-3 hover:bg-white/10 rounded-lg transition-colors">
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
                <p className="text-sm">Loading stations...</p>
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
