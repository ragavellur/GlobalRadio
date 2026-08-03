import { registerSW } from 'virtual:pwa-register';

type UpdateListener = (available: boolean) => void;

const POLL_INTERVAL_MS = 5 * 60 * 1000;

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

export function applyUpdate() {
  if (updateSW) {
    updateSW();
  } else {
    window.location.reload();
  }
}

export function dismissUpdate() {
  notify(false);
}

export function initUpdateSystem() {
  if (initialized) return;
  initialized = true;

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

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

  setInterval(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.update();
    } catch {
      // ignore
    }
  }, POLL_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && available) {
      applyUpdate();
    }
  });
}
