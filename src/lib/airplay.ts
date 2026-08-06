// AirPlay (Safari / WebKit) integration.
//
// macOS Safari and iOS Safari expose a native AirPlay target picker on
// HTMLMediaElement as `webkitShowPlaybackTargetPicker`. We keep a reference to
// the app's <audio> element (created in BottomPanel) and ask Safari to show
// the picker for it. The element is appended to the DOM so Safari can present
// the picker; it renders nothing visible.

let audioEl: HTMLAudioElement | null = null;

export function registerAudio(el: HTMLAudioElement | null): void {
  audioEl = el;
  if (el && !el.parentNode) {
    el.style.display = 'none';
    document.body.appendChild(el);
  }
}

type SafariAudioElement = HTMLAudioElement & {
  webkitShowPlaybackTargetPicker?: () => void;
};

export function showAirPlayPicker(): { supported: boolean; error?: string } {
  const el = audioEl as SafariAudioElement | null;
  if (!el) {
    return { supported: false, error: 'Pick a station first, then use Air Play.' };
  }
  if (typeof el.webkitShowPlaybackTargetPicker !== 'function') {
    return {
      supported: false,
      error: 'Air Play is only available in Safari on Apple devices.',
    };
  }
  try {
    el.webkitShowPlaybackTargetPicker();
    return { supported: true };
  } catch {
    return { supported: false, error: 'Air Play is not available for this station.' };
  }
}
