import type { User } from '@supabase/supabase-js';
import { supabase, SUPABASE_ENABLED } from './supabase';
import type { City, Station } from '../types';

export { SUPABASE_ENABLED };

// ============================================================================
// Device identity — one stable id per browser, so tabs don't double-count.
// ============================================================================
const DEVICE_ID_KEY = 'gr_device_id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `d-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `d-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }
}

export function cityKeyOf(city: City): string {
  return `${city.city},${city.country}`;
}

// ============================================================================
// Room ids — hex sha-256 so realtime filter values are URL-safe.
// ============================================================================
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function cityRoomId(cityKey: string): Promise<string> {
  return sha256Hex(`city:${cityKey}`);
}

export function stationRoomId(stationUrl: string): Promise<string> {
  return sha256Hex(`station:${stationUrl}`);
}

// ============================================================================
// Presence / heartbeat
// ============================================================================
export interface PresenceRow {
  device_id: string;
  user_id: string | null;
  station_url: string;
  station_name: string;
  city_key: string;
  city: string;
  country: string;
  last_seen: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

export interface Listener {
  id: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  anonymous: boolean;
  stationUrl: string;
  stationName: string;
  cityKey: string;
}

export async function sendHeartbeat(
  station: Station,
  city: City,
  user: User | null
): Promise<void> {
  if (!supabase) return;
  const device_id = getDeviceId();
  await supabase.from('presence').upsert(
    {
      device_id,
      user_id: user?.id ?? null,
      station_url: station.url,
      station_name: station.name,
      city_key: cityKeyOf(city),
      city: city.city,
      country: city.country,
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'device_id' }
  );
}

export async function fetchCityListeners(cityKey: string): Promise<Listener[]> {
  if (!supabase) return [];
  const cutoff = new Date(Date.now() - 30_000).toISOString();
  const { data, error } = await supabase
    .from('presence')
    .select(
      'device_id, user_id, station_url, station_name, city_key, last_seen, profiles(display_name, avatar_url)'
    )
    .eq('city_key', cityKey)
    .gte('last_seen', cutoff)
    .order('last_seen', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as any[]).map((row) => {
    const anonymous = !row.user_id;
    const profile = row.profiles ?? null;
    return {
      id: row.user_id ?? row.device_id,
      userId: row.user_id,
      displayName: anonymous
        ? 'Anonymous listener'
        : profile?.display_name || 'Radio listener',
      avatarUrl: profile?.avatar_url ?? null,
      anonymous,
      stationUrl: row.station_url,
      stationName: row.station_name,
      cityKey: row.city_key,
    };
  });
}

export interface LiveStation {
  station_url: string;
  station_name: string;
  city_key: string;
  city: string;
  country: string;
  listeners: number;
}

export async function fetchLiveStations(): Promise<LiveStation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_live_stations');
  if (error || !data) return [];
  return (data as LiveStation[]) ?? [];
}

// ============================================================================
// Room (group) chat
// ============================================================================
export interface SenderProfile {
  display_name: string;
  avatar_url: string | null;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  room_name: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: SenderProfile | null;
}

const profileCache = new Map<string, SenderProfile | null>();

/**
 * Looks up a sender's profile by user id, caching results. Realtime INSERT
 * payloads don't include the joined profile, so this fills the gap.
 */
export async function fetchSenderProfile(userId: string): Promise<SenderProfile | null> {
  if (profileCache.has(userId)) return profileCache.get(userId)!;
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  const profile: SenderProfile | null = data
    ? { display_name: data.display_name || 'Radio listener', avatar_url: data.avatar_url ?? null }
    : null;
  profileCache.set(userId, profile);
  return profile;
}

export async function fetchRoomMessages(
  roomId: string,
  limit = 50
): Promise<RoomMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('room_messages')
    .select('id, room_id, room_name, sender_id, body, created_at, profiles(display_name, avatar_url)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as RoomMessage[]).reverse();
}

export async function sendRoomMessage(
  roomId: string,
  roomName: string,
  body: string
): Promise<RoomMessage | null> {
  if (!supabase) return null;
  const text = body.trim();
  if (!text) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('room_messages')
    .insert({ room_id: roomId, room_name: roomName, sender_id: user.id, body: text })
    .select('id, room_id, room_name, sender_id, body, created_at')
    .single();
  if (error || !data) return null;
  return {
    ...(data as RoomMessage),
    profiles: {
      display_name: (user.user_metadata?.name as string) || 'Radio listener',
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
    },
  };
}

// ============================================================================
// Direct messages
// ============================================================================
export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

export interface Conversation {
  conversation_id: string;
  last_read_at: string;
  other: { id: string; display_name: string; avatar_url: string | null };
  lastMessage: { body: string; sender_id: string; created_at: string } | null;
  unread: number;
}

export async function startDm(peerId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_peer: peerId });
  if (error || !data) return null;
  return data as string;
}

export async function fetchConversations(): Promise<Conversation[]> {
  if (!supabase) return [];
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const me = session?.user;
  if (!me) return [];
  const meId = me.id;

  const { data: myParts, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', meId);
  if (error || !myParts || myParts.length === 0) return [];

  const convIds = myParts.map((p) => p.conversation_id);
  const { data: allParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, profiles(id, display_name, avatar_url)')
    .in('conversation_id', convIds);
  if (!allParts) return [];

  const byConv = new Map<string, { user_id: string; display_name: string; avatar_url: string | null }[]>();
  for (const row of allParts) {
    const profile = (row as any).profiles ?? {};
    const entry = {
      user_id: row.user_id,
      display_name: profile.display_name || 'Radio listener',
      avatar_url: profile.avatar_url || null,
    };
    const list = byConv.get(row.conversation_id) ?? [];
    list.push(entry);
    byConv.set(row.conversation_id, list);
  }

  const conversations: Conversation[] = [];
  for (const p of myParts) {
    const members = byConv.get(p.conversation_id) ?? [];
    const other = members.find((m) => m.user_id !== meId) ?? members[0];
    if (!other) continue;

    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('id, body, sender_id, created_at')
      .eq('conversation_id', p.conversation_id)
      .order('created_at', { ascending: false })
      .limit(50);
    const list = (msgs ?? []) as DirectMessage[];
    const unread = list.filter(
      (m) => m.sender_id !== meId && new Date(m.created_at) > new Date(p.last_read_at)
    ).length;
    conversations.push({
      conversation_id: p.conversation_id,
      last_read_at: p.last_read_at,
      other: { id: other.user_id, display_name: other.display_name, avatar_url: other.avatar_url },
      lastMessage: list[0] ? { body: list[0].body, sender_id: list[0].sender_id, created_at: list[0].created_at } : null,
      unread,
    });
  }
  conversations.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
    const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
    return tb - ta;
  });
  return conversations;
}

export async function fetchDirectMessages(
  conversationId: string,
  limit = 50
): Promise<DirectMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, conversation_id, sender_id, body, created_at, profiles(display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as DirectMessage[];
}

export async function sendDirectMessage(
  conversationId: string,
  body: string
): Promise<DirectMessage | null> {
  if (!supabase) return null;
  const text = body.trim();
  if (!text) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();
  if (error || !data) return null;
  return {
    ...(data as DirectMessage),
    profiles: {
      display_name: (user.user_metadata?.name as string) || 'Radio listener',
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
    },
  };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const me = session?.user;
  if (!me) return;
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', me.id);
}

// ============================================================================
// Notifications
// ============================================================================
export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as AppNotification[];
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);
}
