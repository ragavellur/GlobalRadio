import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { setPendingFavorite } from '../lib/favorites';
import type { NewFavorite } from '../lib/supabase';

interface SignInDialogValue {
  openSignInDialog: (fav?: NewFavorite) => void;
}

const SignInDialogContext = createContext<SignInDialogValue | null>(null);

export function SignInDialogProvider({ children }: { children: ReactNode }) {
  const { signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);

  const openSignInDialog = useCallback((fav?: NewFavorite) => {
    if (fav) setPendingFavorite(fav);
    setOpen(true);
  }, []);

  const value = useMemo<SignInDialogValue>(() => ({ openSignInDialog }), [openSignInDialog]);

  return (
    <SignInDialogContext.Provider value={value}>
      {children}
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 60, pointerEvents: 'auto' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-2xl p-6 mx-4 max-w-sm w-full"
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-[18px] font-semibold mb-1">Sign in to save favorites</h2>
            <p className="text-white/50 text-[13px] mb-5">
              Sign in with Google to save your favorite stations. No account needed otherwise.
            </p>

            <button
              onClick={() => signInWithGoogle()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-[14px] text-[#333] font-medium transition-colors"
              style={{ background: '#ffffff', cursor: 'pointer', border: 'none' }}
            >
              <GoogleG />
              Continue with Google
            </button>

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 mt-2 rounded-full text-[14px] text-white/60 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', cursor: 'pointer', border: 'none' }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </SignInDialogContext.Provider>
  );
}

export function useSignInDialog() {
  const ctx = useContext(SignInDialogContext);
  if (!ctx) throw new Error('useSignInDialog must be used within SignInDialogProvider');
  return ctx;
}

export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.2 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.2 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.3 34.9 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}
