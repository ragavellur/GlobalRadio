import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../lib/auth';
import { supabase, SUPABASE_ENABLED } from '../lib/supabase';
import {
  fetchNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from '../lib/social';

export interface NotificationsState {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
}

/**
 * Subscribes to realtime notification inserts for the signed-in user.
 * Only subscribes while the notifications UI is mounted.
 */
export function useNotifications(): NotificationsState {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems([]);
    if (!SUPABASE_ENABLED || !user) return;
    let mounted = true;
    setLoading(true);
    fetchNotifications().then((list) => {
      if (mounted) {
        setItems(list);
        setLoading(false);
      }
    });

    let channel: RealtimeChannel | null = null;
    if (supabase) {
      channel = supabase
        .channel('notifications')        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as AppNotification;
            setItems((prev) => [n, ...prev].slice(0, 50));
          }
        )
        .subscribe();
    }

    return () => {
      mounted = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!SUPABASE_ENABLED) return;
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, []);

  return {
    items,
    unread: items.filter((n) => !n.is_read).length,
    loading,
    markAllRead,
  };
}
