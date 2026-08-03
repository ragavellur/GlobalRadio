import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useFavorites } from '../lib/favorites';
import { useRadioStore } from '../lib/store';
import { countryName } from '../lib/countryNames';
import { SUPABASE_ENABLED, type Favorite } from '../lib/supabase';
import { GoogleG } from './SignInDialog';

export default function FavoritesPanel() {
  if (!SUPABASE_ENABLED) return null;
  return <FavoritesPanelInner />;
}

function FavoritesPanelInner() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const { favorites, loading, removeFavorite } = useFavorites();
  const { cities, selectedCity, selectCity, playStation, setPendingStationUrl } = useRadioStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const playFavorite = (fav: Favorite) => {
    setPanelOpen(false);
    const city = cities.find(
      (c) =>
        c.country === fav.country_code &&
        c.city.toLowerCase() === fav.city.toLowerCase()
    );
    if (!city) return;
    if (selectedCity?.cityId === city.cityId) {
      playStation({ name: fav.station_name, url: fav.station_url });
      return;
    }
    setPendingStationUrl(fav.station_url);
    if ((window as any).__flyToCity) {
      (window as any).__flyToCity(city);
    } else {
      selectCity(city);
    }
  };

  const closeAll = () => {
    setPanelOpen(false);
    setAccountOpen(false);
  };

  return (
    <>
      {/* Top-right buttons */}
      <div className="absolute z-30 flex gap-2 top-14 sm:top-4 right-2 sm:right-4">
        <button
          onClick={() => { setPanelOpen(true); setAccountOpen(false); }}
          aria-label="My favorites"
          title="My favorites"
          className="relative flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, background: 'rgba(25,25,25,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 32 32" fill={favorites.length > 0 ? '#00C864' : 'none'} stroke={favorites.length > 0 ? '#00C864' : 'white'} strokeWidth="2">
            <path d="M10.4 7.5C7.66 7.5 5.5 9.63 5.5 12.33c0 3.52 2.24 6.55 10.5 13.17 8.26-6.63 10.5-9.66 10.5-13.17 0-2.7-2.16-4.83-4.9-4.83-2.45 0-3.78 1.43-4.81 2.62l-.79.9-.79-.9C14.17 8.97 12.85 7.5 10.4 7.5z" />
          </svg>
          {favorites.length > 0 && (
            <span
              className="flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', background: '#00C864' }}
            >
              {favorites.length}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => { setAccountOpen(!accountOpen); setPanelOpen(false); }}
            aria-label="Account"
            title="Account"
            className="flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, background: 'rgba(25,25,25,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
          >
            {user ? (
              <span className="text-[14px] font-bold" style={{ color: '#00C864' }}>
                {(user.email || user.user_metadata?.name || '?').toString()[0].toUpperCase()}
              </span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
              </svg>
            )}
          </button>

          {accountOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAccountOpen(false)} />
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-lg"
                style={{ background: '#191919', border: '1px solid rgba(255,255,255,0.1)', zIndex: 31 }}
              >
                {user ? (
                  <>
                    <div className="px-4 py-3">
                      <div className="text-[13px] text-white truncate" dir="auto">{user.email}</div>
                      <div className="text-[11px] text-white/40">Signed in with Google</div>
                    </div>
                    <button
                      onClick={() => { setAccountOpen(false); signOut(); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-white/70 hover:bg-white/10 transition-colors"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setAccountOpen(false); signInWithGoogle(); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] text-white hover:bg-white/10 transition-colors"
                    style={{ cursor: 'pointer' }}
                  >
                    <GoogleG /> Continue with Google
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Favorites slide-in panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setPanelOpen(false)}>
          <div
            className="absolute top-0 bottom-0 right-0 w-[320px] max-w-[90vw] flex flex-col"
            style={{ background: '#191919', zIndex: 40 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div className="text-white text-[16px] font-semibold">My Favorites</div>
                <div className="text-[12px] text-white/40">
                  {user ? `${favorites.length} station${favorites.length === 1 ? '' : 's'}` : 'Sign in to sync across devices'}
                </div>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                aria-label="Close favorites"
                className="p-2 rounded-full hover:bg-white/10"
                style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {!user && (
                <div className="p-4 text-center">
                  <p className="text-[13px] text-white/50 mb-3">
                    Save your favorite stations with a free Google account.
                  </p>
                  <button
                    onClick={() => { closeAll(); signInWithGoogle(); }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-full text-[13px] font-medium"
                    style={{ background: '#fff', color: '#333', cursor: 'pointer', border: 'none' }}
                  >
                    <GoogleG /> Continue with Google
                  </button>
                </div>
              )}

              {user && loading && (
                <div className="p-4 text-center text-white/40 text-[13px]">Loading...</div>
              )}

              {user && !loading && favorites.length === 0 && (
                <div className="p-4 text-center text-white/40 text-[13px]">
                  No favorites yet.<br />Tap the heart on any station to save it here.
                </div>
              )}

              {user && !loading && favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="flex items-center gap-1 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors"
                  style={{ cursor: 'pointer' }}
                  onClick={() => playFavorite(fav)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white truncate" dir="auto">{fav.station_name}</div>
                    <div className="text-[11px] text-white/40 truncate">{countryName(fav.country_code)} · {fav.city}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFavorite(fav.station_url); }}
                    aria-label="Remove favorite"
                    className="p-1.5 rounded-full hover:bg-white/10"
                    style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
