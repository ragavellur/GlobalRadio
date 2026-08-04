import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
import type { Conversation, UserDirectoryEntry } from '../lib/social';
import type { City } from '../types';
import SlidePanel from './SlidePanel';
import ChatScreen, { ChatAvatar as Avatar } from './ChatScreen';

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

  const openConv = dms.openId ? dms.conversations.find((c) => c.conversation_id === dms.openId) : null;

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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
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

      {socialRoom ? (
        createPortal(
          <ChatScreen
            title={socialRoom.roomName}
            subtitle="Group chat"
            messages={chat.messages}
            meId={user?.id ?? null}
            showNames
            loading={chat.loading}
            emptyText="No messages yet. Say hello!"
            onSend={async (text) => {
              await chat.send(text);
              return true;
            }}
            onBack={closeSocial}
            onRequireSignIn={() => openSignInDialog()}
          />,
          document.body
        )
      ) : socialOpen && dms.openId ? (
        createPortal(
          <ChatScreen
            title={openConv?.other.display_name || 'Conversation'}
            subtitle="Direct message"
            avatarUrl={openConv?.other.avatar_url ?? null}
            messages={dms.messages}
            meId={user?.id ?? null}
            showNames={false}
            loading={dms.messagesLoading}
            emptyText="No messages yet. Say hello!"
            onSend={(text) => dms.send(text)}
            onBack={() => dms.openConversation('')}
            onRequireSignIn={() => openSignInDialog()}
          />,
          document.body
        )
      ) : (
        createPortal(
          <SlidePanel
            open={socialOpen}
            onClose={closeSocial}
            title="People"
            subtitle="Find listeners & message them"
          >
            <PeopleView
              city={city}
              station={station}
              dms={dms}
              meId={user?.id ?? null}
              onDm={startDmTo}
              onRequireSignIn={() => openSignInDialog()}
            />
          </SlidePanel>,
          document.body
        )
      )}
    </>
  );
}

/* ============================================================================
   People (directory + DMs inbox)
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
