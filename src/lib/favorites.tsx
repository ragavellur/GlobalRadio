import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase, type Favorite, type NewFavorite } from './supabase';
import { useAuth } from './auth';

interface FavoritesValue {
  favorites: Favorite[];
  loading: boolean;
  isFavorite: (url: string) => boolean;
  addFavorite: (fav: NewFavorite) => Promise<void>;
  removeFavorite: (url: string) => Promise<void>;
  toggleFavorite: (fav: NewFavorite) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

const PENDING_KEY = 'globalradio:pendingFavorite';

export function setPendingFavorite(fav: NewFavorite) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(fav));
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);

  const addFavorite = useCallback(
    async (fav: NewFavorite) => {
      if (!supabase || !user) return;
      const row = {
        user_id: user.id,
        country_code: fav.country_code,
        city: fav.city,
        city_key: fav.city_key,
        station_name: fav.station_name,
        station_url: fav.station_url,
      };
      const { data, error } = await supabase
        .from('favorites')
        .upsert(row, { onConflict: 'user_id,station_url' })
        .select()
        .single();
      if (error) {
        console.error('Failed to add favorite:', error);
        return;
      }
      setFavorites((prev) => [
        data,
        ...prev.filter((f) => f.station_url !== fav.station_url),
      ]);
    },
    [user]
  );

  const removeFavorite = useCallback(
    async (url: string) => {
      if (!supabase || !user) return;
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('station_url', url);
      if (error) {
        console.error('Failed to remove favorite:', error);
        return;
      }
      setFavorites((prev) => prev.filter((f) => f.station_url !== url));
    },
    [user]
  );

  useEffect(() => {
    if (!supabase || !user) {
      setFavorites([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.error('Failed to load favorites:', error);
          return;
        }
        setFavorites(data ?? []);
        const pending = localStorage.getItem(PENDING_KEY);
        if (pending) {
          localStorage.removeItem(PENDING_KEY);
          try {
            await addFavorite(JSON.parse(pending) as NewFavorite);
          } catch {}
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, addFavorite]);

  const isFavorite = useCallback(
    (url: string) => favorites.some((f) => f.station_url === url),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (fav: NewFavorite) => {
      if (!supabase || !user) return;
      if (favorites.some((f) => f.station_url === fav.station_url)) {
        await removeFavorite(fav.station_url);
      } else {
        await addFavorite(fav);
      }
    },
    [user, favorites, addFavorite, removeFavorite]
  );

  const value = useMemo<FavoritesValue>(
    () => ({ favorites, loading, isFavorite, addFavorite, removeFavorite, toggleFavorite }),
    [favorites, loading, isFavorite, addFavorite, removeFavorite, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
