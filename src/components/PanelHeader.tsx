export default function PanelHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          title="Back"
          className="flex items-center justify-center shrink-0 rounded-full transition-colors hover:bg-white/10"
          style={{
            width: 24,
            height: 24,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className="text-[13px] font-semibold" style={{ color: 'var(--gr-accent)' }}>{title}</div>
    </div>
  );
}
