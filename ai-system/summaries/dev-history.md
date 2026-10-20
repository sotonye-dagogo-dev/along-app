# Development History

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-19 (Sprint 80: duplicate-proof bug assignment + notification deep links + auth session persistence)
> - last-verified-against-code: 2026-10-19 (Sprint 80 in-runner QA: tsc 0, jest 113/113 suites 1178/1178, build clean)
> - staleness-policy: historical entries do not go stale

> **Overview:** Chronological log of completed development work for Along. Each sprint ends with a summary entry. Agents add entries after completing tasks. Useful for understanding what has been built and when decisions were made.

---

## Entry Format

```
## [Date] — [Sprint or Session Title]

**Summary:**
[2-4 sentence overview of what was accomplished]

**Completed:**
- [task 1]
- [task 2]

**Key Changes:**
- [important architectural or behavioural change]


**Next Sprint Focus:**
[What comes next]
```

---

## History

## 2026-10-17 — Supabase Database Transfer and Recovery (Sprint 73)

**Summary:**
Added a config-driven database transfer boundary for the Prisma Postgres to
Supabase cutover and ongoing recovery strategy. Backups are atomic, checksummed
JSONL artifacts with raw PostgreSQL temporal text preservation, per-table hashes,
resumable journal stages, schema checks, cyclic-FK planning, and one-transaction
restore verification with safety backups before replacement.

**Completed:**

- Resumable migration, generic local backup/restore, and recurring
  Supabase-to-local plus retained-Prisma mirror CLIs
- `.env.example` and README runbook; Prisma connection path reviewed with
  Accelerate retained only where appropriate and direct SQL endpoints used by
  transfer tooling
- Focused integrity/codec/schema/CLI tests, full QA, and live read-only probes

**QA:** TypeScript clean; Jest 104/104 suites and 1025/1025 tests passed; build
clean; lint retains only pre-existing errors in untouched files; both Supabase
poolers and the legacy direct endpoint responded successfully.

## 2026-10-17 — Execute-Feature: Map Tightening (Sprint 72)

**Summary:**
Location fields and suggestions now show friendly reverse-geocoded place names as the pinned intent hit (raw coords/plus codes only as fallback), and `CGQC+HQ2 Lekki`-style plus-code queries resolve against their locality (reference point + plain-locality suggestions) — closing Sprint 71's queued follow-up. The route preview gained a tap-to-assign flow: empty-area map taps open a dismissible stop-assignment card, every location input gained a persistent `[Use my current location] … [Find on map]` row (locate moved out of the focused dropdown), and "Find on map" flies the camera to the best-known target with an auto-hiding tap hint. Route traces became vehicle-aware — walking/bike posts trace on keyed walking/cycling profiles with the legacy driving chain as guaranteed fallback — and baseline map recentering is deferred until after user interaction (fixing the post-detail GPS-tick refit). All additive and config-driven.

**Completed:**

- Friendly intent labels: `geocodeForward` label-first coordinate/plus-code pins (Sprint 71 raw-pin-first superseded), parallel Nominatim ∥ Photon `geocodeReverse` for resilient `locateMe` labels; full addresses never shortened
- Plus-code locality: `extractPlusCodeToken` + `plusCodeLocalityFallback` — code remainder geocoded as bounded short-code reference (parallel, viewer-near fallback) AND as a plain locality query
- Tap-to-assign: `mapPicker.ts` + `RouteMap` `pickOptions`/`onPickOption`/`focusRequest` (anchored dismissible card, Escape/X/re-tap, line taps keep stretch/mini tooltips, focus flyTo bypasses fit deferral + tap-hint pill); ShareRouteModal CTA row, `findOnMap` (coords → text geocode → `resolveFindOnMapTarget` previous-stops/bias → GPS), `handlePickOption` with reverse-label supersede guard; 4 new FAQ items (en + pidgin)
- Vehicle traces: `mapStack.ts` profile registry (`routingBases`/`routingProfiles`/`resolveRoutingProfiles`/`routingProfileSlug`) + `traceRoute(pins,{vehicle})` mode-aware pass (ORS/Mapbox walking-cycling, keyless OSRM driving-only skipped) → byte-identical legacy chain → straight-line; slug-suffixed cache keys only for non-default profiles; both trace APIs + clients + `traceCacheKey(sig, vehicle?)` threaded
- Deferred recenter: `mapView.ts` (`shouldDeferFit` + idle/poll knobs), RouteMap `followActive` dep fix + interaction-deferred token-guarded fit watcher (post card/post detail pan no longer yanked by GPS ticks)
- Tests: +3 NEW suites (`mapVehicleProfiles`, `mapView`, `mapPicker`), `locationIntent` 22→28

**QA:** tsc 0 errors; jest 98/98 suites 865/865; lint clean on touched files (11 pre-existing errors in untouched files); full `next build` clean.

**Files:**

- Edited: `lib/config/{locationSuggestions,mapStack,faq}`, `lib/services/{mapProxyService,routeTracingService}`, `lib/hooks/useRouteTrace`, `lib/utils/geo`, `api/routes/trace`, `api/maps/route`, `components/features/posts/{RouteMap,ShareRouteModal}`, `__tests__/config/locationIntent`
- Created: `lib/config/{mapView,mapPicker}`, `__tests__/config/{mapVehicleProfiles,mapView,mapPicker}.test.ts`

## 2026-10-17 — Execute-Feature: Location Input Power-Ups (Sprint 71)

**Summary:**
Location fields only recognised bare `lat, lng` pairs, could not resolve Plus Codes (Open Location Codes), and house-numbered addresses often blanked when fast geocoders missed them. Paren/bracket-wrapped coordinates now parse; Plus Codes decode fully offline (Nominatim/Photon do not support them — verified upstream); short codes recover against the viewer bias; house-numbered queries get a round-2 stripped retry plus an Overpass `addr:housenumber` scan. All config-driven, keyless-first, never-throw; client still never hits upstreams.

**Completed:**

- Paren-aware `parseCoordinateQuery` (`(6.5244, 3.3792)`, `[...]`); existing range guards unchanged
- Offline OLC stack in `locationSuggestions.ts` (`classifyPlusCode`/`decodePlusCode`/`encodePlusCode`/`recoverNearestPlusCode`/`parsePlusCodeQuery`) ported from google/open-location-code (Apache-2.0), 60/60 official vector checks green
- `geocodeForward`: intent pins (coords + `plus-codes`), bounded reverse-geocode label in parallel with fast providers, short-code recovery via `near`, round-2 numeric-address fallback (`stripLeadingHouseNumber` + `geocodeViaOverpassAddress`)
- Config copy: `locationPlaceholder`/`locationEmptyStateHint`/`numericAddressFallback`/`plusCodeProviderName`; ShareRouteModal/RouteStepInput/RequestRouteModal wired
- NEW `app/__tests__/config/locationIntent.test.ts` (22 assertions)

**Key Changes:**

- Edited: `app/lib/config/locationSuggestions.ts`, `app/lib/services/mapProxyService.ts`, ShareRouteModal/RouteStepInput/RequestRouteModal placeholders
- New: `app/__tests__/config/locationIntent.test.ts`

**QA gate (this runner — node_modules installed):**

- `npx tsc --noEmit` — 0 errors
- `npx jest` — 95/95 suites, 838/838 tests
- `npm run build` — clean
- `npm run lint` — exit 1 from pre-existing `no-explicit-any` in untouched `app/api/posts/feed/route.ts` + `app/api/suggestions/route.ts`; 0 errors in touched files

**Next Sprint Focus:**
Optional: short-code recovery via a locality token when no viewer bias is granted; FAQ note on plus-code support if users ask.

---

## 2026-10-16 — Execute-Feature: Vehicle-Aware Journey Times + Persistent Traffic Overlay + Post-Card Navigate Link (Sprint 67)

**Summary:**
Traffic colors vanished whenever the tracer swapped the straight pins-line for the road-snapped trace (chunk indices belonged to the old geometry), journey times assumed cars for every mode (a trek timed like a taxi, ferries slowed by road traffic), and post cards had no entry point into the navigation guide. All three are fixed config-first: a new journey-time registry (per-vehicle speeds + traffic sensitivity), proportional traffic remapping in the renderer, and a metadata-driven Navigate quick link that deep-links (`?navigate=1`) into the live-navigation overlay.

**Completed:**

- NEW `lib/config/journeyTime.ts` (speeds: trekking 5 / bike 16 / keke 25 / bus 22 / taxi-bolt-car 28-30 / boat 18 / train 60 km/h; sensitivity: trekking 0.05 / bike 0.35 / road 0.9-1 / boat-train 0; pure helpers: speed/sensitivity/recompute/estimate/vehicle-blend/dominant-steps/resolve-duration, destination-excluded, unknown-mode fallbacks)
- Traffic persistence: NEW `remapTrafficSegments` (fractional chunk remap, pure, identity on same geometry, [] on degenerate) in `lib/config/traffic.ts`; RouteMap keeps the last good result across geometry swaps and remaps before slicing; `useRouteTraffic` keeps prior result during refetch + optional vehicle param (memory-cache key extended)
- Vehicle-aware durations end-to-end: `geo.estimateRoute(points, vehicle?)`, `useRouteTrace(pins, vehicle?)` (slow/rail/water recompute from traced distance), `trafficService.getTrafficForRoute(coords, base, vehicle?)` (sensitivity-scaled blend, vehicle-suffixed Redis key), `POST /api/maps/traffic` accepts optional `vehicle`; ShareRouteModal preview + post detail compute the dominant vehicle and pass it to RouteMap/traffic/guide; stored nulls fall back to mode-adjusted trace/estimate
- Post-card Navigate quick link: `POST_ACTIONS_CONFIG` navigate fields (label/path `?navigate=1`/class, non-request cards with coords only); post detail auto-opens `LiveNavigationModal` on `?navigate=1` (once per post id); `LiveNavigationModal` forwards optional `vehicle`
- NEW `app/__tests__/config/journeyTime.test.ts` (16 assertions: speeds/fallbacks, immunity/dampening, destination exclusion, remap persistence)

**Key Changes:**

- New: `app/lib/config/journeyTime.ts`, `app/__tests__/config/journeyTime.test.ts`
- Edited: `lib/config/{traffic,postActions,index}.ts`, `lib/utils/geo.ts`, `lib/hooks/{useRouteTraffic,useRouteTrace}.ts`, `lib/services/trafficService.ts`, `app/api/maps/traffic/route.ts`, `components/features/posts/{RouteMap,PostCard,ShareRouteModal,LiveNavigationModal}.tsx`, `app/(dashboard)/posts/[id]/page.tsx`

**QA gate (this runner — no node_modules, full gate deferred to CI):**

- `node --experimental-strip-types` pure-logic harness — 27/27 checks pass (speeds, sensitivities, blends, dominant-vehicle, resolve-duration, remap full/split/identity/degenerate)
- `npx tsc --noEmit` — only missing-module noise (no project deps installed); no new type errors introduced by inspection
- `npx jest` / `next build` — deferred to CI (no node_modules in runner)

**Next Sprint Focus:**
FAQ/maps docs for vehicle-aware durations + traffic persistence; admin-editable journey-time knobs if non-technical tuning is needed.

---

## 2026-10-09 — Execute-Feature: Route Accuracy (preview = post view) + Live-Navigation Overlay + Admin Users Type Fix (Sprint 28)

**Summary:**
Posted route maps skipped intermediate stops (start → destination) while the composer preview traced them correctly. Root cause was server-side: POST `/api/posts` destructured `waypoints` away and never persisted them, and the post-detail pin builder mapped `waypoints` as the full route instead of origin + intermediates + destination. Both are fixed behind one canonical builder, post detail now fetches a road-snapped trace like the preview (with a bounded geocode backfill for legacy rows), live navigation opens as a near-fullscreen floating overlay with map + guide side-by-side, and the Vercel `admin/users` `actorId` type error is resolved with the established `as string` pattern.

**Completed:**

- Deploy fix: `app/api/admin/users/route.ts` `actorId: user.id` → `user.id as string` (2 sites — verify/unverify + resend-verification notifications)
- Persistence: POST `/api/posts` accepts + stores `waypoints` (schema already allowed them; PATCH already passed them through)
- Canonical pins: NEW `lib/config/routePins.ts` + barrel (`buildRoutePinsFromPost`, `buildTraceInputFromPins`, `ROUTE_PINS_CONFIG`); PostCard mini-map + post detail consume it
- Detail trace: NEW `lib/hooks/useRouteTrace.ts` (instant estimate + debounced trace + 10-min memory cache + silent fallback); legacy waypoint-less rows backfill via bounded (≤5) geocode of missing stop labels
- Navigation overlay: NEW `LiveNavigationModal` (fixed overlay, 92dvh panel, mobile map-over-guide stack, desktop 360px side panel from `LIVE_NAVIGATION_CONFIG`, Escape/backdrop/body-lock, unmount stops tracking); post detail renders CTA card + modal; inline map no longer follows user
- RouteMap `height` widened to `number | string` so the modal can fill its flex parent with `"100%"`

**Key Changes:**

- New: `app/lib/config/routePins.ts`, `app/lib/hooks/useRouteTrace.ts`, `app/components/features/posts/LiveNavigationModal.tsx`, `app/__tests__/config/routePins.test.ts`
- Edited: `app/api/{admin/users,posts}/route.ts`, `app/components/features/posts/{PostCard,RouteMap,index}.tsx`, `app/(dashboard)/posts/[id]/page.tsx`, `lib/config/{index,navigation}.ts`

**QA gate (this runner, node_modules installed via npm install):**

- `npx tsc --noEmit` — clean (exit 0), incl. the exact `admin/users/route.ts:166` gate that failed Vercel
- `npx jest` — 38/38 suites, 333/333 tests pass (incl. new routePins 5/5)
- `npx next lint` on touched files — zero warnings/errors
- `npm run vercel-build` (`next build`) — clean

**Next Sprint Focus:**
Vercel deploy green confirmation; prod-verify a 3-stop post traces start → stop → destination in feed + detail, legacy posts backfill stops, navigation modal map follows the user dot beside the guide; remaining backlog unchanged.

## 2026-10-09 — Execute-Feature: Destination Fare/Vehicle Rule + Pin Accuracy + Deploy Type Fix (Sprint 23)

**Summary:**
The final route step IS the destination, so fare/vehicle are now hidden there end-to-end (composer, PostCard, post detail, NavigationGuide) via `ROUTE_STEPS_CONFIG` and stripped from payloads client- and server-side; map pins were hardened to the same accuracy pipeline as polylines (CSS import, endpoint snapping, stable mapLib, memoized bounds, shared `useUserLocation` hook, controlled explore map, passive post-detail dot); the Vercel `EmailSecurityPanel` type error was removed along with two emailStudio tsc blockers; latent emailStudio jest failures were repaired (redis ESM stub + `{{var}}` href preservation) so the full gate runs green in-runner.

**Completed:**

- Destination rule: `lib/config/routeSteps.ts` (config + helpers + normalize) + barrel exports; composer hides inputs with hint + strips on submit (create/edit) + totals exclude destination; PostCard/post-detail/NavigationGuide hide (legacy rows covered); POST + PATCH normalize server-side
- Pin accuracy: RouteMap `maplibre-gl.css`, endpoint snap (`snapEndpointsToPolyline`), stable mapLib promise, content-keyed memo pins/coords/bounds; `useUserLocation` hook; explore controlled map + accuracy halo; post-detail passive dot
- Deploy fix: EmailSecurityPanel dead `if` removed (TS no-overlap `true | null` vs `false`); emailStudio dotAll-flag + readonly-NODE_ENV tsc errors fixed
- Test repairs: emailStudio redis-mock load fix, `sanitizeStoredBody` `#`-fragment tokens (var hrefs preserved), 2 prefer-const lint fixes
- Tests: `routeSteps.test.ts` (5) + mapTightening snap/tracking (2)

**Key Changes:**

- New: `app/lib/config/routeSteps.ts`, `app/lib/hooks/useUserLocation.ts`, `app/__tests__/config/routeSteps.test.ts`
- Edited: ShareRouteModal, PostCard, NavigationGuide, RouteMap, MapPins, explore + post-detail pages, `api/posts/route.ts`, `api/posts/[id]/route.ts`, `lib/config/{index,mapPins}.ts`, EmailSecurityPanel, `lib/utils/emailTemplates.ts` (sanitize tokens), `lib/utils/emailSanitize.ts` + `lib/utils/emailTemplates.ts` (prefer-const), `__tests__/config/{emailStudio,mapTightening}.test.ts`

**QA gate (this runner, node_modules installed via npm install):**

- `npx tsc --noEmit` — clean (exit 0), incl. the exact `EmailSecurityPanel.tsx:85` gate that failed Vercel
- `npx jest` — 32/32 suites, 282/282 tests pass (emailStudio 20/20 after repairs)
- `npm run lint` — 0 errors in touched files (9 remaining all pre-existing `no-explicit-any` in untouched files; baseline was 11, fixed 2; Vercel build skips lint)

**Next Sprint Focus:**
Vercel deploy green confirmation; prod-verify destination hiding across composer/feed/detail/nav + pin placement through pan/zoom + persistent user dot; remaining backlog unchanged.

## 2026-10-09 — Execute-Feature: Map + Draft + FAQ Tightening (Sprint 20)

**Summary:**
Directive close-out: same-draft update-in-place with update-vs-new prompt, anchor-stable numbered route pins + token-styled user dot shared across RouteMap/explore, dark mode keeping light visual params verbatim, and FAQ accuracy (report flow correction + new Maps & Navigation category). Non-breaking (no migration, no removed APIs, no new deps).

**Completed:**

- `MAP_PINS_CONFIG` + `MapRoutePin`/`MapUserDot` shared components; RouteMap stale-closure + waypoint-numbering fix, stable marker keys, token-only visuals; explore cutover with a11y click buttons
- Dark light-parity (`darkCanvasFilter: "none"`, dark raster mirrors light; renderers skip filter injection)
- `routeDraftsService.updateDraft` + config labels/prompt + ShareRouteModal update-vs-new prompt bar + per-draft Update in RouteDraftsPanel
- FAQ: report via in-post Report dialog, Maps & Navigation category (tracings/pins, mobile zoom/move), edit/delete via post menu, drafts mention in share-route answer
- Tests: `mapTightening.test.ts` (7) + mapStack dark-parity updates

**Key Changes:**

- New: `app/lib/config/mapPins.ts`, `app/components/features/posts/MapPins.tsx`, `app/__tests__/config/mapTightening.test.ts`
- Edited: `RouteMap.tsx`, `explore/page.tsx`, `mapStack.ts` (+ test expectations), `routeDraftsService.ts`, `routeDrafts.ts`, `ShareRouteModal.tsx`, `RouteDraftsPanel.tsx`, `faq.ts`, config barrel

**QA gate (this runner, node_modules via `npm install`):**

- `npx tsc --noEmit` — 0 errors
- `npx jest` — 28 suites / 241 tests pass (7 new)
- `npm run build` — clean
- `npx next lint` (touched files) — no warnings or errors

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-06-02 — Project Bootstrap & Initialization

**Summary:**
Full repository scan completed. All `ai-system` documentation files generated with project-specific content derived from actual codebase analysis: architecture, design system, project context, repair patterns, planning, repo map, and dependency graph. The project is in pre-rebuild state — infrastructure (Prisma, Sentry, Redis, PWA, CI) is fully wired but the `app/` directory application code has not been generated.

**Completed:**

- Repository structure and tech stack analyzed
- `ai-context.md` created with project name, stack, and key modules
- `ai-system/agents/general-instructions.md` updated with project-specific agent protocol
- `ai-system/agents/system-architecture.md` populated with architecture diagram, module breakdown, data flow
- `ai-system/agents/project-context.md` populated with purpose, users, constraints, tech decisions
- `ai-system/agents/design-system.md` populated with colour palette, typography, component patterns, UX principles
- `ai-system/agents/repair-system.md` populated with known error patterns for tech stack
- `ai-system/planning/project-plan.md` created with phased feature checklist (Phase 0-8)
- `ai-system/planning/task-queue.md` created with current sprint tasks
- `ai-system/index/repo-map.md` created with folder structure and directory purposes
- `ai-system/index/dependency-graph.md` created with module dependency map
- `ai-system/checkpoints/session-log.md` created with bootstrap entry
- `ai-system/memory/project-decisions.md` created with initial architecture decisions
- `ai-system/memory/lessons-learned.md` created as blank template
- `ai-system/memory/architecture-history.md` updated with initial architecture state
- `ai-system/summaries/dev-history.md` — this entry
- `ai-system/testing/test-plan.md` created with project-specific test plan
- `ai-system/testing/test-results.md` created as blank template

**Key Changes:**

- All template files in `ai-system/` populated with project-specific content

**Next Sprint Focus:**
Begin Phase 1 development — create config registry files in `app/lib/config/`, followed by universal component library and context providers.

---

## 2026-06-03 — Application Code Generation Complete

**Summary:**
Full Next.js 15 application generated with all module layers: 25 config registry files, 34 universal UI components (App\* wrappers), 6 context providers, 11 OOP services, 11 utility modules, 2 Zod validation schemas, and full page structure for auth, dashboard, admin, and public sections. Push notification system implemented with Web Push API and QStash background workers. Blog with MDX content and FAQ page with structured data added.

**Completed:**

- 25 config registry files (`app/lib/config/*`) covering vehicles, route status, navigation, forms, notifications, feed algorithm, validity, avatars, footer, teams, maps, rewards, invites, rate limits, validation, cache, API registry, SEO, empty states, logo, FAQ, and blog
- 34 UI components (`app/components/ui/`) including AppLogo, GuestBanner, OfflineIndicator, TrustBadge, VehicleChip, and all App\* wrappers
- 6 context providers: AuthProvider, OnlineStatusProvider, PushProvider, GlobalModalProvider, GlobalToastProvider, CookieConsentProvider
- 3 root-level hooks: `useAuth`, `useFeedInteractions`, `useRequireAuth` (with a server-compatible variant in `app/lib/hooks/`)
- 11 services: feedService, pushSubscriptionService, qstashService, rewardsService, routeTracingService, ValidityEngine, DraftingCoachService, offlineQueue, undoService, toastService, modalService
- 11 utility modules: auth (JWT helpers), blog (MDX parser), cn, commentParser, cookies, metadata, pushClient, security, sendPushNotification, siteConfig, structuredData
- Root layout with Inter font, 6 providers, PWA manifest, SEO metadata
- Auth pages (login, register, OTP) with 7 API routes including Google OAuth
- Dashboard pages (home/feed, explore, profile, notifications, bookmarks, invite, analytics, posts/[id])
- Admin dashboard with user/bug/review/config management
- Public pages (landing, about, contact, privacy, terms, report-bug, FAQ, blog)
- Push notification system: 4 API routes (subscribe, unsubscribe, send, vapid-public-key), PushProvider, pushClient, pushSubscriptionService
- QStash worker system: 3 worker endpoints (feed-invalidate, validity-recompute, rewards) with qstashService (Client + Receiver)
- Blog system: MDX posts, listing page, individual post page with remark/HTML rendering, structured data
- FAQ page with client-side search and categorized accordion, JSON-LD structured data
- PWA: service worker (`/sw.js`), offline page, manifest, icons
- Tests: 91 Jest tests across 9 suites

**Key Changes:**

- Application code fully generated — `app/` directory is no longer in "to be generated" state
- Architecture expanded: added OnlineStatus + Push providers, QStash workers, offline queue, push subscription system, blog + FAQ pages
- Two `useRequireAuth` hooks exist in different locations — may need consolidation
- `app/lib/streams/` directory created but empty — placeholder for future reactive streams

**Next Sprint Focus:**
Implement remaining unimplemented features: auth middleware, like/dislike system, full search, map integration with route polyline rendering, clustering, leaderboards, integration tests, and component tests.

---

## 2026-06-09 — Sprint 4: Production Audit Fixes

**Summary:**
Comprehensive production audit fixing 14 issues: runtime errors (PostCard `.length` crash), broken OAuth buttons, double navbar on landing page, 4 dead links, missing dark mode theme toggle, guest access CTAs, brand logo consistency with actual assets, Sentry global-error boundary, auth API error handling, and OG metadata. All quality gates pass with 65 static pages (up from 54).

**Completed:**

- Fixed JS Runtime Error: `post.tags.length` and `post.images.length` crash when undefined (PostCard.tsx)
- Fixed OAuth Google buttons: added `onClick` -> `/api/auth/google` (login + register pages)
- Fixed double navbar: removed inline `<nav>` from landing page
- Fixed dead links: `/dashboard`->`/home` redirect, `/forgot-password` page created
- Implemented dark mode theme toggle: ThemeProvider + ThemeToggle
- Added "Continue as Guest" links to landing page, login, and register pages
- Updated logo branding with actual brand assets
- Created Sentry `global-error.tsx`
- Added `Sentry.captureException()` to auth API routes
- Wired full OG image, Twitter card, and apple-touch-icon

**Key Changes:**

- New architecture: ThemeProvider + ThemeToggle adds dark mode toggle
- Brand consistency: All logo references now use AppLogo with actual brand assets

**Next Sprint Focus:**
Implement remaining features: auth middleware, like/dislike system, full search, map integration, leaderboards, tests, Lighthouse audit.

---

## 2026-06-13 — Dashboard Navigation & Seed Fixes

**Summary:**
Added responsive dashboard navigation (mobile bottom tab bar + desktop collapsible sidebar) matching the design system. Fixed all broken Cloudinary image URLs in seed data by replacing them with valid Unsplash photo URLs. Fixed Prisma `accelerateUrl` TypeScript type error. All quality gates pass.

**Completed:**

- Created `DashboardNav` component (mobile bottom tabs + desktop sidebar)
- Updated dashboard layout to integrate DashboardNav
- Replaced 16 broken Cloudinary seed image URLs with valid Unsplash URLs
- Fixed Prisma accelerateUrl type error (TS2345)

**Key Changes:**

- Dashboard layout now has proper navigation per the design system
- Seed data images no longer return 404
- Prisma client construction now has safe fallback for missing env vars

---

## 2026-07-01 — AI System v1 to v2 Migration

**Summary:**
Upgraded the `ai-system/` from v1 to v2 per MIGRATION.md. All project-specific content migrated: system architecture, project context, design system, repair system (with status fields added), planning files (with complexity tags), repo map and dependency graph (marked auto-regenerable), memory files (with supersedes links), session log (all v1 sessions appended), and dev history. Entry point changed from `agents/general-instructions.md` to `protocols/entry-protocol.md`. README updated accordingly.

**Completed:**

- `ai-context.md` rewritten to v2 template with actual project data
- Root content files (system-architecture, project-context, design-system, repair-system) migrated with metadata headers
- Planning files migrated with complexity tags and updated build stats (65 pages)
- Index files marked as auto-regenerable with current repo structure
- Memory files updated with supersedes/superseded-by fields
- Session log and dev history preserved and extended
- Testing files updated with 91-test status
- README references updated to v2 entry protocol
- All freshness metadata set to 2026-07-01

**Key Changes:**

- `ai-system/` now uses v2 structure with protocols/, agents/ (role-based), commands/ (12 commands), standards/, checkpoints/
- Zero vendor references — tool-agnostic
- Mandatory quality gate (9 criteria) and entry protocol
- Interruption recovery via checkpoints/in-progress.md + resume-session.md

---

## 2026-07-08 — Map & Route Feature Tightening

**Summary:**
Tightened up map interactions, location input, route step reordering, and added navigation system. RouteStepInput now uses real Nominatim OSM geocoding instead of mock Lagos suggestions. RouteMap properly refits bounds on pin/polyline changes. ShareRouteModal step reordering via HTML5 drag-and-drop is now functional. Created NavigationGuide component with step-by-step directions mode. Post Detail page now has "Start Navigation" toggle. Explore page consolidated from duplicate MapViews to single responsive view.

**Completed:**

- RouteStepInput: Real Nominatim geocoding with AbortController
- RouteMap: Auto-refit bounds on pin/polyline/encodedPolyline changes
- ShareRouteModal: Drag-and-drop route step reordering
- NavigationGuide: New step-by-step navigation component
- Post Detail page: Start Navigation button and guide toggle
- Explore page: Consolidated MapView, improved marker display

**Key Changes:**

- RouteStepInput no longer depends on hardcoded mock data — real geocoding API
- Map now stays correctly zoomed/framed as pins change
- Route steps can be reordered via drag-and-drop in ShareRouteModal
- New NavigationGuide component provides turn-by-turn directions
- "Buy Route Guide" CTA replaced with "Start Navigation"

---

## 2026-07-08 (Session 3) — ImageLightbox Component & Auth Remember Me

**Summary:**
Extracted duplicated inline image lightbox from PostCard and post detail page into a reusable `ImageLightbox` component with prev/next navigation for multi-image posts, keyboard Escape support, and image counter display. Fixed auth session duration: default access token extended from 15m to 1h, "Remember me" checkbox added to login page that extends access token to 7d and refresh token to 30d. Wired automatic token refresh in AuthProvider (retries /api/auth/me via /api/auth/refresh on 401). Added ImageLightbox to UI barrel exports.

**Completed:**

- Created reusable `app/components/ui/ImageLightbox.tsx` with prev/next, keyboard, image counter
- Replaced inline lightbox in PostCard.tsx with ImageLightbox
- Replaced inline lightbox in post detail page with ImageLightbox
- Login page "Remember me" checkbox wired to API
- LOGIN_SCHEMA and OTP_SCHEMA updated with rememberMe field
- Auth utility: signAccessToken/RefreshToken accept rememberMe param (1h default, 7d/30d remember)
- Cookies: setAuthCookies accepts rememberMe param with corresponding maxAge
- OTP route and OTP page pass rememberMe through to session creation
- AuthProvider: auto-calls /api/auth/refresh on 401 before falling back to null

**Key Changes:**

- Image viewer is now a reusable component with full gallery navigation
- Session duration is user-configurable via Remember Me checkbox
- Token refresh is now automatic client-side, fixing the unused refresh endpoint

---

## 2026-07-08 — Feature Tightening: Drafts, Map Expand, Undo, Profile, Routing, @mentions, Admin

**Summary:**
Second session on 2026-07-08 implementing 7 feature areas: local draft saving/restoration for ShareRouteModal (localStorage persistence with auto-load on open and clear on submit), expandable fullscreen map view for RouteMap (Maximize2/Minimize2 toggle with body scroll lock), undo/redo integration wired into post detail page like/unbookmark actions with toast-based undo prompts, profile editing with proper initialValues wiring and avatar save confirmation toasts, SPA routing fix in AppTable (router.push replaces window.location.href), inline @mention highlighting in CommentInput using textarea/overlay pattern, and admin dashboard with live API data users table replacing hardcoded dummy rows plus error/retry states and GlobalConfirmModal wired into admin posts page.

**Completed:**

- ShareRouteModal: localStorage draft save/restore with auto-load and clear-on-submit
- RouteMap: Expandable fullscreen toggle with body scroll lock
- Post detail page: Undo toast for unlike and unbookmark actions via undoService
- Profile page: EditProfileModal now passes initialValues, save triggers toast + profile reload
- AvatarEditor: Save confirmation toast with profile refresh
- AppTable (ui): window.location.href replaced with router.push for SPA navigation
- CommentInput: Inline @mention highlighting with textarea overlay pattern (primary bg color + link)
- Admin dashboard: Live users table from API, error/retry state, loading skeleton
- Admin posts: GlobalConfirmModal replaces native confirm() dialog

**Key Changes:**

- ShareRouteModal drafts persisted across browser sessions via localStorage
- RouteMap can expand to fullscreen for detailed route inspection
- Post detail like/bookmark actions now follow undo toast pattern from useFeedInteractions
- Profile editing now properly reflects input defaults and gives feedback
- CommentInput shows visual @mention highlights as you type
- Admin dashboard shows real user data instead of hardcoded rows
- All admin delete actions use GlobalConfirmModal consistently

---

## 2026-07-08 (Session 4) — Sprint A-D Remediation: Auth, Error Handling & Code Quality

**Summary:**
Completed comprehensive codebase remediation across 4 sprints: forgot-password/reset-password flows with rate limiting on all auth routes, AbortController on all async useEffects, catch-block hardening (console.error + toast) across admin and dashboard pages, PostCard state migrated to useReducer, export standardization (17 UI component files changed from default to named exports), aria-labels on explore/home pages, img width/height attributes added, currentUserId prop removed, unnecessary fragment wrappers removed, and email service console.logs guarded behind NODE_ENV production check.

**Completed:**

- Forgot-password API route + reset-password API route + reset-password page UI
- OTP console.log guarded behind NODE_ENV check in register route
- Bookmarks page now fetches real data from /api/bookmarks instead of empty set
- Profile/[username] page fetches real user data from /api/users/by-username
- Created /api/users/by-username/[username] route (Prisma lookup)
- Shared rateLimit.ts utility (in-memory Map, 10 req/15min for auth)
- Rate limiting wired into login, register, otp, refresh routes
- AbortController + res.ok checks added to: notifications, post detail, profile, bookmarks pages
- AbortController added to admin/users search debounce
- Empty catch blocks replaced with console.error in 6 admin pages (reviews, posts, config, bugs, email-preview, users)
- PostCard state refactored from 5 useStates to single useReducer
- 17 UI component files: export default function → export function (named exports only)
- aria-labels added to explore page search inputs, "Near me" button, home page clickable div
- img width/height attributes added to PostCard images and post detail grid images
- currentUserId prop removed from PostCard and home page
- PushProvider and forgot-password layout fragment wrappers removed
- Email service console.logs guarded behind NODE_ENV !== "production" (7 lines)

**Key Changes:**

- Auth routes now rate-limited — prevents brute force and OTP spam
- AbortController pattern standardised across all async useEffects
- Catch blocks across entire app are now actionable (console.error)
- Export convention unified: all UI components use named exports only
- PostCard now uses useReducer for cleaner state management
- All img elements have explicit dimensions (prevents layout shift)
- Console.logs suppressed in production email service

**Key Changes:**

- `ExplorePinCard` and `FilterChipsBar` extracted from 560-line explore page into reusable sub-components under `app/components/features/explore/`
- Explore page reduced from 562 to 498 lines

**Next Sprint Focus:**
Search with full-text indexes, clustering for map markers, component tests, accessibility audit.

---

## 2026-07-08 (Session 4, cont.) — Leaderboard Feature

**Summary:**
Created global leaderboard feature: API route returning top 100 users by rewardPoints, leaderboard page with podium display for top 3, paginated list for ranks 4+, period selector (All time/This month/This week), and navigation integration. Added `/leaderboard` to middleware protected routes and registered `Trophy` nav item in navigation config.

**Completed:**

- `/api/leaderboard/route.ts` — GET returns top 100 users ordered by rewardPoints desc, excluding banned
- `app/(dashboard)/leaderboard/page.tsx` — Podium display, ranked list, period selector, loading skeletons
- `app/(dashboard)/leaderboard/layout.tsx` — metadata wrapper
- `navigation.ts` — Added `Leaderboard` item with `Trophy` icon
- `middleware.ts` — Added `/leaderboard` to protected routes

**Key Changes:**

- New route: /leaderboard with API backend
- Sidebar now shows Leaderboard nav item for all authenticated users

**Next Sprint Focus:**
Search with full-text indexes, clustering for map markers, component tests, accessibility audit.

---

## 2026-07-08 (Session 5) — Follower System Wiring & Integration Freeze

**Summary:**
Wired the follower/following system end-to-end: follow button now calls the API instead of being a stub, `isFollowing` returned from profile API, followers/following counts are clickable links to dedicated list pages (with UserList component). Created follower/following list API routes and pages. Also froze Transact Marketplace and Tega Events integration access points (removed nav item, removed EventsWidget from sidebar) while preserving all code infrastructure.

**Completed:**

- `by-username/[username]` API now returns `isFollowing` status
- Profile `[username]/page.tsx` follow button now calls POST/DELETE /api/users/[id]/follow
- Follower count updates optimistically on follow/unfollow
- Created `GET /api/users/[id]/followers` — returns follower list
- Created `GET /api/users/[id]/following` — returns following list
- Created `app/components/features/profile/UserList.tsx` — reusable list component
- Created `app/(dashboard)/profile/[username]/followers/page.tsx`
- Created `app/(dashboard)/profile/[username]/following/page.tsx`
- Both profile pages: followers/following stats are now clickable links
- Added `following` empty state preset to emptyStates config
- Removed `Marketplace` nav item from navigation config
- Removed `EventsWidget` import and usage from home page
- Integration code fully preserved — only access points removed

**Key Changes:**

- Follow button is no longer a stub — fully functional follow/unfollow
- Followers/following have dedicated list pages
- Integration code frozen and isolated

**Next Sprint Focus:**
Search with full-text indexes, clustering for map markers, component tests, accessibility audit.

---

## 2026-09-15 — Fix: Image Upload, Feed/Explore Visibility & Production Audit

**Summary:**
Resolved tester feedback (image upload no-op, new posts invisible on feed/explore) and ran platform-wide production audit. ShareRouteModal now has functional Cloudinary upload (drag-drop, browse, preview, remove), feed algorithm guarantees new-post visibility via recent-fallback + recency scoring, explore safely handles non-JSON errors, QStash worker body-consumption bug fixed, error messages sanitized, image host allowlist tightened, and env/middleware gaps closed. Build 77 pages with zero type errors and 91 tests passing.

**Completed:**

- `app/api/upload/route.ts` — New: authenticated multipart upload to Cloudinary (5MB/file, 10 max, JPEG/PNG/WebP/GIF), folder `along/posts`, 1200px limit + auto quality/format
- `app/components/features/posts/ShareRouteModal.tsx` — Images now functional: file input + drag-drop, upload to /api/upload, preview grid with remove, uploading state, fallback geocode on submit for steps without lat/lng, title/step validation, optional images label (removed required star), draft persists images
- `app/lib/services/feedService.ts` — Parallelized queries (Promise.all), fixed cursor pagination (resolve cuid → createdAt lt instead of lexical id lt), added recent-posts fallback stream ensuring cold-start / single-post visibility, recency bonus + tie-breaker by createdAt, fills under-limit via recent set, reduced P95 feed latency
- `app/api/posts/route.ts` — Added SyntaxError → 400 handling, P2022 fallback for avatarConfig, optimistic author feed cache bust via Redis del, included author in feed invalidation (`userIds:[authorId]`), sanitized 5xx messages (503 for DB init, non-leak)
- `app/lib/services/qstashService.ts` — `verifySignature` now clones request before `text()` and returns `{valid, bodyText}` so workers can parse without double-consume; legacy helper kept
- `app/api/workers/*` (feed-invalidate, validity-recompute, rewards) — Use `bodyText` from verify to avoid `request.json()` after `text()` 500
- `app/lib/streams/feedStream.ts` — `refresh()` now handles empty legit vs error-empty distinction, prevents stale-cache flash
- `app/(dashboard)/explore/page.tsx` — Uses text→JSON safe parse, filters only finite coordinates, logs non-JSON gracefully, no longer swallows 500 HTML as empty
- `app/(dashboard)/home/page.tsx` — Share submit now safe-parses response, shows toast on error, double refresh to bust 5-min Redis cache (immediate + 800ms)
- `app/lib/utils/auth.ts` + `middleware.ts` — Warn in production if JWT secrets missing, no longer leaks NEXT_PUBLIC_JWT_SECRET, middleware resolves secret safely
- `next.config.mjs` — Restricted `images.remotePatterns` from wildcard `**` to explicit allowlist (res.cloudinary.com, \*.cloudinary.com, lh3.googleusercontent.com, etc.)
- `vercel.json` — Removed incorrect `Content-Type: image/svg+xml` for /media, extended `maxDuration` to posts/feed/upload routes
- `.env.example` — Added missing `QSTASH_TOKEN`
- `ai-system/*` freshness metadata updated; repo-map now documents `/api/upload`

**Key Changes:**

- Image upload is no longer a decorative stub; posts created with real Cloudinary URLs appear immediately
- New posts no longer hidden for cold-start users (0 follows / 0 activity) — trending no longer the sole source
- QStash workers no longer 500 on every invocation due to consumed body stream
- Security tightening: image loader wildcard removed, JWT secret fallback warns in prod, vercel headers de-duplicated

**Next Sprint Focus:**
Mapbox/MapLibre live-tracking navigation, carto API key wiring for base maps, link-auth provider feature, remaining P1 audit items (in-memory rate limiter → Upstash Redis, supercluster wiring for explore).

---

## 2026-09-15 — Fix-Build: Forgot-Password 504 & Redis Hardening (fix-build + update-ai-system)

**Summary:**
Fixed 504 `FUNCTION_INVOCATION_TIMEOUT` on `POST /api/auth/forgot-password` caused by blocking Upstash Redis (wrong env `REDIS_URL` vs `UPSTASH_REDIS_REST_URL`, no timeout on DNS `ENOTFOUND willing-gazelle...` host, sequential email await). Hardened Redis platform-wide with lazy singleton + 1.2–1.5s timeout fallback to memory, made forgot-password non-blocking via `waitUntil`, and updated vercel maxDuration. All gates pass (tsc 0, tests 91/91, build 76 pages).

**Completed:**

- `app/lib/db/redis.ts` — lazy singleton resolves `UPSTASH_REDIS_REST_URL || REDIS_URL`, guards placeholder/non-https, timeout-guarded `get/set/del` (1.2s), exports `withTimeout`, `__resetRedisForTests`
- `app/lib/services/otpStore.ts` — cached singleton, `resolveEnv` guard, `withTimeout` 1.5s per op, fallback to in-memory Maps, fixed log level to warn
- `app/lib/services/feedService.ts` — switched from `new Redis(!)` to shared `redis` wrapper for feed cache get/set
- `app/api/auth/forgot-password/route.ts` — normalized email, format validation, `maxDuration 15` + `force-dynamic`, `setResetToken` <1.5s, background `sendPasswordResetEmail` via `waitUntil`
- `app/api/posts/route.ts`, `app/api/workers/feed-invalidate`, `validity-recompute` — use shared wrapper, no direct `new Redis`
- `vercel.json` — added `forgot-password` & `reset-password` to `maxDuration` map
- `ai-system/repair-system.md` — new entry: Forgot-Password 504 Redis hardening with prevention (never `new Redis` with `!`, always wrapper)
- `ai-system/system-architecture.md`, `index/repo-map.md`, `index/dependency-graph.md` — freshness + Redis wrapper docs

**Key Changes:**

- Redis failures no longer block any hot path — every cache/OTP operation degrades to memory/DB within 1.5s even if Upstash host is deprovisioned
- Auth email sends no longer hold the response — background via `waitUntil` matches register pattern

**Next Sprint Focus:**
Same as above plus rotation of `UPSTASH_REDIS_REST_URL` env var in Vercel from `willing-gazelle-101748.upstash.io` (ENOTFOUND) to valid instance.

---

## 2026-09-16 — Fix-Build: False-Positive Reset Email (no Resend delivery)

**Summary:**
Forgot-password returned success while Resend never sent anything — no mail, no failure, no Vercel error, only an OTP-store Redis-timeout warning. Root cause was fire-and-forget email with no send-result verification. Fixed by checking the Resend send result and surfacing failure honestly instead of a false success toast.

**Completed:**

- `app/lib/services/emailService.ts` — verify Resend send result before reporting success
- Forgot-password flow no longer claims "mail sent" when delivery failed

**Key Changes:**

- Background email must verify provider result — a false success is worse than an error because the user waits for mail that never arrives

**Next Sprint Focus:**
Reset-link "expired/invalid" reports; live map tracking; carto basemap key; auth provider linking.

---

## 2026-09-29 — Fix-Build: Durable DB Reset Tokens ("link expired" false negatives)

**Summary:**
Reset links reported "expired or invalid" within seconds of delivery. Root cause: tokens lived in the Redis/in-memory OTP store subject to timeout fallback and multi-instance loss. Fixed with a durable `PasswordResetToken` Prisma model — reset tokens now persist in Postgres with expiry, independent of cache state. Also shipped alongng.com domain reference updates.

**Completed:**

- `PasswordResetToken` model + migration — durable reset tokens with expiry
- Forgot/reset-password routes read tokens from DB instead of volatile OTP store
- Domain references updated from along.app to alongng.com

**Key Changes:**

- Security tokens must be durable, not cache-resident — cache is best-effort by policy (timeout + memory fallback)

**Next Sprint Focus:**
Sprint 7 execute-feature (route requests E2E, caching, seed hygiene).

---

## 2026-10-07/08 — Sprint 7: Route Requests E2E, Caching, Seed Hygiene, Responsive (execute-feature + resume-session QA)

**Summary:**
Full Sprint 7 workstream A–H delivered: seed backup/clear/restore scripts + `db:*` package scripts with dead mock-api removal and idempotent seed; welcome notification on signup + notification type registry; collapsible live route preview with debounced trace + location autofill; client `memoryCache` + `useCachedFetch` wired across home/notifications/analytics/post/profile/explore with feedStream hydration + hidden-tab pause and server CACHE_KEYS slots with write invalidation; route requests E2E (PostType enum, quotedPost self-relation, fan-out, /api/suggestions, RequestRouteModal, Respond CTA + quote block, response-mode ShareRouteModal); EndlessCarousel + mobile SuggestionsRail + live SuggestionsPanel with mock EVENTS removed; landing preview = latest real posts, About reviews → SITE_REVIEWS config; scroll-aware new-posts prompt; analytics + project-wide responsive sweep; posting E2E verification; per-tab profile filtering + /api/bookmarks; state-strategy decision (no redux); mutation E2E tests + error hardening. QA gate green: tsc 0 errors (removed deleted `downlevelIteration` tsconfig option), lint warnings-only, jest 122/122 across 11 suites, next build clean.

**Completed:**

- Sprints A–D (seed hygiene, welcome notification, live preview + autofill, client/server caching)
- Sprint E1 (route requests E2E) + E2 (carousel, rails, live suggestions, mock cleanup)
- Sprint F (scroll-aware prompt), G (analytics/responsive), H1–H4 (posting E2E, profile tabs, state review, mutation tests)
- QA gate + task-queue/in-progress reconciliation (drift was MINOR — code already contained the work; pointers were stale)

**Key Changes:**

- Prisma: `Post.type`/`description`/`quotedPostId` + extended `NotificationType`; migration `20261007114036_route_requests_and_welcome_notifications`
- New: `GET /api/suggestions`, `GET /api/bookmarks`, `RequestRouteModal`, `EndlessCarousel`/`SuggestionsRail`/`FollowButton`, `memoryCache`/`useCachedFetch`, `scripts/` tooling
- State strategy formally decided: keep memoryCache/useCachedFetch/feedStream, no redux (see project-decisions.md)

**Next Sprint Focus:**
Live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration — per backlog.

---

## 2026-10-08 — Execute-Feature: Doc-Staleness Remediation (design-system, test-plan, search claim) + Real QA Gate

**Summary:**
Closed the three honest-stale items left by the 2026-10-08 update-ai-system deep sync. design-system.md (2026-07-08) and testing/test-plan.md (2026-07-01) are now verified against code and fresh; the search false-claim class was extended (project-plan.md was already fixed — system-architecture.md Search row now matches it); test figures are no longer trusted-to-record — a real `npx jest` run in this session proves 122/122 across 11 suites. QA gate fully green with real runs (tsc 0, jest 122/122, lint exit 0, build exit 0); no code changes needed, so no non-breaking fixes were applied.

**Completed:**

- design-system.md — primary tokens corrected to green brand (#00623B/#00A862/#004A2C from globals.css @theme), radius/shadow tokens corrected to real scale, App\* described as Tailwind + Lucide (zero antd imports in app/, antd dep unused), mobile tabs corrected to Home/Explore/Share-FAB/Bookmarks/Profile, UI count 42 files, freshness → 2026-10-08
- testing/test-plan.md — 91/9 → 122/11 with per-suite verified counts, API-boundary suites marked done (Prisma-mocked), live-DB integration left honestly open, search line marked NOT IMPLEMENTED, freshness → 2026-10-08
- system-architecture.md — Search module row corrected to NOT IMPLEMENTED (same claim class as project-plan fix), UI diagram 34 → 42 files + antd-unused note, services 11 → 15, updater → execute-feature 2026-10-08
- testing/test-results.md — replaced file-presence-only caveat with real-run results from this session
- QA gate — `npm install` then real runs: tsc exit 0, jest 11/122 pass, lint exit 0 (pre-existing no-explicit-any in feed route left untouched), build exit 0

**Key Changes:**

- Docs-only session — zero `app/` code changes; prior session-log test figures (122/122) independently reproduced by execution, not trust
- No architecture impact — no plan-feature.md needed; no task-queue mutation (no sprint tasks for this remediation)

**Next Sprint Focus:**
Backlog per task-queue: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Open via plan-feature.md / execute-feature.md.

---

## 2026-10-08 — Execute-Feature: Search E2E (unified /api/search + /search page) + Update-AI-System Chain

**Summary:**
Implemented the Phase 4 search checkbox end-to-end, non-breaking: `searchService.ts` (unified posts + users + related-tags search over Prisma `contains`/`insensitive` — no migration, no new deps), `GET /api/search` (`q`/`type`/`region`/`postType`/`cursor`/`limit`, shared `search`-bucket rate limiting, guest-accessible, sanitized user-facing errors, P2022 fallback), guest-accessible `/search` page (debounced input, All/Routes/People tabs, PostCard + FollowButton reuse, `EMPTY_STATES.search`), apiRegistry + middleware wiring. This also fixes the dead `/search?q=` links that SuggestionsPanel trending tags already pointed at. 17 new tests (9 API-boundary + 8 service). QA gate fully green with real runs: tsc 0 errors, jest 139/139 across 13 suites, lint zero new errors (7 pre-existing verified identical on stashed baseline; 2 new `no-require-imports` in the new test fixed before close), build clean with `/search` in the route table.

**Completed:**

- Step 1 planning pass (task-queue, project-plan, system-architecture, project-context, design-system, repair-system, project-decisions) + in-progress.md plan
- Step 2 scope check: PASS (search is a Daily Commuter key interaction; complies with state-strategy/config-driven/zero-emoji decisions) — no plan-feature.md needed (no architecture impact)
- Step 3 implementation: searchService, /api/search, /search page (page.tsx metadata + SearchPage client), apiRegistry + middleware edits
- Step 3b tests: `app/__tests__/api/search.test.ts`, `app/__tests__/services/searchService.test.ts`
- Step 4 QA gate: `npm install` (runner had no node_modules) then tsc/jest/lint/build real runs; fixed 2 lint errors in new test (require → typed imports)
- Step 5 close-out: project-plan checkbox, task-queue Sprint 8 + last-synced, system-architecture Search row, test-plan/test-results 122/11 → 139/13, repo-map (search route, 16 services, dashboard search) + dependency-graph (live SearchService) freshness, session-log entries, sync-context checkpoints

**Key Changes:**

- New: `app/lib/services/searchService.ts`, `app/api/search/route.ts`, `app/(dashboard)/search/page.tsx` + `SearchPage.tsx`, 2 test suites
- Edited: `app/lib/config/apiRegistry.ts` (search entry), `middleware.ts` (`/search` guest route)
- No schema/migration changes; existing `CACHE_KEYS.search` + `CACHE_TTL.searchResults` + `RATE_LIMITS.search` slots reused

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Search live-DB integration test still open (API-boundary suites mock Prisma, per convention).

---

## 2026-10-08 — Execute-Feature: Carousel Overflow, Share-Modal Collapse, Request Icon, Footer Grid

**Summary:**
Tightened four home/share/footer UX items, non-breaking and config-driven: the suggestions carousel got its own overflow container and a scroll-based autoplay that users can freely scrub forward/backward with resume-from-position; the share-route modal now starts with preview + quality score collapsed, a collapsible route form, and Save-Draft/Share actions in a footer below preview+score; a query-style "Request?" icon trigger opens the request flow from the home composer; footer link columns render in a 3-col grid on mobile and up. Three new config files (carousel/shareRoute/routeRequest) + footer layout slot; one new config test suite.

**Completed:**

- Planning pass + scope check (no architecture impact — no plan-feature.md)
- Carousel rewrite (EndlessCarousel rAF scrollLeft, SuggestionsRail container, home column layout)
- ShareRouteModal restructure (collapsed defaults, collapsible form, footer actions) + DraftingCoach defaultOpen
- RequestRouteTrigger component + home wiring
- Footer 3-col grid via FOOTER_CONFIG.layout
- uxTightening.test.ts (4 config suites)

**Key Changes:**

- New: `app/lib/config/{carousel,shareRoute,routeRequest}.ts`, `RequestRouteTrigger.tsx`, `__tests__/config/uxTightening.test.ts`
- Edited: `EndlessCarousel.tsx`, `SuggestionsRail.tsx`, `ShareRouteModal.tsx`, `DraftingCoach.tsx`, `home/page.tsx`, `AppFooter.tsx`, `footer.ts`, `config/index.ts`, `posts/index.ts`
- No schema/migration changes; no new dependencies

**Next Sprint Focus:**
update-ai-system deep sync (chained), then remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

---

## 2026-10-08 — Execute-Feature: Carousel Ordering + Route-Drafts Library (Sprint 10)

**Summary:**
Two directive items, non-breaking and config-driven: the home suggestions carousel now sits above the feed but below the share/request trigger div (its own overflow container unchanged, so the feed never grows); savable route drafts gained a full access/restore/complete loop — a multi-draft localStorage library with legacy single-key migration, a drafts panel inside ShareRouteModal (restore/continue-to-upload/delete), a footer drafts counter, and a home "N saved drafts — continue" resume chip that opens the composer with the drafts panel expanded.

**Completed:**

- Planning pass + scope check (no architecture impact — no plan-feature.md; no migration, no new deps)
- Carousel reorder in `home/page.tsx` (SuggestionsRail moved above feed, below trigger div)
- `routeDrafts.ts` config + `routeDraftsService.ts` (multi-draft, legacy migration, never-throw, change event) + `RouteDraftsPanel.tsx`
- ShareRouteModal drafts integration (service-backed save/restore/delete, `startWithDraftsOpen` prop, auto-restore of most recent draft on empty open, delete-on-submit)
- Home drafts resume chip (live count via drafts-changed event + storage listener)
- `routeDrafts.test.ts` (4 suites: config, save/list/restore/delete, corrupt-safety, legacy migration)

**Key Changes:**

- New: `app/lib/config/routeDrafts.ts`, `app/lib/services/routeDraftsService.ts`, `app/components/features/posts/RouteDraftsPanel.tsx`, `app/__tests__/config/routeDrafts.test.ts`
- Edited: `home/page.tsx`, `ShareRouteModal.tsx`, `lib/config/index.ts`, `posts/index.ts`
- No schema/migration changes; no new dependencies

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Full jest/lint/build gate still needs a runner with node_modules (CI).

---

## 2026-10-08 — Execute-Feature: Posting Fix + Response/Draft Linkage + Toast/Report/Carousel Tightening (Sprint 11)

**Summary:**
Five directive items, all non-breaking, config/metadata-driven. Root-caused the "Validation failed" posting bug: `ShareRouteModal` held `description` in a setter-less `useState("")` and always submitted `""`, which fails `z.string().min(10).optional()` (optional allows `undefined`, not `""`) — every share and every request-response failed, with the quality-score "add description" hint and no input to satisfy it. Fixed on both sides plus four UX items.

**Completed:**

- Posting validation: generic route-description input added to ShareRouteModal (config-driven via `SHARE_ROUTE_MODAL_CONFIG.description*`); empty descriptions omitted from payloads; `CREATE_POST_SCHEMA.description` now empty-string-tolerant (`z.preprocess` → `undefined`) and schema accepts client-sent `waypoints`; API returns first-field `message` alongside `error: "Validation failed"` + `details` (shape preserved for existing tests) with a server `console.warn`; `submitPost` surfaces the first field message and logs details to the console
- Response linkage: `RespondToRequest.tags` added; `handleRespond` forwards request tags; response composer inherits tags when empty; drafts persist `description` + `responseTo` ref (`routeDraftsService` + `ROUTE_DRAFTS_CONFIG.responseBadgeLabel` badge in panel); restored response drafts keep their linkage via `effectiveResponseTo`
- Undo toast: single timer owner (GlobalUndoToast); provider no longer races it, passes `duration` through, remounts per toast (`key`) so the progress bar fully elapses; durations centralized in `TOAST_CONFIG` (also fixed a `toastService.close()` self-recursion in provider `close`)
- Post actions: PostCard Copy link (clipboard + execCommand fallback, toast feedback) and Report (reason dialog → `POST /api/bug-reports` with optional `postId` link + reporter attribution, both non-breaking additive); `POST_ACTIONS_CONFIG` registry
- Carousel: About reviews replaced the bespoke interval/`translateX` tape with the shared `EndlessCarousel` (`SITE_REVIEWS` cards, same animation/physics as home)

**Key Changes:**

- New: `app/lib/config/toast.ts`, `app/lib/config/postActions.ts`
- Edited: `ShareRouteModal.tsx`, `home/page.tsx`, `PostCard.tsx`, `RouteDraftsPanel.tsx`, `AboutPageClient.tsx`, `GlobalToastProvider.tsx`, `toastService.ts`, `routeDraftsService.ts`, `routeDrafts.ts`, `shareRoute.ts`, `config/index.ts`, `schemas/post.ts`, `api/posts/route.ts`, `api/bug-reports/route.ts`
- No schema/migration changes (BugReport.postId already existed); no new dependencies

**QA gate (this runner, node_modules installed via `npm ci`): tsc 0 errors; jest 15 suites / 149 tests pass; next build clean; lint shows only pre-existing issues in untouched files (none in touched files).**

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

---

## 2026-10-08 — Execute-Feature: Posting Hardening + Viewer/Carousel Fixes (Sprint 12)

**Summary:**
Five directive iron-out items, all non-breaking, config-driven, no new dependencies, no migration. Double-click route duplicates eliminated at three layers (disabled submit button with spinner, client in-flight dedup, server idempotency replay); like/dislike undo toasts removed; image viewer rewritten around a state-owned index; carousel autoplay restored for touch users and sparse feeds.

**Completed:**

- Submit guard: `ShareRouteModal` gained `isSubmitting` (Share/Save disabled, `Loader2` spinner, re-entry ignored; labels from `POST_SUBMIT_CONFIG`); `RequestRouteModal` submit button gained the same spinner (guard/disabled pre-existed)
- Posting ACID: per-composer `clientMutationId` → `X-Idempotency-Key` header (stripped from JSON body) → server replay (`200 + deduplicated`) or concurrent-duplicate 409 via TTL `idempotencyService`; `POST /api/posts` now scores validity first and inserts in a single atomic `create`; key released on create/quote failure
- Like/dislike: post-detail unlike no longer registers `undoService` or fires `toastService.undo` (success note on like only; bookmark undo kept)
- ImageLightbox: `useState` index replaces `getElementById` src mutation — prev/next, ArrowLeft/Right, Escape, and the `n / total` counter all derive from one value; re-syncs when a different thumbnail opens the viewer
- EndlessCarousel: hover-pause is mouse-only (touch taps no longer stall autoplay); item set repeats (cap `ENDLESS_CAROUSEL_CONFIG.maxRepeat`) until one half overflows the viewport so autoplay stays visible with 1–2 cards

**Key Changes:**

- New: `app/lib/config/postSubmit.ts`, `app/lib/services/idempotencyService.ts`, `app/__tests__/config/postSubmit.test.ts`
- Edited: `ShareRouteModal.tsx`, `RequestRouteModal.tsx`, `home/page.tsx`, `api/posts/route.ts`, `posts/[id]/page.tsx`, `ImageLightbox.tsx`, `EndlessCarousel.tsx`, `carousel.ts`, `config/index.ts`
- No schema/migration changes; no new dependencies

**QA gate (this runner, node_modules installed via `npm ci`): tsc 0 errors; jest 16 suites / 154 tests pass; next build clean; lint clean for touched files (2 pre-existing warnings in untouched code paths).**

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — Execute-Feature: Post/Comment Moderation + Report Lifecycle (Sprint 13)

**Summary:**
Directive close-out: delete/edit/archive for posts, comments and route requests (owner + admin) with global confirm modal + global undo toast; end-to-end reporting with reporter receipt and admin triage actions (anonymity kept both ways); route requests hide map/navigation/trust with responses shown comment-style on expanded views; trust tooltip clamped to viewport. All non-breaking (additive migration `20261008000000_post_moderation`, P2022-tolerant reads), config/metadata-driven (`postActions.ts` extensions, new `moderation.ts`), ACID via single transactions.

**Completed:**

- Schema: `Post.isArchived`/`archivedAt` (+ index), `NotificationType` += REPORT/MODERATION; idempotent migration SQL
- Config: management labels/confirm/undo copy in `POST_ACTIONS_CONFIG`; `MODERATION_CONFIG` (dedup window, outcome copy, admin actions, route-request hide rules); REPORT/MODERATION in `NOTIFICATION_REGISTRY`; `/api/reports` + comment-detail in `API_REGISTRY`
- Services: `postModerationService.ts` (confirm → fetch → undo with snapshot-restore replay, `isAdminRole`); `feedStream.removePost/updatePost`; archive injection + P2022 strip-retry in `feedService`/`searchService`
- APIs: post detail PATCH (archive + admin edit) / DELETE (admin), GET returns `responses`/`responsesCount` + archived tombstone for non-owners; comment PATCH (edit) + admin delete; `POST /api/reports` (transactional dedup, admin + reporter notifications, email); admin bugs PATCH `action` (DISMISS/ARCHIVE_POST/REMOVE_POST in one transaction + MODERATION outcome); admin posts PATCH/DELETE-with-snapshot; archive exclusion in list/feed/suggestions/sitemap
- UI: `moderation/ReportDialog` + `PostMenu` shared by PostCard and detail views; PostCard request rules + archived badge + responses link; CommentList inline edit + confirm/undo delete + report flag; detail page menu/edit-modal/responses section/request rules/tombstone; ShareRouteModal edit mode (`editPost`/`onEditSubmit`, drafts hidden); TrustBadge fixed-position clamped/flipping tooltip; admin posts hide/restore + undo, admin bugs Reports filter + triage buttons; home + search wiring

**Key Changes:**

- New: `prisma/migrations/20261008000000_post_moderation/`, `app/lib/config/moderation.ts`, `app/lib/services/postModerationService.ts`, `app/api/reports/route.ts`, `app/components/features/moderation/{ReportDialog,PostMenu,index}.tsx`, `app/__tests__/post-moderation.test.ts`
- Edited: `schema.prisma`, `postActions.ts`, `notifications.ts` (+service type), `apiRegistry.ts`, `config/index.ts`, `feedService.ts`, `searchService.ts`, post/comment/admin APIs, `PostCard.tsx`, `CommentList.tsx`, `posts/[id]/page.tsx`, `ShareRouteModal.tsx`, `TrustBadge.tsx`, `home/page.tsx`, `SearchPage.tsx`, admin posts/bugs pages, `sitemap.ts`, `feedStream.ts`, `posts.test.ts`

**QA gate (this runner, node_modules via `npm ci`): tsc 0 errors; jest 17 suites / 160 tests pass; next build clean; lint clean for touched files (fixed 1 unused var + 1 exhaustive-deps during the gate).**

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — Execute-Feature: Notification/Referral/Profile Tightening (Sprint 14)

**Summary:**
Directive close-out: post nature (ROUTE / ROUTE_REQUEST / ROUTE_RESPONSE) preserved through edit/archive/admin operations; profile Archived tab + Routes tab showing actual routes (ROUTE + ROUTE_RESPONSE) with requests on their own tab; full notification coverage (mentions, likes, dislikes, comments, request responses, follower uploads/requests); invite cap converted from a growth limit to a send-points cap with auth-type-agnostic referrals (email+password and Google OAuth); leaderboard confirmed zero-point-inclusive; route-request flag contrast fixed in both modes. All non-breaking (additive migration `20261008000001_notification_coverage`, P2022-style fail-safe notification writes), config/metadata-driven, ACID-preserving.

**Completed:**

- Schema: `NotificationType` += DISLIKE/NEW_ROUTE; idempotent migration SQL with duplicate_object guards; regenerated Prisma client
- Config: `MODERATION_CONFIG.immutablePostFields` (["type","quotedPostId"]); DISLIKE/NEW_ROUTE in `NOTIFICATION_REGISTRY` (ThumbsDown slate, Route green); `INVITE_CONFIG` growth-policy docs (cap send-credit, never linking)
- Services: `mentionService.ts` (extract/diff/resolve, 10-mention cap, never throws); `referralService.ts` (resolveReferral + linkReferralRewards: ACCEPTED always, SENT inside cap, self-referral guard); `createNotification` `allowSelf` (WELCOME fix)
- APIs: post PATCH strips immutable fields; GET /api/posts comma-separated `type` + owner-only `?archived=true` (non-owners silently unarchived); POST /api/posts NEW_ROUTE fan-out (request-author excluded from double-notify); like route LIKE+DISLIKE via service; comments POST (COMMENT with commentId + MENTION fan-out, post-author excluded) and PATCH (edit-diff mentions); register via referralService; Google callback `state=ref:` linking (new + first-time-OAuth) + welcome; invite API unchanged (field-compatible)
- UI: own/other profile tabs + type/archived pills; register/login `?ref=` forwarding (effect-based, no hydration mismatch) + cross-page ref links; invite page "Bonus Invites Left" + unlimited-invite copy; notifications page DISLIKE/NEW_ROUTE/REPORT/MODERATION icons; warning pairing fix (`bg-warning text-warning-text border-warning-border`) on PostCard, detail, RequestRouteModal, drafts panel, ShareRouteModal banner, admin pills, bugs flag, invite ranks
- Tests: new `post-nature.test.ts` (4), `mentionService.test.ts` (8), `referralService.test.ts` (6), `leaderboard.test.ts` (2); extended `posts.test.ts` (ROUTE fan-out, multi-type, archived owner/non-owner) + `mutations.test.ts` (service-routed like/dislike/comment/mention)

**Key Changes:**

- New: `prisma/migrations/20261008000001_notification_coverage/`, `app/lib/services/mentionService.ts`, `app/lib/services/referralService.ts`, `app/__tests__/api/post-nature.test.ts`, `app/__tests__/api/leaderboard.test.ts`, `app/__tests__/services/mentionService.test.ts`, `app/__tests__/services/referralService.test.ts`
- Edited: `schema.prisma`, `moderation.ts`, `notifications.ts`, `inviteConfig.ts`, `notificationService.ts`, `app/api/posts/[id]/route.ts` (PATCH strip), `app/api/posts/route.ts` (GET filters + NEW_ROUTE fan-out), like/comments/commentId/register/google-callback routes, register/login pages, own/other profile pages, invite page, notifications page, PostCard, posts/[id] page, RequestRouteModal, RouteDraftsPanel, ShareRouteModal, admin posts/bugs pages, `posts.test.ts`, `mutations.test.ts`

**QA gate (this runner, node_modules via `npm ci`): tsc 0 errors (after `prisma generate` for new enum values); jest 21 suites / 188 tests pass; next build clean; next lint 11 pre-existing errors / 0 new.**

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — Execute-Feature: Notification Nav/Badges, Referral+Points Coverage, Username Edit, Landing Guest-Link, One-Time Prod Reset (Sprint 15)

**Summary:**
Directive close-out: notifications replaced bookmarks on the mobile bottom bar with live unread badges on both desktop sidebar and mobile tab; notification service now covers referral conversions (inviter told who signed up) plus points and tier-up wins via the rewards worker; username is editable with global uniqueness preserved; landing "Continue as guest" hides under the exact auth gate that shows "View Feed"; one-time full prod DB reset scripted into `vercel-build` for removal after the clean build. All non-breaking (no migration, no removed APIs, additive config + never-throw service calls), config/metadata-driven.

**Completed:**

- Nav: MOBILE_TABS Notifications swap; `NOTIFICATION_BADGE_CONFIG` + `BADGED_NAV_HREFS`; `useUnreadNotifications` + `formatBadgeCount`; badge UI both surfaces (99+ cap, screen-reader labels)
- Services: `NOTIFICATION_MESSAGES`; `notifyReferralConversion`; `notifyPointsAwarded`; wiring in register, Google callback (×2 paths), rewards worker
- Profile: EDIT_PROFILE_FIELDS userName + USERNAME_RULE; PATCH 400/409 + P2002 guard; profile page error-aware save + userName initial value
- Landing: `GuestContinueLink` + page.tsx swap
- Ops: `scripts/reset-prod-db.ts` + `db:reset-prod` + `vercel-build` hook (one-time)
- Tests: `__tests__/sprint15/tightening.test.ts` (10 tests)

**Key Changes:**

- New: `app/lib/hooks/useUnreadNotifications.ts`, `scripts/reset-prod-db.ts`, `app/__tests__/sprint15/tightening.test.ts`
- Edited: `app/lib/config/navigation.ts`, `notifications.ts`, `forms.ts`, `index.ts` (barrel), `DashboardNav.tsx`, `notificationService.ts`, `referral` call sites (register, google callback), `app/api/workers/rewards/route.ts`, `app/api/users/[id]/route.ts`, `app/(dashboard)/profile/page.tsx`, `LandingCtas.tsx`, `app/(public)/page.tsx`, `package.json`, `task-queue.md`, `session-log.md`

**QA gate (this runner, node_modules via `npm ci`): tsc 0 errors; jest 22 suites / 198 tests pass; next build clean; next lint 1 pre-existing warning / 0 new.**

**Next Sprint Focus:**
⚠️ Remove the one-time reset (script + package.json entries) once prod DB is confirmed clean. Then backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — Execute-Feature: Vercel-Build Reset Removal + Early-Adopter "First N Users" Badge (Sprint 16)

**Summary:**
Directive close-out in two parts: (1) the one-time prod DB reset was confirmed successful, so its `vercel-build` invocation was removed — builds no longer wipe the DB (script + `db:reset-prod` retained manual-only); (2) a dynamic, admin-manageable early-adopter badge ("First 100 Users #42" style) now marks the N earliest-joined users on profiles, with rank derived from the already-recorded `User.createdAt` (no migration) and list/filter endpoints ready for future rewards and audience tooling. All non-breaking (additive files + additive response fields, best-effort badge reads that never fail their host request), config/metadata-driven.

**Completed:**

- Ops: `vercel-build` no longer runs `db:reset-prod` (package.json one-line removal; script + `scripts/reset-prod-db.ts` kept for manual use)
- Config: `app/lib/config/earlyAdopter.ts` (key, defaults enabled/limit 100/`First {N} Users #{rank}`, limits, normalize, 400-validation, label/tooltip builders, admin-card meta, badge display meta) + barrel export + seed row
- Service: `app/lib/services/earlyAdopterService.ts` (config via `getSiteConfig`, deterministic rank by `createdAt` asc + id tie-break, Redis-cached 600s, status + list helpers)
- APIs: `GET /api/users/early-adopters` (config + earliest users), `GET /api/users/[id]/early-adopter` (per-user, 404 unknown), `earlyAdopter` embedded in `/api/users/[id]` + `/by-username/[username]`, `API_REGISTRY` entries
- Admin: `/api/admin/config` validates `earlyAdopterConfig` + invalidates `siteConfig` Redis on PUT/DELETE; Config page badge card (toggle + N + template, dirty-gated save); `/api/admin/users?earlyAdopter=true` earliest-first filter with rank + label
- UI: `EarlyAdopterBadge` + `EarlyAdopterBadgeFromStatus` on own + other profile headers (wrap-safe, tooltip, null-safe)
- Tests: `earlyAdopter.test.ts` (5) + `EarlyAdopterBadge.test.tsx` (6)

**Key Changes:**

- New: `app/lib/config/earlyAdopter.ts`, `app/lib/services/earlyAdopterService.ts`, `app/api/users/early-adopters/route.ts`, `app/api/users/[id]/early-adopter/route.ts`, `app/components/features/profile/EarlyAdopterBadge.tsx`, `app/__tests__/config/earlyAdopter.test.ts`, `app/__tests__/components/EarlyAdopterBadge.test.tsx`
- Edited: `package.json` (vercel-build), `prisma/seed.ts` (badge seed row), `app/lib/config/{index,apiRegistry}.ts`, `app/api/admin/{config,users}/route.ts`, `app/api/users/{[id],by-username/[username]}/route.ts`, `app/(dashboard)/profile/{page,[username]/page}.tsx`, `app/admin/config/page.tsx`, `app/components/features/profile/index.ts`

**QA gate (this runner — no node_modules, deps not installable here):**

- `npx tsc --noEmit` — new/edited files produce zero non-environment diagnostics (only missing-module/missing-type errors shared by ALL files incl. untouched ones); no syntax errors
- `npm test` — not runnable here; new suites follow the existing jest patterns (pure-config assertions + RTL component assertions); full gate (tsc + lint + tests + build) to run where deps exist
- `package.json` validated as JSON; `git diff --stat` reviewed (12 edited + 7 new)

**Next Sprint Focus:**
Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — Execute-Feature: Admin Dashboard Fix, Referral Hardening, Error-Report Actualisation (Sprint 17)

**Summary:**
Closed four linked complaints in one pass: (1) the admin dashboard crashed on every visit because the stats API never returned the `recentUsers` field the page dereferenced — the API now returns it and the page tolerates older payloads; (2) admin entry points were invisible because client code compared the DB's uppercase `ADMIN` role against lowercase `"admin"` — a canonical case-insensitive `isAdminRole()` now owns the rule in the sidebar, the admin shell guard, and profile Quick Links (which gained a role-gated Admin Dashboard entry); (3) referral-link email/password signup is now referral-failure-proof (isolated resolution, FK-race retry, reward fan-out guards) and legacy null invite codes are backfilled so invite links never render `?ref=null`; (4) error boundaries no longer make the false "our team has been notified" claim — they file a real sanitized `BugReport` (message/stack/route/digest, PII redacted) and render copy that reflects whether the report actually persisted. All non-breaking (additive fields, additive endpoints payload, best-effort reporting that never fails its host), config/metadata-driven.

**Completed:**

- APIs: `GET /api/admin/stats` returns batched `recentUsers`; `POST /api/auth/register` referral isolation + retry + fan-out guards; `GET /api/invite` inviteCode backfill
- UI: admin dashboard defensive defaults + safe initials; `AdminShell` + `DashboardNav` via `isAdminRole()`; profile Quick Links admin entry; `global-error`/`error` honest report-status copy
- Config/service: `errorReporting.ts` + `errorReportService.ts` (barrel-exported); `navigation.ts` `isAdminRole` + uppercase roles + case-insensitive access; `NavItem.roles` type widened
- Tests: `errorReportService.test.ts` (8) + `navigation.test.ts` (+2)

**Key Changes:**

- New: `app/lib/config/errorReporting.ts`, `app/lib/services/errorReportService.ts`, `app/__tests__/services/errorReportService.test.ts`
- Edited: `app/api/admin/stats/route.ts`, `app/api/auth/register/route.ts`, `app/api/invite/route.ts`, `app/admin/{page.tsx,AdminShell.tsx}`, `app/components/ui/DashboardNav.tsx`, `app/(dashboard)/profile/page.tsx`, `app/global-error.tsx`, `app/error.tsx`, `app/lib/config/{index,navigation}.ts`, `app/lib/types/index.ts`, `app/__tests__/config/navigation.test.ts`

**QA gate (this runner, node_modules via `npm install`):**

- `npx tsc --noEmit` — 0 errors
- `npx jest` — 25 suites / 220 tests pass
- `npm run build` — clean
- `npx next lint` — 0 issues in touched files (pre-existing feed/suggestions errors untouched)

**Next Sprint Focus:**
Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — Execute-Feature: Admin Responsive + Real Metrics + Bulk Ops + Config UX (Sprint 18)

**Summary:**
Made the admin area responsive and honest: collapsible desktop sidebar (persisted) + mobile drawer; dashboard trends now computed server-side (zero values render flat "No change"/"No data", never fake +/-); users/posts/bugs/reviews all support bulk selection (checkboxes, select-all toggle, invert, undo-select, clear, first-10/25/50) with working bulk actions (role/demote/suspend, archive/restore/delete, triage/resolve/close, approve/reject) backed by bulk-tolerant APIs; site config is manageable without JSON (type-aware editors, boolean toggles, drag-drop + arrow reorder); profile tab bars scroll with proper spacing. All non-breaking and config/metadata-driven.

**Completed:**

- Config/hook/tests: `admin.ts`, `useBulkSelection.ts`, `admin.test.ts`
- Shell/metrics: `AdminShell.tsx`, stats route deltas, dashboard `formatDelta`
- Bulk UI + APIs: users/posts/bugs/reviews pages + PATCH/DELETE `*Ids` support
- Config UX: card editors, kind picker, reorder; profile tabs scrollable (both profile pages)

**Key Changes:**

- New: `app/lib/config/admin.ts`, `app/lib/hooks/useBulkSelection.ts`, `app/__tests__/config/admin.test.ts`
- Edited: `app/admin/{AdminShell,page.tsx,users/page.tsx,posts/page.tsx,bugs/page.tsx,reviews/page.tsx,config/page.tsx}`, `app/api/admin/{stats,users,posts,bugs,reviews}/route.ts`, `app/(dashboard)/profile/{page.tsx,[username]/page.tsx}`, `app/lib/config/index.ts`

**QA gate:** not runnable in this runner (no node_modules — pre-existing env limit); new suite follows existing patterns; diff reviewed.

## 2026-10-09 — Execute-Feature: Keyless Map Stack — OpenFreeMap + OSRM + Proxied Geocoding (Sprint 19)

**Summary:**
Ended recurring map API-key failures by making the whole map pipeline work with zero keys: tiles render from OpenFreeMap keyless vector styles (MapLibre-native) with a keyless raster step-down chain (plain Carto → OSM → Esri); routing resolves OSRM-first via a cached server proxy with env-gated ORS/Mapbox overrides and a straight-line guarantee; all geocoding flows through `/api/maps/*` server proxy (Nominatim with policy-compliant identity headers + Photon fallback), fixing the browser-direct Nominatim policy violation and the Carto `?apiKey=` dependency (removed — plain keyless Carto is the default). Renderers (RouteMap + explore) walk a shared config-driven style stack with onError step-down; `routeTracingService` is now a thin delegate over `mapProxyService`; `.env.example` marks every keyed map var optional-override. All non-breaking (no migration, no removed APIs, no new deps), config/metadata-driven.

**Completed:**

- Config: `app/lib/config/mapStack.ts` (vector styles, dark mapping, raster chain, routing/geocode orders, upstreams, identity, TTLs, attributions, preconnect hosts, style-stack builders, env-gate helpers) + barrel export
- Service: `app/lib/services/mapProxyService.ts` (traceRoute/geocodeForward/geocodeReverse, Redis read-through, never-throw, keyed-only-with-env)
- APIs: `POST /api/maps/route`, `GET /api/maps/geocode`, `GET /api/maps/reverse` (maps-bucket rate limit, sanitized errors, guest-accessible); `/api/routes/trace` delegates to proxy (contract unchanged)
- Renderer: RouteMap + explore consume `getMapStyleStack` (vector primary, raster step-down, no `mapbox://`/apiKey branches); root layout preconnects keyless hosts from config
- Clients: RouteStepInput, ShareRouteModal (both geocode paths), `geo.ts reverseGeocode` → internal proxy; zero Nominatim URLs left in client code
- Tracing: `routeTracingService.trace` validates then delegates (existing imports keep working)
- Hygiene: `RATE_LIMITS.maps` (60/min), `CACHE_TTL`/`CACHE_KEYS` maps entries, `API_REGISTRY` maps entries, `.env.example` optional-override notes
- Tests: `app/__tests__/config/mapStack.test.ts` (10: keyless URLs, fallback order, dark mapping, attribution, preconnect hosts, stack shape, cache-key determinism, straight-line proof, offline degradation, Nominatim-shape normalization; redis mocked per established service-test pattern)

**Key Changes:**

- New: `app/lib/config/mapStack.ts`, `app/lib/services/mapProxyService.ts`, `app/api/maps/{route,geocode,reverse}/route.ts`, `app/__tests__/config/mapStack.test.ts`
- Edited: `app/lib/config/{index,rateLimits,cache,apiRegistry}.ts`, `app/lib/services/routeTracingService.ts`, `app/api/routes/trace/route.ts`, `app/components/features/posts/{RouteMap,RouteStepInput,ShareRouteModal}.tsx`, `app/(dashboard)/explore/page.tsx`, `app/layout.tsx`, `app/lib/utils/geo.ts`, `.env.example`, `ai-system/planning/task-queue.md`

**QA gate (this runner, node_modules via `npm install`):**

- `npx tsc --noEmit` — 0 errors
- `npx jest` — 27 suites / 234 tests pass (10 new)
- `npm run build` — clean (84 static pages; `/api/maps/{route,geocode,reverse}` + `/api/routes/trace` present)
- `npx next lint` — zero new issues (pre-existing `any` errors + RouteMap exhaustive-deps warning unchanged vs baseline stash-compare)

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, auth provider linking, supercluster clustering, rate-limiter Redis migration. (Carto basemap key wiring is closed by this sprint — keyless Carto is the default.) OSRM demo has no SLA (~1 req/s, Redis cache absorbs repeats); self-host path stays open if routing volume outgrows it.

## 2026-10-09 — Execute-Feature: Safe Account Deletion + Email Studio + Admin/Profile Grids (Sprint 21)

**Summary:**
Self-service safe deletion (request → 7-day archived grace → anonymized finalize, reversible, policy-aligned) with user/admin email + in-app fan-out, generic Deleted-User profile (posts retained, likes/bookmarks empty), admin deletions queue + first-N-by-signup bulk safe deletion, full Email Studio (visual/HTML builder, enable toggles with audited transitions, custom templates, dynamic recipients), plus profile sign-out, quick-links 2→3-col grid, and admin KPI 2→4-col grid. Non-breaking (additive schema + migration, no removed APIs).

**Completed:**

- Prisma: User `isDeleted/deletedAt/deletionRequestedAt/deletionScheduledFor/deletionReason`, `AccountDeletionRequest` model, `AccountDeletionStatus` enum, `NotificationType` +3 values; idempotent migration `20261009000000_account_deletion`
- Config: `accountDeletion.ts` (grace 7d, retention 30d, anon identity, caps), `emailManagement.ts` (system names, recipient modes, caps, manual parser), email.ts +3 templates, notifications registry +3, admin bulk presets incl. First 100 + signup-order flag, apiRegistry +9 endpoints
- Service: `accountDeletionService.ts` (ACID tx request/cancel/finalize, counter recompute, last-admin guard, best-effort side-effects); emailService `sendTemplatedEmail` + deletion sends + `resolveEmailRecipients`; `isTemplateEnabled`/toggle + merge-backfill in emailTemplates utils
- APIs: `/api/account/{delete-request,cancel-deletion,deletion-status}`, `/api/cron/process-deletions` (CRON_SECRET, daily 02:00 vercel cron), `/api/admin/deletions` + `/finalize`, `/api/admin/email/{templates,send}`; posts route honors deleted profiles (all posts visible, likedBy/bookmarkedBy empty); by-username returns generic deleted profile; admin users `?deletion=` + `?order=oldest`
- UI: `AccountDeletionPanel` (profile danger zone + pending banner), own-profile sign-out + 2/3-col quick links, deleted-profile banner + no follow, admin Deletions queue page, Email Studio page (`/admin/email`), users page deletion filter + first-N-by-signup + Delete (safe) bulk, KPI `grid-cols-2 lg:grid-cols-4`, AdminShell Deletions/Email nav, GlobalConfirmModal `confirmLabel`
- Tests: `app/__tests__/config/accountDeletion.test.ts` (9 assertions: grace/retention, scheduling, anon identity, overdue, system templates, recipient modes, manual parse, bulk signup-order)

**Key Changes:**

- New: `app/lib/{config/accountDeletion.ts,config/emailManagement.ts,services/accountDeletionService.ts}`, `app/api/{account/delete-request,cancel-deletion,deletion-status}/route.ts`, `app/api/cron/process-deletions/route.ts`, `app/api/admin/deletions/{route.ts,finalize/route.ts}`, `app/api/admin/email/{templates/send}/route.ts`, `app/{admin/deletions,admin/email}/page.tsx`, `app/components/features/profile/AccountDeletionPanel.tsx`, `prisma/migrations/20261009000000_account_deletion/migration.sql`, `app/__tests__/config/accountDeletion.test.ts`
- Edited: `prisma/schema.prisma`, `app/lib/config/{email,notifications,admin,apiRegistry,index}.ts`, `app/lib/{utils/emailTemplates.ts,services/emailService.ts,services/notificationService.ts,services/modalService.ts,hooks/useBulkSelection.ts}`, `app/api/{posts,users/by-username/[username],admin/users,admin/email/preview}/route.ts`, `app/{(dashboard)/profile/page.tsx,(dashboard)/profile/[username]/page.tsx,admin/{AdminShell,page}.tsx,admin/users/page.tsx}`, `app/components/{ui/GlobalConfirmModal.tsx,features/profile/index.ts}`, `app/providers/GlobalModalProvider.tsx`, `vercel.json`, `.env.example`

**QA gate (this runner: NO node_modules — static verification only):**

- `npx tsc` / `npx jest` / `npm run build` NOT runnable here (no node_modules, consistent with prior session-log note); Vercel build runs `prisma generate` + `migrate deploy` before `next build` so new Prisma models/enums resolve at build time
- Static checks: modalService `confirmLabel` wired through provider+modal; `avatarConfig: null` clear; counter recompute captures post ids pre-wipe; manual review of all route/service/UI edits for excess-property and import-path correctness
- Residual risk: full tsc/jest/build must be confirmed in CI/Vercel; generated client (`app/generated/prisma`) is stale until regenerated

**Next Sprint Focus:**
Remaining backlog: live map tracking navigation, auth provider linking, supercluster clustering, rate-limiter Redis migration; confirm Sprint 21 QA green in CI and exercise the deletion cron + Email Studio sends in staging.

## 2026-10-09 — Execute-Feature: Auth Hardening + Single-Admin Assignment + avatarConfig Build Fix

**Summary:**
Referral/normal registration "validation failed" resolved via pre-Zod normalization (trim + lowercase email), body-fallback referral codes, case-insensitive email checks, and field-specific error messages surfaced in the UI; all auth paths (register/login/OTP/resend/Google/link-password, plus prior reset normalization) audited for the same drift class; issue notifications switched from notify-every-admin to exactly-one load-balanced assignee (open-bug load + shared deletion backlog, random tie-break); Vercel `avatarConfig: null` type error fixed with `Prisma.DbNull` and a regenerated Prisma client.

**Completed:**

- Build: `accountDeletionService.ts` finalize `avatarConfig: Prisma.DbNull`; regenerated `app/generated/prisma` (stale client lacked isDeleted/AccountDeletionRequest/new NotificationTypes → 33 local tsc errors, 0 after)
- Auth: register/login/OTP/resend normalize-then-validate + specific first-field error + `fieldErrors`; register reads ref from query OR body and stores lowercase email; login/OTP/resend/Google use case-insensitive email lookup; Google email lowercased + derived username sanitized to app rules; register page mirrors ref in body + renders server fieldErrors
- Assignment: `adminAssignmentService.assignAdminForIssue()`; wired into `POST /api/bug-reports` (reviewerId + assignee-only mail/in-app + reporter receipt), `POST /api/reports` (same, single resolve reused), accountDeletionService request (assignee-only alert mail)/cancel+complete (assignee-only in-app, fan-out fallback only on resolver failure); `sendBugReportNotification(title, category, description, recipientOverride?)`
- Tests: `app/__tests__/services/adminAssignmentService.test.ts` (6)

**Key Changes:**

- New: `app/lib/services/adminAssignmentService.ts`, `app/__tests__/services/adminAssignmentService.test.ts`
- Edited: `app/lib/services/{accountDeletionService,emailService}.ts`, `app/api/auth/{register,login,otp,otp/resend,google/callback,link/password}/route.ts`, `app/(auth)/register/page.tsx`, `app/api/{bug-reports,reports}/route.ts`
- Regenerated: `app/generated/prisma/**`

**QA gate (this runner, node_modules installed via npm install):**

- `npx tsc --noEmit` — 0 errors
- `npm test` — 30 suites / 255 tests pass (6 new)
- `npm run lint` — zero new issues in touched files (pre-existing repo-wide warnings unchanged; Vercel build skips lint)
- `npm run build` — not run locally (requires prod env/network); Vercel runs generate + migrate deploy + build

**Next Sprint Focus:**
Prod-verify referral + normal registration, single-admin mail ownership, reviewerId on bug/error reports; remaining backlog unchanged (live tracking nav, provider linking, clustering, rate-limiter Redis).

## Sprint 22 — Email Studio tightening + auth-email wiring + profile tabs + explore share/location + env centralization (2026-10-09, execute-feature)

**Completed:**

- Env: `lib/config/env.ts` (PROJECT_ENV-wins effective env); prisma.ts uses it; README + .env.example document differentiation
- Sanitization: `lib/utils/emailSanitize.ts` (allowlist HTML, escaping, var extraction); admin templates PUT + all sends hardened
- Interpolation fix: missing vars → "" (never literal `{{ident}}`); HTML-escaped values; shared defaults (logoUrl absolute/appUrl/appName/supportEmail/year); preview readable samples
- Wrapper/icons: `composeEmailDocument/Text`, `EMAIL_DEFAULT_VARIABLES`, `EMAIL_ICONS` SVG (welcome emojis replaced); 3 new system templates (verifyEmail/changeEmail/changePassword)
- Builder: `lib/utils/emailBuilder.ts` blocks↔HTML↔text lossless (execution-verified round-trips); Studio rewritten (blocks editor, catalog select + custom vars, in-place text, raw HTML, per-var composer inputs, select-search recipients via `/api/admin/users?q=`)
- Sends: toggle-respecting OTP/welcome/reset/contact/bug + 3 new senders; welcome unconditional (register) + Google signup
- Auth APIs: verify-email (trigger+confirm), change-email (request+confirm, uniqueness, OTP binds address), change-password (hasPassword-only + security notice); link/password change also notifies
- Profile: EmailSecurityPanel (gated verify/change-email/change-password) + account tab group + quick-links grid; explore: functional share (sheet→clipboard→fallback) + persistent watched user dot

**Key Changes:**

- New: `app/lib/{config/env.ts,utils/emailSanitize.ts,utils/emailBuilder.ts}`, `app/api/auth/{verify-email,change-email,change-password}/route.ts`, `app/components/features/profile/EmailSecurityPanel.tsx`, `app/__tests__/config/emailStudio.test.ts`
- Edited: `app/lib/config/{email,emailManagement,index,apiRegistry}.ts`, `app/lib/{utils/emailTemplates.ts,services/emailService.ts,db/prisma.ts}`, `app/api/admin/email/templates/route.ts`, `app/api/email/preview/route.ts`, `app/admin/email/page.tsx`, `app/api/auth/{register,google/callback,link/password}/route.ts`, `app/(dashboard)/{profile,explore}/page.tsx`, `README.md`, `.env.example`

**QA gate (this runner, no node_modules):**

- `tsc --ignoreConfig --noResolve` new+edited files — zero attributable errors (environment-only noise)
- node strip-types execution: builder 4/4 round-trips, sanitizer strips script/handlers/js-urls, env precedence correct
- jest (17 new) / lint / build — deferred to CI/Vercel (deps absent)

## Sprint 24 (2026-10-09) — PWA fulfillment + Pidgin expansion

- PWA registry `app/lib/config/pwa.ts`: versioned caches (v3), guest-only precache, never-cache auth/push/admin, cacheable API prefixes, map-tile hosts, push mirror map, heartbeat + toast copy.
- `public/sw.js` rewrite: navigation preload, network-first pages with offline.html fallback (cached-pages list), SWR for cacheable GET APIs + images + keyless map tiles (bounded LRU), real background-sync handshake (FLUSH_OFFLINE_QUEUE), push with actions + focus-or-open click.
- `public/manifest.json`: id/scope/launch_handler, split any+maskable icons, PWA utm shortcuts (Explore/Search/FAQ); `public/offline.html`: design-token styling, cached-destinations list, retry + cached-feed CTA, refresh notice.
- OnlineStatus: heartbeat (captive-portal/flaky detection), offline/online toasts, focus re-flush, SW sync relay, `useRequireOnline`; new `offlineGuard.ts` (requireOnline/isOfflineError/sanitized errors).
- Session preservation: AuthProvider keeps last-known user on network/5xx/non-JSON; only double-401 clears. useCachedFetch serves stale cache on offline failure instead of erroring.
- Push fan-out: `pushSender.ts` (VAPID direct send, 410 pruning, never throws) auto-mirrored from `createNotification` (fire-and-forget, forward-compatible unknown types); `/api/push/status` + `PushManager` opt-in on notifications page; existing auto-subscribe preserved.
- Components: `OfflineBanner` (retry), `CachedDataNotice`, `ServiceWorkerRegistrar` (update-only SKIP_WAITING, never force-reloads); wired in layout + notifications page; `/api/health` heartbeat endpoint.
- i18n: +44 keys en/pcm (pwa/offline/push/placeholders/post/notifications/profile), parity-tested incl. interpolation preservation; Pidgin genuinely translated (45/142 differing).
- FAQ: new "Offline & App" category (6 entries: offline scope, cached-page fallback, install, push mirroring, session preservation); README PWA offline paragraph.
- Tests: `pwa.test.ts` (11), `locales.test.ts` (4), `offlineGuard.test.ts` (3) — 18 new suites entries; full gate deferred to CI (runner has no node_modules; SW syntax + JSON parity executed locally).

**Next Sprint Focus:**
CI green confirmation; prod-verify Google welcome mail, verify/change E2E, Studio send with missing vars, select-search send, explore share + dot.

## Sprint 25 (2026-10-09) — PWA Tightening + Pidgin Depth + Platform Reviews Access

**Directive:** cache config registry (raw `guest.signIn` keys seen offline) + collapsible offline toast; pidgin across config-driven public pages (about/faq/feed/landing/leaderboard/invitations/buttons/links) with seamless toggle; user access point for platform reviews (profile tab + FAQ), About placeholders → real reviews + every-10 CTA panel, thank-you notification (no email), archiving anonymizes without admin crashes. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- PWA: pwa.ts v4 (`/locales/*.json` precache, `/api/config` + `/api/reviews` cacheable, `PWA_OFFLINE_BANNER`, REVIEW push mirror); sw.js v4 mirror + `/locales/` cache-first branch; I18nProvider bundled-EN seed + localStorage last-good + `along-locale` cookie sync + `tf()` fallback helper; OfflineBanner collapsible/expandable pill persisted per device.
- i18n: +74 keys en/pcm (235/235 parity, interpolation preserved); FAQ_PCM 24-item pidgin map + new Reviews FAQ category; toggle wired through PostCard aria-labels, PostMenu (config-fallback), AppFooter (optional `i18nKey`), LandingCtas + new LandingCopy islands, About headings, FaqClient, leaderboard/invite/feed-empty.
- Reviews: `GET/POST /api/reviews` (self-pair `UserReview` marker → 1/user, upsert ACID, PENDING moderation, `mine`/`authorId`/cursor, edge cache, `reviews` rate-limit bucket); ReviewsPanel (form + pending note + guest gate + FAQ + list); own-profile `reviews` tab + `#reviews` deep link; other-profile read-only tab; About real-reviews tape with CTA cadence (`insertReviewCtaPanels`); `notifyReviewThanks` (REWARD+allowSelf, no email); archiving preserves-anonymizes with null-safe admin (`reviewAuthorName`).
- Tests: `reviews.test.ts` (8), pwa.test +4, locales REQUIRED_KEYS +32.
  **QA (this runner, node_modules installed):** `tsc --noEmit` 0 errors (2 session errors fixed: test helper typing, `useState<number>`); `jest --ci` 36/36 suites, 309/309 tests pass; `next build` clean; `next lint` 0 new (1 pre-existing `Medal` unused-var warning); `node --check sw.js` OK; locale parity via python 235/235, 0 interpolation mismatches.
  **Compliance:** no migration, no removed APIs/shapes, no new deps; SW scope/strategy additive (v4 invalidates v3 cleanly); providers additive; all errors sanitized/offline-aware; ACID upsert for reviews.

## Sprint 26 (2026-10-09) — Email Studio tightening: live preview, logo universality, parsing, save-styling, vars/fallbacks, origins

- Live unsaved preview: Studio debounced client render (canonical draft → wrap → interpolate w/ samples + composer overrides) + Live/Saved badge + whitespace-insensitive dirty tracking; `POST /api/email/preview` draft endpoint (sanitize + fill + same pipeline).
- Logo/images universal: all 11 defaults head with logo img (`alt={{appName}}`) + shared wrapper/footer; image blocks email-safe with alt fallback + Studio thumbnails; legacy header SVG gone.
- Builder parsing: `htmlToBlocks` strips inline tags (no raw HTML in paragraphs), handles div/td wrappers, CTA + nested-list splits, dedupe; backreference fix (`\5`→`\4`).
- Save styling: `ensureEmailDocument` fragment auto-wrap at render (preview + sends); PUT regenerates text twin from new html.
- Vars/fallbacks/origins: `{{name||fallback}}` everywhere (render/extract/sanitize); catalog 12→25; every link builder via `getAppUrl()` (google, forgot-password, verify/change-email, deletion, welcome, preview samples) — no localhost in prod paths.
- Tests: +13 emailStudio cases (fallbacks, wrap, parsing, image, logo universality).
- QA: runner has no node_modules → full gate (tsc/jest/build) deferred to CI/Vercel; change-set verified by review (14 files, additive-only, no migration/deps).

## Sprint 27 (2026-10-09) — Admin verify actions + push-prompt handling + OTP feedback

**Directive:** admin email-verification actions; push Enable notice (no action, no push, never clears) with graceful per-environment handling + local flag; verify-email OTP feedback (instant invalid/expired, missing re-sends, rate-limit invisibility). Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- Registries: `config/authVerification.ts` (otpTtl 900s, resendCooldown 60s, maxVerifyAttempts 5, key prefixes, copy, maskEmail/cooldownKeyFor/attemptsKeyFor) + `config/pushPrompt.ts` (enabled/dismissed keys, 7-day dismiss TTL, per-outcome copy, isLikelyIos) + barrel exports.
- otpStore additive: `setSendCooldown`/`getSendCooldownRemaining`, `recordVerifyAttempt`/`clearVerifyAttempts` (Redis withTimeout + memory fallback, same discipline as OTP).
- APIs: `otp/resend` + `verify-email` POST enforce per-email cooldown (429 + `retryAfter` header/body) and return honest `{sent, expiresIn, cooldown, invalidatesPrevious}`; `otp` POST + `verify-email` PUT use attempt counter (revoke at 5, `expired`/`attemptsLeft` flags, contextual copy); `verify-email` PUT newly shares the auth rate bucket.
- Register seeds the cooldown at issuance and returns timers; register page forwards `?cooldown=`; OTP screen rewritten (real masked email, expiry + newest-only notes, server-adopted timer, delivery-failure vs rate-limit distinction); `useOtpResend` hook shared with EmailSecurityPanel (cooldown display + honest resend errors).
- Push: `getPushSupport()` (SSR/insecure-context/no-SW guards), `ensurePushPermission()` (in-gesture request), `subscribeToPushDetailed()` (ok/unsupported/insecure-context/no-vapid/no-service-worker/denied/dismissed-permission/subscribe-failed/server-rejected/offline; never throws; `subscribeToPush()` boolean kept); PushManager persists `along-push-enabled` + dismissal timestamp, renders per-outcome guidance (+iOS Add-to-Home-Screen help) with retry + toasts; PushProvider auto-subscribes only when permission already granted.
- Admin: `PATCH /api/admin/users` handles `verify`/`unverify` (VERIFIED notification to user, `previous` snapshot for undo) and `resend-verification` (fresh OTP + verifyEmail send, `{emailed, errors}` honesty, skips verified); users page gains Email-status column, Verify/Unverify/Resend-code row actions (confirm on unverify), bulk Verify, undo toasts.
- Locales: +15 keys en/pcm (250/250 parity, interpolation preserved, pidgin genuinely translated).
- Tests: `app/__tests__/config/authVerificationPush.test.ts` (6: registry values, key builders, maskEmail, copy coverage, pushPrompt storage/copy, isLikelyIos).
  **QA:** no node_modules in runner — node strip-types executed both configs clean; locale parity script 250/250 identical. `npx tsc --noEmit` + `npm test` + `next build` deferred to CI/Vercel (must confirm green).
  **Compliance:** no migration, no new deps, no removed APIs; errors sanitized; notifications never-throw; ACID untouched.

## Sprint 29 (2026-10-09) — Tightening-up: auth edge case + email studio + blog + audit + leaderboard

**Directive:** see session-log Sprint 29 (unverified-login edge case, email-studio hardening, blog admin, audit trail, leaderboard pagination/jump, dynamic email variables).
**Implemented:**

- Auth: login 403-on-unverified removed → session + `needsVerification` + deduped VERIFIED prompt (CTA → profile security tab); login page + notification rows + profile pill honor the CTA.
- Email: SVG allowlist (icons render in preview + sent); unverified-recipient filter default + opt-in + note; per-recipient var resolution (auto platform/user/generated, manual only for gaps) + composer badges; restore-to-default (hardcoded never auto-overwrites).
- Blog: SiteConfig-backed managed posts merged over MDX seeds; admin CRUD + bulk status + Studio with visual blocks; public feed API + listing (category/pagination) + detail; sanitized like email configs.
- Audit: AuditLog table (migration `20261009000001_audit_log`) + service + admin API/page/nav + mutation hooks.
- Leaderboard: paginated API (`page/limit/me/totalPages/total`) + own-rank card + jump-to-rank + pagination UI.
- Tests: leaderboard test updated; NEW `tightening.test.ts`.
  **QA:** no node_modules in runner — review-verified; full gate (tsc/jest/build) deferred to CI/Vercel.
  **Compliance:** one idempotent table migration; no new deps; no removed APIs; additive-only otherwise.

## Sprint 30 (2026-10-09) — Profile consistency + audit build fix

**Directive:** profile posts-tab avatar parity, like/interaction parity (feed vs profile tab), verified-tag token colors in Email & Security, Vercel `audit/page.tsx:89 unknown → ReactNode` type error. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- Audit page: `hasRenderableMetadata` guard + never-throw `formatMetadata` (fixes the exact failing gate).
- NEW `lib/config/profilePosts.ts` (+ barrel): avatar/interaction field lists, token pill classes, viewer-scoped cache keys, tab TTL.
- `GET /api/posts`: viewer-scoped `_isLiked`/`_isBookmarked` batch enrichment (Like/Bookmark, never-throw, plain-row fallback).
- Own + [username] profile pages forward avatar/avatarConfig + interaction flags (header fallback; bookmarks `isBookmarked` alias honored).
- PostCard: `useEffect` SET_FROM_PROPS re-sync so fresh props update icons.
- ProfilePostCard: `feedStream.applyInteraction` mirror on like/dislike/bookmark + interaction-cache seed via useMemo.
- EmailSecurityPanel Verified pill → `bg-success text-success-text border-success-border` (design tokens, both themes).
- Bookmarks API also returns `_isBookmarked` (`isBookmarked` kept for compat).
- Tests: NEW `profilePosts.test.ts` (5 cases).
  **QA:** no node_modules in runner — static re-reads only (guard narrowing, Prisma delegate names Like/Bookmark, barrel exports, JSX usage, alias handling). Full gate (tsc/jest/build) deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Fix-build 2026-10-09 — Share-route validation hardening

**Directive:** empty stop + fare range ("400-500") passed the composer, server Zod rejected with bare "Validation failed", draft toast + modal close read as success with no post on feed/explore. Client validation with inline feedback + error-boundary classes + sanitized messages; Share unattemptable while invalid; draft never cleared on failure. Config/metadata-driven, reusable, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `lib/config/routeValidation.ts` (+ barrel): copy, strict `parseFareInput`, `validateRouteComposer` (every-step), `sanitizeRouteErrorMessage`, `firstRouteServerMessage`, `fieldErrorClass`.
- `schemas/post.ts`: location/title config messages, fare preprocess + finite/≥0/≤10M refines.
- `ShareRouteModal`: `_fareRaw` + text fare input, inline errors + token boundaries + aria, form banner, `canShare`-gated Share, validate-first submit, failure keeps modal open + preserves draft, drag carries errors.
- `home/page` submitPost + both edit submits: sanitized honest toasts (edit silence removed).
- POST/PATCH APIs: friendly `message` via config (shape unchanged).
- Tests: NEW `routeValidation.test.ts` (13 cases).
  **QA:** no node_modules in runner — targeted `tsc --ignoreConfig --noResolve` zero attributable errors; new suite awaits CI. Full gate deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Sprint 31 (2026-10-10) — Universal post share + dynamic trust engine

**Directive:** share button/icon working on posts everywhere (was profile-only); trust score/breakdown dynamic, accurate, responsive to followers + interactions (was frozen at creation value). Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- Share: NEW `lib/services/postShareService.ts` (Web Share → clipboard → legacy, never throws) + NEW `hooks/usePostShare.ts`; `POST_ACTIONS_CONFIG` += share fields; `PostCard` service fallback (override kept); `ProfilePostCard` deduplicated; feed/search/post-detail (both bars)/bookmarks wired.
- Trust: `ValidityEngine` v2 (optional reputation/engagement/report signals, additive weights, legacy parity); shared `computeRouteDetailScore`/`computeSimilarityRatio`; POST computes similarity + author signals synchronously; worker loads full signals; recompute triggers on like/bookmark/comment/edit/report/follow-unfollow; GET detail ships live `validityBreakdown`; `TrustBadge.breakdown` prop renders real rows with "live" marker, legacy placeholder otherwise.
- Tests: NEW `postShareService.test.ts` (8 cases); `ValidityEngine.test.ts` +9 (dynamic signals, scorers); `TrustBadge.test.tsx` +2 (live rows, placeholder parity).
  **QA:** no node_modules in runner — static verification only (full-scope re-reads, legacy-score arithmetic proofs, misplaced-block repair). Full gate (tsc/jest/build) deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Sprint 32 (2026-10-10) — Trust breakdown consistency (feed card == detail)

**Directive:** corroboration (and every shared row) must match between the feed post card and post detail; fewer card rows must still carry identical values. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `lib/services/trustBreakdownService.ts` (canonical single + batched live breakdowns, batched author/follower/report lookups, per-post tag-overlap; never throws; live score/tier overwrite stored rows on reads) + NEW `lib/config/trustDisplay.ts` (compact/full keys, labels, variant keys, tier derivation).
- `TrustBadge` `variant?` + `breakdown.score?`: number prefers live score, tier re-derived; compact (feed) vs full (detail) share identical values; placeholder fallback only.
- `PostCard` compact; every read API (list/feed+guest/search/suggestions/bookmarks/detail) attaches the same live object; worker refactored onto the service.
- Tests: NEW `trustBreakdownConsistency.test.ts` (5 cases); `TrustBadge.test.tsx` +2 (compact parity, live-score preference).
  **QA:** no node_modules in runner — static re-reads only. Full gate (tsc/jest/build) deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Sprint 33 (2026-10-10) — Cloudinary orphan prevention on deletions

**Directive:** deletion of posts/drafts/accounts must cleanly/safely (ACID) handle updated assets in Cloudinary to avoid orphaned assets and resource waste. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `lib/config/mediaCleanup.ts` (enabled, along/\* allowlist, per-flow toggles, account-retain policy, dry-run; env-overridable) + barrel + apiRegistry upload/uploadCleanup entries.
- NEW `lib/utils/cloudinaryUrls.ts` (pure, client+server safe: host check, public_id extract from secure_url, allowlist filter, edit diff) — no schema migration (Post.images stays String[]).
- NEW `lib/services/mediaCleanupService.ts` (server-only SDK; post-commit best-effort destroy, never throws, Sentry on failures) + NEW `POST /api/upload/cleanup` (auth, capped, skips URLs still referenced by live posts).
- Wired: DELETE /api/posts/[id] (pre-read images → post-commit purge), PATCH (removed-images diff), DELETE /api/admin/posts (snapshot images), PATCH /api/admin/bugs REMOVE_POST (pre-tx capture), accountDeletionService.finalizeOne (legacy Cloudinary avatar only; post images retained per Data-Retention policy), routeDraftsService.deleteDraft (fire-and-forget cleanup; publish path passes cleanupAssets:false), ShareRouteModal (publish skips, explicit discard cleans).
- Tests: NEW `mediaCleanup.test.ts` (5 cases).
  **QA:** no node_modules in runner — parser logic verified via node inline (URL_PARSER_OK) + full-scope static re-reads of all 11 touched files. Full gate (tsc/jest/build) deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only (new config/service/route, optional deleteDraft opts, best-effort background cleanup).

## Sprint 34 (2026-10-10) — Location toasts + feed/explore soundness + invite-link tightening

**Directive:** denied-location toast coverage; sound feed/Explore ranking with behind-the-scenes location factor; invite-link api-route tightening. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- Location: NEW `lib/config/locationFeedback.ts` (central copy + code helper); geo.ts + Explore consume it; NavigationGuide adds denial toast + Retry (inline banner kept); GlobalUndoToast Undo button now conditional (no dead Undo on plain toasts).
- Feed/Explore: SiteConfig feedAlgorithm honoured (DEFAULT fallback); viewer-location bonus (haversine 50km decay × locationBonus, geo-less = no-op); trust tie-break (score → validityScore → recency); ?lat=&lng feed params; feedStream + home passive-fix one-shot revalidation; Explore Verified⊇Trusted, engagement tie-breaks, NEW Nearest sort.
- Invites: buildInviteUrl/sanitizeInviteCode; OAuth failures redirect to /login?error= (+ref preserved); login renders sanitized error map; NEW /invite/[code] → canonical /register?ref= redirect.
  **QA:** no node_modules in runner — static checks only (19/19 files, 12/12 balance). Full gate deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Fix-build 2026-10-11 — Share-modal photo-remove visibility + expanded-map containment

**Directive:** image-removal button in the share route modal works but is invisible (not accessible); desktop post-view expanded map spills past its container into the suggestions rail. Config/metadata-driven, non-breaking + update-ai-system chain.
**Implemented:**

- `shareRoute.ts` += `photoRemoveButtonClass` (always-visible `opacity-100`, `w-7 h-7`, `bg-black/70`, `border-white/40`, focus-visible outline, token classes only) + `photoRemoveIconSize: 14`; `ShareRouteModal.tsx` consumes them (inline fallbacks; indexed aria-label unchanged).
- `mapStack.ts` += `MAP_EXPAND_CONFIG` (+ barrel export): centered overlay, scrim backdrop, `max-w-4xl` panel, `80vh` height, backdrop-click + Escape dismissal, dialog/minimize labels; `RouteMap.tsx` expanded mode renders that contained dialog (shared `mapChrome` fragment, resize + refit on open, focus to Minimize, scroll-lock kept); collapsed root += `max-w-full w-full min-w-0`.
- Tests: `uxTightening.test.ts` +1 photo-remove case; `mapStack.test.ts` +2 containment cases.
  **QA:** no node_modules in runner — targeted `tsc --ignoreConfig --noResolve` zero attributable errors (noise identical to untouched baseline); full jest/tsc/build deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Sprint 36 (2026-10-11) — Response-linkage persistence + composer false-validation fix

**Directive:** edits of response posts and response drafts must keep their linkage; posting after edit→draft→repost-as-response failed with phantom "highlighted fields" errors. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- `routeValidation.ts` destination fare/vehicle skip flags; `ShareRouteModal` edit-response banner + drafts-in-edit with linkage fallback + no destination `_fareRaw` seeding; callers forward linkage; `GET /api/posts` includes `quotedPost`.
- Tests: `routeValidation.test.ts` +2, `routeDrafts.test.ts` +1.
  **QA:** executed shipped validator in node (3/3 expectations hold); full gate deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Sprint 35 (2026-10-11) — Leaderboard cross-links + auth-link tightening

**Directive:** leaderboard links on footer/profile/invite; one-auth-means accounts can connect the other and it persists; Email & Security reflects connected means. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `LEADERBOARD_LINKS_CONFIG` + footer Leaderboard link + `PROFILE_QUICK_LINKS_CONFIG` (profile quick links now config-driven, incl. Leaderboard) + invite "View full leaderboard" CTA; 3 locale keys added with en/pcm parity.
- `GET /api/auth/link/status` re-reads auth methods from DB (booleans only) — fixes always-false `hasPassword` so password-linking persists in UI and Change-password gating works; profile toasts `google_linked`/`google_already_linked` once and cleans the URL.
- NEW `AUTH_LINK_STATUS_CONFIG` (+ state resolver/copy helper) consumed by Connected Accounts + Email & Security (connected-methods line, per-state hints).
- Tests: NEW `leaderboardAuthLink.test.ts` (5 cases).
  **QA:** no node_modules in runner — static verification only; full gate deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs; additive-only.

## Fix 2026-10-11 — Register verify-email/OTP not sent (fire-and-forget freeze)

**Directive:** verify email/OTP not sent on successful register while other email flows deliver; config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Root cause:** register used fire-and-forget (`void sendInBackground()` / `globalThis.waitUntil`, which does not exist on the Vercel/Next runtime). Serverless freezes the function the moment the response returns, so the OTP mail was silently dropped; awaited flows (forgot-password 6s race, resend, verify-email trigger) delivered fine — matching the "email service functional, register OTP missing" report. Secondary: register sent the otp-only template while resend/trigger use the verifyEmail (OTP + link) template.
**Implemented:**

- `lib/config/authVerification.ts` += `REGISTER_EMAIL_DISPATCH_CONFIG` (otpTimeoutMs 6000, welcomeTimeoutMs 6000, useVerifyTemplate true) + `GOOGLE_WELCOME_DISPATCH_CONFIG` (5000).
- `api/auth/register/route.ts`: awaited parallel dispatch (`Promise.allSettled`, per-mail timeout race, `sendVerifyEmail` OTP+link with `verify-email?email=` link, welcome independent/non-fatal), honest `sent`/`reason`/`welcomeSent` payload (mirrors resend contract) instead of false-positive "OTP sent"; account creation never rolled back on mail failure.
- `api/auth/google/callback/route.ts`: welcome awaited within 5s timeout (same freeze class fixed; redirect latency bounded, failure non-fatal).
- `(auth)/register/page.tsx`: surfaces `sent===false` via info toast but still advances to `/otp` (code IS saved).
- Tests: NEW `registerEmailDispatch.test.ts` (6 file-presence cases).
  **QA:** no node_modules in runner — re-reads of all touched files, static predicate checks (no sendInBackground/globalThis/void-send remains on register; sent flag + verify link present); full jest/tsc/build deferred to CI/Vercel.
  **Compliance:** no migration, no new deps, no removed APIs (register 201 shape additive-only: +sent/reason/welcomeSent/invalidatesPrevious); additive-only.

## Sprint 37 (2026-10-11) — Owner-only post menu + admin edit with audit + friendly audit trail

**Directive:** post menu must not expose archive/delete to non-posters (incl. admins); admin post actions gain editing, audit-logged; audit log UI becomes user-friendly with sanitization + universal table/tag components. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- `PostMenu.tsx`: Edit/Archive/Delete render for owners only; admins viewing others' posts see Copy link + Report like any viewer (handlers additionally no-op without ownership; `viewerRole` kept for call-site compat). Admin moderation lives on `/admin/posts`.
- `PUT /api/admin/posts` (new): title/description/tags only, validated, nature-preserving by construction; PATCH/DELETE now `logAudit` (`post.archive`/`post.restore`/`post.delete`); `PATCH/DELETE /api/posts/[id]` audit admin-not-owner mutations (`post.edit`/`post.archive`/`post.restore`/`post.delete`).
- `/admin/posts`: Edit button + `AppModal` form (`AppInput`/`AppTextarea`/`AppButton`, inline + toast errors, audited save).
- NEW `lib/config/audit.ts` (`AUDIT_DISPLAY_CONFIG` + `sanitizeAuditText`/`sanitizeAuditDetails`/`auditEntityMeta`/`auditActionMeta`, zero-dep, never-throw); `/admin/audit` rebuilt on `AppTable`/`AppTag`/`AppCard`/`AppEmptyState`/`AppSelect`/`AppInput`/`AppButton` with sanitized actor/detail/date cells and capped chips + collapsible full JSON.
- Service type fix: `attachLiveBreakdownsToPosts` returns `T & Partial<LiveBreakdownAttachment>` (was `T[]` while attaching score/tier/breakdown) — additive, all callers unaffected.
- Tests: NEW `config/audit.test.ts` (6) + NEW `components/PostMenu.test.tsx` (4: owner/admin/viewer/archived visibility).
  **QA:** `npx tsc --noEmit` zero errors (baseline had 5 in untouched trustBreakdown test + prisma-client staleness; verified pre-existing via `git stash -u`); `npm run build` passes; jest 436/439 — 3 failures in `searchService` + `registerEmailDispatch` verified identical at clean HEAD (pre-existing, unrelated); `next lint` errors only in untouched files, zero findings in touched files.
  **Compliance:** no migration, no new deps, no removed APIs (PostMenu props unchanged; admin list shape unchanged — description/tags already returned; PUT is new); additive-only.

## Sprint 38 (2026-10-11) — Profile post parity + corroboration tightening

**Directive:** profile posts consistent with platform (response marker + current trust badge); explain + tighten corroboration (and review other trust factors); config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- Profile `PostItem` (own + `[username]`) forwards `validityBreakdown/quotedPostId/quotedPost/responsesCount` — tabs now render the "Responding to" marker and live compact TrustBadge exactly as feed cards.
- NEW `CORROBORATION_CONFIG` (window 30d, blend 0.55/0.25/0.20, geo radius 8km, fare band ±25%, response 25pts cap 60); pure engine scorers (tag Jaccard, geo corridor, route content with destination exclusion, endorsement from likes/dislikes vs views, coverage-scaled blend); service single + batched paths share one candidate pool; create path reuses the same helper (no optimistic flash); `TRUST_BREAKDOWN_DESCRIPTIONS` tooltip help.
- Other trust factors audited, unchanged (all real signals; dynamic legs additive/capped).
- Tests: NEW `services/corroboration.test.ts` (8).
  **QA:** tsc zero errors; trust suites 43/43; full jest 443/446 with 3 pre-existing failures verified identical at HEAD; lint pre-existing-only.
  **Compliance:** additive-only, no migration/deps/API removals.

## Sprint 39 (2026-10-11) — Comment tightening + feed modal parity + explore search expansion + test close-out

**Directive:** invisible comment caret; comment avatar inconsistency; feed comment icon full-page nav vs profile modal; explore search for users + general posts with suggestions + recents; resolve all failing tests (incl. 3 pre-existing). Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `COMMENTS_CONFIG` + `EXPLORE_SEARCH_CONFIG` (+ recent helpers) exported from config index.
- Caret: explicit `var(--color-primary)` inline (overlay trick kept, `caret-current` removed); avatars: `AppAvatar` in composer/list/mentions/search rows; detail page passes real `userName` (fixes profile links).
- NEW shared `PostCommentsModal`; feed/profile/search/detail all use it; hook fallback soft-navigates via router.
- NEW `ExploreSearchInput`: unified-search suggestions (routes incl. requests + people + tags) + localStorage recents + full-search footer; explore filter untouched; pick centres/opens pin or routes to post.
- All 3 pre-existing red suites fixed (comment-prose assertions reworded; cache test asserts deep equality + empty-page fast path); NEW `commentTightening` (10) + `exploreSearchExpansion` (6) suites.
  **QA:** tsc zero errors; jest 54/54 suites 461/461 (was 443/446); lint pre-existing-only; `npm run build` clean.
  **Compliance:** additive-only, no migration/deps/API removals.

## Sprint 40 (2026-10-11) — Trust detail-42 fix + error-boundary bug-report CTA + search discoverability

**Directive:** every post shows detail 42% regardless of richness; error boundary should toast a bug-report CTA with sanitized prefilled report (editable above/below) + same behaviour on any "team notified" surface (audit first); search links in top bar/footer/profile. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `DETAIL_SCORING_CONFIG` (image/tag/description/vehicle/fare/stop/location bonuses, all capped, 0-when-absent); `computePostDetailScore` + `detailContextFromPost` in ValidityEngine (legacy scorer untouched; no-context returns base exactly); service single + batched paths + POST create + recompute worker all reuse it (reads == writes, no flash); detail tooltip copy names the richer inputs.
- `ERROR_REPORTING_CONFIG` (bugReportPath, prefill caps, toast CTA copy, prefill scaffolding) + `buildErrorReportPrefill`/`buildBugReportUrl` (sanitized, capped, never-throws); boundaries toast the CTA via the existing toast action slot + render an inline prefilled "Report a bug" link; `/report-bug` prefills `?title=&description=` into `initialValues` with an editable-prefill note; `EMPTY_STATES.error` mirrors the honest unreported copy. Audit: `not-found.tsx` correctly out of scope (no error claim).
- Search: `NAV_REGISTRY` entry (sidebar), sidebar user-row search icon (guest + authed, collapsed-safe), footer Features link + profile quick-link (`footer.search` en/pcm); mobile bottom tabs intentionally unchanged (5-tab + FAB layout; footer + explore carry mobile).
- Tests: NEW `detailScoring` (8) + `errorReportPrefill` (6) + `searchLinks` (3).
  **QA:** tsc zero errors; jest 57/57 suites 478/478 (was 461/461); `next lint` exit 0, warnings pre-existing-only, zero findings in touched files; build deferred to Vercel.
  **Compliance:** additive-only, no migration/deps/API removals (optional params; toast shape reused).

## Sprint 41 (2026-10-11) — Signup verify-email delivery parity + failure fallback

**Directive:** signup verify mails persistently undelivered while the profile-triggered flow works; audit the unverified-blocking hypothesis; keep profile fallback for edge cases only. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Implemented:**

- Root cause (budget asymmetry, not a logic gate): register raced each mail against 6s outer / 5s inner timeouts while the profile trigger awaited a single send with no outer race (maxDuration=30) — cold starts timed out on signup and delivered on profile. Audit confirmed NO unverified-recipient gate exists on any transactional verify path (new static suite asserts it).
- `REGISTER_EMAIL_DISPATCH_CONFIG`: otpTimeoutMs 6s→15s, welcomeTimeoutMs 6s→10s (parallel wall-time ≤15s < maxDuration 30) + new `clearCooldownOnFailure` + `resendUseVerifyTemplate` flags.
- `emailService`: `sendEmail({timeoutMs})` + optional timeout params on sendOtp/sendWelcome/sendVerify (defaults unchanged); verify fallback to otp-only preserved.
- `otpStore`: additive `clearSendCooldown` (redis + memory; OTP hash untouched, auth rate bucket still caps abuse).
- Register/resend/verify-email-trigger: thread patient budgets; on delivery failure lift the issuance cooldown and return `cooldown: 0` so the OTP screen offers immediate retry (success still returns the 60s cooldown); otp/resend now sends the verifyEmail template (OTP + link) like register/profile instead of otp-only.
- Tests: NEW `config/signupVerifyDelivery` (7 static: helper, config, timeout threading, three routes, no-gate audit).
  **QA:** no node_modules in runner (jest/tsc/build deferred to CI/Vercel); brace/paren balance + expectation-presence checks via node one-liners all green; existing `registerEmailDispatch` assertions preserved (parallel dispatch + honest `sent` contract intact).
  **Compliance:** additive-only, no migration/deps/API removals (optional params; response shapes gain no new required fields).

## Sprint 42 (2026-10-11) — Dislike parity + comment-avatar consistency

**Directive:** comment-box avatar inconsistent with the platform; post-detail dislike button dead + count stale (feed card correct); every dislike control needs an active fill/bg like the like control. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Implemented:**

- Root causes (all verified in code): (1) `GET /api/auth/me` selects `avatarConfig` but `AuthProvider.User` dropped it and all four comment viewers (detail/home/search/ProfilePostCard) omitted it — DiceBear users fell back to initials in the composer; (2) the `Like` table stores LIKE|DISLIKE in one row but no API ever returned `_isDisliked`, PostCard hard-reset `disliked: false`, and the detail dislike button had no `onClick` at all; (3) like had token fill classes, dislike had none.
- Server (additive `_isDisliked`, never-throw preserved): `GET /api/posts/[id]` derives it from the vote row; `GET /api/posts` batches a DISLIKE query alongside LIKE; `feedService.getFeed`/`getPostById` enrich both paths; `feedStream.applyInteraction` tracks `_isDisliked` with like/dislike mutual exclusion mirroring the PostCard reducer; `PROFILE_POSTS_CONFIG.interactionFields` gains the flag.
- Client: PostCard seeds/syncs `disliked` from `_isDisliked` (effect deps extended) and both vote buttons read `POST_ACTIONS_CONFIG` active/icon classes (+ `aria-pressed`); detail page gains `handleDislike` (optimistic count, mutual exclusion, `!res.ok` rollback, error toast) and `handleLike` now clears prior dislike state; home `onLike` always sends LIKE (unlike = toggle-off, previously mis-sent DISLIKE) and `onDislike` honors the toggle value; ProfilePostCard mirrors both + forwards dislikes through the cache seed; profile tabs forward the flag.
- Styling: `POST_ACTIONS_CONFIG` += `likeActiveClass/likeIconClass/dislikeActiveClass/dislikeIconClass` (dislike = warning-token text + fill, readable light/dark, no `text-white`).
- Avatar: `AuthProvider.User` += optional `avatarConfig`; detail/home/search/ProfilePostCard viewers forward it into `CommentInput`/`PostCommentsModal` (same `AppAvatar` path as every other surface).
- Tests: NEW `config/dislikeSync` (15 static: config parity, card sync, detail wiring + exclusion + toggle payloads, cache exclusion, profile forwarding, three server enrichments, four avatar wirings) + `profilePosts` interaction-fields +1.
  **QA:** no node_modules in runner (jest/build deferred to CI/Vercel like recent sprints); tsc shows zero errors on any touched symbol (`_isDisliked|dislikeActive|dislikeIcon|likeActiveClass|avatarConfig` grep clean — remaining output is missing-`react`-module cascades on untouched files too); all 30 new-suite assertions grep-verified present verbatim; brace-balance + diff review clean.
  **Compliance:** additive-only, no migration/deps/API removals (optional props/fields; vote API contract unchanged — same toggle endpoint, corrected payloads).

## Sprint 43 (2026-10-11) — Admin destructive user deletion + dashboard period toggle

**Directive:** keep the 7-day deletion-request flow and add the actual destructive safe deletion (warning + undo per convention); dashboard period toggle like user analytics, wired end-to-end to overview + signups chart. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Implemented:**

- `ADMIN_DASHBOARD_PERIODS` + `parseAdminDashboardPeriod` + `ADMIN_USER_DELETION_META` in `lib/config/admin.ts` (barrel re-exported); service += `finalizeSingleRequest` (force-gated), `cancelDeletionRequestById`, `deleteUserNow` (same ACID anonymize pipeline, guards preserved, never throws).
- `GET /api/admin/stats?period=7|30|90` — windowed signups series, window-vs-previous-window deltas (zero-activity stays flat via existing `pctChange`/`formatDelta` semantics), back-compatible shape (`signups7d` alias, `postsToday`, legacy 7-day deltas on default period).
- `POST /api/admin/deletions/finalize` += `cancel` (requestId|userId), `finalizeOne` (due-only unless force), `deleteNow` — every new action `logAudit`-audited with self-delete guard.
- Dashboard `<select>` toggle drives fetch, subtitle, chart title, and posts-card label/value; deletions queue per-row Reverse (confirm + re-request undo) + Delete now (destructive confirm, no fake undo, recovery note); users table per-row Request/Reverse/Delete-now gated on deletion state; bulk copy unified on the shared meta.
- Tests: `config/admin.test.ts` +3 suites (period parity, parser clamps, deletion copy).
  **QA:** no node_modules in runner (tsc/jest/build deferred to CI/Vercel); node strip-types checks 9/9 green; jest additions mirror them for CI.
  **Compliance:** additive-only, no migration/deps/API removals (new query param optional, new response fields optional, new finalize actions additive).

## Sprint 44 (2026-10-11) — Deleted-account view-only gating + Active filter + row-actions dropdown

**Directive:** admin users panel — deleted accounts must not offer verify / resend-code / make-admin (view-only; recovery is off-platform); add a non-deleted (Active) filter alongside All / Deletion pending / Deleted; move AppTable row actions into a dropdown that preserves bg/text colors so long action lists stop elongating rows and prevent mis-taps. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Implemented:**

- Config (`lib/config/admin.ts`, barrel re-exported): `ADMIN_USER_FILTERS` (All/Active/Pending/Deleted + descriptions + `parseAdminUserFilter`/`deletionQueryForFilter`), `ADMIN_USER_ROW_ACTIONS` (action ids + deleted-hidden list + view-only note) + pure never-throw `isDeletedAdminUser`/`allowedUserRowActions`/`canShowUserRowAction` (deleted → `["view"]`; pending swaps request→reverse), `ADMIN_TABLE_ACTIONS_META` (trigger copy/align/empty).
- API (`GET/PATCH /api/admin/users`): `?deletion=active` = `isDeleted:false AND deletionScheduledFor:null` (AND-combined with text search so search keeps working); PATCH verify/unverify/resend/role partitions targets into live vs deleted, applies only to live, returns 422 when all-deleted and honest `skippedDeleted` counts on partials; audit metadata + notifications use live targets.
- UI shared: `AppDropdown` += additive `className`/`disabled`/`disabledReason`/`title`/`ariaLabel` passthrough (colors preserved per item, destructive variant untouched); NEW `AppTableRowActions` (`TableRowAction` metadata: id/label/icon/className/variant/disabled/href/onSelect, never-throw builder, compact `···` trigger, stopPropagation-safe, empty → `—`).
- UI pages: users table tablist now config-driven with live counts, actions cell replaced by the dropdown (deleted rows render View-only); bulk verify/role/suspend/delete partition the selection (deleted skipped with honest toast); posts table (Edit/Hide-View-Delete) and deletions queue (View/Reverse/Delete-now) migrated to the same dropdown with colors preserved.
- Tests: `config/admin.test.ts` +2 suites (filter ids/parse/query; deleted view-only gating incl. active-vs-pending sets + dropdown meta).
  **QA:** no node_modules in runner (tsc/jest/build deferred to CI/Vercel like recent sprints); changed-file review clean (imports/exports — incl. new `TableRowAction` barrel type — icon availability on lucide-react 0.469, closure-order safety on deletions helper, AND-search composition on the active filter); new assertions mirror for CI.
  **Compliance:** additive-only, no migration/deps/API removals (new filter value optional, new response field optional, new component additive, old button classes preserved as item classNames).

## Sprint 45 (2026-10-12) — Chart hover tooltips + admin analytics + sidebar/avatar

**Directive:** hover tooltips on charts platform-wide; dedicated comprehensive admin analytics page; admin sidebar scrollability; admin avatar consistent with the platform via the existing component extended with an optional admin tag (whole component linking to profile). Config/metadata-driven, reusable, non-breaking + update-ai-system chain.
**Implemented:**

- Config (`lib/config/charts.ts`, barrel re-exported): `CHART_TOOLTIP_CONFIG` + `CHART_SERIES_META` + never-throw colour/format helpers + `ADMIN_ANALYTICS_CONFIG` (KPIs/sections/lists/validity buckets).
- UI shared: NEW `ChartTooltip.tsx` (`ChartHoverTooltip`/`ChartTooltipWrapper`/`SvgChartContainer`, barrel exported); `AppUserLabel` += optional `roleLabel`/`hideTier` (link-to-profile preserved, null → legacy render).
- Pages: `app/admin/page.tsx` + `app/(dashboard)/analytics/page.tsx` hover tooltips on every chart (SVG mouse-follow + per-point `<title>` fallbacks, bar-row wrappers, config colours); NEW `app/admin/analytics/page.tsx` (period toggle, 6 KPIs, 4 chart sections, top-posts/contributors, responsive grids) + NEW `GET /api/admin/analytics?period=` (period-aware deltas, sanitized errors); `AdminShell` scrollable links region + `AppAvatar`/`AppUserLabel` identity + `/admin/analytics` nav entry.
- Tests: `config/charts.test.ts` + `components/ChartTooltip.test.tsx` + `components/AdminAnalyticsShell.test.tsx` (new suites mirror for CI).
  **QA:** no node_modules in runner (tsc/jest/build deferred to CI/Vercel); node strip-types live check 6/6 green on `charts.ts` (caught + fixed a null→"0" formatting bug pre-ship); changed-file review clean.
  **Compliance:** additive-only, no migration/deps/API removals (new routes/pages/props optional or additive; legacy `title` fallbacks and `signups7d` alias kept).

## Sprint 46 (2026-10-12) — Push firing + global PWA install/push notices

**Directive:** push functional/firing (permissions et al) + non-interfering global PWA install notice; offline already good, push/install never observed. Config/metadata-driven, reusable, non-breaking + update-ai-system chain.
**Implemented:**

- VAPID parity (/api/push/vapid-public-key reads VAPID_PUBLIC_KEY ?? NEXT_PUBLIC_VAPID_PUBLIC_KEY); FOLLOW post-transaction push+invalidation mirror; registrar dev-guard (NEXT_PUBLIC_ENABLE_SW_IN_DEV).
- PWA_INSTALL_CONFIG + isStandaloneDisplay + NEW InstallPrompt (deferred BIP, appinstalled, iOS/manual help, flags, collapsible, i18n) + PushManager floating variant + PwaNotices hub in root layout + appleWebApp meta; FAQ install/push copy (+pcm) updated.
- Tests: pwa.test.ts +3 (install registry, standalone helper).
  **QA:** no node_modules in runner (tsc/jest/build deferred to CI); node --check sw.js + JSON + balance checks green; review clean.
  **Compliance:** additive-only, no migration/deps/API removals.

---

## Sprint 47 (2026-10-12) — PWA notice icon/theme compliance + user visibility + avatar consistency

**Directive:** icon-library compliance for PWA notices (? → FAQ), instance + platform-wide design-system run, deleted/archived-user exclusion + follow guards + counts, avatar consistency. Config/metadata-driven, reusable, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `lib/config/userVisibility.ts` + `PWA_FAQ_LINKS`; FaqClient `?q=`/`#hash` deep-links; InstallPrompt/PushManager/OfflineBanner lucide icons + `--color-*` tokens + FAQ help links; NavigationGuide Check icon + token pills.
- Suggestions/search/follow/followers/following/user-search visibility filters (P2022-tolerant) + follow 410 + live counts; Panel/Rail/UserList filters + AppAvatar; FollowButton unavailable state; admin avatar selects + AppAvatar/AppUserLabel pages.
- Tests: `config/sprint47.test.ts` (9 suites mirror for CI).
  **QA:** no node_modules in runner (tsc/jest/build deferred to CI); brace/token/emoji sweeps clean, tsc --strict zero-dep configs OK, node execution 11/11 + faq-links OK.
  **Compliance:** additive-only, no migration/deps/API removals.

---

## Sprint 48 (2026-10-12) — Profile tightening: dead phone field, name whitespace, AvatarSize 20

**Directive:** drop unpersistable edit-profile phone field; whitespace handling for name inputs (edit + registration audit); fix `size={20}` Vercel type error. Config/metadata-driven, reusable, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `lib/config/profileValidation.ts` (`PROFILE_VALIDATION_CONFIG` + normalize/validate helpers) + barrel; `EDIT_PROFILE_FIELDS` phone removed (+ client caps on names/bio); `VALIDATION_RULES.phonePattern` removed (unused).
- `ConfigDrivenForm` trims non-password fields pre-validation; `PATCH /api/users/[id]` normalizes + 400s bad display names (stale `phone` ignored); register collapses name whitespace.
- `AppAvatar` `AvatarSize` += 20 (compact request-card intent preserved).
- Tests: `config/profileTightening.test.ts` (14).
  **QA:** full local gate — `tsc --noEmit` clean, jest 66/559 pass, lint 0 new errors vs baseline.
  **Compliance:** non-breaking, no migration (UI-config-only phone removal; additive avatar union; legacy `phone` payloads still succeed).

## Sprint 49 (2026-10-12) — Installed-PWA update lifecycle: periodic checks + user-approved single-reload prompt

**Directive:** close the SW update gap — installed clients ran stale shells (auto-skipWaiting, no periodic `registration.update()`, no prompt); ensure updates surface without yanking running pages or dropping sessions. Config/metadata-driven, reusable, non-breaking + update-ai-system chain.
**Implemented:**

- Config: `PWA_CACHE_VERSION` v4→v5 (+ `sw.js` mirror) so existing installs purge stale caches on next activate; NEW `PWA_UPDATE_CONFIG` (hourly interval, visible/focus/online checks, `along:sw-update-ready` event, reload-guard + 1-day dismiss TTL, copy) + NEW `PWA_SW_MESSAGES` vocabulary (`SKIP_WAITING`/`SW_UPDATE_READY`/`SW_ACTIVATED`/`GET_SW_VERSION`/`SW_VERSION`) + barrel exports.
- SW: install precaches WITHOUT `skipWaiting` (never yanks a running page), broadcasts `SW_UPDATE_READY`/`SW_ACTIVATED` with version, answers `GET_SW_VERSION`; activate still claims + purges non-v5 caches; auth/push/admin never-cache untouched.
- Client: `ServiceWorkerRegistrar` rewritten — periodic `registration.update()` (hourly + visible/focus/online, offline-skipped), `updatefound`→waiting detection (controlled pages only), `controllerchange` single-reload guarded (first-install never reloads; sessionStorage episode flag cleared 5s after settled load), SW message relay.
- UI: NEW `ServiceWorkerUpdatePrompt` in `PwaNotices` hub — fixed bottom card (above offline slot) + collapsible pill, Update posts SKIP_WAITING (8s stale-browser fallback reload + success toast), Later snoozes 1 day, `pwa.update*` i18n keys (en + pcm pidgin), `--color-*` tokens, lucide RefreshCw/X/Chevron icons.
- Copy: NEW FAQ `app-updates` answer (+pcm twin) — background checks, Update/Later, session preservation, refresh-when-online.
- Tests: `pwa.test.ts` +2 (update registry shape, message vocabulary), `locales.test.ts` +4 required keys (en/pcm parity).
  **QA:** no node_modules in runner (full tsc/jest/build deferred to CI — standing arrangement); executed: `node --check sw.js` OK, en/pcm JSON parse OK, CACHE_VERSION v5 both sides, precache/message parity script OK (11/11 routes + 5/5 tokens); tsc shows only pre-existing missing-module noise (react/jest types), zero errors attributable to touched files.
  **Compliance:** additive-only, non-breaking, no migration/deps/API removals (SW message additions backward-compatible — old pages ignore unknown broadcasts; prompt renders only when an update is actually waiting; first-install path unchanged in behaviour).

## Sprint 50 (2026-10-13) — Reports+screenshots, pagination controls, merged geo, floating lanes, README

**Directive:** report screenshot uploads, view-more/page controls on paginated surfaces, second keyless geo source + location-biased suggestions + description/stop recall in search, floating-button overlap fix, README service credits. Config/metadata-driven, non-breaking + update-ai-system chain.
**Implemented:**

- NEW `reportAttachments` / `paginationUi` / `floatingUi` configs + barrel; upload `folder=` policies; `along/reports` cleanup source; `ReportImageUpload` + dialog/page wiring; `metadata.images` on both report APIs (no migration); admin thumbnails.
- NEW `ViewMoreButton` + `PageNavigator`; view-more on notifications/search/comments/reviews; navigators on leaderboard/blog.
- `openmeteo` merged geocode + near-rank + `?lat=&lng=` + granted-only `geoBias` helper; routes-JSON stop-name recall in search.
- Floating lanes (offline/install/transient) + mobile left dock; README +11 service attributions.
- Tests: `config/sprint50.test.ts` (10).
  **QA:** node --check + strip-types pure-logic green in-runner; full gate deferred to CI (no node_modules).
  **Compliance:** additive-only, non-breaking, no migration/deps/API removals.

## Sprint 51 (2026-10-13) — Notification routing + bug-report ACID + admin tables + validity top + bug emails

**Directive:** appropriate notification targets, table asc/desc sort, top-route correctness, bug-report ACID + pagination + screenshot viewing, user bug-email lifecycle with Studio visibility, deferred admin pagination bulk-safely, Vercel metadata type fix.
**Implemented:**

- `notificationRoutes` resolver (comment/post/follow/queue fallbacks) + notifications page + CommentList highlight + detail `?comment=` scroll + push payload via resolver.
- Bug-report Json cast fix + `BUG_REPORT_DEDUP_CONFIG` idempotency/dedup + atomic assign + `{id}` response + clientToken/error UI.
- `bugReportReceived` + `bugReportStatusUpdate` templates (service senders, status copy, studio samples, var catalog/sources); PATCH lifecycle fan-out.
- `ADMIN_TABLE_SORT_META` + `ADMIN_PAGINATION_META` + `useAdminCursorList`; `?sort=&dir=` on 4 admin APIs; sort + ViewMore on 4 pages; AppTable `aria-sort`; bugs screenshot viewer.
- Top-posts correctness filter + deterministic order (analytics + stats).
  **QA:** structural review in-runner (no node_modules); full gate deferred to CI.
  **Compliance:** additive-only, non-breaking, no migration.

## Session 2026-10-13 — Right-dock rounds, bug-report upload-before-submit, landmark geocode power-up

**Directive:** theme toggle + back-to-top buttons aligned right again (rest stay left); bug-report screenshot upload before the submit button (submit last); location providers to support landmark/building names/addresses (+ another keyless provider if needed). Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Implemented:**

- `FLOATING_UI_CONFIG.mobileDockSide` left→right (config-only; only BackToTop/ThemeToggle consume the dock side — banners/install/transient lanes untouched) + comment refresh in both buttons; sprint50 test expectation updated to right.
- `ConfigDrivenForm.beforeSubmit` optional slot (rendered fields → slot → submit; absent = legacy layout verbatim) + report-bug page passes `ReportImageUpload` through it with `isLoading={sending}` (submit stays last, disables while sending); ReportDialog already upload-before-actions, unchanged.
- Landmark power-up: `MapGeocodeProvider` += `overpass` (last in `geocodeOrder`, barrel-exported `LANDMARK_GEOCODE_CONFIG` min-4-chars/cap-5/10s tuning); `geocodeViaOverpass` (regex-escaped OSM `name` search via keyless overpass-api.de interpreter, canonical hits, timeout-guarded, never-throws) merged in `geocodeForward` with unknown-provider fallthrough; Nominatim `addressdetails=1&dedupe=1`; Photon labels now render street/housenumber/district/locality/county/postcode (was name/city/state/country only — addresses were dropped); proxy + RouteStepInput comments refreshed. All consumers (RouteStepInput/ShareRouteModal/search/explore) inherit via `/api/maps/geocode`, no client branching.
- Tests: NEW `__tests__/config/sessionTightening.test.ts` (7: right dock + lane clearance, order/upstream/tuning, photon street labels, overpass landmark surfacing, short-query gating, overpass-failure merge safety).
  **QA:** no node_modules in runner — `node --experimental-strip-types --check` green on all touched .ts files (mapStack, mapProxyService, floatingUi, config index, geocode route, new test); .tsx changes hand-verified (slot render order, page wiring); full tsc/jest/build deferred to CI (standing arrangement).
  **Compliance:** additive-only, non-breaking (no migration — overpass hits are runtime-merged, photon/nominatim shapes unchanged for callers, beforeSubmit optional, dock side is one config value; unknown future providers fall through safely).

---

**Session 2026-10-13 — location suggestions + Email Studio availability.**
**Directive:** location search/input not bringing suggestions since recent changes; Studio still showing one bug-report template.
**Implemented:**

- `app/lib/utils/rateLimit.ts` — per-bucket counters (`ip::bucket`); maps budget no longer starved by auth/search/posts traffic (the silent-429 suggestion wipe).
- `app/lib/utils/geoBias.ts` — NEW `peekBiasCoords()` + `getBiasCoordsQuick(120ms)`; keystroke suggestions never wait on a cold GPS fix.
- `RouteStepInput.tsx` / `ShareRouteModal.tsx` — quick bias, 429 keeps prior hits, failures leave the dropdown untouched.
- `RequestRouteModal.tsx` — From/To autocomplete dropdowns over `/api/maps/geocode` (debounced/abortable/bias-budgeted/429-safe); submit shape unchanged.
- `app/api/admin/email/templates/route.ts` + `app/lib/utils/emailTemplates.ts` — Studio GET merges via NEW exported `mergeEmailTemplatesWithDefaults` (stored wins, defaults backfill); save/delete/restore persist the raw row so backfills never snapshot.
- Tests: NEW `app/__tests__/config/locationSuggestions.test.ts` (7 suites).
  **QA:** no node_modules in runner — re-reads + balance-vs-baseline + diff-stat review green; full tsc/jest/build deferred to CI.
  **Compliance:** non-breaking, no migration, no new deps, additive-only.

**Session 2026-10-13 — broad location suggestions.**
**Directive:** suggestions only fired for near-exact address starts; must cover addresses, landmarks/buildings, roads, towns/cities, postal codes, states/countries, coordinates in any order, nearby-first with permission.
**Implemented:**

- NEW `app/lib/config/locationSuggestions.ts` — `LOCATION_SUGGESTIONS_CONFIG` + `parseCoordinateQuery` + `reorderQueryTokens` + `buildGeocodeUrl` (barrel-exported).
- `mapProxyService.geocodeForward` — parallel fast fan-out (`bounded` race), coordinate fast-path pinned first, empty-only fallback batch (overpass + reorder retry), Photon `lat/lon` + Nominatim `viewbox` rank-only bias, short TTL for empty merges.
- `GET /api/maps/geocode` + `RouteStepInput`/`ShareRouteModal`/`RequestRouteModal` consume the shared config (min 2 chars, 350ms debounce, limit 6).
- Tests: NEW `app/__tests__/config/locationSuggestBroad.test.ts` (13 suites).
  **QA:** no node_modules in runner — node-executed pure-logic port green, full re-reads + pre-existing-suite compat verified; full tsc/jest/build deferred to CI.
  **Compliance:** non-breaking, no migration, no new deps, additive-only.

**Session 2026-10-13 — blog share/SEO/defaults/variables + bug action modal.**
**Directive:** blogs need share + dynamic SEO (title/description/image); shipped defaults manageable in Blog Studio like Email Studio with rollback; Studio wants variables with guest fallbacks + insert-variable picker; bug reports need a modal for status + custom note + images/viewer.
**Implemented:**

- Share: NEW `BLOG_SHARE_CONFIG` (blogManagement) + NEW `blogShareService` (Web Share → clipboard → legacy, never throws) + NEW `BlogShareButtons` wired into `blog/[slug]` detail header (network links as progressive enhancement).
- SEO: `buildMetadata` += `ogType/publishedTime/authorName` (additive, cast to OpenGraph union); blog detail `generateMetadata` now per-post title/description (160-cap)/cover via `resolveOgImage`, `article` type, safe date parse; not-found branch uses honest noIndex metadata.
- Defaults: NEW `DEFAULT_BLOG_POSTS` (2 shipped posts with guest-safe `{{vars}}`) + `getDefaultBlogPosts/mergeBlogPostsWithDefaults/isDefaultBlogSlug` (stored-wins merge, same contract as emails); `GET /api/admin/blog` ships `{posts, defaults}`; `PUT {restoreSlug}` rollback (audited, cache-invalidated); Studio gains shipped-defaults rollback panel.
- Variables: NEW `BLOG_VARIABLE_CATALOG` (9 vars with documented fallbacks) + NEW `blogVariables` (`buildBlogVarContext`/`renderBlogContent`, escaped, never throws, guest/traveller identity fallbacks); detail renders managed HTML through it; NEW `BlogVariableInsert` picker in Studio appends tokens with `||fallback` to the last text block.
- Bugs: NEW `BUG_REPORT_ACTION_MODAL` copy; `PATCH /api/admin/bugs` accepts sanitized/capped `statusNote` overriding default copy in lifecycle emails + moderation outcome notifications; admin page gains action modal (status select + note + default preview + per-report screenshots opening the existing viewer); single/bulk/moderation all route through it (moderation keeps its confirm first).
- Tests: NEW `__tests__/services/blogShareVariables.test.ts` (share URL/fallback, guest fallbacks, leak-free render, defaults merge).
  **QA:** no node_modules in runner — brace/paren balance + full re-reads of all touched files, new-date guard + metadata cast reviewed; full tsc/jest/build deferred to CI.
  **Compliance:** non-breaking, no migration, no new deps, additive-only; config/metadata-driven throughout.

**Sprint 52 (2026-10-13) — audit trail reports+blogs + enriched defaults + featured carousel + Studio parsing.**
**Directive:** audit trail must capture report actions and blog actions; enrich default blogs (more posts, Blog Studio must parse without loss); ASD-STE100 writing, no emdashes; featured blogs section on landing (endless carousel, per-blog CTA + view-all CTA) reused on about (after reviews) and invite (after leaderboard); config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Found:** (1) report lifecycle wrote zero audit rows — `POST /api/reports`, `POST /api/bug-reports`, and admin bugs PATCH triage/moderation had no `logAudit` (blog upsert/delete/restore/bulk already audited); audit display had no `report` entity and no specific report/blog action labels. (2) only 2 shipped defaults, thin copy. (3) `htmlToBlocks` dropped bare inter-tag text, ignored section/article/figure/h4-h6/br tags, flattened block children in wrappers to one paragraph (or dropped them via the >300-char wrapper skip), and left empty logo-link remnants as URL-labelled link blocks. (4) no featured surface — blog discovery ended at /blog.
**Implemented:**

- Audit: `AUDIT_DISPLAY_CONFIG` += `report` entity + report.create/moderate/status + blog.upsert/delete/restore-default/bulk labels (specific prefixes ordered before generic `report.`/`blog.`); fire-and-forget `logAudit` in reports POST, bug-reports POST, admin bugs PATCH triage + moderation branches (never fail the request).
- Defaults: `DEFAULT_BLOG_POSTS` 2 → 6 (welcome, routing tips, fare guide, safety, how-maps-work, trust; STE100 short sentences, emdash-free, every `{{var}}` carries `||fallback`); stored DB rows still win per-slug so existing admin edits are untouched.
- Featured: NEW `FEATURED_BLOGS_CONFIG` (+ barrel) + NEW `FeaturedBlogsSection` (EndlessCarousel reuse, skeleton loading, null when empty, per-card Read CTA + section View-all CTA, tf() fallbacks with zero new locale keys); landing server-feeds `initialPosts` via `getPublicBlogPosts` + `pickFeaturedBlogs`; about renders after reviews; invite renders compact after leaderboard; `/api/blog?limit=` reused for client fetch.
- Parsing: `htmlToBlocks` keeps bare text, new container tags, `br` → spacer, h4-h6 → heading, block-child recursion (section-wrapped headings survive), empty-anchor-remnant drop; paragraph plain-text contract unchanged (pre-existing emailStudio suites assert it — verified green).
- Tests: NEW `__tests__/config/featuredBlogs.test.ts` (17 assertions: config/CTA/emdash, pick/cap/href, defaults coverage/vars, audit labels, parsing no-loss incl. section-heading + bare-text + logo-remnant cases).
  **QA:** no node_modules in runner — node strip-types executed 20+ pure-logic assertions green (featured pick/href, audit labels old+new, defaults count/emdash/fallbacks, builder round-trips for all 6 defaults + all 4 pre-existing emailStudio parser contract cases); full re-reads of all TSX/API diffs; full tsc/jest/build deferred to CI.
  **Compliance:** non-breaking, no migration, no new deps, additive-only; config/metadata-driven throughout; ASD-STE100 short-sentence copy on all new user-facing text; no emdashes in new copy.

**Sprint 2026-10-13 — Universal post cards + avatar menu + reviews tape (execute-feature).**
**Directive:** post menus/actions functional on every surface (feed, bookmarks page, profile tabs, search, detail); like/bookmark fill + firing parity; bookmarks + profile tabs get search filter; camera/avatar triggers incl. edit-modal entry; reviews carousel on landing/invite + footer review link; avatar + post-menu FAQs. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Found:** (1) dedicated /bookmarks used a custom compact list (no PostCard/menu/like/comment/map/TrustBadge) and rendered Saved time from post createdAt despite bookmarkedAt existing; (2) search cards omitted onLike/onDislike/onBookmark/onEdit (local-only toggles, no persistence) and GET /api/search had zero viewer enrichment; (3) ProfilePostCard never passed onEdit so PostMenu hid Edit on all profile tabs; (4) other-profile liked tab filtered to own author (always empty) with no isBookmarked alias and liked rows misattributed to the header; (5) no AvatarMenu existed (camera went straight to editor; avatar itself inert; edit modal had no avatar entry); (6) reviews tape only on About, footer had no review-form link, FAQ had no avatar entry and only fragmented post-menu coverage.
**Implemented:**

- Universal card: bookmarks page rewritten on ProfilePostCard (+ Saved bookmarkedAt line); SearchPage PostCard → ProfilePostCard (comment modal deduplicated into the card); feed/detail untouched.
- Parity: /api/bookmarks enriches \_isLiked/\_isDisliked viewer-scoped + bookmarkedAt passthrough; searchService accepts viewerId and overlays \_isLiked/\_isDisliked/\_isBookmarked on fresh and cached rows (guests false); /api/search threads getUserFromRequest; liked-tab guard + alias + attribution fixed.
- Edit in place: ProfilePostCard handleEdit routes ROUTE_REQUEST → RequestRouteModal else ShareRouteModal; handleEditSubmit PATCHes, updates feedStream + local override, toasts; nature preserved end-to-end.
- Search boxes: bookmarks + own/other profile tabs filter client-side (title/description/tags/author) with no-match empty state; tab switch clears query.
- Avatar: NEW AvatarMenu (view/change, config labels, dictionary overrides) + AvatarCameraBadge (always visible, desktop + mobile) + AVATAR_MENU_CONFIG; avatar click + badge open menu; EditProfileModal gains avatar row that closes the modal and opens the menu (text submit flow untouched).
- Reviews: NEW ReviewsCarouselSection (same EndlessCarousel + insertReviewCtaPanels cadence, skeleton, null when empty); landing renders below blogs, invite compact below blogs; footer Community += Leave a Review → /profile#reviews; en/pcm keys (footer.leaveReview, avatar.menu.\*).
- FAQ: NEW Routes & Posts post-menu-options (full menu matrix + cross-surface parity), NEW Profile & Avatar category (avatar-management end-to-end + avatar-not-showing cache note), where-reviews-appear updated; pcm twins for all four.
  **QA:** no node_modules in runner — tsc shows only missing-module noise (all files, pre-existing); targeted re-reads of all edited/created files; grep verified no direct PostCard use outside feed/detail, menu present on every card, locale keys resolve; full tsc/jest/build deferred to CI.
  **Compliance:** non-breaking, no migration, no new deps, additive-only; config/metadata-driven throughout.

**Sprint 2026-10-13 — Feed de-glitch + profile build fix (execute-feature).**
**Directive:** user feed must not glitch (sound arrangement/rendering algorithm, no redundant post rendering) + resolve the `tabQuery` duplicate-declaration Vercel build failure. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Found:** (1) `app/(dashboard)/profile/page.tsx` declared `const [tabQuery, setTabQuery]` (search-box state) AND `const tabQuery` (per-tab post-query URL) — same for `profile/[username]/page.tsx` (`useState` + query builder) — webpack `Identifier 'tabQuery' has already been declared`, build red; (2) score-ordered feed paginates on a createdAt cursor, so page N+1 legitimately re-scores rows already on screen — loadMore appended without dedup, producing the observed redundant rendering; (3) poll merges overwrote the pagination cursor with the page-one cursor (rewind → more duplicates); (4) home page re-subscribed to feedState$ on every posts change ([posts] dep) + double refreshFeed after submit (immediate + 800ms timeout) causing render churn/flash; (5) IntersectionObserver closed over a stale passiveFix; (6) useCachedFetch effect ignored url changes; (7) feed sort had no final tie-break (equal-score rows shuffled between fetches).
**Implemented:**

- Build fix: search-box state renamed `tabQuery` → `tabFilter` (+ `setTabFilter`) in both profile pages; query URL renamed → `tabPostsQuery` with a collision note; zero behaviour change otherwise.
- Server: feedService accepts `excludeIds` (sanitized, capped 200, `id: { notIn }` in all four candidate queries + backfill over-fetch so pages still fill); deterministic `id` tie-break after score/trust/recency; `/api/posts/feed` parses `?exclude=` and threads it through (guest recent-path honors it too).
- Stream: NEW `FEED_STREAM_CONFIG` (pageSize/pollIntervalMs/freshSec/retentionSec/maxExcludeIds, barrel-exported); exported `dedupePosts` invariant applied on every merge; poll prepends only genuinely-new rows and keeps the current cursor; loadMore passes rendered ids as exclude + `loadingMore` re-entrancy guard; `lastViewerLocation` retained so refresh/poll keep the nearby boost.
- Home: single fresh-count subscription via postsRef (no [posts]-dep resubscribe churn); identical-array emissions skip setPosts; single refreshFeed after submit; observer deps include passiveFix.
- Hook: useCachedFetch effect deps now include url (tab/query switches revalidate correctly).
- Tests: NEW `__tests__/config/feedDedup.test.ts` (order-preserving dedup, bad-id drop, empty, config sanity).
  **QA:** no node_modules in runner — tsc/jest/build deferred to CI (standing arrangement); grep verified zero remaining `tabQuery` identifiers in profile dir, `setTabFilter` wired (tab-switch reset + input), diff reviewed file-by-file for syntax coherence.
  **Compliance:** non-breaking, no migration, no new deps, additive-only (`exclude` optional; dedup preserves first-seen order); config/metadata-driven throughout.

**Session 2026-10-14 — Avatar consistency + profile avg + feed prompt (execute-feature).**
**Directive:** notifications/leaderboard/invite-leaderboard avatar consistency; other-profile Avg Score showed total not average + stats misaligned; own new post first on feed until refetch; new-posts pill reliable + auto-dismiss 30–60s/click. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Found:** (1) notifications/leaderboard/invite rendered raw initial-divs (no AppAvatar, no avatarConfig — leaderboard/invite APIs didn't even select it); (2) `[username]/page.tsx` computed avg as `rewardPoints/postCount` (a total) while own profile uses the post aggregate; stats bar nested the divider inside each cell (inline-block) vs own profile's sibling-divider flex; (3) `submitPost` went straight to `refreshFeed` (score-order hid the new row instantly); pill had hardcoded thresholds, no auto-dismiss, click neither cleared nor scrolled.
**Implemented:** `AVATAR_DISPLAY_CONFIG` + `asAvatarConfig` + API selects + `AppAvatar` on all three surfaces; by-username aggregate + client server-value preference + stats parity; `feedStream.prependPost` + submit pin/scroll + `FEED_NEW_POSTS_PROMPT_CONFIG` (45s/45s) + pill clear/scroll/refresh + auto-dismiss; NEW `feedTightening.test.ts`.
**QA:** no node_modules in runner — strip-types green (avatar/feedAlgorithm), full gate deferred to CI/Vercel.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-14 — Blog Studio image uploads + faithful preview (execute-feature).**
**Directive:** studio accommodates cover + inline picture uploads (logical URL handling, cleanup where desired, replacement-with-cleanup on edit); preview mirrors the actual blog page. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Found:** (1) cover was a bare text input — no upload, no validation, no preview; (2) image blocks were URL-only with no upload and no alt-text control; (3) public `[slug]` never rendered the cover (metadata-only) and list cards had no covers, so the Studio preview (title + reading-time + body) could not match the published page; (4) no cleanup path existed for replaced/removed blog assets (cleanup route only knew post/report sources and only guarded `Post.images`).
**Implemented:** `BLOG_IMAGE_CONFIG` + pure `blogImages.ts` (resolve/extract/collect/diff, never-throw); `/api/upload` blog policy (admin-gated) + cleanup blog sources with SiteConfig reference guard; reusable `BlogImageUpload` (cover/inline, eager upload, swap-now/purge-after-save) + shared `BlogPostArticle` (public page + preview render the same component); Studio baseline/pending tracking with post-commit best-effort purges; covers on detail/list/featured/tape; `sanitizeBlogPost` cover resolution; admin DELETE background purge; NEW `blogImages.test.ts` (7).
**QA:** full gate green in-runner — tsc 0 errors, jest 77/77 suites 656/656 tests, lint clean on touched files, `npm run build` clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-14 — Trust portal + admin collapse + scrollbars + feed diversity + loose search (execute-feature).**
**Directive:** desktop post-card trust breakdown out of view; admin collapsed sidebar hides icons; token-driven scrollbar styling; feed anti same-poster back-to-back shuffle preserving relevance; Spotify-style loose search (order-free, typo-tolerant, locations/descriptions/titles, best first). Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Found:** (1) `PostCard AppCard hover` lifts via `hover:-translate-y-0.5` — transforms re-anchor `fixed` descendants, so the viewport-computed tooltip flew off-screen on desktop hover (mobile/detail have no hover transform — matched the report); (2) collapsed `NavLink` stacked `px-4` + `px-2` (px-4 won) with `mx-3` + 20px icon = 76px in a 72px `overflow-hidden` rail; (3) zero custom scrollbar styles existed; (4) pure score sort clustered same-author runs; (5) single-phrase `contains` recall missed order-swapped ("B from A") and typo'd queries.
**Implemented:** `TrustBadge` portal to document.body + edge-aware anchor/flip/height-cap + hover-bridge delay + tooltip knobs in `TRUST_DISPLAY_CONFIG`; conditional rail spacing + shrink-0 icons; token-driven scrollbar CSS + `.scroll-thin`/`.scroll-stable` + `SCROLLBAR_CONFIG`; `FEED_DIVERSITY_CONFIG` + pure `applyFeedDiversity` wired post-sort/pre-slice (SiteConfig `feedDiversity` merge); `SEARCH_CONFIG` + pure tokenize/levenshtein/coverage/relevance + two-phase recall + in-memory rank + index cursor in `searchService` (same envelope); NEW `feedSearchTightening.test.ts` (19), ranked-semantics updates to `searchService`/`api/search` suites.
**QA:** full gate green in-runner — tsc 0 errors, jest 78/78 suites 679/679 tests, lint clean on touched files, `npm run build` clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-14 — Studio tightening: blog reorder/CTA, sticky previews, feedDiversity card, zero-result analytics (execute-feature).**
**Directive:** blog studio blocks move up/down like email studio; buttons styled like CTA buttons not links; generous preview max-heights with scrollability (studios + avatar editor, mostly large screens); session-log futures — feedDiversity Studio card + zero-result query analytics. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Found:** (1) blog blocks lacked `moveBlock`/up/down UI email had; (2) buttons deliberately degraded to links per prior dark-mode decision — directive overrides, so CTA had to be token-CSS not inline styles; sanitizer allowed no `class` at all, so any CTA class would be stripped; (3) previews used short fixed max-h (420/640px) with no stickiness — tall editors scrolled previews out of view; avatar grid fixed 320px with no sticky preview; (4) `feedDiversity` had merge logic but no Studio card and no write validation; (5) no zero-result search signal existed for tuning stopwords/fuzzy.
**Implemented:** `STUDIO_LAYOUT_CONFIG` + style builders; blog `moveBlock` + Email-identical controls; `blocksToBlogHtml` CTA markup + `BLOG_CTA_CLASS_ALLOWLIST` + `htmlToBlocks` blog-cta round-trip + `.blog-cta` token CSS; sticky generous previews in Email/Blog/AvatarEditor; diversity KEY/META/normalize/validate + API guard + editor entry + Config card (save/reset); `SEARCH_ANALYTICS_CONFIG` + pure query/payload helpers + fire-and-forget AnalyticsEvent logging + analytics aggregation + admin section; NEW `studioTightening.test.ts` (4), CTA + allowlist suites in `blogCompliance.test.ts`.
**QA:** full gate green in-runner — tsc 0 errors, jest 79/79 suites 684/684 tests, lint clean on touched files (sole error pre-existing elsewhere), `npm run build` clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-14 — Media cross-post guard + share icons + feed first-load (execute-feature).**
**Directive:** critical Cloudinary cross-post deletion on new-post/edit flows + desktop share buttons need per-platform icons + feed first-load skeleton must persist until truly ready. Config/metadata-driven, reusable modular, non-breaking + update-ai-system chain.
**Found:** (1) edit/delete/admin-bulk/moderation cleanup paths bypassed the live-post reference guard only the draft/composer endpoint had — shared eager-upload URLs across posts meant one post's edit/delete destroyed another live post's image; (2) blog share desktop row hardcoded one generic icon with no config icon field, and lucide has no X/WhatsApp brands; (3) feed painted stale/non-geo snapshots then re-ranked silently (background revalidate + geo second fetch) with per-fetch `Math.random()` jitter guaranteeing visible reshuffles.
**Implemented:** `guardLivePostReferences` + `filterUnreferencedUrls` choke-point guard (fail-open, TOCTOU-closing, `skippedReferenced` observability) with upload/cleanup delegating to it; `BlogShareNetworkIcon` keys + `ShareNetworkIcon` (Facebook lucide, inline X/WhatsApp SVG, generic fallback); `FEED_FIRST_LOAD_CONFIG` + `seededRand` + home `isReady` single-fetch gate with pre-ready emission hold. NEW `tighteningMediaShareFeed.test.ts` (9) + `ShareNetworkIcon.test.tsx` (2); `mediaCleanup.test.ts` +4.
**QA:** full gate green in-runner — tsc 0 errors, jest 81/81 suites 697/697 tests, lint clean on touched files, `npm run build` clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.
**Directive:** design-system-compliant push banner in dark theme; traffic from employed or new keyless providers for map + navigation with durations, yellow/red segments, "i" legend, FAQ/README updates.
**Found:** (1) push banner used 15%-alpha info fill in dark (invisible on Android); (2) no employed provider has keyless traffic — Mapbox congestion and TomTom flow are keyed-only; honest keyless = deterministic rush-pattern estimate labeled as such; (3) RouteMap hooks-after-early-return lint violations pre-existing.
**Implemented:** opaque `PUSH_PROMPT_CONFIG.surface` + restyle; `TRAFFIC_CONFIG` + `trafficService` + `/api/maps/traffic` + `useRouteTraffic` + RouteMap overlays + `TrafficLegend` + guide/modal durations + post-detail wiring + hook-order fix; FAQ/README/env docs; NEW `traffic.test.ts` (12).
**QA:** full gate green in-runner — tsc 0 errors, jest 82/82 suites 709/709 tests, lint clean on touched files (4 pre-existing errors fixed), `npm run build` clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-15 — Feed inclusion + PostCard follow + request labels/FAQ + traffic tightening (execute-feature).**
**Directive:** feed must not exclude own/non-followed posts; inline follow beside post author (mobile icon, desktop text, hidden when following); route-request FAQ; visible "Request a route" text in/beside the trigger; TomTom + legacy traffic tightening.
**Found:** (1) feed exclusion was a ranking gap, not a filter gap (own 0.15 vs followed 0.7); (2) no card-level follow affordance or status endpoint; (3) request labels lived only in aria attributes; (4) no route-request FAQ; (5) traffic live-computed (legacy safe) but (0,0)-tolerant, untrimmed keys, fragile TomTom indexing, unguarded provider loop.
**Implemented:** explicit own-posts pool at `ownPostsWeight` (= followingWeight); `POST_FOLLOW_CONFIG` + follow-status GET + `useFollowStatus` + FollowButton responsive variant + `PostCardFollow`; in-button responsive request labels (trigger + composer); `route-requests` FAQ + PCM + locale keys; traffic trim/strip/index/guard hardening.
**QA:** full gate green in-runner — tsc 0 errors, jest 83/83 suites 723/723 tests, lint clean on touched files, `npm run build` clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-15 — Feed out-of-network discovery guarantee (execute-feature).**
**Directive:** feed must include posts from users outside the viewer's network; suggestions carousel showed a non-network route request the feed omitted.
**Found:** candidate-generation gap (not a filter gap): trending 7-day + engagement-ordered, tag needs activity overlap, recent window tiny — quiet/older/tag-less stranger posts (notably open requests) never entered the candidate set while suggestions always surfaces them.
**Implemented:** two explicit discovery pools (open requests from non-followed, no age window; general recent from anyone not followed) at `discoveryWeight` 0.5 + `openRequestWeight` 0.6 (+0.05 recency), spread-merge safe, non-finite → default.
**QA:** full gate green in-runner — tsc 0 errors, jest 84/84 suites 728/728 tests, lint clean on touched files, build deferred to CI/Vercel.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-15 — Design-system visibility + Config Studio parity (execute-feature).**
**Directive:** vehicle flags/icons (post cards + details) and enabled/linked/tier shield icons/text in profile tabs (connected accounts + points) unreadable in light theme; hardcoded admin-config defaults on the config page with no-code editing, DB-aware + default-rollback like email/blog studios.
**Found:** near-white `-50` vehicle washes with no border; `bg-success/error text-white` white-on-pastel pills (AuthLinkPanel, admin email/users, notifications) — same class as the earlier EmailSecurityPanel fix; raw metallic tier hues in RewardsPanel/AppUserLabel; TrustBadge hardcoded hex; config API DB-rows-only with no defaults/restore/audit/idempotency.
**Implemented:** `-100` washes + per-type `borderClass` + bordered semibold chips; tokenized TrustBadge + border; `REWARD_TIER_DISPLAY`/`rewardTierPillClass` + all pill fixes; `ADMIN_CONFIG_DEFAULTS`/`mergeAdminConfigsWithDefaults`/`validateAdminConfigValue`/`ADMIN_SIMPLE_CONFIG_CARDS`/`ADMIN_DEDICATED_CONFIG_KEYS` + merged GET/virtual rows/`defaults` catalog + `restore` + audit + idempotent DELETE + page badges/cards/raw-list split.
**QA:** full gate green in-runner — tsc 0 errors, jest 85/85 suites 736/736 tests, lint clean on touched files, build deferred to CI/Vercel.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-15 — Community route-request fan-out + location-only draft restore (execute-feature).**
**Directive:** route-request notifications must fire whether or not any follow relationship exists; draft saving must survive when the only input is a location (location vanished on restore while fuller drafts kept it). Install node modules + proper QA. Config/metadata-driven, modular, non-breaking + update-ai-system chain.
**Found:** (1) POST `/api/posts` ROUTE_REQUEST branch fanned out to `getFollowerIds` only — `createNotification` no-ops on `[]`, so non-followed members never heard; (2) `ShareRouteModal.applyDraft` gated `setSteps` on `draft.steps.length >= 2` — a location-only draft persists as 1 step, so restore never ran and the composer kept empty rows (plus `if (draft.title)` left stale titles); (3) `legacyToDraft` hasContent ignored description/tags.
**Implemented:** NEW `config/routeRequestAudience.ts` (community default, 500 cap / 1–5000 bounds, excludeDeleted, SiteConfig key + normalize/validate + admin meta) + barrel; `notificationService.getRouteRequestAudienceIds` (followers-first, then recent non-deleted members to cap, self excluded, never throws, followers-only legacy mode); ROUTE_REQUEST branch uses the audience with followers fallback; admin registration (editors + defaults + central validation + no-code card); applyDraft 1-step → Origin + empty Destination with coords, unconditional title reset; legacy hasContent matches hasUsableContent; FAQ who-sees-request (en + pidgin) states community-wide notification.
**QA:** full gate green in-runner (`npm install` ok): `npx tsc --noEmit` 0 errors; `npx jest` 86/86 suites 742/742 tests (NEW routeRequestAudience 4, routeDrafts +2, posts community-audience case); `next lint` zero findings on touched files (pre-existing errors in untouched files left alone); build deferred to CI/Vercel (needs DB URL).
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-15 — Optimistic location-aware route-request fan-out + notification preferences (execute-feature).**
**Directive:** PM-conversation verdict + optimistic location filtering without privacy violations (graceful fallback to Sprint 62 everyone-notified); preferences modal via gear icon on notifications page (defaults = current behaviour, NULL-safe); FAQs + docs. Install modules + QA. Config/metadata-driven, non-breaking + update-ai-system chain.
**Verdict:** install→push PARTLY TRUE (permission-gated); follow-free broadcast TRUE; "we don't store location" FALSE (`lastKnownLat/Lng` nullable/consented/feed-boost/deletion-cleared — corrected in copy); background-limits LARGELY TRUE; webhook-storage block TRUE-ish; mobility/familiarity TRUE → optimistic-filter + guaranteed fallback.
**Found:** audience fn location-blind; no prefs store/API/UI; POST dropped request fixes; FAQ had no location/preferences story.
**Implemented:** audience `location { enabled, radiusKm, minNearby }` + ephemeral-fix fan-out (nearby-only when `>= minNearby`, else full fallback; coords never persisted/logged/exposed); POST `requestLat/requestLng` passthrough; `notificationPreferences` config + `NotificationPreference` model/migration + service + central `createNotification` filter + `GET/PUT /api/notifications/preferences`; cached-only bias attach in RequestRouteModal; gear + `NotificationPreferencesModal`; FAQ `who-sees-request` update + `request-location-filtering` + `notification-preferences` (en+pcm) + push note.
**QA:** full gate green in-runner — tsc 0 errors, jest 87/87 suites 750/750 tests, lint clean on touched files, next build clean.
**Compliance:** non-breaking, one additive table + additive optional fields only, never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-15 — Offline coverage for landing/profile/notifications + authenticated-offline guest-banner fix (execute-feature).**
**Directive:** cached pages + offline functionality should include landing, profile, notifications end-to-end with configs (offline info page) reflecting it; guest banner must not show for still-signed-in users going offline. Install modules + proper QA. Config/metadata-driven, non-breaking + update-ai-system chain.
**Found:** precache guest-shell only with no documented runtime path for protected pages; "/api/posts/" trailing-slash prefix never matched query-form profile URLs + /api/users|rewards|bookmarks missing; AuthProvider booted null so offline reloads read as guest; CachedDataNotice only on /notifications.
**Implemented:** NEW `config/authOffline.ts` (7-day TTL server-confirmed session snapshot, corrupt/stale-safe) + barrel; AuthProvider sync-hydrate + refresh-on-200 + clear-on-genuine-401/logout; GuestBanner offline-with-snapshot suppression; pwa.ts v5→v6 (destinations += landing + runtimeCached /profile + /notifications, cacheable APIs += bare /api/posts fix + /api/users + /api/rewards + /api/bookmarks); sw.js v6 mirror; offline.html + FAQ (en+pcm) list all 9 pages with visited-while-online caveat; NEW `LandingOfflineNotice` island; CachedDataNotice on both profile pages.
**QA:** full gate green in-runner — tsc 0 errors, jest 88/88 suites 757/757 tests, lint clean on touched files, next build clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-16 — Post-card detail links + response-banner dismiss + vehicle contrast (execute-feature, Sprint 65).**
**Directive:** route text (in addition to title) should route to the detail post view from the card (except tags/maps with own actions); share-route modal needs an X on the respond-to-request banner to dismiss it (changed mind / post something else first / add another draft); vehicle icons still low-visibility in light theme — darken text for badge/app contrast. Install node modules + proper QA. Config/metadata-driven, non-breaking + update-ai-system chain.
**Found:** (1) PostCard title linked but description + route-step text were inert `<div>`/`<p>` — no path to detail except the title; (2) response banner had no exit — a user who opened Respond (or restored a response draft) could only close the whole modal, losing flow; prop-owned `responseTo` (home) and post-derived `responseTo` (detail) needed different clearing paths; (3) vehicle light labels sat at `-800` on `-100` washes — readable but thin against white cards (plus a stray trailing space in the taxi entry); `vehicles.test.ts` pinned `-800` literally.
**Implemented:** `POST_ACTIONS_CONFIG` += `detailTextLinksEnabled`/`detailDescriptionClass`/`detailRouteStepClass`; PostCard description + step location/description render as encoded-`postPath` Links with stopPropagation + aria-labels (tags/maps untouched; title uses the same helper); `SHARE_ROUTE_MODAL_CONFIG` += `responseBannerDismissLabel/Title`; ShareRouteModal += optional `onClearResponse` + `dismissResponse` (restored-linkage clear + parent callback, modal stays open, input/tags/images preserved, hidden in edit mode since linkage is immutable); home stable `clearRespondTo` (Escape-listener-safe); post-detail `respondUnlinked` gate reset on open/close/submit; `VEHICLE_REGISTRY` light text `-800`→`-900` all 9 types; NEW `postCardDetailLinks.test.ts` (4) + vehicles test updates.
**QA:** full gate green in-runner (`npm ci` ok): `npx tsc --noEmit` 0 errors; `npx jest --ci` 89/89 suites 761/761 tests; `next lint` exit 0 (1 pre-existing `prefer-const` error in untouched `accountDeletionService.ts` + pre-existing warnings, none on touched files); full `next build` clean.
**Compliance:** non-breaking, no migration, no new deps, additive-only with never-throw fallbacks; config/metadata-driven throughout.

**Session 2026-10-16 — Config studio links + vehicle badge readability (execute-feature, Sprint 66).**
**Directive:** admin Config page blog/email portions should link to the admin blog/email pages; vehicle badge text/icons need light-theme readability work modeled on the route-request flag (visible in both themes).
**Found:** Config page owned an inline `emailConfig` sender card while the Email Studio lacked sender editing; studio-managed rows (`blogPosts`/`emailTemplates`/`emailTemplateToggles`) could surface as raw JSON; vehicle flags still pale (`-100`/`-300`) vs the route-request flag's saturated pairing.
**Implemented:** `ADMIN_STUDIO_MANAGED_KEYS` + `ADMIN_STUDIO_LINKS` metadata (barrel-exported); Config page link cards with Customized badges, raw list hides studio keys; `emailConfig` dropped from simple cards (defaults/validator/API/service untouched); Email Studio Sender identity card (config-API backed); vehicles `-200`/`-400` + chip shadow + heavier icon stroke (PostCard/detail/NavigationGuide inherit via registry).
**QA:** static in-runner only (no node_modules; tsc/jest/build deferred to CI, expected 89 suites / 762 tests). Re-read verified: balanced hunks, barrel parity, no stale vehicle grades, `emailConfig` reads intact.
**Compliance:** non-breaking, additive-only with fallbacks; config/metadata-driven throughout.

## 2026-10-16 — Sprint 68: navigation-guide map parity + tracing tooltips

**Summary:** The navigation/route-guide map now renders the SAME traffic data and tracings as the post detail map with zero re-retrieval (`LiveNavigationModal.trafficOverride`, one lookup serving both surfaces); expanding the map from inside the guide no longer vanishes behind the modal (expand overlay z-50 → z-[70], above the live modal's z-[60]); tapping tracings opens config-driven tooltips — per-stretch traffic level + estimated time + distance on detail/nav maps over a wide invisible tap line, and a rate-limit-friendly quick-link card (View post / Open navigation guide) on feed minis. All config/metadata-driven (`mapTooltips.ts` registry + pure helpers), non-breaking (optional props only, tooltips never throw, minis add zero network calls).
**QA:** tsc 0 errors; jest 91/91 suites 790/790 (NEW mapTooltips 15); next lint clean on touched files; next build clean.
**Files:** NEW `app/lib/config/mapTooltips.ts` + `app/__tests__/config/mapTooltips.test.ts`; edited `RouteMap.tsx` (`expandable`/`tooltipMode`/`detailHref`/`navigateHref`/`postTitle`, hit layer, stretch + mini Markers), `LiveNavigationModal.tsx` (`trafficOverride`), `PostCard.tsx` (mini tooltip wiring), `posts/[id]/page.tsx` (shared traffic into modal, explicit detailed mode), `mapStack.ts` (expand z-[70]).

## 2026-10-16 — Sprint 69: leg-aware stretch tooltips + summary-bar tightening

**Summary:** Stretch tooltips now reflect the leg actually tapped — pin borders on the snapped trace split the route into origin→stop→destination legs, each tap reports that leg's worst traffic level plus its polyline-length share of time/distance with "Stretch N of M" + "A → B" labels, anchored at the tap point so it never hides off-screen; every summary bar (detail map overlay, live-nav map overlay, share preview, guide header + live banner) is guarded by a shared registry so loading/zero values hide instead of flashing "0 min with traffic (was 1h 6m)", and total fare (travelling legs only, destination excluded) now shows everywhere. Remaining distance/time in the live guide shrink as the user advances (manual or auto-advance). All config/metadata-driven (`mapSummary.ts` + extended `mapTooltips.ts` + `totalFareForSteps`), non-breaking (additive optional props + additive pure helpers only, tooltips/summaries never throw).
**QA:** tsc 0 errors; jest 93/93 suites 806/806 (NEW mapSummary 10 + routeLegs 8); next lint clean on touched files (fixed unused import + prefer-const); next build clean.
**Files:** NEW `app/lib/config/mapSummary.ts` + `app/__tests__/config/mapSummary.test.ts` + `app/__tests__/config/routeLegs.test.ts`; edited `mapTooltips.ts` (leg helpers), `routeSteps.ts` (`totalFareForSteps`), `RouteMap.tsx` (leg-aware taps at tap anchor, guarded overlay), `NavigationGuide.tsx` (`totalFare`, guarded + dynamic remaining bars), `LiveNavigationModal.tsx` (`totalFare` forward), `posts/[id]/page.tsx` (detail distance/duration/fare truth), `ShareRouteModal.tsx` (shared fare total, hide ₦0), `accountDeletionService.ts` (lint prefer-const).

## 2026-10-16 — Sprint 70: consistent journey totals + resilient traffic cache + docs

**Summary:**
Header journey totals (post-detail map overlay + route-guide header) now render as a free-flow–with-traffic range whose bounds the per-stretch times sum to by construction, and the traffic overlay survives remounts, geometry swaps, and flaky networks via a persistent layered cache with background refresh — fixing both halves of the directive (inconsistent totals, vanishing traffic). FAQs, privacy, terms, and README updated to match (location FAQ shortened, pidgin twins kept).

**Completed:**

- Consistent totals: `mapSummary.ts` += `formatDurationRange` + `splitMinsByWeights` (largest-remainder sum contract) + `rangeSeparator`/`rangeTitle`; `journeyTime.ts` += `legTrafficFactor`; `RouteMap` consistent leg splits + range overlay/tooltips; `NavigationGuide` range header + range remaining banner
- Resilient cache: `traffic.ts` += `rebaseTrafficResult` + `trafficClientKey` + client knobs (300s/600s/120s/900ms); `useRouteTraffic` memory → localStorage read-through, geometry-scoped keys, stale-while-revalidate, mounted background refresh, silent-fail keeps last good
- Docs: FAQ traffic/time rewrite + legend stretch hint + shortened location FAQ (en+pcm); privacy location/traffic/offline/retention sections; terms traffic-estimate + deletion-grace sections; README range + caching strategy
- Tests: NEW `journeyConsistency.test.ts` (10 assertions)

**QA:** tsc 0 errors; jest 94/94 suites 816/816; lint clean on touched files; build clean.

**Files:**

- Edited: `lib/config/{traffic,mapSummary,journeyTime,index,faq}`, `lib/hooks/useRouteTraffic`, `components/features/posts/{RouteMap,NavigationGuide}`, `(public)/{privacy,terms}/page`, `README.md`
- Created: `__tests__/config/journeyConsistency.test.ts`

## 2026-10-18 — Sprint 75: notice tightening — safe refresh + rich announcements + tag limits + map picker scroll

**Summary:**
The platform now has an admin-configurable post-maintenance "kindly refresh" strip that safely reboots the client (clears stale caches + unregisters the service worker + cache-busted reload) while positively preserving drafts, the offline auth snapshot, and user preferences — plus multi-announcements with optional CTAs, unified config-driven tag limits with toasts/honest placeholders, an opaque dark-theme maintenance surface, and a scrollable stop-assignment card. Everything config/metadata-driven, non-breaking (legacy announcement string still renders; shipped defaults backfill new keys; request-form tag cap loosened 5→10).

**Completed:**

- Dark-theme fix: `--color-warning-surface` opaque token (light `#FEF3C7`, dark `#3B2F14`) used by maintenance + offline strips
- Refresh notice: `refreshNotice` key (default OFF) + admin card below Maintenance + `safeClientRefresh.ts` (protected-key storage clear + Cache Storage wipe + SW unregister + cache-bust reload; cookies untouched; fail-open) + strip with Refresh button
- Rich announcements: `announcements` key (max 5, CTA label+href, `isSafeAnnouncementHref` gate) + `normalizeAnnouncements` + per-id dismiss + CTA strip rendering + bespoke no-JSON admin list editor + central validator + legacy banner preserved
- Tags: `ROUTE_TAG_CONFIG` (10×30) in both modals + comma parsing + limit/length toasts + placeholder copy + Zod backstop (trim/`#`-strip/reject over-limit) + drafts sanitizer aligned
- Map picker: `cardMaxHeight` 42vh + scrollable option list in `RouteMap`
- i18n: en + pcm refresh keys; locale parity enforced

**QA:** tsc 0 errors; jest 105/105 suites 1042/1042 (NEW siteNotice 12); lint 0 new issues; build clean.

**Files:**

- Created: `lib/config/{routeTags,safeRefresh}.ts`, `lib/pwa/safeClientRefresh.ts`, `__tests__/config/siteNotice.test.ts`
- Edited: `lib/config/{siteNotice,admin,mapPicker,index}`, `lib/schemas/post`, `lib/services/routeDraftsService`, `api/site-config/route`, `components/ui/SiteNotices`, `components/pwa/OfflineBanner`, `components/features/posts/{ShareRouteModal,RequestRouteModal,RouteMap}`, `admin/config/page`, `globals.css`, locales, tests

## 2026-10-18 — Sprint 76: refresh-notice once-flag + catch-all note

**Summary:**
The "maintenance over — kindly refresh" strip no longer re-nags users who already tapped Refresh now. A locally persisted once-flag (`along-safe-refresh-done-at`, written by `safeClientRefresh` itself, preserve-whitelisted through its storage clear, 7-day TTL) suppresses the strip for already-refreshed browsers, and a config-driven catch-all note ("Already refreshed or updated? You can ignore this notice.") covers manual-refresh / lost-flag edge cases. Non-breaking: first-time viewers of an enabled toggle still see the strip exactly as before.

**Completed:**

- Once-flag config: `SITE_NOTICE_CONFIG.refresh` += `completedAtKey` + `completedTtlMs` (7d, mirrors push-dismiss window) + `copy.refresh.note` + `i18nKeys.refreshNote` + pure `isSafeRefreshCompleted` helper (garbage/missing/expired → not completed, fail-open visible)
- Flag preservation: `along-safe-refresh-done-at` on `SAFE_REFRESH_CONFIG.preserveLocalStorageKeys` (survives the refresh's own storage sweep)
- Flag recording: `safeClientRefresh` writes the timestamp at sequence start (before the clear) — self-recording for every caller
- Strip behavior: `SiteNotices` reads the flag in a mount-only SSR-safe effect; `refreshVisible = refreshNotice && !refreshDone`; catch-all note rendered as a smaller italic muted line
- i18n: `siteNotice.refreshNote` in en + pcm; locales REQUIRED_KEYS parity

**QA:** tsc 0 errors; jest 105/105 suites 1047/1047 (+5 new); lint clean on all six touched files; build clean.

**Files:**

- Edited: `lib/config/{siteNotice,safeRefresh,index}`, `lib/pwa/safeClientRefresh`, `components/ui/SiteNotices`, locales `{en,pcm}`, `__tests__/config/{siteNotice,locales}.test.ts`

## 2026-10-18 — Sprint 77: post-migration DB pool exhaustion + MapLibre null warnings

**Summary:**
Fixed the production 500s that hit every DB-backed route after the Supabase migration (feed cursor pages, reviews, blogs, site config/stats, intermittent auth/me) — the runtime PrismaClient was resolving the SESSION-mode pooler (DIRECT_URL, port 5432, hard-capped at the dashboard Pool Size, commonly 15) while pg opened `max: 10` per warm Vercel instance, so any real concurrency hit `EMAXCONNSESSION`. Runtime URL precedence now prefers the TRANSACTION-mode pooler (prod `DATABASE_URL → …`, dev `LOCAL_DB → …`; CLI stays DIRECT-first), backed by a new config-driven `dbPool.ts` (small per-instance pool via `DB_POOL_MAX` default 5, connect timeout 5s, idle release, `prepare: false` iff transaction-mode — Supavisor rejects prepared statements there), a globalThis Prisma singleton in every env, and a one-time production warn on a session-mode resolution. Also shipped a same-origin sanitized map-style proxy (`GET /api/maps/style?name=`) that coalesce-wraps data-driven numeric style expressions with config fallbacks, silencing the MapLibre "Expected value to be of type number, but found null instead" console warning class (maplibre-gl-js#7856) for every renderer. Non-breaking: no migration, no removed APIs, same response shapes.

**Completed:**

- `app/lib/config/dbPool.ts` (new): `DB_POOL_CONFIG`, `isTransactionModePoolerUrl` (6543/pgbouncer flag), `isSessionModePoolerUrl` (warn signal), `buildPgAdapterOptions` (max 5 via `DB_POOL_MAX`, connect 5s, idle 10s, allowExitOnIdle, prepare:false iff tx-mode); barrel exports
- `resolveDatabaseUrl()` precedence fix + `.env.example` two-pooler contract docs + optional `DB_POOL_MAX` / `DB_CONNECT_TIMEOUT_MS` / `DB_IDLE_TIMEOUT_MS` knobs
- `prisma.ts`: globalThis singleton in every env; pooler-aware adapter; one-time production session-mode warn
- Style proxy: `mapStyleSanitize.ts` (new pure sanitizer), `mapProxyService.getMapStyleDocument` (Redis read-through + stale-on-error), `app/api/maps/style/route.ts` (new), `vectorStyleUrl` → proxy path, apiRegistry + sw.js cacheable entries
- Tests: `dbPool.test.ts` (new, 15), `mapStyleSanitize.test.ts` (new, 7), mapStack proxy tests (+4)

**QA:** tsc 0 errors; jest 107/107 suites 1071/1071 (+2 suites, +24 tests); lint clean on touched files; build clean (`/api/maps/style` live in route manifest).

**Files:**

- Created: `lib/config/dbPool.ts`, `lib/utils/mapStyleSanitize.ts`, `api/maps/style/route.ts`, `__tests__/config/dbPool.test.ts`, `__tests__/utils/mapStyleSanitize.test.ts`
- Edited: `lib/config/{env,mapStack,apiRegistry,index}.ts`, `lib/db/prisma.ts`, `lib/services/mapProxyService.ts`, `public/sw.js`, `.env.example`, `__tests__/config/mapStack.test.ts`, ai-system docs

## 2026-10-18 — Sprint 78: SEO title suffix single-source + feed page size 20 + pagination compliance sweep (Issue #25)

**Summary:**
Eliminated the ` | Along | Along` double title-suffix on every page by making the root layout `title.template` the single suffix authority (`DEFAULT_META.titleSuffix` in `app/lib/config/seo.ts`; metadata builders compose OG/Twitter titles once — Next never templates those fields), raised the feed default page size from 10 to 20 everywhere (server fallback, `DEFAULT_FEED_CONFIG`, `FEED_STREAM_CONFIG`, zod schema), and ran a platform-wide pagination compliance sweep: a new central `PAGINATION_CONFIG` + `clampPageLimit` now gates every cursor route (search, notifications, comments, bookmarks, reviews, admin lists, users-search, followers/following), every cursor query carries an id sort-key tiebreaker, the notifications Redis key includes the effective limit (the badge `limit=1` poller can no longer poison the page-20 first-page cache), `feedStream` treats transient fetch failures as retry-with-backoff instead of end-of-list (exponential backoff via config knobs, chained single retry timer, self-healing initial failure state), and every previously first-20-only list gained config-driven cursor load-more (followers/following + post-detail comments via `ViewMoreButton`; all six profile tabs via the new reusable `useCursorList` hook). Non-breaking: response shapes additive (`{users, nextCursor}`), no migration, no new deps.

**Completed:**

- SEO: `DEFAULT_META.titleSuffix` single source; root template `%s${suffix}`; bare titles in `buildMetadata`/`buildPostMetadata`/`buildProfileMetadata`; admin layout "Admin"; metadata tests rewritten with source-scan regression rejecting manual ` | Along` literals
- `app/lib/config/pagination.ts` (new): `PAGINATION_CONFIG` surfaces + `clampPageLimit`; feed default/max 20/50
- Feed 20-cap: `api/posts/feed` + `api/posts` clamp via config; `DEFAULT_FEED_CONFIG.pageSize` + `FEED_STREAM_CONFIG.pageSize` = 20; `FEED_QUERY_SCHEMA` defaults from config; id tiebreakers
- Server sweep: clamp on 13 route/service files; notifications cache limit-in-key + `notificationsAll` enumeration; audit service clamp + sort key
- feedStream hardening: `fetchFeed` → `null` on failure, `hasMore` preserved, `errorRetryBackoffMs`/`errorBackoffMaxMs` exponential backoff + chained retry
- Load-more: followers/following cursor pages + `UserList` ViewMoreButton; post-detail appended-comment windows; profile tabs via `useCursorList` on both profile pages; admin audit dedupe/in-flight guard; explore + search + badge-endpoint literals moved to config
- Lint fixes in touched files: feed route 5× `no-explicit-any` → `unknown[]` typed casts (P2022 pattern from `posts/route.ts`); admin bugs rules-of-hooks false positive via module-scope alias

**QA:** tsc 0 errors; jest 108/108 suites 1119/1119 (+1 suite, +7 tests); lint clean on touched files; build clean.

**Files:**

- Created: `lib/config/pagination.ts`, `lib/hooks/useCursorList.ts`, `__tests__/config/paginationCompliance.test.ts`
- Edited: `lib/config/{seo,feedAlgorithm,index,cache,admin,navigation}.ts`, `app/layout.tsx`, `app/admin/layout.tsx`, `lib/utils/metadata.ts`, `api/posts/{feed,route}.ts`, `api/{search,users/search,notifications,bookmarks,reviews}/route.ts`, `api/posts/[id]/comments/route.ts`, `api/admin/{posts,users,reviews,bugs,deletions,audit}/route.ts`, `api/users/[id]/{followers,following}/route.ts`, `lib/services/auditService.ts`, `lib/schemas/post.ts`, `lib/streams/feedStream.ts`, `admin/{audit,bugs,deletions,posts,reviews,users}/page.tsx`, `(dashboard)/{explore,search,posts/[id],profile,profile/[username]}/page.tsx`, `components/features/{explore/ExploreSearchInput,profile/UserList}.tsx`, `__tests__/utils/metadata.test.ts`, ai-system docs

## 2026-10-18 — Sprint 79: Legacy announcement-banner deprecation + bug-report pipeline tightening (Issue #25)

**Summary:**
Five-workstream close-out of the issue #25 directive, non-breaking (no migration, no removed API fields, config-driven throughout). (1) The legacy single-string `announcementBanner` SiteConfig key — superseded by the rich `announcements` list — is now actually deprecated: its admin SimpleConfigCard and editor registration are removed, a new `ADMIN_DEPRECATED_CONFIG_KEYS` list (folded into `ADMIN_DEDICATED_CONFIG_KEYS`) hides it from every admin surface including the raw JSON list, and the `SiteNotices` legacy strip no longer renders; the shipped default, validator, and `/api/site-config` field remain for stored-value back-compat. (2) The reported `ChunkLoadError: Loading chunk 72 failed` on `/login` (stale tab after a deploy rotates hashed chunks) gets one automatic `location.reload()` per browser session from both `error.tsx` and `global-error.tsx` (`isChunkLoadError` + `attemptChunkLoadRecovery`, with patterns/copy/session-guard key in `ERROR_REPORTING_CONFIG.chunkLoad`); a second match falls through to the normal report flow so a persistently broken deploy can never reload-loop. (3) Duplicate bug-report rows from one error report are eliminated: `reportClientError` derives a stable timestamp-free idempotency key (`eb:` + double FNV-1a of title|path|digest) and sends it as `x-idempotency-key` + body `clientToken`, and the server dedup pre-read now matches idempotency key OR the same error identity (title + `metadata.path` + `metadata.digest`) OR the exact description — scoped to the same reporter or both-anonymous. (4) The admin bug action modal gains a "Full context" collapsible (complete description + source/route/digest metadata + category), Reported-by with the reporter's email (added to the admin GET reporter select), and Assigned-to reviewer (also on the list card). (5) The status-change note textarea is prefilled with `BUG_REPORT_STATUS_COPY[status]`; switching status re-prefills only when the box is empty or still holds the previous default verbatim; a "Reset to default note" button appears when customized; the server's whitespace-empty → default fallback remains authoritative.

**Completed:**

- Deprecation: `admin.ts` (editor entry removed, defaults entry marked deprecated, `ADMIN_DEPRECATED_CONFIG_KEYS`), `SiteNotices.tsx` (legacy strip + fetch field removed), `siteNotice.ts` (`@deprecated` key annotation), config page comment
- Chunk recovery: `errorReporting.ts` `chunkLoad` config block; `errorReportService.ts` `isChunkLoadError` / `attemptChunkLoadRecovery` (injectable reload for tests); both error boundaries short-circuit to recovering copy + info toast
- Dedup: stable key builder (`buildStableErrorIdempotencyKey`); `reportClientError` sends header + `clientToken`; `/api/bug-reports` pre-read rewritten (identity match, reporter scoping)
- Admin modal: full-context panel + metadata rows, reporter email in GET, reviewer on card + modal, note prefill + re-prefill + reset button, updated `BUG_REPORT_ACTION_MODAL` copy
- Tests: new `chunkLoadRecovery.test.ts` (10), new `bugReports.test.ts` (8), idempotency test in `errorReportService.test.ts`, deprecated-key coverage in `designCompliance.test.ts`

**QA:** tsc 0 errors; jest 110/110 suites 1134/1134; lint clean on touched files; build clean.

**Files:**

- Created: `__tests__/services/chunkLoadRecovery.test.ts`, `__tests__/config/bugReports.test.ts`
- Edited: `lib/config/{admin,index,siteNotice,errorReporting,bugReports,reportAttachments}.ts`, `lib/services/errorReportService.ts`, `app/error.tsx`, `app/global-error.tsx`, `api/bug-reports/route.ts`, `api/admin/bugs/route.ts`, `admin/bugs/page.tsx`, `admin/config/page.tsx`, `components/ui/SiteNotices.tsx`, `__tests__/config/designCompliance.test.ts`, `__tests__/services/errorReportService.test.ts`, ai-system docs

## 2026-10-19 — Sprint 80: Duplicate-proof bug assignment + admin notification deep links + auth session persistence (Issue #25)

**Summary:**
Three-lane close-out of the issue #25 "Tightening up" directive, config-driven and non-breaking (one additive nullable column, no removed API fields). (1) Bug-report writes are now race-proof: a new pure `bugReportDedupService` plus per-reporter Postgres advisory locks (`pg_advisory_xact_lock` on `bug-report:<reporterId|anon>`) move dedup-read, assignee resolution, and insert into ONE transaction in both `/api/bug-reports` and `/api/reports` — the non-transactional read-then-write race that produced duplicate rows (each auto-assigned to a different admin = the reported "multiple admins" symptom) is closed; the matcher orders idempotency key > error identity (metadata.path + digest, title no longer required) > exact description, and unassigned duplicates self-heal to the single algorithmic assignee. (2) Admin assignment notifications now deep-link to the exact report: additive `Notification.metadata Json?` (migration `20261019000000_notification_metadata`) threads through `createNotification` → push mirror → `resolvePushPayload`; `resolveNotificationRoute` sends REPORT/MODERATION with `metadata.bugId` to `/admin/bugs?highlight=<id>` (assignee pings only — reporter-facing rows carry no bugId); `/api/admin/bugs?id=` single-fetch + the admin page's highlight capture/strip, fetch-by-id fallback, prepend, one-shot scroll and `ring-2` highlight; the admin assignee email gained a `{{appUrl}}{{reportLink}}` CTA. (3) Auth sessions stop expiring out from under PWA/remember-me/Google users: new `app/lib/config/authSession.ts` single-sources token TTLs and cookie maxAges, the refresh JWT carries the `rm` remember-me claim (legacy claim-less tokens keep their old lifetime), a dedicated `authRefresh` rate bucket (45/15min) stops refresh traffic from starving login/OTP, the middleware refresh-grace mints the access cookie at the Edge AND forwards it downstream (PWA relaunch after >1h no longer bounces to /login), Google OAuth forces the account chooser (`prompt=select_account`) with remember-me preserved through an httpOnly `oauth_session_prefs` handshake cookie, and AuthProvider now treats 429 as transient with exponential-backoff retries plus throttled online/visibility revalidation.

**Completed:**

- Lane A: `bugReportDedupService.ts` (identity/matcher/lock helpers) + locked transactional writes + assignee-in-INSERT + dup self-heal + heal-only fan-out in both report routes; `BUG_REPORT_DEDUP_CONFIG` += `dedupMaxCandidates`/`dedupLockPrefix`
- Lane B: `Notification.metadata` column + migration; metadata threaded through `notificationService`/`pushSender`/pwa push mirror/resolvers; `notificationRoutes` bugId-wins routing; `/api/admin/bugs?id=`; admin page `?highlight=` capture/strip/scroll/ring; notifications page passes metadata; `bugReportNotification` email `reportLink` CTA + preview sample
- Lane C: `authSession.ts` config; refresh `rm` claim + `includeRefresh`; `authRefresh` rate bucket; middleware refresh-grace with downstream header forwarding (`nextWithAccessCookie`) + `applyLocale` refactor; Google `prompt=select_account` + `oauth_session_prefs` handshake at all exits; login Google button carries rememberMe; AuthProvider 429 exponential backoff + throttled revalidation
- Tests: new `bugReportDedupService.test.ts`, `notificationRoutes.test.ts`, `authSession.test.ts` (44 new tests); Prisma client regenerated after schema edit

**QA:** tsc 0 errors; jest 113/113 suites 1178/1178; lint clean on touched files (only pre-existing findings elsewhere); `next build` clean; `prisma validate` OK.

**Files:**

- Created: `lib/services/bugReportDedupService.ts`, `lib/config/authSession.ts`, `prisma/migrations/20261019000000_notification_metadata/migration.sql`, `__tests__/services/bugReportDedupService.test.ts`, `__tests__/config/notificationRoutes.test.ts`, `__tests__/config/authSession.test.ts`
- Edited: `prisma/schema.prisma`, `api/bug-reports/route.ts`, `api/reports/route.ts`, `lib/config/{reportAttachments,notificationRoutes,pwa,rateLimits,email,index}.ts`, `lib/services/{notificationService,pushSender,emailService}.ts`, `middleware.ts`, `providers/AuthProvider.tsx`, `api/auth/refresh/route.ts`, `api/auth/google/{route,callback}/route.ts`, `(auth)/login/page.tsx`, `api/admin/bugs/route.ts`, `admin/bugs/page.tsx`, `(dashboard)/notifications/page.tsx`, `api/email/preview/route.ts`, `lib/utils/{auth,cookies}.ts`, ai-system docs

**Next Sprint Focus:**
Re-save the `bugReportNotification` template in Email Studio (or run `db:seed`) on the live DB so the new CTA publishes; watch refresh-bucket 429 rates in production after deploy.

## 2026-10-20 — Sprint 81: Feed first-load hydration fix (Issue #25)

**Summary:**
Fixed a timing-dependent bug where the home feed could remain on its loading skeleton until the user navigated away and back. The geo-aware init effect in `app/(dashboard)/home/page.tsx` armed the per-viewer `startedForRef` guard before awaiting `feedStream.loadInitial`; when the passive location fix resolved after the `geoWaitMs` timer had started the fetch (geo wait 1.5s vs an 8s geolocation timeout), the `passiveFix` dependency re-ran the effect, whose cleanup only set `cancelled` — dropping the awaited commit and `setIsReady(true)` while leaving the guard armed. The replacement effect then skipped fetching because the guard was present, stranding the skeleton permanently for that mount. The effect now tracks `started` vs `settled`, lets `runInitial` own the guard, and releases it on cleanup only when a started load never committed, so the next run retries with the latest fix; successful loads keep the guard to avoid a geo double-fetch.

**Completed:**
- `home/page.tsx` init effect: `started`/`settled` ownership, guard release on cancelled-but-unsettled cleanup, single guard owner
- New `app/__tests__/config/feedFirstLoad.test.ts` regression suite (guard contract, single owner, ready commit, timing-window sanity)

**QA:** Full gate green in-runner: tsc 0 errors; jest 114/114 suites 1183/1183 tests (new `feedFirstLoad.test.ts`); lint clean on touched files; `next build` clean.

**Files:**
- Edited: `app/(dashboard)/home/page.tsx`, ai-system docs
- Created: `app/__tests__/config/feedFirstLoad.test.ts`

## 2026-10-20 — Sprint 82: Platform tour + review notice

**Summary:**
Shipped two non-breaking Issue-#25 features end to end: a config/metadata-driven interactive platform tour (spotlight overlay wizard across dashboard pages, replayable, offline-aware) and a dismissible floating review prompt with an embedded quick form, plus the shared FAQ/i18n/PWA/admin work they ride on. Tree-shaking-safe design: all gate/logic lives in pure config-module helpers so components stay dumb and the behavior matrices are directly unit-testable.

**Completed:**
- Platform tour: `platformTour.ts` config (5 steps, 3 interactive, stable selectors, spot-ring knobs, end card, offline copy, localStorage state), guest `/api/tour` GET serving the SiteConfig-merged config (SWR-cached and registered in sw.js/PWA prefixes/apiRegistry), `PlatformTour.tsx` spot-ring + tooltip wizard with interactive steps, offline blocked phase, resume/auto-start/replay, mounts + profile quick-link `action` kind replay entry.
- Review notice: `reviewNotice.ts` pure gate matrix (3-day age, 7-day dismiss TTL, done flag, fail-safe has-review probe), `reviewNoticeBottomPx` lane, `ReviewNotice.tsx` floating collapse-to-pill card reusing `/api/reviews` + `reviews.*` i18n, root-layout mount.
- Docs: en+pcm FAQ (new `tour` category, `review-prompt`), 27 new i18n keys, admin `platformTourConfig` simple card + validator branch + seed entry.
- Tests: `platformTour.test.ts` (18) + `reviewNotice.test.ts` (16); suites 116, tests 1216, all green with the full QA gate.

**Key Changes:**
- New precedent: operational knobs in SiteConfig + `ADMIN_SIMPLE_CONFIG_CARDS`, content in code config — the tour never depends on the network for its step list, which is what makes it PWA-offline usable.
- New floating-UI lane `reviewNoticeBottomPx` keeps stacked notices collision-free.

**Files:**
- Created: `app/lib/config/platformTour.ts`, `app/lib/config/reviewNotice.ts`, `app/api/tour/route.ts`, `app/components/features/tour/PlatformTour.tsx`, `app/components/features/reviews/ReviewNotice.tsx`, `app/__tests__/config/platformTour.test.ts`, `app/__tests__/config/reviewNotice.test.ts`
- Edited: `app/lib/config/{floatingUi,admin,index,profileQuickLinks,pwa,apiRegistry}.ts`, `app/(dashboard)/{layout.tsx,profile/page.tsx}`, `app/layout.tsx`, `app/lib/config/faq.ts`, `public/locales/{en,pcm}.json`, `app/__tests__/config/locales.test.ts`, `prisma/seed.ts`, `public/sw.js`

## 2026-10-20 — Sprint 83: Platform tour enhancements

**Summary:**
Extended the shipped platform tour without changing its config-driven architecture: guests now get the tour (including a sign-in/register walkthrough) from the root layout, the spotlight scrim is click-through, the route composer and explore mobile bar are covered, and interrupted tours resume through an explicit top-center prompt instead of a silent hijack.

**Completed:**
- Guest + auth journey: `PlatformTour` moved from the dashboard layout to `app/layout.tsx`; steps carry an `audience` (`all`/`guest`/`authenticated`), added `auth-sign-in`/`auth-register` anchored on login/register email inputs, and `stepId` persists so a full-page registration/sign-in reload resumes at the first still-visible step (`resolveTourResumeIndex`).
- Non-blocking spotlight: outer overlay is `pointer-events-none` with `pointer-events-auto` on tooltip/resume/offline/end cards, so theme toggle, share trigger, modal controls and normal page actions keep working.
- Composer + explore: `data-tour` anchors on the first origin input, locate-me, find-on-map and route-score in `ShareRouteModal`, per-step `timeoutMs`; persistent mobile "Near me" button on `/explore`.
- Entry points + persistence: `TourLaunchButton` on FAQ, config-driven footer `actionEvent` link, auto-start only on `autoStartRoutes` (default `/home`), top-center resume prompt (`resume.autoResume` false), and `bootstrapConfigRef` so config-fetch resolution no longer cancels the start timer.
- Docs/copy: en+pcm auth/composer/resume/takeTour keys (+17, 331 total) and FAQ guests-auth/composer/resume (en+pcm); tests extended for audience/resume/auto-start/timeout/normalize/validate and anchor/mount/trigger source assertions.
- QA full in-runner: `npx tsc --noEmit` 0 errors; jest 116/116 suites 1221/1221 tests; lint clean on touched files; `next build` clean (107 static pages).

**Key Changes:**
- Audience filtering is the mechanism that makes one shipped step list valid for both guests and signed-in users; `stepId` (not just an index) is what survives the auth transition.
- Interactive steps must not capture the pointer globally — a `pointer-events-none` scrim is now the standing rule for any guided overlay.

**Files:**
- Created: `app/components/features/tour/TourLaunchButton.tsx`
- Edited: `app/lib/config/{platformTour,faq,footer}.ts`, `app/components/features/tour/PlatformTour.tsx`, `app/components/features/posts/ShareRouteModal.tsx`, `app/components/ui/AppFooter.tsx`, `app/(public)/faq/FaqClient.tsx`, `app/(auth)/{login,register}/page.tsx`, `app/(dashboard)/{layout.tsx,explore/page.tsx}`, `app/layout.tsx`, `public/locales/{en,pcm}.json`, `app/__tests__/config/{platformTour,locales}.test.ts`
