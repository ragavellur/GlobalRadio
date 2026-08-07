// Google Cast (Chromecast / Google Home) sender integration.
//
// - In the browser it loads the Cast Web Sender SDK on demand and streams a
//   live radio station to a Cast-enabled device using the Default Media
//   Receiver, so no receiver registration or API key is required.
// - In the native app the Cast Web Sender SDK is disabled by Google inside
//   WebView, so it uses the Android Cast SDK through the
//   @strasberry/capacitor-chromecast plugin, which gives real device
//   discovery and the system Cast device picker.

/// <reference types="chromecast-caf-sender" />

import { Capacitor } from '@capacitor/core';
import type { Station } from '../types';
import type { SessionObject } from '@strasberry/capacitor-chromecast';

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

type NativeChromecast = typeof import('@strasberry/capacitor-chromecast');

const isNative = Capacitor.isNativePlatform();
const listeners = new Set<CastListener>();

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

function notify(): void {
  const state = currentState();
  listeners.forEach((l) => l(state));
}

// ---------------------------------------------------------------------------
// Native (Android Cast SDK) implementation
// ---------------------------------------------------------------------------

let nativePlugin: NativeChromecast | null = null;
let nativeReady: Promise<void> | null = null;
let nativeDeviceName: string | null = null;
let nativeConnected = false;

async function loadNativePlugin(): Promise<NativeChromecast> {
  if (!nativePlugin) {
    nativePlugin = await import('@strasberry/capacitor-chromecast');
  }
  return nativePlugin;
}

function handleNativeSession(session: unknown): void {
  const name = (session as SessionObject | undefined)?.receiver?.friendlyName;
  if (name) nativeDeviceName = name;
  nativeConnected = true;
  notify();
}

function handleNativeEnd(): void {
  nativeConnected = false;
  nativeDeviceName = null;
  notify();
}

function ensureNative(): Promise<void> {
  if (nativeReady) return nativeReady;
  nativeReady = (async () => {
    const { Chromecast } = await loadNativePlugin();
    await Chromecast.initialize({
      appId: DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: 'tab_and_origin_scoped',
      defaultActionPolicy: 'create_session',
    });
    Chromecast.addListener('SESSION_STARTED', (...args: unknown[]) => handleNativeSession(args[0]));
    Chromecast.addListener('SESSION_RESUMED', (...args: unknown[]) => handleNativeSession(args[0]));
    Chromecast.addListener('SESSION_LISTENER', (...args: unknown[]) => handleNativeSession(args[0]));
    Chromecast.addListener('SESSION_UPDATE', (...args: unknown[]) => handleNativeSession(args[0]));
    Chromecast.addListener('SESSION_ENDED', () => handleNativeEnd());
    Chromecast.addListener('SESSION_START_FAILED', () => notify());
  })();
  return nativeReady;
}

function nativeStateInfo(): CastStateInfo {
  return {
    available: true,
    connected: nativeConnected,
    devicesAvailable: true,
    deviceName: nativeDeviceName,
  };
}

async function castStationNative(station: Station): Promise<{ deviceName: string }> {
  const { Chromecast } = await loadNativePlugin();
  await ensureNative();
  const session = await Chromecast.requestSession();
  await Chromecast.loadMedia({
    contentId: station.url,
    contentType: contentTypeFor(station.codec),
    streamType: 'live',
    autoPlay: true,
    metadata: { title: station.name },
  });
  handleNativeSession(session);
  return { deviceName: nativeDeviceName ?? session.receiver.friendlyName ?? 'Cast device' };
}

async function pauseCastNative(): Promise<void> {
  const { Chromecast } = await loadNativePlugin();
  await Chromecast.mediaPause();
}

async function resumeCastNative(): Promise<void> {
  const { Chromecast } = await loadNativePlugin();
  await Chromecast.mediaPlay();
}

async function stopCastMediaNative(): Promise<void> {
  const { Chromecast } = await loadNativePlugin();
  await Chromecast.sessionStop();
}

function stopCastNative(): void {
  void (async () => {
    try {
      await stopCastMediaNative();
    } catch {
      // no active session to stop
    }
    handleNativeEnd();
  })();
}

function subscribeCastNative(listener: CastListener): () => void {
  listeners.add(listener);
  listener(nativeStateInfo());
  ensureNative()
    .then(notify)
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Google Cast is unavailable';
      listeners.forEach((l) => l({ ...nativeStateInfo(), available: false, error: msg }));
    });
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Web (Cast Web Sender SDK) implementation
// ---------------------------------------------------------------------------

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

let sdkPromise: Promise<void> | null = null;
let webInitialized = false;

function webContext() {
  return window.cast.framework.CastContext.getInstance();
}

function webCurrentState(): CastStateInfo {
  const info: CastStateInfo = {
    available: false,
    connected: false,
    devicesAvailable: false,
    deviceName: null,
  };
  try {
    if (!sdkLoaded()) return info;
    info.available = true;
    const ctx = webContext();
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

function currentState(): CastStateInfo {
  return isNative ? nativeStateInfo() : webCurrentState();
}

function initCast(): void {
  if (webInitialized) return;
  webInitialized = true;
  const ctx = webContext();
  ctx.setOptions({
    receiverApplicationId: DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  ctx.addEventListener(window.cast.framework.CastContextEventType.CAST_STATE_CHANGED, notify);
  ctx.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED, notify);
  notify();
}

async function castStationWeb(station: Station): Promise<{ deviceName: string }> {
  await loadCastSdk();
  initCast();
  const ctx = webContext();
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

function mediaOp(op: 'play' | 'pause' | 'stop'): Promise<void> {
  const session = sdkLoaded() ? webContext().getCurrentSession() : null;
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

function webStopCast(): void {
  if (!sdkLoaded()) return;
  try {
    webContext().endCurrentSession(true);
  } catch {
    // ignore
  }
  notify();
}

function webSubscribeCast(listener: CastListener): () => void {
  listeners.add(listener);
  listener(webCurrentState());
  loadCastSdk()
    .then(() => initCast())
    .then(() => notify())
    .catch((e: unknown) => {
      listeners.forEach((l) =>
        l({
          ...webCurrentState(),
          error: e instanceof Error ? e.message : 'Google Cast is unavailable',
        })
      );
    });
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Public API (dispatches to native or web implementation)
// ---------------------------------------------------------------------------

export function subscribeCast(listener: CastListener): () => void {
  return isNative ? subscribeCastNative(listener) : webSubscribeCast(listener);
}

export async function castStation(station: Station): Promise<{ deviceName: string }> {
  return isNative ? castStationNative(station) : castStationWeb(station);
}

export function pauseCast(): Promise<void> {
  return isNative ? pauseCastNative() : mediaOp('pause');
}

export function resumeCast(): Promise<void> {
  return isNative ? resumeCastNative() : mediaOp('play');
}

export function stopCastMedia(): Promise<void> {
  return isNative ? stopCastMediaNative() : mediaOp('stop');
}

export function stopCast(): void {
  if (isNative) stopCastNative();
  else webStopCast();
}
