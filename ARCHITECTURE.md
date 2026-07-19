# Global Radio Explorer — Architecture & Implementation Plan

> **Verified against radio.garden** via Chrome DevTools inspection on 2026-07-20.
> All findings below are observed facts, not assumptions.

---

## 1. Data Analysis Summary

| Metric | Value |
|--------|-------|
| Total cities | 12,707 |
| Total stations | 150,935 |
| Countries | 166 |
| Raw JSON size | 17.9 MB |
| Coords-only (compact) | **0.48 MB** |
| Stations-only (compact) | **10.4 MB** |

---

## 2. How radio.garden Actually Works (Verified)

### 2.1 Globe Rendering

- **MapLibre GL JS** with native `globe` projection — NOT CesiumJS
- Single WebGL canvas, custom layer for satellite imagery + dots
- Satellite tiles: `${baseUrl}/{z}/{x}/{y}.jpg` (512px tiles, retina `-2x.jpg` variants)
- Custom scroll/touch zoom handlers with slow zoom rates (1/450 scroll, 1/300 wheel, 1/50 pinch)
- Rotation disabled; only pan + zoom
- Device benchmark-based quality (loads `/public/benchmarks-9/d-apple.json`)

### 2.2 Data Loading (Two API Calls Load Everything)

**Call 1: `/api/ara/content/places-core-columnar`** (~80 KB gzipped)
```
{
  "ids": ["IraCQo_B", "cEmlVB5h", ...],    // 11,113 short IDs
  "lats": [51.644, 43.3623, ...],           // latitudes
  "lngs": [-121.295, -8.4115, ...],         // longitudes
  "sizes": [11, 12, ...],                   // station count per city
  "boosts": [1, 0, ...]                     // visibility/prominence boost
}
```

**Call 2: `/api/ara/content/places-details-columnar`** (~80 KB gzipped)
```
{
  "titles": ["100 Mile House", "A Coruna", ...],  // city names
  "countryIdx": [0, 1, ...],                       // index into countries array
  "countries": ["Canada", "Spain", ...],            // 224 unique country names
  "skipRides": [7, 11, 26, ...]                    // indices to skip in balloon ride
}
```

Both are columnar (separate arrays per field) for efficient parsing and compression. Both cached via Cloudflare (etag + cf-cache-status: HIT).

### 2.3 Dot Rendering on Globe

Dots rendered via MapLibre custom WebGL layer with these scale factors:
```
smallPlaceScale:  0.14   (1-4 stations)
mediumPlaceScale: 0.27   (5-19 stations)
largePlaceScale:  0.42   (20+ stations)
boostScale:       1.5    (boosted cities)
globalScale:      0.5    (base scale)
```

### 2.4 City Interaction Flow

1. Click dot → navigates to `/visit/{city-slug}/{cityId}`
2. Fetches `/api/ara/content/page/{cityId}` → returns:
   - Stations in the city
   - Picks from the area (nearby stations)
   - Popular in country
   - Nearby cities with distances
   - Cities in country with station counts
3. Panel slides in from left with all this info

### 2.5 Audio Streaming Flow

1. Click "play" or select station → navigates to `/listen/{station-slug}/{channelId}`
2. Fetches `/api/ara/content/channel/{channelId}` → returns:
   - `stream`: domain hint (e.g., "radiojar.com") — NOT the full URL
   - `secure`: boolean (HTTPS available)
   - `website`, `preroll`, `country`, `place`
3. **Server-side proxy**: Audio played via `/api/ara/content/test/radio.mp3?{timestamp}`
   - Radio.garden resolves the actual stream URL server-side
   - Proxies all audio through their domain (serves CORS, handles HTTP streams)
   - Timestamp is cache buster

### 2.6 Search

- Server-side: `/api/search?q={query}`
- Returns mixed results: cities (with station count), individual stations, countries
- Debounced client-side (cancels in-flight requests as user types)
- Fuzzy matching across city names, station names, country names

### 2.7 URL Structure

| URL Pattern | Purpose |
|-------------|---------|
| `/visit/{city-slug}/{cityId}` | City view on globe |
| `/listen/{station-slug}/{channelId}` | Playing a station |
| `/balloon-ride` | Random discovery mode |
| `/search` | Search interface |
| `/browse` | Curated playlists |
| `/settings` | Settings panel |

### 2.8 Settings

- Language selection
- Dark mode toggle
- Increased contrast
- Globe dots size (Normal)
- Globe quality (Very High / High / Medium / Low)
- Favorites transfer via codes
- Submit station, Contact, Privacy Policy links

---

## 3. Our Implementation Architecture

### 3.1 Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | **Next.js 14+ (App Router)** | SSR shell, API routes, edge runtime, static data serving |
| **Language** | **TypeScript** | Type safety |
| **Map/Globe** | **MapLibre GL JS** with `projection: 'globe'` | Same as radio.garden. Native globe projection, WebGL custom layers, battle-tested |
| **Styling** | **Tailwind CSS** | Fast utility-first |
| **State** | **Zustand** | Lightweight, no boilerplate |
| **Audio** | **HTML5 Audio API** | Proxied streams, simple `<audio>` element |
| **Search** | **Fuse.js** (client) + in-memory index | Fuzzy search on the 11K city index |

### 3.2 Data Architecture (Matching radio.garden's Approach)

We replicate their columnar format almost exactly:

**Phase 1: Two files load everything for the globe**

`/data/index.json` (~480 KB → ~186 KB gzipped)
```json
{
  "ids": ["0", "1", "2", ...],
  "lats": [51.644, 43.3623, ...],
  "lngs": [-121.295, -8.4115, ...],
  "sizes": [11, 12, ...],
  "cities": ["100 Mile Hous", "A Coruna", ...],
  "cc": ["CA", "ES", ...]
}
```

**Phase 2: Station data loaded per-city on click**

`/data/stations/{id}.json` (~2-20 KB each)
```json
{
  "stations": [
    ["Cntry 840", "https://vistaradio.streamb.live/SB00073"],
    ["Civl-Fm", "https://live.civl.ca:8000/live.mp3"]
  ],
  "nearby": [
    ["Williams Lake", "CA", 52.1, -122.1, 5, 89],
    ...
  ],
  "countryCities": [
    ["Vancouver", "CA", 49.28, -123.12, 15],
    ...
  ]
}
```

### 3.3 Project Structure

```
globalradio/
├── scripts/
│   └── preprocess.mjs          # Data pipeline: stations.json → optimized shards
├── public/
│   └── data/
│       ├── index.json           # All cities columnar (480 KB)
│       ├── search.json          # Search index
│       └── stations/
│           ├── 0.json           # Per-city station data
│           ├── 1.json
│           └── ...
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Redirect to /live
│   │   ├── globals.css
│   │   └── live/
│   │       └── page.tsx        # Main globe page
│   ├── components/
│   │   ├── Globe/
│   │   │   ├── GlobeView.tsx        # MapLibre GL with globe projection
│   │   │   ├── GlobeDots.tsx        # Custom WebGL layer for dots
│   │   │   └── GlobeControls.tsx    # Zoom, location, balloon ride
│   │   ├── Player/
│   │   │   ├── AudioPlayer.tsx      # Bottom bar: play/pause, next, volume
│   │   │   └── StationDialog.tsx    # Station details modal
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx          # Slide-out drawer
│   │   │   ├── CityHeader.tsx       # City name, country, count, time
│   │   │   ├── StationList.tsx      # Stations in city
│   │   │   ├── NearbyCities.tsx     # Nearby with distances
│   │   │   └── CountryCities.tsx    # Other cities in country
│   │   ├── Search/
│   │   │   ├── SearchPanel.tsx      # Search UI
│   │   │   └── SearchResults.tsx    # Mixed results display
│   │   ├── Browse/
│   │   │   └── BrowsePanel.tsx      # Curated playlists (Phase 2)
│   │   ├── Favorites/
│   │   │   └── FavoritesPanel.tsx   # Saved stations
│   │   └── Settings/
│   │       └── SettingsPanel.tsx    # Dark mode, quality, etc.
│   ├── lib/
│   │   ├── data/
│   │   │   ├── index.ts            # Load + cache index.json
│   │   │   ├── loader.ts           # Fetch per-city station data
│   │   │   └── search.ts           # Fuse.js search
│   │   ├── audio/
│   │   │   └── player.ts           # HTML5 Audio wrapper
│   │   ├── hooks/
│   │   │   ├── useGlobe.ts         # MapLibre map instance
│   │   │   ├── useStation.ts       # Current station state
│   │   │   ├── useSearch.ts        # Search with debounce
│   │   │   └── useFavorites.ts     # localStorage favorites
│   │   └── utils/
│   │       ├── geo.ts              # Lat/lon math
│   │       └── constants.ts        # Scale factors, thresholds
│   ├── store/
│   │   └── useStore.ts             # Zustand store
│   └── types/
│       └── index.ts
├── package.json
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

### 3.4 Loading Strategy (Matching radio.garden)

```
Page Load:
  1. index.json (186 KB gz) → renders 12,707 dots on globe
  2. search.json (fuzzy index) → enables search
  
User clicks city dot:
  3. /data/stations/{cityId}.json → shows station list + nearby
  
User clicks play:
  4. Audio element plays the stream URL directly
  (No server-side proxy needed if streams have CORS; otherwise add one)
  
User searches:
  5. Client-side Fuse.js on loaded index
```

### 3.5 Key Implementation Details

**Globe initialization (MapLibre GL JS):**
```typescript
const map = new maplibregl.Map({
  container: 'globe',
  projection: { type: 'globe' },
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
});
```

**Dot rendering (custom WebGL layer):**
```typescript
// Use MapLibre's CustomLayerInterface for WebGL dot rendering
// Render dots as GL_POINTS or instanced quads
// Scale based on sizes[] from index data
// Color: green for active, dim for inactive
```

**Audio player:**
```typescript
// Direct HTML5 Audio for most streams
// HLS.js for .m3u8 streams
// Fallback: proxy endpoint on our server for CORS-blocked streams
const audio = new Audio();
audio.src = streamUrl;
audio.play();
```

---

## 4. Implementation Steps

| Step | Task | Est. |
|------|------|------|
| 1 | Preprocess stations.json → index.json + per-city shards | 2 hrs |
| 2 | Next.js scaffolding + Tailwind + Zustand | 1 hr |
| 3 | MapLibre GL globe with `projection: 'globe'` | 3 hrs |
| 4 | Custom WebGL dot rendering layer | 4 hrs |
| 5 | City click → load station data → sidebar panel | 3 hrs |
| 6 | Audio player (play/pause/next/prev/volume) | 2 hrs |
| 7 | Search (Fuse.js + debounced input) | 2 hrs |
| 8 | Navigation (URL routing, drawer open/close) | 2 hrs |
| 9 | Globe controls (zoom, location, balloon ride) | 2 hrs |
| 10 | Settings (dark mode, quality) | 1 hr |
| 11 | Responsive + mobile | 2 hrs |
| 12 | Performance optimization | 2 hrs |
| **Total** | | **~26 hrs** |

---

## 5. Performance Targets

| Metric | Target |
|--------|--------|
| First paint (globe + dots) | < 2s |
| Time to interactive | < 3s |
| Station play latency | < 1.5s |
| Initial JS bundle | < 250 KB gzipped |
| Mobile 60fps globe | Yes |
