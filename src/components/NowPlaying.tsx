import { useEffect, useRef } from 'react';
import { useRadioStore } from '../lib/store';

export default function NowPlaying() {
  const { currentStation, isPlaying, stopPlayback, audioVolume, setVolume } = useRadioStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    if (isPlaying && currentStation) {
      audio.src = currentStation.url;
      audio.volume = audioVolume;
      audio.play().catch(console.error);
    } else {
      audio.pause();
      audio.src = '';
    }

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [isPlaying, currentStation, audioVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  if (!isPlaying || !currentStation) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-white/10 p-4 z-20">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={stopPlayback}
          className="w-10 h-10 flex items-center justify-center bg-green-500 hover:bg-green-400 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        </button>

        {/* Station Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">{currentStation.name}</div>
          <div className="text-sm text-gray-400 truncate">Direct Stream</div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={audioVolume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

        {/* Close Button */}
        <button
          onClick={stopPlayback}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
