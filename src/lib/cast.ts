// Google Cast (Chromecast / Google Home) sender integration.
//
// Loads the Cast Web Sender SDK on demand and streams a live radio station to
// a Cast-enabled device using the Default Media Receiver, so no receiver
// registration or API key is required. Once casting starts, the device pulls
// the stream itself and playback continues even if this tab is closed.

/// <reference types="chromecast-caf-sender" />

import type { Station } from '../types';

const CAST_SDK_URL =
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const DEFAULT_MEDIA_RECEIVER_APP_ID = 'CC1AD845';

export interface CastStateInfo {
  available: boolean;
  connected: boolean;
  devicesAvailable: boolean;
  deviceName: string | null;
  error?: string | null;
}

type CastListener = (state: CastStateInfo) => void;

let sdkPromise: Promise<void> | null = null;
let initialized = false;
const listeners = new Set<CastListener>();

const CODEC_MIME: Record<string, string> = {
  MP3: 'audio/mpeg',
  AAC: 'audio/aac',
  'AAC+': 'audio/aac',
  AACPLUS: 'audio/aac',
  OGG: 'audio/ogg',
  VORBIS: 'audio/ogg',
  OPUS: 'audio/ogg',
  FLAC: 'audio/flac',
  WAV: 'audio/wav',
  WEBM: 'audio/webm',
  HLS: 'application/vnd.apple.mpegurl',
};

function contentTypeFor(codec?: string): string {
  if (!codec) return 'audio/mpeg';
  return CODEC_MIME[codec.trim().toUpperCase()] ?? 'audio/mpeg';
}

function sdkLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.cast?.framework !== 'undefined';
}

function loadCastSdk(): Promise<void> {
  if (sdkLoaded()) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const win = window as unknown as { __onGCastApiAvailable?: (available: boolean) => void };
    const existing = win.__onGCastApiAvailable;
    win.__onGCastApiAvailable = (available: boolean) => {
      if (existing) existing(available);
      if (available) resolve();
      else
        reject(
          new Error(
            "Google Cast isn't available in this app. Use the Chrome web version, Air Play, or Sonos."
          )
        );
    };
    const script = document.createElement('script');
    script.src = CAST_SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Google Cast'));
    document.head.appendChild(script);
    window.setTimeout(() => {
      if (!sdkLoaded()) reject(new Error('Google Cast took too long to load'));
    }, 15000);
  });
  return sdkPromise;
}

function context() {
  return window.cast.framework.CastContext.getInstance();
}

function currentState(): CastStateInfo {
  const info: CastStateInfo = {
    available: false,
    connected: false,
    devicesAvailable: false,
    deviceName: null,
  };
  try {
    if (!sdkLoaded()) return info;
    info.available = true;
    const ctx = context();
    const state = ctx.getCastState();
    info.connected = state === window.cast.framework.CastState.CONNECTED;
    info.devicesAvailable = state !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE;
    const session = ctx.getCurrentSession();
    info.deviceName = session ? session.getCastDevice().friendlyName : null;
  } catch {
    // SDK present but not initialized yet
  }
  return info;
}

function notify(): void {
  const state = currentState();
  listeners.forEach((l) => l(state));
}

function initCast(): void {
  if (initialized) return;
  initialized = true;
  const ctx = context();
  ctx.setOptions({
    receiverApplicationId: DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  ctx.addEventListener(window.cast.framework.CastContextEventType.CAST_STATE_CHANGED, notify);
  ctx.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED, notify);
  notify();
}

export async function ensureCastReady(): Promise<void> {
  await loadCastSdk();
  initCast();
}

export async function castStation(station: Station): Promise<{ deviceName: string }> {
  await ensureCastReady();
  const ctx = context();
  let session = ctx.getCurrentSession();
  if (!session) {
    await ctx.requestSession();
    session = ctx.getCurrentSession();
    if (!session) throw new Error('No cast device was selected');
  }
  const media = new window.chrome.cast.media.MediaInfo(station.url, contentTypeFor(station.codec));
  media.streamType = window.chrome.cast.media.StreamType.LIVE;
  const metadata = new window.chrome.cast.media.GenericMediaMetadata();
  metadata.title = station.name;
  media.metadata = metadata;
  await session.loadMedia(new window.chrome.cast.media.LoadRequest(media));
  notify();
  return { deviceName: session.getCastDevice().friendlyName };
}

export function pauseCast(): Promise<void> {
  return mediaOp('pause');
}

export function resumeCast(): Promise<void> {
  return mediaOp('play');
}

export function stopCastMedia(): Promise<void> {
  return mediaOp('stop');
}

function mediaOp(op: 'play' | 'pause' | 'stop'): Promise<void> {
  const session = sdkLoaded() ? context().getCurrentSession() : null;
  const media = session ? session.getMediaSession() : null;
  if (!media) return Promise.reject(new Error('No active cast media session'));
  return new Promise<void>((resolve, reject) => {
    const success = () => resolve();
    const error = (e: chrome.cast.Error) => reject(new Error(e.description || 'Cast media error'));
    if (op === 'play') {
      media.play(new window.chrome.cast.media.PlayRequest(), success, error);
    } else if (op === 'pause') {
      media.pause(new window.chrome.cast.media.PauseRequest(), success, error);
    } else {
      media.stop(new window.chrome.cast.media.StopRequest(), success, error);
    }
  });
}

export function stopCast(): void {
  if (!sdkLoaded()) return;
  try {
    context().endCurrentSession(true);
  } catch {
    // ignore
  }
  notify();
}

export function subscribeCast(listener: CastListener): () => void {
  listeners.add(listener);
  listener(currentState());
  ensureCastReady()
    .then(() => notify())
    .catch((e: unknown) => {
      listeners.forEach((l) =>
        l({ ...currentState(), error: e instanceof Error ? e.message : 'Google Cast is unavailable' })
      );
    });
  return () => {
    listeners.delete(listener);
  };
}
