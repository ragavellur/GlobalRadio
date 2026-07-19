# Global Radio Explorer — Architecture Document

> Version: 1.0  
> Date: 2026-07-20  
> Status: Approved

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   index.json  │  │ countries.json│  │ stations/*.json│         │
│  │   (480 KB)    │  │   (65 KB)    │  │  (10 MB lazy) │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                   │
│         ▼                  ▼                  ▼                   │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                  Data Loading Layer                    │      │
│  │  • index.json loads on startup                        │      │
│  │  • countries.json loads on startup                    │      │
│  │  • Per-country files lazy-loaded on click             │      │
│  │  • KDBush spatial index built from index.json         │      │
│  │  • Caching: in-memory + sessionStorage                │      │
│  └────────────────────────┬─────────────────────────────┘      │
│                           │                                      │
│         ┌─────────────────┴─────────────────┐                   │
│         ▼                                   ▼                   │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │   Globe View     │              │   Sidebar       │          │
│  │  (MapLibre GL)   │              │  (Station Info)  │          │
│  │                  │              │                  │          │
│  │  • Globe proj.   │              │  • City header   │          │
│  │  • WebGL dots    │◄────────────►│  • Station list  │          │
│  │  • Click detect  │              │  • Nearby cities │          │
│  │  • Camera anim   │              │  • Country cities │          │
│  └────────┬────────┘              └─────────────────┘          │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────┐              │
│  │              Audio Player                      │              │
│  │  • HTML5 Audio API (direct stream URLs)        │              │
│  │  • Play/pause/stop/volume/mute                 │              │
│  │  • Persistent bottom bar                       │              │
│  │  • Error handling + retry logic                 │              │
│  │  • Media Session API (lock-screen controls)    │              │
│  └──────────────────────────────────────────────┘              │
│                                                                  │
│  ┌──────────────────────────────────────────────┐              │
│  │              Search Panel                      │              │
│  │  • Fuse.js fuzzy search                        │              │
│  │  • Debounced input (300ms)                     │              │
│  │  • Max 50 results                              │              │
│  └──────────────────────────────────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Build** | Vite | 8.x | Fast dev server, optimized builds, GitHub Pages support |
| **Framework** | React | 19.x | Component model, large ecosystem |
| **Language** | TypeScript | 5.9.x | Type safety, better DX |
| **Styling** | Tailwind CSS | 4.3.x | Utility-first, v4 uses `@tailwindcss/vite` |
| **Globe** | MapLibre GL JS | 5.24.x | Native globe projection (same as radio.garden) |
| **Globe (React)** | @vis.gl/react-maplibre | 8.1.x | React wrapper for MapLibre |
| **State** | Zustand | 5.x | Lightweight, no boilerplate, persist middleware |
| **Audio** | HTML5 Audio API | - | Direct stream playback, no server proxy |
| **Search** | Fuse.js | 7.x | Client-side fuzzy search |
| **Routing** | React Router | 7.x | SPA routing with history API |
| **Spatial Index** | KDBush + geokdbush | 4.x / 2.x | O(log n) nearest-neighbor click detection |
| **Virtual Lists** | react-window | 1.8.x | Browse page with 150K+ items |

---

## 3. Data Architecture

### 3.1 Data Flow

```
stations.json (17.9 MB, source)
    │
    ▼ [scripts/preprocess.mjs]
    │
    ├── index.json (480 KB) ──────────────► loads on startup
    ├── countries.json (65 KB) ────────────► loads on startup
    ├── grid_5deg.json (70 KB) ────────────► loads on startup
    └── stations/*.json (10 MB total) ─────► lazy-loaded per country
```

### 3.2 Columnar Data Format

**Why columnar?** Matches radio.garden's approach. More efficient for:
- GPU buffer uploads (contiguous memory)
- Spatial index construction (only need lats/lngs)
- JSON compression (similar values compress better)

**index.json structure:**
```json
{
  "version": 2,
  "totalCities": 12707,
  "totalStations": 150935,
  "ids": ["0", "1", "2", ...],
  "lats": [51.644, 43.3623, ...],
  "lngs": [-121.295, -8.4115, ...],
  "sizes": [11, 12, ...],
  "boosts": [1, 0, ...],
  "cities": ["100 Mile House", "A Coruna", ...],
  "cc": ["CA", "ES", ...]
}
```

**countries.json structure:**
```json
{
  "countries": [
    { "code": "US", "name": "United States", "stationCount": 15000, "cityCount": 2800 },
    { "code": "GB", "name": "United Kingdom", "stationCount": 3200, "cityCount": 450 }
  ],
  "countryIndex": {
    "US": [0, 5, 12, ...],
    "GB": [3, 8, 15, ...]
  }
}
```

**Per-country station file structure:**
```json
{
  "country": "GB",
  "stations": [
    ["BBC Radio 1", "http://stream.bbc.co.uk/bbcradio1/rlslive.mp3"],
    ["Capital FM", "https://media-ice.musicradio.com/CapitalMP3"]
  ],
  "cities": [
    ["London", 51.5074, -0.1278, 45],
    ["Manchester", 53.4808, -2.2426, 22]
  ]
}
```

### 3.3 Loading Strategy

```
1. Page loads
   │
   ▼
2. Fetch index.json (480 KB) ──► renders 12,707 dots on globe
   │
   ▼
3. Fetch countries.json (65 KB) ──► enables country navigation
   │
   ▼
4. Build KDBush spatial index from lats/lngs
   │
   ▼
5. User sees globe with all dots
   │
   ▼
6. User rotates globe ──► preload nearby country files
   │
   ▼
7. User clicks city dot ──► loadCountry(code) fetches stations/{code}.json
   │
   ▼
8. Sidebar shows station list, nearby cities, country cities
   │
   ▼
9. User clicks play ──► HTML5 Audio plays stream URL directly
```

### 3.4 Caching Strategy

| Cache Layer | Storage | Duration | Purpose |
|-------------|---------|----------|---------|
| In-memory | JavaScript | Session | Instant access to loaded data |
| sessionStorage | Browser | Tab lifetime | Survives page refresh |
| Service Worker | Browser | Configurable | Offline support (Phase 2) |

**Eviction policy:** When sessionStorage is full, evict oldest 50% of country entries.

---

## 4. Globe Architecture

### 4.1 MapLibre GL JS Setup

```typescript
const map = new maplibregl.Map({
  container: 'globe',
  style: {
    version: 8,
    projection: { type: 'globe' },
    sources: {},
    layers: [],
  },
  center: [0, 20],
  zoom: 1.8,
  pitch: 0,
  bearing: 0,
  attributionControl: false,
  canvasContextAttributes: { antialias: true },
});
```

### 4.2 Custom WebGL Layer for Dots

**Rendering approach:** MapLibre `CustomLayerInterface` with `renderingMode: '3d'`

**Key shader functions:**
- `projectTile(a_pos)` — MapLibre's built-in globe projection
- Distance-based scaling — dots appear same size regardless of zoom
- Screen-space quad offset — GL_POINTS rendered as quads

**Dot sizing formula:**
```
if (stations < 5)     size = smallPlaceScale  (0.14)
if (stations < 20)    size = mediumPlaceScale (0.27)
if (stations >= 20)   size = largePlaceScale  (0.42)
if (boosted)          size *= boostScale      (1.5)
size *= globalScale   (0.5)
```

**Dot color:** `#00FF82` RGBA(0, 255, 130) — teal-green

### 4.3 Click Detection (KDBush)

```typescript
import KDBush from 'kdbush';
import * as geokdbush from 'geokdbush';

// Build index on data load
const index = new KDBush(stations.length, 64, Float64Array);
stations.forEach(s => index.add(s.lng, s.lat));
index.finish();

// On globe click
map.on('click', (e) => {
  const { lng, lat } = e.lngLat;
  const nearestIds = geokdbush.around(index, lng, lat, 1, 50); // 50km radius
  if (nearestIds.length > 0) {
    const station = stations[nearestIds[0]];
    navigateTo(`/visit/${station.slug}/${station.id}`);
  }
});
```

**Performance:**
- Build index: O(n log n) — ~57ms for 138K points
- Single query: O(log n) — <0.03ms
- 1000 queries: ~25ms

### 4.4 Camera Transitions

```typescript
// Fly to city
map.flyTo({
  center: [station.lng, station.lat],
  zoom: 6,
  pitch: 45,
  duration: 3000,
  essential: true,  // Respects prefers-reduced-motion
});
```

### 4.5 Known Globe Gotchas

| Issue | Mitigation |
|-------|------------|
| Antimeridian double rendering | Set `buffer: 256` on GeoJSON sources |
| Custom layers disappear at zoom ~11 | Use `projectTileFor3D()` instead of `projectTile()` |
| Globe enlarges at poles | Account with zoom adjustment function |
| Mali GPU precision issues | Use algebraic identities, avoid `atan`/`sin`/`cos` |
| flyTo padding broken on globe | Call `map.setPadding()` before `flyTo()` |

---

## 5. Audio Architecture

### 5.1 Audio Playback Flow

```
User clicks play
    │
    ▼
HTML5 Audio element (singleton, persistent)
    │
    ├──► audio.src = streamUrl
    ├──► audio.crossOrigin = 'anonymous'
    ├──► audio.playsInline = true
    │
    ▼
audio.play()
    │
    ├──► Success ──► update Media Session API
    │                update UI (play icon → pause icon)
    │
    └──► Error ──► retry with exponential backoff
                   (1s, 2s, 4s, 8s, 16s)
                   show "Stream unavailable" after max retries
```

### 5.2 CORS Handling

| Scenario | Behavior |
|----------|----------|
| Stream has CORS headers | Audio plays normally |
| Stream missing CORS headers | Browser blocks playback |
| HTTP stream on HTTPS site | Mixed content blocked |
| Stream offline | Error → retry → show message |

**No server proxy** — failed streams show "Stream unavailable" error.

### 5.3 Mobile Audio

- Persistent `<audio>` element (created once, reused)
- Preserves user gesture trust on iOS
- Media Session API for lock-screen controls
- Autoplay blocked until first user gesture

---

## 6. State Management

### 6.1 Zustand Store

```typescript
interface AppState {
  // Globe
  globeReady: boolean;
  selectedCity: City | null;

  // Audio
  currentStation: Station | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  metadata: { title?: string; artist?: string } | null;

  // UI
  sidebarOpen: boolean;
  searchOpen: boolean;

  // Favorites
  favorites: string[];

  // Settings
  darkMode: boolean;
  dotSize: 'small' | 'normal' | 'large';
  globeQuality: 'low' | 'medium' | 'high' | 'very-high';
}
```

### 6.2 Persistence

Persisted to localStorage via Zustand `persist` middleware:
- `volume`
- `favorites`
- `darkMode`
- `dotSize`
- `globeQuality`

---

## 7. Routing Architecture

### 7.1 Route Definitions

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | HomePage | Globe view (default) |
| `/visit/:citySlug/:cityId` | CityPage | City detail + stations |
| `/listen/:stationSlug/:channelId` | StationPage | Playing a station |
| `/balloon-ride` | BalloonRidePage | Random discovery |
| `/search` | SearchPage | Search interface |
| `/browse` | BrowsePage | Browse by country/city |
| `/settings` | SettingsPage | App settings |

### 7.2 SPA Routing on GitHub Pages

```
User navigates to /visit/london/42
    │
    ▼
GitHub Pages looks for /visit/london/42.html → not found
    │
    ▼
GitHub Pages serves 404.html (copy of index.html)
    │
    ▼
React Router reads URL, renders CityPage
```

**Build script:** `"build": "vite build && cp dist/index.html dist/404.html"`

---

## 8. UI Architecture

### 8.1 Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header (search, browse, settings)                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │              GLOBE (full width)                   │   │
│  │                                                  │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────┐                  │
│  │  Sidebar (slide-in from right)    │                  │
│  │  • City header (name, country)    │                  │
│  │  • Station list (with play btns)  │                  │
│  │  • Nearby cities (with distances) │                  │
│  │  • Country cities                 │                  │
│  └──────────────────────────────────┘                  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Audio Player (fixed bottom)                             │
│  [Play/Pause] [Station Name] [Volume] [Mute]            │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Component Hierarchy

```
App
├── RootLayout
│   ├── Header
│   │   ├── Logo
│   │   ├── SearchToggle
│   │   ├── BrowseLink
│   │   └── SettingsLink
│   ├── MainContent
│   │   ├── GlobeView
│   │   │   ├── MapLibreMap
│   │   │   └── GlobeDots (CustomLayer)
│   │   └── Sidebar
│   │       ├── CityHeader
│   │       ├── StationList
│   │       │   └── StationItem (with play button)
│   │       ├── NearbyCities
│   │       └── CountryCities
│   └── AudioPlayer
│       ├── PlayPauseButton
│       ├── StationInfo
│       ├── VolumeSlider
│       └── MuteButton
├── SearchPanel (overlay)
├── SettingsPanel (overlay)
└── BalloonRideOverlay
```

---

## 9. Performance Architecture

### 9.1 Optimization Strategies

| Strategy | Implementation |
|----------|---------------|
| Code splitting | `React.lazy()` for route components |
| Lazy loading | Country station files loaded on demand |
| Virtualization | `react-window` for browse page lists |
| Debouncing | Search input debounced at 300ms |
| Memoization | `React.memo` for row components |
| Binary data | Columnar format for efficient parsing |
| Spatial indexing | KDBush for O(log n) queries |
| Caching | In-memory + sessionStorage for loaded data |
| Preloading | Nearby countries preloaded on globe rotation |

### 9.2 Bundle Splitting

```
Initial bundle:
├── vendor-react (~45 KB gz)    # React + ReactDOM
├── vendor-maplibre (~150 KB gz) # MapLibre GL JS
├── app (~50 KB gz)             # App code
└── styles (~10 KB gz)          # Tailwind CSS

Lazy-loaded:
├── SearchPanel chunk
├── SettingsPanel chunk
├── BrowsePage chunk
└── BalloonRidePage chunk
```

### 9.3 Performance Targets

| Metric | Target | How |
|--------|--------|-----|
| First paint | < 2s | Fast data loading, minimal JS |
| Time to interactive | < 3s | Code splitting, lazy loading |
| Station play latency | < 1.5s | Direct stream URLs |
| Initial JS bundle | < 250 KB gz | Vendor splitting, tree shaking |
| Globe 60fps | Yes | Custom WebGL, no DOM markers |
| Click detection | < 5ms | KDBush spatial index |
| Search response | < 50ms | Fuse.js with pre-built index |

---

## 10. Security Architecture

### 10.1 Static Site Security

| Concern | Mitigation |
|---------|------------|
| No server to attack | Static files only |
| No secrets in code | Environment variables (if needed) |
| HTTPS enforced | Cloudflare SSL |
| No user data | No accounts, no PII stored |

### 10.2 Audio Stream Security

| Concern | Mitigation |
|---------|------------|
| CORS blocks streams | Show error message (no proxy) |
| Mixed content | HTTPS streams only on HTTPS site |
| Stream availability | Retry logic, graceful degradation |

---

## 11. Deployment Architecture

### 11.1 CI/CD Pipeline

```
Developer pushes to main
    │
    ▼
GitHub Actions triggers
    │
    ├──► Checkout code
    ├──► Setup Node.js 22
    ├──► npm ci (install dependencies)
    ├──► npm run build (Vite build)
    ├──► cp dist/index.html dist/404.html (SPA fallback)
    ├──► Upload artifact to GitHub Pages
    │
    ▼
GitHub Pages serves static files
    │
    ▼
Cloudflare DNS resolves radio.vellur.in → GitHub Pages
    │
    ▼
User accesses https://radio.vellur.in
```

### 11.2 DNS Architecture

```
radio.vellur.in
    │
    ▼
Cloudflare DNS (DNS-only mode)
    │
    ├──► CNAME radio → ragavellur.github.io
    │
    ▼
GitHub Pages (Fastly CDN)
    │
    ├──► SSL via Let's Encrypt
    ├──► Static files served
    │
    ▼
User's browser
```

---

## 12. Design Decisions

### 12.1 Why No Server?

| Decision | Rationale |
|----------|-----------|
| No server proxy for audio | Simpler deployment, no hosting costs, no maintenance |
| No API endpoints | All data is static, preprocessed at build time |
| No user accounts | Focus on core functionality first |
| Static site only | GitHub Pages is free and reliable |

### 12.2 Why MapLibre GL JS?

| Decision | Rationale |
|----------|-----------|
| Same as radio.garden | Proven technology, battle-tested |
| Native globe projection | No need for CesiumJS complexity |
| WebGL custom layers | High-performance dot rendering |
| Open source | No licensing concerns |

### 12.3 Why Columnar Data?

| Decision | Rationale |
|----------|-----------|
| Matches radio.garden | Consistent with proven approach |
| Efficient GPU uploads | Contiguous memory for WebGL buffers |
| Better compression | Similar values compress better |
| Selective loading | Load only lats/lngs for spatial index |

---

*Document maintained in `docs/03-ARCHITECTURE.md`*
