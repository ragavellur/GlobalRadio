import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useRadioStore } from '../lib/store';
import { useSignInDialog } from './SignInDialog';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { useRoomChat } from '../hooks/useRoomChat';
import { useDMs } from '../hooks/useDMs';
import { useUserDirectory } from '../hooks/useUserDirectory';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { cityKeyOf } from '../lib/social';
import { countryName } from '../lib/countryNames';
import type { RoomMessage, Conversation, UserDirectoryEntry } from '../lib/social';
import type { City } from '../types';
import SlidePanel from './SlidePanel';

export default function SocialPanel() {
  if (!SUPABASE_ENABLED) return null;
  return <SocialPanelInner />;
}

function SocialPanelInner() {
  const { user } = useAuth();
  const { openSignInDialog } = useSignInDialog();
  const { selectedCity, currentStation, socialOpen, socialRoom, openSocial, closeSocial } = useRadioStore();

  const city = selectedCity;
  const station = currentStation;
  const dms = useDMs(!!user);
  const hb = useHeartbeat();

  const chat = useRoomChat(
    socialOpen && socialRoom ? socialRoom.roomId : null,
    socialRoom?.roomName ?? ''
  );

  const dmUnread = hb.unread.filter((u) => u.conversation_id !== dms.openId).reduce((n, u) => n + u.unread, 0);

  const startDmTo = useCallback(
    (peerId: string) => {
      void dms.startConversation(peerId);
    },
    [dms]
  );

  return (
    <>
      {/* People button */}
      <button
        onClick={() => (socialOpen ? closeSocial() : openSocial())}
        aria-label="People"
        title="Find listeners & message them"
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

      <SlidePanel
        open={socialOpen}
        onClose={closeSocial}
        title={socialRoom ? socialRoom.roomName : 'People'}
        subtitle={socialRoom ? 'Group chat' : 'Find listeners & message them'}
      >
        {socialRoom ? (
          <RoomChatView
            meId={user?.id ?? null}
            roomName={socialRoom.roomName}
            messages={chat.messages}
            loading={chat.loading}
            onSend={chat.send}
            onBack={closeSocial}
            onRequireSignIn={() => openSignInDialog()}
          />
        ) : dms.openId ? (
          <DmThread
            dms={dms}
            meId={user?.id ?? null}
            onBack={() => dms.openConversation('')}
          />
        ) : (
          <PeopleView
            city={city}
            station={station}
            dms={dms}
            meId={user?.id ?? null}
            onDm={startDmTo}
            onRequireSignIn={() => openSignInDialog()}
          />
        )}
      </SlidePanel>
    </>
  );
}

/* ============================================================================
   WhatsApp-style chat primitives (shared by group chat + DMs)
   ============================================================================ */

const CHAT_BG = '#0b141a';
const INCOMING_BUBBLE = '#202c33';
const OUTGOING_BUBBLE = '#005c4b';
const CHAT_TEXT = '#e9edef';
const CHAT_META = 'rgba(233,237,239,0.55)';
const CHAT_DAY_BG = '#182229';
const CHAT_DAY_TEXT = '#8696a0';
const CHAT_INPUT_BG = '#1f2c33';
const CHAT_INPUT_FIELD = '#2a3942';
const CHAT_SEND = '#00a884';

// Faint doodle tile, mirrors WhatsApp's chat wallpaper.
const CHAT_WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='280'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.055' stroke-width='3' stroke-linecap='round'%3E%3Ccircle cx='40' cy='40' r='10'/%3E%3Cpath d='M120 30c8 0 14 6 14 14s-6 14-14 14-14-6-14-14'/%3E%3Cpath d='M200 50c-10-8-10-24 0-32'/%3E%3Ccircle cx='260' cy='30' r='6'/%3E%3Cpath d='M30 120c6-6 14-6 20 0s14 6 20 0'/%3E%3Ccircle cx='140' cy='110' r='8'/%3E%3Cpath d='M210 100c10 4 16 12 18 22'/%3E%3Ccircle cx='30' cy='250' r='6'/%3E%3Cpath d='M120 240c8 0 14 6 14 14'/%3E%3Ccircle cx='250' cy='250' r='10'/%3E%3Cpath d='M180 200c-8 6-20 6-28 0'/%3E%3Cpath d='M240 180l10 20'/%3E%3Cpath d='M60 180c12 0 12 12 24 12'/%3E%3Ccircle cx='260' cy='130' r='5'/%3E%3C/g%3E%3C/svg%3E\")";

const NAME_COLORS = ['#f47b6a', '#7ee081', '#f5b761', '#7f8ef4', '#a5f4f4', '#f5a8d0'];

function colorForName(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function DayChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center" style={{ margin: '6px 0 10px' }}>
      <span
        className="px-2.5 py-0.5 rounded-lg font-medium tracking-wide uppercase"
        style={{ background: CHAT_DAY_BG, color: CHAT_DAY_TEXT, fontSize: 11 }}
      >
        {label}
      </span>
    </div>
  );
}

function Tick({ mine }: { mine: boolean }) {
  if (!mine) return null;
  return (
    <svg width="14" height="12" viewBox="0 0 18 12" style={{ flexShrink: 0 }}>
      <path
        d="M1 6l4 4 8-9"
        stroke="rgba(233,237,239,0.6)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

interface ChatRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

// One WhatsApp bubble (tail on the first of a run, time + tick inside).
function ChatBubble({
  mine,
  name,
  nameColor,
  firstInGroup,
  body,
  time,
}: {
  mine: boolean;
  name?: string;
  nameColor?: string;
  firstInGroup: boolean;
  body: string;
  time: string;
}) {
  return (
    <div
      className="flex"
      style={{ justifyContent: mine ? 'flex-end' : 'flex-start', paddingBottom: 2 }}
    >
      <div
        className="relative"
        style={{
          maxWidth: '78%',
          background: mine ? OUTGOING_BUBBLE : INCOMING_BUBBLE,
          color: CHAT_TEXT,
          padding: '6px 8px 6px 9px',
          borderRadius: 7.5,
          borderTopLeftRadius: !mine && firstInGroup ? 0 : 7.5,
          borderTopRightRadius: mine && firstInGroup ? 0 : 7.5,
          boxShadow: '0 1px 1px rgba(0,0,0,0.2)',
          fontSize: 13.5,
          lineHeight: 1.35,
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      >
        {name && (
          <div style={{ color: nameColor, fontWeight: 600, fontSize: 12.5, marginBottom: 1 }}>
            {name}
          </div>
        )}
        <div dir="auto" style={{ whiteSpace: 'pre-wrap' }}>
          {body}
        </div>
        <div
          className="flex items-center"
          style={{
            float: 'right',
            margin: '4px 0 -2px 8px',
            gap: 3,
            color: mine ? 'rgba(233,237,239,0.65)' : CHAT_META,
          }}
        >
          <span style={{ fontSize: 10.5, lineHeight: 1 }}>{time}</span>
          <Tick mine={mine} />
        </div>
      </div>
    </div>
  );
}

// WhatsApp-style composer: rounded field + green circular send button.
function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  error: string | null;
  disabled?: boolean;
}) {
  return (
    <form
      className="shrink-0"
      style={{ background: CHAT_INPUT_BG, padding: '8px 10px', borderTop: '1px solid rgba(11,20,26,0.8)' }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {error && (
        <div className="px-1 pb-1.5 text-[12px]" style={{ color: '#ff8a80' }}>
          {error}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 rounded-lg outline-none disabled:opacity-60"
          style={{
            background: CHAT_INPUT_FIELD,
            color: CHAT_TEXT,
            fontSize: 13.5,
            padding: '9px 12px',
            border: 'none',
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity"
          style={{
            width: 40,
            height: 40,
            background: CHAT_SEND,
            cursor: 'pointer',
            border: 'none',
            color: '#fff',
            opacity: value.trim() ? 1 : 0.6,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </div>
    </form>
  );
}

function ChatEmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1" style={{ minHeight: 0, background: CHAT_BG }}>
      <span className="text-[13px]" style={{ color: CHAT_META }}>
        {text}
      </span>
    </div>
  );
}

/* ============================================================================
   Group chat (opened from a city or station chat icon)
   ============================================================================ */
function RoomChatView({
  meId,
  roomName,
  messages,
  loading,
  onSend,
  onBack,
  onRequireSignIn,
}: {
  meId: string | null;
  roomName: string;
  messages: RoomMessage[];
  loading: boolean;
  onSend: (body: string) => Promise<void>;
  onBack: () => void;
  onRequireSignIn: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    if (!meId) {
      onRequireSignIn();
      return;
    }
    setSendError(null);
    void onSend(text).then(() => setDraft(''));
  };

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      <div
        className="flex items-center gap-2 px-2 py-2 shrink-0"
        style={{ background: CHAT_INPUT_BG, borderBottom: '1px solid rgba(11,20,26,0.8)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center rounded-full hover:bg-white/10"
          style={{ width: 32, height: 32, cursor: 'pointer', border: 'none', background: 'transparent' }}
          aria-label="Close chat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(233,237,239,0.8)" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span
          className="flex items-center justify-center rounded-full shrink-0 font-bold"
          style={{ width: 30, height: 30, background: CHAT_INPUT_FIELD, color: CHAT_SEND, fontSize: 14 }}
        >
          {(roomName.trim()[0] ?? 'G').toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-white truncate" style={{ color: CHAT_TEXT }}>
            {roomName}
          </div>
          <div className="text-[11.5px] truncate" style={{ color: CHAT_META }}>
            Group chat
          </div>
        </div>
      </div>

      {loading && messages.length === 0 ? (
        <ChatEmptyHint text="Loading chat…" />
      ) : messages.length === 0 ? (
        <ChatEmptyHint text="No messages yet. Say hello!" />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="mx-auto px-2 py-2.5" style={{ maxWidth: 860, background: CHAT_BG, backgroundImage: CHAT_WALLPAPER, backgroundSize: '280px 280px' }}>
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const mine = m.sender_id === meId;
              const sameSender = !!prev && prev.sender_id === m.sender_id;
              const timeGap = prev ? new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() : Infinity;
              const firstInGroup = !sameSender || timeGap > 5 * 60 * 1000;
              const groupEnd = !next || next.sender_id !== m.sender_id || new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > 5 * 60 * 1000;
              return (
                <div key={m.id} style={{ marginBottom: groupEnd ? 8 : 2 }}>
                  {(!prev || !sameDay(prev.created_at, m.created_at)) && <DayChip label={dayLabel(m.created_at)} />}
                  <ChatBubble
                    mine={mine}
                    firstInGroup={firstInGroup}
                    body={m.body}
                    time={clock(m.created_at)}
                    name={mine ? undefined : m.profiles?.display_name || 'Radio listener'}
                    nameColor={mine ? undefined : colorForName(m.sender_id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        placeholder={meId ? 'Message' : 'Sign in to chat…'}
        error={sendError}
        disabled={!meId}
      />
    </div>
  );
}

/* ============================================================================
   People (directory + DMs)
   ============================================================================ */
type UsersScope = 'all' | 'country' | 'city' | 'station';

function PeopleView({
  city,
  station,
  dms,
  meId,
  onDm,
  onRequireSignIn,
}: {
  city: City | null;
  station: { name: string; url: string } | null;
  dms: ReturnType<typeof useDMs>;
  meId: string | null;
  onDm: (peerId: string) => void;
  onRequireSignIn: () => void;
}) {
  const [scope, setScope] = useState<UsersScope>('all');

  const directoryScope = useMemo(() => {
    if (scope === 'country' && city) return { country: city.country };
    if (scope === 'city' && city) return { cityKey: cityKeyOf(city) };
    if (scope === 'station' && station) return { stationUrl: station.url };
    return {};
  }, [scope, city, station]);

  const users = useUserDirectory(true, directoryScope);

  const chips: { key: UsersScope; label: string }[] = [
    { key: 'all', label: 'All' },
    ...(city ? [{ key: 'country' as const, label: countryName(city.country) }] : []),
    ...(city ? [{ key: 'city' as const, label: city.city }] : []),
    ...(station ? [{ key: 'station' as const, label: station.name }] : []),
  ];

  return (
    <div className="px-3 py-2">
      {dms.conversations.length > 0 && (
        <>
          <div className="text-[12px] text-white/60 font-medium mt-1 mb-1">Messages</div>
          {dms.conversations.map((c) => (
            <InboxRow key={c.conversation_id} conv={c} meId={meId} onOpen={() => dms.openConversation(c.conversation_id)} />
          ))}
        </>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setScope(c.key)}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={{
              cursor: 'pointer',
              border: 'none',
              background: scope === c.key ? 'rgba(0,200,100,0.2)' : 'rgba(255,255,255,0.08)',
              color: scope === c.key ? '#00C864' : 'rgba(255,255,255,0.6)',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {users.length === 0 ? (
        <div className="text-[13px] text-white/35 py-4 text-center">
          No users found{scope !== 'all' ? ' in this area' : ''}.
        </div>
      ) : (
        <div className="mb-2 text-[11px] text-white/40">
          {users.length} user{users.length === 1 ? '' : 's'}
        </div>
      )}
      {users.map((u) => (
        <UserRow key={u.user_id} user={u} meId={meId} onDm={onDm} onRequireSignIn={onRequireSignIn} />
      ))}
    </div>
  );
}

function UserRow({
  user,
  meId,
  onDm,
  onRequireSignIn,
}: {
  user: UserDirectoryEntry;
  meId: string | null;
  onDm: (peerId: string) => void;
  onRequireSignIn: () => void;
}) {
  const isSelf = user.user_id === meId;

  let status: string;
  if (user.online) {
    status = user.station_name
      ? `Listening to ${user.station_name}${user.city ? ` · ${user.city}${user.country ? `, ${user.country}` : ''}` : ''}`
      : 'Online';
  } else if (user.station_name) {
    status = `Last on ${user.station_name}`;
  } else if (user.last_active_at) {
    status = `Last active ${timeAgo(user.last_active_at)}`;
  } else {
    status = 'No activity yet';
  }

  return (
    <button
      onClick={() => {
        if (isSelf) return;
        if (meId) onDm(user.user_id);
        else onRequireSignIn();
      }}
      className="w-full flex items-center gap-2 py-2 rounded-lg hover:bg-white/5 transition-colors px-1 text-left"
      style={{ cursor: isSelf ? 'default' : 'pointer', border: 'none', background: 'transparent' }}
    >
      <Avatar url={user.avatar_url} name={user.display_name} size={26} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] text-white truncate">
          {user.display_name || 'Radio listener'}
          {user.online && (
            <span
              className="rounded-full shrink-0"
              style={{ width: 7, height: 7, background: '#00C864' }}
              title="Online now"
            />
          )}
        </div>
        <div className="text-[11px] text-white/40 truncate">{status}</div>
      </div>
    </button>
  );
}

/* ============================================================================
   DM thread
   ============================================================================ */
function DmThread({
  dms,
  meId,
  onBack,
}: {
  dms: ReturnType<typeof useDMs>;
  meId: string | null;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const openConv = dms.openId ? dms.conversations.find((c) => c.conversation_id === dms.openId) : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dms.messages.length, dms.openId]);

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      <div
        className="flex items-center gap-2 px-2 py-2 shrink-0"
        style={{ background: CHAT_INPUT_BG, borderBottom: '1px solid rgba(11,20,26,0.8)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center rounded-full hover:bg-white/10"
          style={{ width: 32, height: 32, cursor: 'pointer', border: 'none', background: 'transparent' }}
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(233,237,239,0.8)" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <Avatar url={openConv?.other.avatar_url ?? null} name={openConv?.other.display_name ?? '?'} size={30} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] truncate" style={{ color: CHAT_TEXT }}>
            {openConv?.other.display_name || 'Conversation'}
          </div>
          <div className="text-[11.5px] truncate" style={{ color: CHAT_META }}>
            Direct message
          </div>
        </div>
      </div>

      {dms.messagesLoading && dms.messages.length === 0 ? (
        <ChatEmptyHint text="Loading…" />
      ) : dms.messages.length === 0 ? (
        <ChatEmptyHint text="No messages yet. Say hello!" />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div
            className="mx-auto px-2 py-2.5"
            style={{ maxWidth: 860, background: CHAT_BG, backgroundImage: CHAT_WALLPAPER, backgroundSize: '280px 280px' }}
          >
            {dms.messages.map((m, i) => {
              const prev = dms.messages[i - 1];
              const next = dms.messages[i + 1];
              const mine = m.sender_id === meId;
              const sameSender = !!prev && prev.sender_id === m.sender_id;
              const timeGap = prev ? new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() : Infinity;
              const firstInGroup = !sameSender || timeGap > 5 * 60 * 1000;
              const groupEnd = !next || next.sender_id !== m.sender_id || new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > 5 * 60 * 1000;
              return (
                <div key={m.id} style={{ marginBottom: groupEnd ? 8 : 2 }}>
                  {(!prev || !sameDay(prev.created_at, m.created_at)) && <DayChip label={dayLabel(m.created_at)} />}
                  <ChatBubble mine={mine} firstInGroup={firstInGroup} body={m.body} time={clock(m.created_at)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSubmit={() => {
          const text = draft.trim();
          if (!text) return;
          setSendError(null);
          void dms.send(text).then((ok) => {
            if (ok) setDraft('');
            else setSendError("Message couldn't be sent. Try again.");
          });
        }}
        placeholder="Message"
        error={sendError}
      />
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

/* ============================================================================
   Shared bits
   ============================================================================ */
function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
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
