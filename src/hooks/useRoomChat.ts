import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  fetchRoomMessages,
  fetchSenderProfile,
  sendRoomMessage,
  type RoomMessage,
} from '../lib/social';

export interface RoomChatState {
  messages: RoomMessage[];
  loading: boolean;
  send: (body: string) => Promise<void>;
}

/**
 * Group chat for a single room (city or station). Loads history on mount and
 * subscribes to realtime inserts for new messages.
 */
export function useRoomChat(roomId: string | null, roomName: string): RoomChatState {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setMessages([]);
    setLoading(false);
    if (!supabase || !roomId) return;
    const sb = supabase;

    let mounted = true;
    setLoading(true);
    fetchRoomMessages(roomId).then((msgs) => {
      if (mounted) {
        setMessages(msgs);
        setLoading(false);
      }
    });

    const channel = sb
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new as RoomMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
          if (!msg.profiles) {
            void fetchSenderProfile(msg.sender_id).then((profile) => {
              if (!profile) return;
              setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? { ...m, profiles: profile } : m))
              );
            });
          }
        }
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      mounted = false;
      setLoading(false);
      if (channelRef.current) {
        sb.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId]);

  const send = useCallback(
    async (body: string) => {
      if (!roomId) return;
      const msg = await sendRoomMessage(roomId, roomName, body);
      if (msg) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
      }
    },
    [roomId, roomName]
  );

  return { messages, loading, send };
}
