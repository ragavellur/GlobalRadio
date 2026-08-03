import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useNotifications } from '../hooks/useNotifications';
import { SUPABASE_ENABLED } from '../lib/supabase';

export default function NotificationsPanel() {
  if (!SUPABASE_ENABLED) return null;
  return <NotificationsPanelInner />;
}

function NotificationsPanelInner() {
  const { user } = useAuth();
  const { items, unread, loading, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) void markAllRead();
  }, [open, markAllRead]);

  if (!user) return null;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Notifications"
          title="Notifications"
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unread > 0 && (
            <span
              className="flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', background: '#00C864' }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div
              className="absolute right-0 top-full mt-2 w-72 rounded-lg overflow-hidden"
              style={{ background: '#191919', border: '1px solid rgba(255,255,255,0.1)', zIndex: 31, maxHeight: 360 }}
            >
              <div className="px-4 py-3 text-[13px] text-white/70 font-medium" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                Notifications
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
                {loading && items.length === 0 && (
                  <div className="px-4 py-4 text-center text-white/40 text-[13px]">Loading…</div>
                )}
                {!loading && items.length === 0 && (
                  <div className="px-4 py-4 text-center text-white/40 text-[13px]">Nothing yet.</div>
                )}
                {items.map((n) => (
                  <div key={n.id} className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-white truncate">{n.title}</span>
                      {!n.is_read && <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: '#00C864' }} />}
                    </div>
                    {n.body && <div className="text-[12px] text-white/45 truncate mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-white/25 mt-0.5">{timeAgo(n.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return '';
  }
}
