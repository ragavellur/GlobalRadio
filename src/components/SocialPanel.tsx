import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useRadioStore } from '../lib/store';
import { useSignInDialog } from './SignInDialog';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { useRoomChat } from '../hooks/useRoomChat';
import { useDMs } from '../hooks/useDMs';
import { useListenerCounts } from '../hooks/useListenerCounts';
import { cityRoomId, stationRoomId, cityKeyOf } from '../lib/social';
import type { Listener, RoomMessage, DirectMessage, Conversation } from '../lib/social';
import SlidePanel from './SlidePanel';

type Tab = 'chat' | 'listeners' | 'dm';

export default function SocialPanel() {
  if (!SUPABASE_ENABLED) return null;
  return <SocialPanelInner />;
}

function SocialPanelInner() {
  const { user } = useAuth();
  const { openSignInDialog } = useSignInDialog();
  const { selectedCity, currentStation } = useRadioStore();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');
  const [roomMode, setRoomMode] = useState<'city' | 'station'>('station');
  const [roomId, setRoomId] = useState<string | null>(null);

  const city = selectedCity;
  const station = currentStation;

  useEffect(() => {
    if (!open) {
      setRoomId(null);
      return;
    }
    let cancelled = false;
    const compute = async () => {
      if (roomMode === 'station' && station) {
        const id = await stationRoomId(station.url);
        if (!cancelled) setRoomId(id);
      } else if (roomMode === 'city' && city) {
        const id = await cityRoomId(cityKeyOf(city));
        if (!cancelled) setRoomId(id);
      } else {
        setRoomId(null);
      }
    };
    void compute();
    return () => {
      cancelled = true;
    };
  }, [open, roomMode, station, city]);

  const roomName = useMemo(() => {
    if (roomMode === 'station' && station) return station.name;
    if (city) return `${city.city}, ${city.country}`;
    return '';
  }, [roomMode, station, city]);

  const chat = useRoomChat(open ? roomId : null, roomName);
  const counts = useListenerCounts(city, open && tab === 'listeners');
  const dms = useDMs(!!user);

  const dmUnread = dms.conversations.reduce((n, c) => n + c.unread, 0);

  const startDmTo = useCallback(
    (peerId: string) => {
      void dms.startConversation(peerId);
      setTab('dm');
    },
    [dms]
  );

  const hasStationRoom = !!station;
  const hasCityRoom = !!city;

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Social"
        title="City & station chat, listeners, DMs"
        className="flex items-center justify-center rounded-full"
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          background: 'rgba(25,25,25,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {dmUnread > 0 && (
          <span
            className="flex items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', background: '#00C864' }}
          >
            {dmUnread > 99 ? '99+' : dmUnread}
          </span>
        )}
      </button>

      <SlidePanel open={open} onClose={() => setOpen(false)} title="Social" subtitle="Chat with listeners around the world">
        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {(
            [
              ['chat', 'Chat'],
              ['listeners', 'Listeners'],
              ['dm', 'DMs'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2.5 text-[13px] font-medium"
              style={{
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
                color: tab === key ? '#00C864' : 'rgba(255,255,255,0.55)',
                borderBottom: tab === key ? '2px solid #00C864' : '2px solid transparent',
              }}
            >
              {label}
              {key === 'dm' && dms.conversations.length > 0 && (
                <span className="ml-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {dms.conversations.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'chat' && (
          <ChatView
            user={!!user}
            hasCityRoom={hasCityRoom}
            hasStationRoom={hasStationRoom}
            roomMode={roomMode}
            setRoomMode={setRoomMode}
            cityName={city ? `${city.city}, ${city.country}` : ''}
            stationName={station?.name ?? ''}
            messages={chat.messages}
            loading={chat.loading}
            onSend={chat.send}
            onRequireSignIn={() => openSignInDialog()}
          />
        )}

        {tab === 'listeners' && (
          <ListenersView
            city={city}
            station={station}
            counts={counts}
            meId={user?.id ?? null}
            onDm={startDmTo}
          />
        )}

        {tab === 'dm' && (
          <DmView
            dms={dms}
            meId={user?.id ?? null}
            onRequireSignIn={() => openSignInDialog()}
            user={!!user}
          />
        )}
      </SlidePanel>
    </>
  );
}

/* ============================================================================
   Chat
   ============================================================================ */
function ChatView({
  user,
  hasCityRoom,
  hasStationRoom,
  roomMode,
  setRoomMode,
  cityName,
  stationName,
  messages,
  loading,
  onSend,
  onRequireSignIn,
}: {
  user: boolean;
  hasCityRoom: boolean;
  hasStationRoom: boolean;
  roomMode: 'city' | 'station';
  setRoomMode: (m: 'city' | 'station') => void;
  cityName: string;
  stationName: string;
  messages: RoomMessage[];
  loading: boolean;
  onSend: (body: string) => Promise<void>;
  onRequireSignIn: () => void;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, roomMode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!user) {
      onRequireSignIn();
      return;
    }
    void onSend(text);
    setDraft('');
  };

  const hasRoom = hasCityRoom || hasStationRoom;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
      {/* Room selector */}
      <div className="flex gap-2 px-3 py-2.5">
        {hasCityRoom && (
          <RoomChip active={roomMode === 'city'} onClick={() => setRoomMode('city')} label={`City · ${cityName}`} />
        )}
        {hasStationRoom && (
          <RoomChip active={roomMode === 'station'} onClick={() => setRoomMode('station')} label={`Station · ${stationName}`} />
        )}
      </div>

      {!hasRoom ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-[13px] text-white/40">
          Select a city on the globe (or play a station) to open its live chat.
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-2"
            style={{ minHeight: 0 }}
          >
            {loading && messages.length === 0 && (
              <div className="text-center text-white/40 text-[13px] py-6">Loading chat…</div>
            )}
            {!loading && messages.length === 0 && (
              <div className="text-center text-white/40 text-[13px] py-6">
                No messages yet. Say hello!
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={user ? 'Message…' : 'Sign in to chat…'}
              className="flex-1 rounded-full px-3.5 py-2 text-[13px] text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="submit"
              className="flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, background: '#00C864', cursor: 'pointer', border: 'none' }}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function RoomChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 truncate rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
      style={{
        cursor: 'pointer',
        border: 'none',
        background: active ? 'rgba(0,200,100,0.2)' : 'rgba(255,255,255,0.08)',
        color: active ? '#00C864' : 'rgba(255,255,255,0.6)',
      }}
      title={label}
    >
      {label}
    </button>
  );
}

function MessageBubble({ message }: { message: RoomMessage }) {
  const name = message.profiles?.display_name || 'Radio listener';
  const avatar = message.profiles?.avatar_url || null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Avatar url={avatar} name={name} size={18} />
        <span className="text-[12px] font-medium" style={{ color: '#00C864' }}>
          {name}
        </span>
        <span className="text-[10px] text-white/30">{timeAgo(message.created_at)}</span>
      </div>
      <div className="pl-[25px]">
        <div className="text-[13px] text-white/90 leading-snug break-words" dir="auto">
          {message.body}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Listeners
   ============================================================================ */
function ListenersView({
  city,
  station,
  counts,
  meId,
  onDm,
}: {
  city: { city: string; country: string } | null;
  station: { name: string; url: string } | null;
  counts: { cityCount: number; listeners: Listener[] };
  meId: string | null;
  onDm: (peerId: string) => void;
}) {
  const cityListeners = counts.listeners;
  const stationListeners = station
    ? cityListeners.filter((l) => l.stationUrl === station.url)
    : [];

  return (
    <div className="px-3 py-2">
      {!city ? (
        <div className="text-center text-white/40 text-[13px] py-6">
          Select a city on the globe to see who's listening.
        </div>
      ) : (
        <>
          <SectionHeader
            label={`Listening in ${city.city}, ${city.country}`}
            count={counts.cityCount}
          />
          {cityListeners.length === 0 && <EmptyNote text="No one is listening here right now." />}
          {cityListeners.map((l) => (
            <ListenerRow key={l.id} listener={l} meId={meId} onDm={onDm} />
          ))}

          {station && (
            <>
              <SectionHeader label={`Listening to ${station.name}`} count={stationListeners.length} />
              {stationListeners.length === 0 && <EmptyNote text="No one is listening to this station right now." />}
              {stationListeners.map((l) => (
                <ListenerRow key={l.id} listener={l} meId={meId} onDm={onDm} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ListenerRow({
  listener,
  meId,
  onDm,
}: {
  listener: Listener;
  meId: string | null;
  onDm: (peerId: string) => void;
}) {
  const canDm = !!listener.userId && listener.userId !== meId;
  return (
    <div className="flex items-center gap-2 py-2 rounded-lg hover:bg-white/5 transition-colors px-1">
      <Avatar url={listener.avatarUrl} name={listener.displayName} size={26} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white truncate">{listener.displayName}</div>
        <div className="text-[11px] text-white/40 truncate">
          {listener.anonymous ? '' : 'via '}
          {listener.stationName}
        </div>
      </div>
      {canDm && (
        <button
          onClick={() => onDm(listener.userId!)}
          className="rounded-full px-3 py-1 text-[11px] font-medium shrink-0 transition-colors"
          style={{ background: 'rgba(0,200,100,0.15)', color: '#00C864', cursor: 'pointer', border: 'none' }}
        >
          Message
        </button>
      )}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between mt-2 mb-1">
      <span className="text-[12px] text-white/60 font-medium">{label}</span>
      <span className="text-[11px] text-white/40">{count}</span>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div className="text-[13px] text-white/35 py-2">{text}</div>;
}

/* ============================================================================
   DMs
   ============================================================================ */
function DmView({
  dms,
  meId,
  user,
  onRequireSignIn,
}: {
  dms: ReturnType<typeof useDMs>;
  meId: string | null;
  user: boolean;
  onRequireSignIn: () => void;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const openConv = dms.openId ? dms.conversations.find((c) => c.conversation_id === dms.openId) : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dms.messages.length, dms.openId]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-[13px] text-white/50 mb-3">Sign in to message listeners.</p>
        <button
          onClick={onRequireSignIn}
          className="rounded-full px-5 py-2 text-[13px] font-medium"
          style={{ background: '#fff', color: '#333', cursor: 'pointer', border: 'none' }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!dms.openId) {
    return (
      <div className="px-3 py-2">
        {dms.loading && <div className="text-center text-white/40 text-[13px] py-6">Loading…</div>}
        {!dms.loading && dms.conversations.length === 0 && (
          <div className="text-center text-white/40 text-[13px] py-6">
            No conversations yet. Open the Listeners tab and tap "Message" on a signed-in listener.
          </div>
        )}
        {dms.conversations.map((c) => (
          <InboxRow key={c.conversation_id} conv={c} meId={meId} onOpen={() => dms.openConversation(c.conversation_id)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => dms.openConversation('')}
          className="flex items-center justify-center rounded-full hover:bg-white/10"
          style={{ width: 28, height: 28, cursor: 'pointer', border: 'none', background: 'transparent' }}
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-white truncate">{openConv?.other.display_name || 'Conversation'}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2" style={{ minHeight: 0 }}>
        {dms.messagesLoading && dms.messages.length === 0 && (
          <div className="text-center text-white/40 text-[13px] py-6">Loading…</div>
        )}
        {!dms.messagesLoading && dms.messages.length === 0 && (
          <div className="text-center text-white/40 text-[13px] py-6">Say hello 👋</div>
        )}
        {dms.messages.map((m) => (
          <DmBubble key={m.id} message={m} meId={meId} />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          void dms.send(text);
          setDraft('');
        }}
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          className="flex-1 rounded-full px-3.5 py-2 text-[13px] text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <button
          type="submit"
          className="flex items-center justify-center rounded-full"
          style={{ width: 36, height: 36, background: '#00C864', cursor: 'pointer', border: 'none' }}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function InboxRow({ conv, meId, onOpen }: { conv: Conversation; meId: string | null; onOpen: () => void }) {
  const last = conv.lastMessage;
  const preview = last ? `${last.sender_id === meId ? 'You: ' : ''}${last.body}` : '';
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-2 px-1 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
      style={{ cursor: 'pointer', border: 'none', background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Avatar url={conv.other.avatar_url} name={conv.other.display_name} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white truncate">{conv.other.display_name}</div>
        <div className="text-[12px] text-white/40 truncate">{preview || 'No messages yet'}</div>
      </div>
      {conv.unread > 0 && (
        <span
          className="flex items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
          style={{ minWidth: 18, height: 18, padding: '0 5px', background: '#00C864' }}
        >
          {conv.unread}
        </span>
      )}
    </button>
  );
}

function DmBubble({ message, meId }: { message: DirectMessage; meId: string | null }) {
  const mine = message.sender_id === meId;
  return (
    <div className="mb-2 flex" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        className="max-w-[75%] rounded-2xl px-3 py-2"
        style={{
          background: mine ? 'rgba(0,200,100,0.2)' : 'rgba(255,255,255,0.08)',
          borderTopRightRadius: mine ? 4 : 12,
          borderTopLeftRadius: mine ? 12 : 4,
        }}
      >
        <div className="text-[13px] text-white break-words leading-snug" dir="auto">
          {message.body}
        </div>
        <div className="text-[10px] text-white/30 mt-0.5 text-right">{timeAgo(message.created_at)}</div>
      </div>
    </div>
  );
}

/* ============================================================================
   Shared bits
   ============================================================================ */
function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full shrink-0 object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.12)', fontSize: Math.max(9, size * 0.4) }}
    >
      <span className="font-bold" style={{ color: '#00C864' }}>
        {(name || '?').trim()[0]?.toUpperCase() ?? '?'}
      </span>
    </span>
  );
}

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  } catch {
    return '';
  }
}
