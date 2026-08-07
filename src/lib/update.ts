import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

async function unregisterNativeServiceWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  if (regs.length > 0) {
    const controllers = await navigator.serviceWorker.getRegistrations();
    if (controllers.length === 0 && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }
}

type UpdateListener = (available: boolean) => void;

const POLL_INTERVAL_MS = 30_000;

let available = false;
let updateSW: (() => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;
const listeners = new Set<UpdateListener>();
let initialized = false;

function notify(value: boolean) {
  available = value;
  listeners.forEach((cb) => cb(value));
}

export function isUpdateAvailable() {
  return available;
}

export function subscribeUpdate(cb: UpdateListener) {
  listeners.add(cb);
  cb(available);
  return () => {
    listeners.delete(cb);
  };
}

async function checkForUpdates() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  } catch {
    // ignore
  }
}

export async function applyUpdate() {
  const before = await navigator.serviceWorker.getRegistration();
  if (updateSW && before?.waiting) {
    // Tell the waiting worker to skip waiting; vite-plugin-pwa reloads the
    // page once the new worker takes control.
    await updateSW();
    return;
  }
  // No worker is waiting (already activated, still installing, or none), so
  // SKIP_WAITING would be a no-op. Force a reload so the new code loads.
  window.location.reload();
}

export function dismissUpdate() {
  notify(false);
}

export function initUpdateSystem() {
  if (initialized) return;
  initialized = true;

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  if (Capacitor.isNativePlatform()) {
    void unregisterNativeServiceWorkers();
    return;
  }

  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swScriptUrl, reg) {
      registration = reg ?? null;
    },
    onNeedRefresh() {
      notify(true);
    },
    onOfflineReady() {},
  });

  navigator.serviceWorker.addEventListener('updatefound', () => {
    if (!navigator.serviceWorker.controller) return;
    const installing = registration?.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') notify(true);
    });
  });

  // Check right after load (in case the browser's own navigation check was
  // skipped), then keep polling while the tab is open.
  setTimeout(checkForUpdates, 5_000);
  setInterval(checkForUpdates, POLL_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkForUpdates();
    } else if (available) {
      applyUpdate();
    }
  });
}
