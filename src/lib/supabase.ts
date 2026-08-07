import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface Favorite {
  id: string;
  user_id: string;
  country_code: string;
  city: string;
  city_key: string;
  station_name: string;
  station_url: string;
  created_at: string;
}

export interface NewFavorite {
  country_code: string;
  city: string;
  city_key: string;
  station_name: string;
  station_url: string;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { flowType: 'pkce' } }) : null;

export const SUPABASE_ENABLED = supabase !== null;
