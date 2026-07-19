# Global Radio Explorer — Development Guide

> Version: 1.0  
> Date: 2026-07-20  
> Status: Approved

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | JavaScript runtime |
| npm | 10+ | Package manager |
| Git | 2.40+ | Version control |
| VS Code | Latest | IDE (recommended) |

---

## 2. Project Setup

### 2.1 Clone & Install

```bash
# Clone the repository
git clone https://github.com/ragavellur/GlobalRadio.git
cd GlobalRadio

# Install dependencies
npm install
```

### 2.2 VS Code Extensions

Install these extensions for the best DX:

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **TypeScript Vue Plugin** (`Vue.volar`) — for TypeScript support

### 2.3 VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "css.validate": false,
  "tailwindCSS.classAttributes": ["class", "className", "classList"]
}
```

---

## 3. Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (http://localhost:5173) |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run format` | Run Prettier on all files |
| `npm run type-check` | TypeScript type checking only |

---

## 4. Project Structure

```
GlobalRadio/
├── public/                          # Static assets (served as-is)
│   ├── data/
│   │   ├── index.json               # All cities columnar (480 KB)
│   │   ├── countries.json           # Country metadata (65 KB)
│   │   ├── grid_5deg.json           # Spatial grid (70 KB)
│   │   └── stations/
│   │       ├── US.json              # Per-country station files
│   │       ├── GB.json
│   │       └── ...                  # 166 country files
│   ├── .nojekyll                    # Prevents Jekyll processing
│   ├── CNAME                        # Custom domain: radio.vellur.in
│   └── favicon.ico
│
├── src/
│   ├── components/                  # UI components
│   │   ├── Globe/
│   │   │   ├── GlobeView.tsx        # MapLibre GL map with globe
│   │   │   ├── GlobeDots.tsx        # Custom WebGL layer for dots
│   │   │   └── GlobeControls.tsx    # Zoom, location, balloon ride
│   │   ├── Player/
│   │   │   ├── AudioPlayer.tsx      # Fixed bottom bar player
│   │   │   └── MiniPlayer.tsx       # Compact player variant
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx          # Slide-out drawer
│   │   │   ├── CityHeader.tsx       # City name, country, count
│   │   │   ├── StationList.tsx      # Stations in city
│   │   │   ├── NearbyCities.tsx     # Cities with distances
│   │   │   └── CountryCities.tsx    # Other cities in country
│   │   ├── Search/
│   │   │   └── SearchPanel.tsx      # Search UI
│   │   ├── Settings/
│   │   │   └── SettingsPanel.tsx    # Settings UI
│   │   └── ui/
│   │       ├── Button.tsx           # Reusable button
│   │       ├── Input.tsx            # Reusable input
│   │       ├── Modal.tsx            # Reusable modal
│   │       └── Spinner.tsx          # Loading spinner
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useGlobe.ts              # MapLibre map instance
│   │   ├── useAudioPlayer.ts        # Audio playback logic
│   │   ├── useStationSearch.ts      # Search with debounce
│   │   └── useFavorites.ts          # Favorites management
│   │
│   ├── lib/                         # Utility libraries
│   │   ├── data/
│   │   │   ├── loader.ts            # Data loading + caching
│   │   │   └── spatial.ts           # KDBush spatial index
│   │   ├── audio/
│   │   │   └── player.ts            # HTML5 Audio wrapper
│   │   └── utils/
│   │       ├── geo.ts               # Lat/lng math utilities
│   │       └── constants.ts         # Scale factors, thresholds
│   │
│   ├── store/
│   │   └── useStore.ts              # Zustand store
│   │
│   ├── pages/                       # Route components
│   │   ├── HomePage.tsx             # Globe view
│   │   ├── CityPage.tsx             # City detail
│   │   ├── StationPage.tsx          # Station playback
│   │   ├── BalloonRidePage.tsx      # Random discovery
│   │   ├── SearchPage.tsx           # Search interface
│   │   ├── BrowsePage.tsx           # Browse stations
│   │   ├── SettingsPage.tsx         # App settings
│   │   └── NotFoundPage.tsx         # 404 page
│   │
│   ├── types/
│   │   └── index.ts                 # TypeScript type definitions
│   │
│   ├── App.tsx                      # Root component
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Tailwind CSS entry
│
├── scripts/
│   └── preprocess.mjs               # Data preprocessing pipeline
│
├── docs/                            # Documentation
│   ├── 01-REQUIREMENTS.md
│   ├── 02-PLANNING.md
│   ├── 03-ARCHITECTURE.md
│   ├── 04-DEVELOPMENT.md
│   └── 05-DEPLOYMENT.md
│
├── .github/
│   └── workflows/
│       └── deploy.yml               # GitHub Actions CI/CD
│
├── CNAME                            # Custom domain
├── index.html                       # Vite entry HTML
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── eslint.config.js
├── .prettierrc
├── .prettierignore
└── .gitignore
```

---

## 5. Code Conventions

### 5.1 TypeScript

```typescript
// Use explicit types for function parameters
function playStream(url: string, volume: number): Promise<void> {
  // ...
}

// Use interfaces for object shapes
interface Station {
  id: string;
  name: string;
  city: string;
  country: string;
  streamUrl: string;
}

// Use type for unions and primitives
type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// Use `type` keyword for imports
import type { Station } from '../types';
```

### 5.2 React Components

```tsx
// Use functional components with explicit props types
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ children, onClick, variant = 'primary', disabled }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-colors',
        variant === 'primary' && 'bg-primary text-white hover:bg-primary/90',
        variant === 'secondary' && 'bg-secondary text-white hover:bg-secondary/90',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}
```

### 5.3 File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `GlobeView.tsx` |
| Hooks | camelCase with `use` | `useGlobe.ts` |
| Utilities | camelCase | `loader.ts` |
| Types | PascalCase | `Station.ts` |
| Constants | UPPER_SNAKE_CASE | `SCALE_FACTORS.ts` |
| CSS files | kebab-case | `globe-dots.css` |

### 5.4 Import Order

```typescript
// 1. React imports
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import maplibregl from 'maplibre-gl';
import { create } from 'zustand';

// 3. Internal types
import type { Station } from '../types';

// 4. Internal components
import { Button } from '../components/ui/Button';

// 5. Internal hooks
import { useGlobe } from '../hooks/useGlobe';

// 6. Internal utilities
import { calculateDistance } from '../lib/utils/geo';

// 7. Styles
import './styles.css';
```

### 5.5 Tailwind CSS

```tsx
// Use cn() utility for conditional classes
import { cn } from '../lib/utils/cn';

<div className={cn(
  'base-classes',
  condition && 'conditional-classes',
  isActive ? 'active-classes' : 'inactive-classes'
)} />

// Use @theme for custom design tokens (Tailwind v4)
// In index.css:
@import "tailwindcss";

@theme {
  --color-primary: #00FF82;
  --color-secondary: #1a1a1a;
  --color-accent: #333333;
}
```

---

## 6. Key Implementation Patterns

### 6.1 Data Loading

```typescript
// lib/data/loader.ts
class StationDataManager {
  private index: IndexData | null = null;
  private countryCache = new Map<string, CountryData>();
  private pendingLoads = new Map<string, Promise<CountryData>>();

  async loadIndex(): Promise<IndexData> {
    if (this.index) return this.index;
    const response = await fetch('/data/index.json');
    this.index = await response.json();
    return this.index;
  }

  async loadCountry(code: string): Promise<CountryData> {
    if (this.countryCache.has(code)) {
      return this.countryCache.get(code)!;
    }

    if (this.pendingLoads.has(code)) {
      return this.pendingLoads.get(code)!;
    }

    const loadPromise = this._fetchAndCache(code);
    this.pendingLoads.set(code, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.pendingLoads.delete(code);
    }
  }
}
```

### 6.2 Audio Player

```typescript
// lib/audio/player.ts
let audioElement: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = document.createElement('audio');
    audioElement.preload = 'none';
    audioElement.crossOrigin = 'anonymous';
    audioElement.playsInline = true;
    document.body.appendChild(audioElement);
  }
  return audioElement;
}

export async function playStream(url: string): Promise<void> {
  const audio = getAudioElement();
  audio.src = url;
  await audio.play();
}

export function pauseStream(): void {
  getAudioElement().pause();
}

export function setVolume(volume: number): void {
  getAudioElement().volume = Math.max(0, Math.min(1, volume));
}
```

### 6.3 Spatial Index

```typescript
// lib/data/spatial.ts
import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';

export function buildSpatialIndex(stations: Station[]): KDBush<Station> {
  const index = new KDBush(stations.length, 64, Float64Array);
  stations.forEach(s => index.add(s.lng, s.lat));
  index.finish();
  return index;
}

export function findNearestStation(
  index: KDBush<Station>,
  lng: number,
  lat: number,
  maxDistanceKm: number = 50
): Station | null {
  const ids = geokdbush.around(index, lng, lat, 1, maxDistanceKm);
  return ids.length > 0 ? index.data[ids[0]] : null;
}
```

### 6.4 Zustand Store

```typescript
// store/useStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface AppState {
  // State
  currentStation: Station | null;
  isPlaying: boolean;
  volume: number;
  favorites: string[];
  darkMode: boolean;

  // Actions
  play: (station: Station) => Promise<void>;
  pause: () => void;
  setVolume: (v: number) => void;
  toggleFavorite: (id: string) => void;
  toggleDarkMode: () => void;
}

export const useStore = create<AppState>()(
  persist(
    immer((set, get) => ({
      currentStation: null,
      isPlaying: false,
      volume: 0.8,
      favorites: [],
      darkMode: true,

      play: async (station) => {
        set((state) => {
          state.currentStation = station;
          state.isPlaying = true;
        });
        await playStream(station.streamUrl);
      },

      pause: () => {
        pauseStream();
        set((state) => {
          state.isPlaying = false;
        });
      },

      setVolume: (v) => {
        setVolume(v);
        set((state) => {
          state.volume = v;
        });
      },

      toggleFavorite: (id) => set((state) => {
        const idx = state.favorites.indexOf(id);
        if (idx === -1) state.favorites.push(id);
        else state.favorites.splice(idx, 1);
      }),

      toggleDarkMode: () => set((state) => {
        state.darkMode = !state.darkMode;
      }),
    })),
    {
      name: 'radio-app-storage',
      partialize: (state) => ({
        volume: state.volume,
        favorites: state.favorites,
        darkMode: state.darkMode,
      }),
    }
  )
);
```

---

## 7. Git Workflow

### 7.1 Branch Strategy

```
main (production)
├── develop (integration)
│   ├── feature/globe-dots
│   ├── feature/audio-player
│   └── feature/search
└── hotfix/critical-bug
```

### 7.2 Commit Messages

Follow Conventional Commits:

```
feat: add globe dot rendering
fix: resolve CORS issue with audio streams
docs: update architecture document
refactor: extract data loader to separate module
style: format code with prettier
test: add unit tests for spatial index
chore: update dependencies
```

### 7.3 Pre-commit Hooks

Husky + lint-staged run automatically:

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// .lintstagedrc.json
{
  "src/**/*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "src/**/*.{css,json}": [
    "prettier --write"
  ]
}
```

---

## 8. Testing

### 8.1 Manual Testing Checklist

| Test | Steps |
|------|-------|
| Globe loads | Open app, verify globe renders with dots |
| Click detection | Click a dot, verify sidebar opens |
| Audio playback | Click play, verify audio starts |
| Volume control | Adjust volume slider, verify changes |
| Search | Type in search box, verify results |
| Mobile | Open on mobile, verify responsive |
| Dark mode | Toggle dark mode, verify changes |
| Direct URL | Navigate to `/visit/london/42`, verify works |

### 8.2 Browser Testing

| Browser | Version | Platform |
|---------|---------|----------|
| Chrome | 90+ | Desktop, Mobile |
| Firefox | 90+ | Desktop |
| Safari | 15+ | Desktop, Mobile |
| Edge | 90+ | Desktop |

### 8.3 Performance Testing

```bash
# Lighthouse audit
npx lighthouse http://localhost:5173 --output=html

# Bundle analysis
npx vite-bundle-visualizer
```

---

## 9. Troubleshooting

### 9.1 Common Issues

| Issue | Solution |
|-------|----------|
| `npm run dev` fails | Check Node.js version (22+) |
| TypeScript errors | Run `npm run type-check` |
| ESLint errors | Run `npm run lint` |
| Globe not rendering | Check browser WebGL support |
| Audio not playing | Check CORS headers on stream |
| 404 on direct URL | Ensure 404.html exists in dist/ |

### 9.2 Debug Mode

```bash
# Enable debug logging
DEBUG=true npm run dev

# Open React DevTools
# Install browser extension: https://react.dev/learn/react-devtools

# Open MapLibre debug
# Add ?debug to URL: http://localhost:5173/?debug
```

---

## 10. Code Review Checklist

- [ ] TypeScript compiles without errors
- [ ] ESLint passes without errors
- [ ] Code is formatted with Prettier
- [ ] No `console.log` in production code
- [ ] No hardcoded values (use constants)
- [ ] Components are properly typed
- [ ] No unnecessary re-renders
- [ ] Mobile responsive
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Performance acceptable (60fps globe)

---

*Document maintained in `docs/04-DEVELOPMENT.md`*
