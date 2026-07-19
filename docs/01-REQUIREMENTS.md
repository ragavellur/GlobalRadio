# Global Radio Explorer — Requirements Document

> Version: 1.0  
> Date: 2026-07-20  
> Status: Approved

---

## 1. Project Overview

**Global Radio Explorer** is a web application that visualizes radio stations from around the world on an interactive 3D globe. Users can discover, explore, and listen to live radio streams directly in their browser.

The application is inspired by [radio.garden](https://radio.garden) and replicates its core functionality as a **static site** with **no server-side processing**.

---

## 2. Goals & Objectives

| Goal | Description |
|------|-------------|
| **Discover** | Visualize 150,000+ radio stations as dots on a 3D globe |
| **Explore** | Navigate cities, browse stations by country/city |
| **Listen** | Play live radio streams directly in the browser |
| **Discover** | Random "balloon ride" feature for serendipitous discovery |
| **Accessible** | Works on desktop and mobile devices |
| **Fast** | Loads in under 3 seconds, 60fps globe on modern devices |
| **Static** | No server required — hosted entirely on GitHub Pages |

---

## 3. Functional Requirements

### 3.1 Globe Visualization

| ID | Requirement | Priority |
|----|-------------|----------|
| F-GL-01 | Display an interactive 3D globe using MapLibre GL JS | Must |
| F-GL-02 | Render radio stations as colored dots on the globe | Must |
| F-GL-03 | Dot size reflects number of stations in the city | Must |
| F-GL-04 | Green dot color (#00FF82) matching radio.garden aesthetic | Must |
| F-GL-05 | Globe supports rotation, zoom, and pan gestures | Must |
| F-GL-06 | Globe works on touch devices (mobile/tablet) | Must |
| F-GL-07 | Smooth camera transitions when navigating to cities | Must |
| F-GL-08 | Globe renders at 60fps on modern devices | Should |
| F-GL-09 | Globe quality settings (low/medium/high) | Should |

### 3.2 Station Discovery

| ID | Requirement | Priority |
|----|-------------|----------|
| F-DI-01 | Click on city dot to view stations in that city | Must |
| F-DI-02 | Sidebar shows city name, country, station count | Must |
| F-DI-03 | Sidebar lists all stations in the selected city | Must |
| F-DI-04 | Sidebar shows nearby cities with distances | Must |
| F-DI-05 | Sidebar shows other cities in the same country | Must |
| F-DI-06 | Clicking a nearby city navigates to it on the globe | Must |
| F-DI-07 | "Balloon ride" mode: auto-rotate globe, visit random stations | Should |
| F-DI-08 | Balloon ride pauses on user interaction, resumes after idle | Should |

### 3.3 Audio Playback

| ID | Requirement | Priority |
|----|-------------|----------|
| F-AU-01 | Play radio streams using HTML5 Audio API | Must |
| F-AU-02 | Play/pause/stop controls | Must |
| F-AU-03 | Volume control with slider | Must |
| F-AU-04 | Mute/unmute toggle | Must |
| F-AU-05 | Display current station name and city | Must |
| F-AU-06 | Persistent audio player at bottom of screen | Must |
| F-AU-07 | Audio continues playing while navigating the globe | Must |
| F-AU-08 | Error handling for failed/unavailable streams | Must |
| F-AU-09 | Retry logic with exponential backoff | Should |
| F-AU-10 | Media Session API for lock-screen controls (mobile) | Should |

### 3.4 Search

| ID | Requirement | Priority |
|----|-------------|----------|
| F-SE-01 | Client-side fuzzy search across cities and stations | Must |
| F-SE-02 | Search by city name, station name, country | Must |
| F-SE-03 | Debounced input (300ms) for performance | Must |
| F-SE-04 | Search results show city name, station count, country | Must |
| F-SE-05 | Click search result navigates to city on globe | Must |
| F-SE-06 | Maximum 50 results displayed | Should |

### 3.5 Browse

| ID | Requirement | Priority |
|----|-------------|----------|
| F-BR-01 | Browse stations by country | Should |
| F-BR-02 | Browse stations by city within a country | Should |
| F-BR-03 | Sort stations by name, popularity, bitrate | Should |
| F-BR-04 | Virtualized list for performance with 150K+ items | Should |

### 3.6 Settings

| ID | Requirement | Priority |
|----|-------------|----------|
| F-ST-01 | Dark mode toggle (default: dark) | Must |
| F-ST-02 | Globe dot size setting (small/normal/large) | Should |
| F-ST-03 | Globe quality setting (low/medium/high/very-high) | Should |
| F-ST-04 | Favorites list (saved to localStorage) | Should |

### 3.7 Routing

| ID | Requirement | Priority |
|----|-------------|----------|
| F-RT-01 | SPA routing with clean URLs | Must |
| F-RT-02 | Routes: `/visit/:citySlug/:cityId` | Must |
| F-RT-03 | Routes: `/listen/:stationSlug/:channelId` | Must |
| F-RT-04 | Routes: `/balloon-ride` | Should |
| F-RT-05 | Routes: `/search` | Must |
| F-RT-06 | Routes: `/browse` | Should |
| F-RT-07 | Routes: `/settings` | Must |
| F-RT-08 | Direct URL navigation works (404.html fallback) | Must |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NF-PF-01 | First meaningful paint (globe + dots) | < 2 seconds |
| NF-PF-02 | Time to interactive | < 3 seconds |
| NF-PF-03 | Station play latency | < 1.5 seconds |
| NF-PF-04 | Initial JS bundle size (gzipped) | < 250 KB |
| NF-PF-05 | Globe frame rate on desktop | 60 fps |
| NF-PF-06 | Globe frame rate on mobile | 30+ fps |
| NF-PF-07 | Click detection response time | < 5 ms |
| NF-PF-08 | Search response time | < 50 ms |

### 4.2 Compatibility

| ID | Requirement |
|----|-------------|
| NF-CM-01 | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| NF-CM-02 | iOS Safari 15+, Chrome for Android 90+ |
| NF-CM-03 | Responsive design: 320px to 2560px viewport width |
| NF-CM-04 | Works without JavaScript disabled (shows message) |

### 4.3 Accessibility

| ID | Requirement |
|----|-------------|
| NF-AC-01 | Keyboard navigation for all interactive elements |
| NF-AC-02 | ARIA labels on audio player controls |
| NF-AC-03 | Minimum touch target size: 44x44 CSS pixels |
| NF-AC-04 | Color contrast ratio: 4.5:1 for text |

### 4.4 Security

| ID | Requirement |
|----|-------------|
| NF-SC-01 | No secrets or API keys in client-side code |
| NF-SC-02 | HTTPS enforced via Cloudflare |
| NF-SC-03 | No server-side processing (static site only) |

### 4.5 Deployment

| ID | Requirement |
|----|-------------|
| NF-DP-01 | Hosted on GitHub Pages |
| NF-DP-02 | Custom domain: radio.vellur.in |
| NF-DP-03 | Automatic deployment on push to main branch |
| NF-DP-04 | Cloudflare DNS (DNS-only mode) |

---

## 5. Data Requirements

### 5.1 Source Data

| Metric | Value |
|--------|-------|
| Source file | stations.json (17.9 MB) |
| Total cities | 12,707 |
| Total stations | 150,935 |
| Countries | 166 |
| Invalid values (NaN) | 622 (0.4%) — replaced with null |

### 5.2 Processed Data

| File | Size | Purpose |
|------|------|---------|
| index.json | ~480 KB | All cities columnar (loads on startup) |
| countries.json | ~65 KB | Country metadata + city mapping |
| grid_5deg.json | ~70 KB | Spatial grid for viewport filtering |
| stations/*.json | ~10 MB total | Per-country station files (166 files) |

### 5.3 Data Format

**Columnar format** (matching radio.garden's approach):

```json
{
  "ids": ["0", "1", "2", ...],
  "lats": [51.644, 43.3623, ...],
  "lngs": [-121.295, -8.4115, ...],
  "sizes": [11, 12, ...],
  "cities": ["London", "Paris", ...],
  "cc": ["GB", "FR", ...]
}
```

---

## 6. Constraints

| Constraint | Description |
|------------|-------------|
| **No server** | Static site only — no API endpoints, no proxies |
| **No CORS proxy** | Audio streams must have CORS headers; failed streams show error |
| **GitHub Pages** | Limited to static file hosting |
| **10 MB data limit** | Total data transfer per page load should be reasonable |
| **Mobile-first** | Must work well on mobile devices |

---

## 7. Out of Scope (Phase 2+)

| Feature | Phase |
|---------|-------|
| User accounts / login | Phase 3 |
| Station ratings / reviews | Phase 3 |
| Curated playlists | Phase 2 |
| Radio station submission | Phase 3 |
| Podcasts | Phase 3 |
| Social features (sharing, following) | Phase 3 |
| Offline support (PWA) | Phase 2 |
| Server-side audio proxy (for CORS-blocked streams) | Phase 2 |

---

## 8. Success Criteria

| Criteria | Measurement |
|----------|-------------|
| Globe loads with all dots | < 2 seconds on 4G connection |
| Audio plays on first click | No autoplay blocks |
| Mobile experience | Usable on iPhone SE (375px width) |
| Search works | Returns relevant results in < 50ms |
| Deployment works | Auto-deploys on push to main |
| DNS works | radio.vellur.in resolves and loads HTTPS |

---

## 9. Stakeholders

| Role | Name |
|------|------|
| Project Owner | ragavellur |
| Developer | ragavellur |
| Domain | radio.vellur.in |
| Hosting | GitHub Pages |
| DNS | Cloudflare |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Columnar format** | Data organized by field (all lats together, all lngs together) rather than by record |
| **KDBush** | Spatial index for fast nearest-neighbor queries |
| **MapLibre GL JS** | Open-source map library with WebGL rendering |
| **Globe projection** | 3D sphere rendering mode in MapLibre |
| **Custom Layer** | WebGL rendering layer in MapLibre for custom graphics |
| **CORS** | Cross-Origin Resource Sharing — browser security for cross-domain requests |
| **SPA** | Single Page Application — client-side routing without page reloads |

---

*Document maintained in `docs/01-REQUIREMENTS.md`*
