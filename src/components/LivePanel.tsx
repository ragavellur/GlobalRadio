import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRadioStore } from '../lib/store';
import { useLiveStations } from '../hooks/useLiveStations';
import { useUserDirectory } from '../hooks/useUserDirectory';
import { useDMs } from '../hooks/useDMs';
import { useAuth } from '../lib/auth';
import { useSignInDialog } from './SignInDialog';
import { SUPABASE_ENABLED, type LiveStation } from '../lib/social';
import { stationRoomId } from '../lib/social';
import SlidePanel from './SlidePanel';
import ChatScreen, { ChatAvatar as Avatar } from './ChatScreen';
import { countryName } from '../lib/countryNames';

export default function LivePanel() {
  if (!SUPABASE_ENABLED) return null;
  return <LivePanelInner />;
}

function LivePanelInner() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const stations = useLiveStations(open);
  const listeners = useUserDirectory(open && !!expanded, { stationUrl: expanded ?? undefined });
  const dms = useDMs(open, 'live');
  const { user } = useAuth();
  const { openSignInDialog } = useSignInDialog();
  const { cities, selectedCity, playStation, setPendingStationUrl, openSocialRoom } = useRadioStore();

  const meId = user?.id ?? null;
  const onlineListeners = listeners.filter((u) => u.online && u.user_id !== meId);
  const dmPeer = dms.openId ? dms.conversations.find((c) => c.conversation_id === dms.openId) : null;

  const play = (ls: LiveStation) => {
    setOpen(false);
    const city = cities.find((c) => `${c.city},${c.country}` === ls.city_key);
    if (!city) return;
    const station = { name: ls.station_name, url: ls.station_url };
    if (selectedCity?.cityId === city.cityId) {
      playStation(station);
      return;
    }
    setPendingStationUrl(ls.station_url);
    if ((window as any).__flyToCity) {
      (window as any).__flyToCity(city);
    } else {
      playStation(station);
    }
  };

  const messageUser = (peerId: string) => {
    if (peerId === meId) return;
    if (!meId) {
      openSignInDialog();
      return;
    }
    void dms.startConversation(peerId);
  };

  return (
    <>
      <style>{`@keyframes grPulse{0%{box-shadow:0 0 0 0 rgba(255,59,48,.5)}70%{box-shadow:0 0 0 6px rgba(255,59,48,0)}100%{box-shadow:0 0 0 0 rgba(255,59,48,0)}}`}</style>
      {/* Live button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Live stations"
        title="Stations with listeners right now"
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
        <span className="relative flex items-center">
          <span
            className="absolute -left-2 rounded-full"
            style={{ width: 8, height: 8, background: '#ff3b30', boxShadow: '0 0 0 0 rgba(255,59,48,0.6)', animation: 'grPulse 1.5s infinite' }}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a10 10 0 0 0-6.32 17.78l1.5-1.5A8 8 0 1 1 12 4a8 8 0 0 1 5.66 2.34l1.5-1.5A10 10 0 0 0 12 2zm0 4a6 6 0 0 0-3.8 10.67l1.5-1.5A4 4 0 1 1 12 8a4 4 0 0 1 2.83 1.17l1.5-1.5A6 6 0 0 0 12 6z" />
            <circle cx="12" cy="12" r="2" fill="#ff3b30" />
          </svg>
        </span>
      </button>

      {createPortal(
        <SlidePanel
          open={open}
          onClose={() => setOpen(false)}
          title="Listening now"
          subtitle={stations.length > 0 ? `${stations.length} station${stations.length === 1 ? '' : 's'} live` : 'Updating…'}
        >
          {stations.length === 0 && (
            <div className="p-6 text-center text-white/40 text-[13px]">
              No one is listening to any station right now.
            </div>
          )}
          {stations.map((ls) => (
            <div key={ls.station_url}>
              <div
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <button
                  onClick={() => play(ls)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                  style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
                >
                  <span
                    className="flex items-center justify-center rounded-full text-[11px] font-bold shrink-0"
                    style={{ minWidth: 34, height: 22, padding: '0 8px', background: 'rgba(var(--gr-accent-rgb),0.15)', color: 'var(--gr-accent)' }}
                  >
                    {ls.listeners}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-white truncate" dir="auto">{ls.station_name}</span>
                    <span className="block text-[11px] text-white/40 truncate">
                      {countryName(ls.country)} · {ls.city}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => setExpanded(expanded === ls.station_url ? null : ls.station_url)}
                  aria-label={`Who's listening at ${ls.station_name}`}
                  title="Who's listening"
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{
                    width: 26,
                    height: 26,
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="2.5"
                    style={{ transform: expanded === ls.station_url ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void stationRoomId(ls.station_url).then((id) =>
                      openSocialRoom({ roomId: id, roomName: ls.station_name })
                    );
                  }}
                  aria-label={`Chat about ${ls.station_name}`}
                  title={`Chat about ${ls.station_name}`}
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{
                    width: 26,
                    height: 26,
                    background: 'rgba(var(--gr-accent-rgb),0.12)',
                    border: '1px solid rgba(var(--gr-accent-rgb),0.35)',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr-accent)" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </button>
              </div>
              {expanded === ls.station_url && (
                <div style={{ background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="px-4 pt-2 pb-1 text-[11px] text-white/50">
                    {onlineListeners.length > 0
                      ? `${onlineListeners.length} listener${onlineListeners.length === 1 ? '' : 's'} now`
                      : 'No one else listening right now'}
                  </div>
                  {onlineListeners.map((u) => (
                    <div key={u.user_id} className="flex items-center gap-2 px-4 py-1.5">
                      <Avatar url={u.avatar_url} name={u.display_name} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white truncate">{u.display_name || 'Radio listener'}</div>
                      </div>
                      <button
                        onClick={() => messageUser(u.user_id)}
                        aria-label={`Message ${u.display_name || 'listener'}`}
                        title={`Message ${u.display_name || 'listener'}`}
                        className="flex items-center justify-center shrink-0 rounded-full text-[11px] font-medium"
                        style={{
                          padding: '3px 11px',
                          background: 'rgba(var(--gr-accent-rgb),0.12)',
                          border: '1px solid rgba(var(--gr-accent-rgb),0.35)',
                          color: 'var(--gr-accent)',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        Message
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </SlidePanel>,
        document.body
      )}

      {/* Direct message chat opened from a listener row */}
      {createPortal(
        dms.openId ? (
          <ChatScreen
            title={dmPeer?.other.display_name || 'Conversation'}
            subtitle="Direct message"
            avatarUrl={dmPeer?.other.avatar_url ?? null}
            messages={dms.messages}
            meId={meId}
            showNames={false}
            loading={dms.messagesLoading}
            emptyText="No messages yet. Say hello!"
            onSend={(text) => dms.send(text)}
            onBack={() => dms.openConversation('')}
            onRequireSignIn={() => openSignInDialog()}
          />
        ) : null,
        document.body
      )}
    </>
  );
}
