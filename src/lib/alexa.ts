import { supabase } from './supabase';

export interface SendToAlexaArgs {
  user_id: string;
  station_name: string;
  station_url: string;
  city: string;
  country: string;
}

export async function sendToAlexa(item: SendToAlexaArgs): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('play_queue').insert(item);
  if (error) throw error;
}
