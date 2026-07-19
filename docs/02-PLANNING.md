# Global Radio Explorer — Planning Document

> Version: 1.0  
> Date: 2026-07-20  
> Status: Approved

---

## 1. Project Timeline

**Total estimated duration:** 12 days (phased implementation)

```
Week 1: Foundation + Data + Globe
├── Day 1-2:  Project scaffolding & configuration
├── Day 3:    Data preprocessing pipeline
├── Day 4-6:  Globe visualization
└── Day 7-8:  UI components

Week 2: Features + Polish + Deploy
├── Day 9:    State management & routing
├── Day 10-11: Features (balloon ride, settings, mobile)
└── Day 12:   Polish, deploy, DNS setup
```

---

## 2. Phase Breakdown

### Phase 1: Foundation (Days 1-2)

| Task | Description | Est. |
|------|-------------|------|
| 1.1 | Scaffold Vite + React + TypeScript project | 30 min |
| 1.2 | Configure Tailwind CSS v4 | 30 min |
| 1.3 | Set up ESLint + Prettier | 30 min |
| 1.4 | Configure Vite for GitHub Pages (`base: '/'`) | 15 min |
| 1.5 | Create project folder structure | 30 min |
| 1.6 | Create `CNAME` file and `.nojekyll` | 5 min |
| 1.7 | Create GitHub Actions workflow | 30 min |
| 1.8 | Verify dev server runs and builds | 30 min |

**Deliverables:**
- Working React app with Vite
- Tailwind CSS configured
- ESLint + Prettier configured
- GitHub Actions workflow ready
- Project structure created

---

### Phase 2: Data Layer (Day 3)

| Task | Description | Est. |
|------|-------------|------|
| 2.1 | Analyze `stations.json` structure | 30 min |
| 2.2 | Write preprocessing script (`scripts/preprocess.mjs`) | 2 hrs |
| 2.3 | Generate `index.json` (columnar format) | 30 min |
| 2.4 | Generate `countries.json` (country metadata) | 30 min |
| 2.5 | Generate per-country station files | 30 min |
| 2.6 | Implement data loader with caching (`lib/data/loader.ts`) | 1 hr |
| 2.7 | Build KDBush spatial index (`lib/data/spatial.ts`) | 1 hr |

**Deliverables:**
- Preprocessed data in `public/data/`
- Data loader with in-memory + sessionStorage caching
- KDBush spatial index for click detection

---

### Phase 3: Globe Visualization (Days 4-6)

| Task | Description | Est. |
|------|-------------|------|
| 3.1 | Initialize MapLibre GL with globe projection | 1 hr |
| 3.2 | Create custom WebGL layer for dots | 3 hrs |
| 3.3 | Implement dot sizing based on station count | 1 hr |
| 3.4 | Add dot color (#00FF82) and highlight on hover | 1 hr |
| 3.5 | Implement click detection with KDBush | 1 hr |
| 3.6 | Add camera transitions (flyTo) | 1 hr |
| 3.7 | Handle antimeridian edge cases | 1 hr |
| 3.8 | Optimize for 60fps performance | 2 hrs |

**Deliverables:**
- Globe with 12,707 dots rendered
- Click detection working
- Smooth camera transitions
- 60fps performance

---

### Phase 4: UI Components (Days 7-8)

| Task | Description | Est. |
|------|-------------|------|
| 4.1 | Build Sidebar component (slide-in) | 1.5 hrs |
| 4.2 | Build CityHeader (name, country, count, time) | 1 hr |
| 4.3 | Build StationList with play buttons | 1.5 hrs |
| 4.4 | Build NearbyCities (distances) | 1 hr |
| 4.5 | Build CountryCities (other cities in country) | 1 hr |
| 4.6 | Build AudioPlayer (fixed bottom bar) | 2 hrs |
| 4.7 | Build SearchPanel with Fuse.js | 1.5 hrs |
| 4.8 | Build SettingsPanel (dark mode, quality) | 1 hr |

**Deliverables:**
- Sidebar with city/station info
- Audio player with controls
- Search panel with fuzzy search
- Settings panel

---

### Phase 5: State & Routing (Day 9)

| Task | Description | Est. |
|------|-------------|------|
| 5.1 | Set up Zustand store with persistence | 1.5 hrs |
| 5.2 | Configure React Router with all routes | 1.5 hrs |
| 5.3 | Implement SPA routing on GitHub Pages (404.html) | 30 min |
| 5.4 | Connect components to store | 1.5 hrs |
| 5.5 | Test all routes work | 30 min |

**Deliverables:**
- Zustand store with persist middleware
- All routes configured
- 404.html fallback working
- Components connected to store

---

### Phase 6: Features (Days 10-11)

| Task | Description | Est. |
|------|-------------|------|
| 6.1 | Implement BalloonRide (auto-rotation, random stations) | 2 hrs |
| 6.2 | Add favorites functionality (localStorage) | 1 hr |
| 6.3 | Add mobile responsiveness | 2 hrs |
| 6.4 | Add touch gestures for globe | 1 hr |
| 6.5 | Add Media Session API for lock-screen controls | 1 hr |
| 6.6 | Add error handling for failed streams | 1 hr |
| 6.7 | Add retry logic with exponential backoff | 1 hr |

**Deliverables:**
- Balloon ride feature
- Favorites list
- Mobile-responsive design
- Touch gestures working
- Error handling complete

---

### Phase 7: Polish & Deploy (Day 12)

| Task | Description | Est. |
|------|-------------|------|
| 7.1 | Performance optimization (code splitting, lazy loading) | 1.5 hrs |
| 7.2 | Final testing on multiple devices | 1 hr |
| 7.3 | Set up Cloudflare DNS (DNS-only mode) | 30 min |
| 7.4 | Test GitHub Actions deployment | 30 min |
| 7.5 | Verify HTTPS works | 15 min |
| 7.6 | Test on mobile devices | 30 min |
| 7.7 | Final polish and bug fixes | 1 hr |

**Deliverables:**
- Production build optimized
- DNS configured and verified
- HTTPS working
- Mobile tested

---

## 3. Task Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Data Layer) ← depends on Phase 1
    ↓
Phase 3 (Globe) ← depends on Phase 2
    ↓
Phase 4 (UI) ← depends on Phase 3
    ↓
Phase 5 (State & Routing) ← depends on Phase 4
    ↓
Phase 6 (Features) ← depends on Phase 5
    ↓
Phase 7 (Deploy) ← depends on Phase 6
```

---

## 4. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CORS blocks audio streams | High | Medium | Show "Stream unavailable" error; no server proxy |
| Globe performance on low-end devices | Medium | Medium | Reduce dot count, disable atmosphere, cap DPR at 1 |
| Cloudflare proxy breaks cert renewal | Low | High | Use DNS-only (grey cloud) permanently |
| Antimeridian rendering issues | Medium | Low | Set `buffer: 256` on sources, avoid camera near 180° |
| Large bundle size | Medium | Medium | Code splitting, lazy loading, vendor chunks |
| Mobile touch conflicts | Medium | Low | Configure OrbitControls, prevent page scroll on canvas |
| Data preprocessing errors | Low | High | Validate output, test with sample data first |

---

## 5. Quality Checklist

### Before Each Phase

- [ ] Previous phase complete and tested
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] Git commit with descriptive message

### Before Deployment

- [ ] All routes work with direct URL navigation
- [ ] Globe renders all dots at 60fps
- [ ] Audio plays on first click (no autoplay issues)
- [ ] Mobile responsive (375px width)
- [ ] Search returns relevant results
- [ ] Favorites persist across page refreshes
- [ ] 404.html fallback works for SPA routing
- [ ] HTTPS enforced via Cloudflare
- [ ] DNS resolves correctly
- [ ] GitHub Actions workflow completes successfully

---

## 6. Communication Plan

| Event | Action |
|-------|--------|
| Phase complete | Update this document with completion status |
| Blocker encountered | Document in ARCHITECTURE.md decisions section |
| DNS ready | Update DEPLOYMENT.md with DNS records |
| Deployment tested | Update DEPLOYMENT.md with verification results |

---

## 7. Definition of Done

A task is considered **done** when:

1. Code is written and working
2. TypeScript compiles without errors
3. ESLint passes without errors
4. Code is formatted with Prettier
5. Tested on Chrome and Safari
6. Tested on mobile (iPhone SE viewport)
7. Committed to git with descriptive message
8. No regressions in existing functionality

---

## 8. Status Tracking

| Phase | Status | Start Date | End Date | Notes |
|-------|--------|------------|----------|-------|
| Phase 1: Foundation | Pending | - | - | |
| Phase 2: Data Layer | Pending | - | - | |
| Phase 3: Globe | Pending | - | - | |
| Phase 4: UI Components | Pending | - | - | |
| Phase 5: State & Routing | Pending | - | - | |
| Phase 6: Features | Pending | - | - | |
| Phase 7: Deploy | Pending | - | - | |

---

*Document maintained in `docs/02-PLANNING.md`*
