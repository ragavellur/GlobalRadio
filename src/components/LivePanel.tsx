import { useState } from 'react';
import { useRadioStore } from '../lib/store';
import { useLiveStations } from '../hooks/useLiveStations';
import { SUPABASE_ENABLED, type LiveStation } from '../lib/social';
import SlidePanel from './SlidePanel';
import { countryName } from '../lib/countryNames';

export default function LivePanel() {
  if (!SUPABASE_ENABLED) return null;
  return <LivePanelInner />;
}

function LivePanelInner() {
  const [open, setOpen] = useState(false);
  const stations = useLiveStations(open);
  const { cities, selectedCity, playStation, setPendingStationUrl } = useRadioStore();

  const play = (ls: LiveStation) => {
    setOpen(false);
    const city = cities.find((c) => `${c.city},${c.country}` === ls.city_key);
    if (!city) return;
    const station = { name: ls.station_name, url: ls.station_url };
    if (selectedCity?.cityId === city.cityId) {
      playStation(station);
      return;
    }
    setPendingStationUrl(ls.station_url);
    if ((window as any).__flyToCity) {
      (window as any).__flyToCity(city);
    } else {
      playStation(station);
    }
  };

  return (
    <>
      <style>{`@keyframes grPulse{0%{box-shadow:0 0 0 0 rgba(255,59,48,.5)}70%{box-shadow:0 0 0 6px rgba(255,59,48,0)}100%{box-shadow:0 0 0 0 rgba(255,59,48,0)}}`}</style>
      {/* Live button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Live stations"
        title="Stations with listeners right now"
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          background: 'rgba(25,25,25,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
      >
        <span className="relative flex items-center">
          <span
            className="absolute -left-2 rounded-full"
            style={{ width: 8, height: 8, background: '#ff3b30', boxShadow: '0 0 0 0 rgba(255,59,48,0.6)', animation: 'grPulse 1.5s infinite' }}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a10 10 0 0 0-6.32 17.78l1.5-1.5A8 8 0 1 1 12 4a8 8 0 0 1 5.66 2.34l1.5-1.5A10 10 0 0 0 12 2zm0 4a6 6 0 0 0-3.8 10.67l1.5-1.5A4 4 0 1 1 12 8a4 4 0 0 1 2.83 1.17l1.5-1.5A6 6 0 0 0 12 6z" />
            <circle cx="12" cy="12" r="2" fill="#ff3b30" />
          </svg>
        </span>
      </button>

      <SlidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Listening now"
        subtitle={stations.length > 0 ? `${stations.length} station${stations.length === 1 ? '' : 's'} live` : 'Updating…'}
      >
        {stations.length === 0 && (
          <div className="p-6 text-center text-white/40 text-[13px]">
            No one is listening to any station right now.
          </div>
        )}
        {stations.map((ls) => (
          <button
            key={ls.station_url}
            onClick={() => play(ls)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
            style={{ cursor: 'pointer', border: 'none', background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span
              className="flex items-center justify-center rounded-full text-[11px] font-bold shrink-0"
              style={{ minWidth: 34, height: 22, padding: '0 8px', background: 'rgba(0,200,100,0.15)', color: '#00C864' }}
            >
              {ls.listeners}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white truncate" dir="auto">{ls.station_name}</div>
              <div className="text-[11px] text-white/40 truncate">
                {countryName(ls.country)} · {ls.city}
              </div>
            </div>
          </button>
        ))}
      </SlidePanel>
    </>
  );
}
