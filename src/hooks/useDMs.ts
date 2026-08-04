import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../lib/auth';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import {
  fetchConversations,
  fetchDirectMessages,
  markConversationRead,
  sendDirectMessage,
  startDm,
  type Conversation,
  type DirectMessage,
} from '../lib/social';
import { useHeartbeat } from './useHeartbeat';

export interface DmState {
  conversations: Conversation[];
  loading: boolean;
  openId: string | null;
  messages: DirectMessage[];
  messagesLoading: boolean;
  openConversation: (convId: string) => void;
  startConversation: (peerId: string) => Promise<void>;
  send: (body: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useDMs(active: boolean, channelKey?: string): DmState {
  const { user } = useAuth();
  const hb = useHeartbeat();
  const meId = user?.id ?? null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const lastRefreshRef = useRef(0);
  const inboxTopic = channelKey ? `dm-inbox:${channelKey}` : 'dm-inbox';
  const dmTopic = channelKey ? (openId: string) => `dm:${channelKey}:${openId}` : (openId: string) => `dm:${openId}`;

  const refresh = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    const convs = await fetchConversations();
    setConversations(convs);
    if (openId) {
      const c = convs.find((x) => x.conversation_id === openId);
      if (c) c.unread = 0;
    }
  }, [openId]);

  // Load inbox when user signs in, and refresh while tab is active.
  useEffect(() => {
    if (!active || !user) {
      if (!user) {
        setConversations([]);
        setMessages([]);
        setOpenId(null);
      }
      return;
    }
    let mounted = true;
    lastRefreshRef.current = Date.now();
    setLoading(true);
    fetchConversations().then((convs) => {
      if (mounted) {
        setConversations(convs);
        setLoading(false);
      }
    });

    let inboxChannel: RealtimeChannel | null = null;
    if (supabase) {
      inboxChannel = supabase
        .channel(inboxTopic)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_participants',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchConversations().then((convs) => mounted && setConversations(convs));
          }
        )
        .subscribe();
    }

    return () => {
      mounted = false;
      if (inboxChannel && supabase) supabase.removeChannel(inboxChannel);
    };
  }, [active, user]);

  // Refresh the inbox whenever the heartbeat detects an unread-DM change.
  useEffect(() => {
    if (!active || !user) return;
    if (hb.unreadChangedAt <= lastRefreshRef.current) return;
    lastRefreshRef.current = hb.unreadChangedAt;
    let mounted = true;
    fetchConversations().then((convs) => mounted && setConversations(convs));
    return () => {
      mounted = false;
    };
  }, [active, user, hb.unreadChangedAt]);

  // Load messages for the open conversation + realtime subscription.
  useEffect(() => {
    setMessages([]);
    if (!supabase || !openId) return;
    const sb = supabase;
    let mounted = true;
    setMessagesLoading(true);
    fetchDirectMessages(openId).then((msgs) => {
      if (mounted) {
        setMessages(msgs);
        setMessagesLoading(false);
      }
    });
    void markConversationRead(openId);

    const channel = sb
      .channel(dmTopic(openId))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${openId}`,
        },
        (payload) => {
          const msg = payload.new as DirectMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
          void markConversationRead(openId);
          setConversations((prev) =>
            prev.map((c) =>
              c.conversation_id === openId
                ? {
                    ...c,
                    unread: 0,
                    lastMessage: {
                      body: msg.body,
                      sender_id: msg.sender_id,
                      created_at: msg.created_at,
                    },
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      sb.removeChannel(channel);
    };
  }, [openId]);

  const openConversation = useCallback((convId: string) => {
    setOpenId(convId);
    void markConversationRead(convId);
  }, []);

  const startConversation = useCallback(
    async (peerId: string) => {
      if (!peerId || peerId === meId) return;
      const convId = await startDm(peerId);
      if (convId) {
        await refresh();
        setOpenId(convId);
      }
    },
    [meId, refresh]
  );

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      if (!openId) {
        console.error('send: no open conversation');
        return false;
      }
      const msg = await sendDirectMessage(openId, body);
      if (!msg) return false;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation_id === openId
            ? {
                ...c,
                unread: 0,
                lastMessage: {
                  body: msg.body,
                  sender_id: msg.sender_id,
                  created_at: msg.created_at,
                },
              }
            : c
        )
      );
      return true;
    },
    [openId]
  );

  return {
    conversations,
    loading,
    openId,
    messages,
    messagesLoading,
    openConversation,
    startConversation,
    send,
    refresh,
  };
}
