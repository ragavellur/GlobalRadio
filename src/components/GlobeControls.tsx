import { useRadioStore } from '../lib/store';

export default function GlobeControls() {
  const { selectedCity } = useRadioStore();

  return (
    <div className="absolute right-[15px] z-10 flex flex-col items-center gap-2" style={{ bottom: 165 }}>
      {/* Balloon Ride */}
      <button className="w-[36px] h-[36px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Balloon Ride Radio">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="white">
          <path d="M17.41 17.71c-.49 1.32-1.02 2.73-1.4 4.46H16l-.09-.42c-.37-1.53-.86-2.82-1.31-4.02-1.36-3.61-2.34-6.22 1.35-12.94L16 4.7l.06.09c3.7 6.67 2.72 9.29 1.35 12.92"/>
          <path d="M14.46 22.17h-.02c-2.87-4.44-6.34-5.44-6.34-10.34 0-3.76 2.5-6.42 6.15-7.05-3.55 6.82-2.44 9.78-1.05 13.48.44 1.17.91 2.42 1.26 3.91m9.44-10.34c0 4.9-3.33 5.8-6.34 10.34h-.01c.35-1.5.83-2.76 1.27-3.94 1.4-3.72 2.51-6.7-1.06-13.45 3.65.64 6.14 3.29 6.14 7.05"/>
          <path d="M16.01 22.18v.01"/>
        </svg>
      </button>

      {/* Go to location */}
      <button className="w-[36px] h-[36px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Go to your location">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="white">
          <path d="M25 6L15.03 26l-1.51-8.52L5 15.97 25 6z"/>
        </svg>
      </button>

      {/* Lock station */}
      <button className="w-[36px] h-[36px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Lock station">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2">
          <rect x="8" y="14" width="16" height="14" rx="2"/>
          <path d="M12 14v-4a4 4 0 018 0v4"/>
        </svg>
      </button>

      {/* Zoom in */}
      <button className="w-[36px] h-[40px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Zoom in"
        onClick={() => {
          const mapEl = document.querySelector('.maplibregl-map') as any;
          if (mapEl?.__maplibregl) mapEl.__maplibregl.zoomIn();
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Zoom out */}
      <button className="w-[36px] h-[40px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Zoom out"
        onClick={() => {
          const mapEl = document.querySelector('.maplibregl-map') as any;
          if (mapEl?.__maplibregl) mapEl.__maplibregl.zoomOut();
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  );
}
