import { memo, useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================================
   Full-screen, WhatsApp-style chat screen.
   Layout: fixed header / single scrollable message list / fixed composer.
   Only the message list scrolls; messages never render under header/composer.
   ============================================================================ */

export interface ChatMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

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

/* ------------------------------- Avatar ---------------------------------- */

export function ChatAvatar({
  url,
  name,
  size = 40,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
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
      className="flex items-center justify-center rounded-full shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: 'var(--gr-chat-field)',
        fontSize: Math.max(10, size * 0.4),
      }}
      aria-hidden="true"
    >
      <span className="font-bold" style={{ color: 'var(--gr-chat-send)' }}>
        {(name || '?').trim()[0]?.toUpperCase() ?? '?'}
      </span>
    </span>
  );
}

/* --------------------------- Day marker chip ----------------------------- */

const DayChip = memo(function DayChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center" style={{ margin: '14px 0 10px' }}>
      <span
        className="rounded-lg px-2.5 py-1 font-medium uppercase tracking-wide"
        style={{ background: 'var(--gr-chat-day-bg)', color: 'var(--gr-chat-day-text)', fontSize: 11 }}
      >
        {label}
      </span>
    </div>
  );
});

/* --------------------------- Delivered tick ------------------------------ */

const Tick = memo(function Tick({ mine }: { mine: boolean }) {
  if (!mine) return null;
  return (
    <svg width="15" height="11" viewBox="0 0 18 12" className="shrink-0" aria-hidden="true">
      <path
        d="M1 6l4 4 8-9"
        stroke="var(--gr-chat-tick)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
});

/* ------------------------------- Bubble ---------------------------------- */

const ChatMessageRow = memo(function ChatMessageRow({
  msg,
  mine,
  firstInGroup,
  groupEnd,
  showName,
}: {
  msg: ChatMessage;
  mine: boolean;
  firstInGroup: boolean;
  groupEnd: boolean;
  showName: boolean;
}) {
  const senderName = msg.profiles?.display_name || 'Radio listener';
  const nameColor = colorForName(msg.sender_id);

  return (
    <div className="grx-chat-in flex" style={{ justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: groupEnd ? 10 : 2 }}>
      <div
        className="max-w-[85%] rounded-xl px-3 py-1.5 lg:max-w-[70%]"
        style={{
          background: mine ? 'var(--gr-chat-outgoing)' : 'var(--gr-chat-incoming)',
          color: 'var(--gr-chat-text)',
          borderTopLeftRadius: !mine && firstInGroup ? 4 : 12,
          borderTopRightRadius: mine && firstInGroup ? 4 : 12,
          boxShadow: 'var(--gr-chat-bubble-shadow)',
        }}
      >
        {showName && (
          <div className="mb-0.5 text-[13px] font-semibold leading-tight" style={{ color: nameColor }}>
            {senderName}
          </div>
        )}
        <div
          dir="auto"
          className="text-[15px] leading-[1.5] [overflow-wrap:anywhere] whitespace-pre-wrap"
        >
          {msg.body}
        </div>
        <div className="mt-0.5 flex items-center justify-end gap-1" style={{ color: mine ? 'var(--gr-chat-meta)' : 'var(--gr-chat-meta)' }}>
          <span className="text-[11px] leading-none">{clock(msg.created_at)}</span>
          <Tick mine={mine} />
        </div>
      </div>
    </div>
  );
});

/* --------------------------- Message list -------------------------------- */

export function ChatMessageList({
  messages,
  meId,
  showNames,
}: {
  messages: ChatMessage[];
  meId: string | null;
  showNames: boolean;
}) {
  const rows = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const mine = m.sender_id === meId;
    const sameSender = !!prev && prev.sender_id === m.sender_id;
    const timeGap = prev ? new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() : Infinity;
    const firstInGroup = !sameSender || timeGap > 5 * 60 * 1000;
    const groupEnd =
      !next ||
      next.sender_id !== m.sender_id ||
      new Date(next.created_at).getTime() - new Date(m.created_at).getTime() > 5 * 60 * 1000;

    if (!prev || !sameDay(prev.created_at, m.created_at)) {
      rows.push(<DayChip key={`day-${m.id}`} label={dayLabel(m.created_at)} />);
    }
    rows.push(
      <ChatMessageRow
        key={m.id}
        msg={m}
        mine={mine}
        firstInGroup={firstInGroup}
        groupEnd={groupEnd}
        showName={showNames && !mine}
      />
    );
  }
  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-10">
      {rows}
    </div>
  );
}

/* ------------------------------- Composer -------------------------------- */

function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
  error: string | null;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value]);

  return (
    <form
      className="shrink-0"
      style={{ background: 'var(--gr-chat-composer)', boxShadow: 'var(--gr-chat-header-shadow)' }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {error && (
        <div className="px-4 pb-1.5 pt-2 text-[12.5px] sm:px-6 lg:px-10" style={{ color: '#ff7b7b' }} role="alert">
          {error}
        </div>
      )}
      <div
        className="mx-auto flex max-w-[1000px] items-end gap-2 px-4 pt-2 sm:px-6 lg:px-10"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          name="message"
          aria-label="Message"
          className="grx-chat-focus block min-h-[48px] w-full flex-1 resize-none rounded-2xl px-4 py-3 text-[15px] leading-6 outline-none disabled:opacity-60"
          style={{
            background: 'var(--gr-chat-field)',
            color: 'var(--gr-chat-field-text)',
            maxHeight: 132,
            caretColor: 'var(--gr-chat-field-text)',
            boxShadow: 'var(--gr-chat-bubble-shadow)',
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={disabled}
          className="grx-chat-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 active:scale-95 disabled:cursor-not-allowed"
          style={{
            background: 'var(--gr-chat-send)',
            color: '#fff',
            cursor: disabled ? 'pointer' : 'pointer',
            border: 'none',
            opacity: disabled ? 0.85 : value.trim() ? 1 : 0.55,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </div>
    </form>
  );
}

/* -------------------------------- Screen --------------------------------- */

export default function ChatScreen({
  title,
  subtitle,
  avatarUrl,
  messages,
  meId,
  showNames,
  loading,
  emptyText,
  onSend,
  onBack,
  onRequireSignIn,
}: {
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  messages: ChatMessage[];
  meId: string | null;
  showNames: boolean;
  loading: boolean;
  emptyText: string;
  onSend: (body: string) => Promise<boolean>;
  onBack: () => void;
  onRequireSignIn: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  const lastMsgId = messages.length ? messages[messages.length - 1].id : null;

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (!stickRef.current) return;
    scrollToBottom(messages.length > 2);
  }, [lastMsgId, scrollToBottom, messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || sending) return;
    if (!meId) {
      onRequireSignIn();
      return;
    }
    setSending(true);
    setError(null);
    void onSend(text)
      .then((ok) => {
        if (ok) setDraft('');
        else setError("Message couldn't be sent. Try again.");
      })
      .catch(() => setError("Message couldn't be sent. Try again."))
      .finally(() => setSending(false));
  }, [draft, sending, meId, onSend, onRequireSignIn]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--gr-chat-bg)' }}
    >
      {/* Fixed header */}
      <header
        className="shrink-0"
        style={{ background: 'var(--gr-chat-header)', boxShadow: 'var(--gr-chat-header-shadow)', zIndex: 1 }}
      >
        <div className="flex h-14 items-center gap-1 px-1 sm:px-3">
          <button
            onClick={onBack}
            aria-label="Back"
            className="grx-chat-focus flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-black/10 active:bg-black/15"
            style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--gr-chat-text)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="mr-2 shrink-0">
            <ChatAvatar url={avatarUrl ?? null} name={title} size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-semibold leading-tight" style={{ color: 'var(--gr-chat-text)' }}>
              {title}
            </div>
            <div className="truncate text-[12px] leading-tight" style={{ color: 'var(--gr-chat-meta)' }}>
              {subtitle}
            </div>
          </div>
        </div>
      </header>

      {/* The only scrollable region */}
      <main
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label={title}
        className="grx-chat-wallpaper grx-chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-[13.5px]" style={{ color: 'var(--gr-chat-meta)' }}>
              Loading chat…
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-[13.5px]" style={{ color: 'var(--gr-chat-meta)' }}>
              {emptyText}
            </span>
          </div>
        ) : (
          <ChatMessageList messages={messages} meId={meId} showNames={showNames} />
        )}
      </main>

      {/* Fixed composer */}
      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        placeholder={meId ? 'Message' : 'Sign in to chat…'}
        disabled={!meId}
        error={error}
      />
    </div>
  );
}
