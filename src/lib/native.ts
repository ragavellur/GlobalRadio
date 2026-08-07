import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from './supabase';
import { parseRoute, setRoute } from './router';

export const AUTH_REDIRECT = 'globalradio://auth';
export const SONOS_REDIRECT = 'globalradio://sonos-callback';

export const isNative = (): boolean => Capacitor.isNativePlatform();

// Register the deep-link handlers used by the native shell. On Android the
// WebView loads from https://localhost (androidScheme), so OAuth flows must
// round-trip through custom-scheme URLs and return to the still-open app via
// the appUrlOpen event. Outside native, all of this is a no-op.
export function initNativeDeepLinks(): void {
  if (!isNative()) return;

  void App.getLaunchUrl().then((res) => {
    if (res?.url) void handleIncomingUrl(res.url);
  });

  App.addListener('appUrlOpen', ({ url }) => {
    void handleIncomingUrl(url);
  });
}

async function handleIncomingUrl(url: string): Promise<void> {
  try {
    let u: URL;
    try {
      u = new URL(url);
    } catch (e) {
      console.warn('handleIncomingUrl: bad URL', url, e);
      return;
    }

    if (u.protocol === 'globalradio:') {
      const target = (u.hostname || u.pathname.replace(/^\/+/, '')).toLowerCase();
      if (target === 'auth') {
        const code = u.searchParams.get('code');
        if (code && supabase) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } else if (target === 'sonos-callback') {
        window.dispatchEvent(new CustomEvent('sonos-callback', { detail: url }));
      } else if (u.hostname || u.pathname.startsWith('/')) {
        const routePath = '/' + (u.hostname ? u.hostname + u.pathname : u.pathname);
        setRoute(parseRoute(routePath));
      }
      return;
    }

    if (u.hash) {
      setRoute(parseRoute(u.hash));
    }
  } catch (e) {
    console.error('handleIncomingUrl error:', e);
  }
}
