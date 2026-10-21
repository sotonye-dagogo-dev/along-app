# Project Plan

> **Metadata**
>
> - last-updated-by: update-ai-system 2026-10-21 (Sprint 88: landing tour CTA + guest-banner spacing + tour exit policy)
> - staleness-policy: re-verify if project scope or phase changes

> **Overview:** High-level feature checklist for Along — a social travel-intelligence platform for West African urban commuters. Phases follow the Roadmap (docs/ROADMAP.md). Agents update checkboxes as work is completed.

## Sprint 88 — Landing tour CTA + guest-banner spacing + tour exit policy (2026-10-21, execute-feature)

- [x] Landing CTA [Sprint 88]: `LandingCtaActions` pairs the auth-aware bottom CTA with a permanent `TourLaunchButton` ("Take the tour"); new `AppButton` `on-primary` variant keeps the outlined action legible on the brand gradient; `landing.cta.takeTour` en/pcm
- [x] Guest banner spacing [Sprint 88]: the three CTAs now `flex-auto` wrap and grow to fill each narrow row (`sm:flex-none` restores the compact desktop row), removing the dead space on the right
- [x] Tour exit policy [Sprint 88]: additive per-step `allowEnd` metadata (default true, normalized/validated); `post-navigate` is awareness-only (`interactive` off, `allowEnd: false`) and hides End/X/Escape so the essential sharing/request/explore stops stay on the path
- [x] Post timing [Sprint 88]: post-overview/post-trust/post-actions/post-navigate target windows raised to 6000ms, preserving online auto-advance and offline note fallbacks
- [x] FAQ + QA [Sprint 88]: en/pcm navigation awareness/exit copy, landing-page entry, banner spacing; tests extended for allowEnd and landing/banner wiring; tsc 0, jest 118/118 suites 1261/1261, build clean

## Sprint 87 — Post/request/navigation tour + guest-banner tour CTA (2026-10-21, execute-feature)

- [x] Share hint [Sprint 87]: `SHARE_ROUTE_MODAL_CONFIG.detailsHint.mapValueTemplate` + pure `fillShareRouteHintTemplate`; Details Map link renders live `(distance km · duration min)`, degrading to the bare label when values are unavailable
- [x] Post tour [Sprint 87]: four feed steps (`post-overview`, `post-trust`, `post-actions`, interactive `post-navigate`) anchored on the first route-bearing `PostCard`; requests/platform posts intentionally excluded
- [x] Route-request tour [Sprint 87]: interactive `route-request` step on the composer header trigger, with `SHARE_ROUTE_OPEN_EVENT` reopening a closed composer
- [x] Navigation coverage [Sprint 87]: `data-tour` anchors on `NavigationGuide` and `LiveNavigationModal`; post step explains live guide, tracing, distance/time/fare
- [x] Guest entry [Sprint 87]: `GuestBanner` gains a responsive “Take tour” CTA (tour/sign-in/sign-up); floating `GuestTourNotice` retired (disabled + unmounted, code retained for opt-in)
- [x] FAQ + QA [Sprint 87]: en/pcm post/request/navigation + retired-prompt + map-hint copy; tsc 0, jest 118/118 suites 1259/1259, build clean

## Sprint 86 — Guest tour prompt + tour hand-off/scroll + share modal polish (2026-10-21, execute-feature)

- [x] Guest prompt [Sprint 86]: `guestTourNotice.ts` ordered gate matrix + dismiss TTL/install/cookie readers; `GuestTourNotice.tsx` delayed, dismissible, guest-only root-mounted card; cookie/install coordination events
- [x] Footer/floating [Sprint 86]: tour link moved to Along (single entry), guest prompt lanes registered, tests updated
- [x] Tour hand-off/scroll [Sprint 86]: `scroll` knobs + per-step override, safe `along:*` activate/advance events; PlatformTour scrolls targets, opens composer on Next, switches Score; home/modal event listeners
- [x] Share modal polish [Sprint 86]: space-between footer, tighter header/tab spacing, live score in Details hint
- [x] FAQ + QA [Sprint 86]: en/pcm updates; new `guestTourNotice.test.ts`; tsc 0, jest 118/118 suites 1257/1257, build clean

## Sprint 85 — Tabbed share-route composer (2026-10-21, execute-feature)

- [x] Tab metadata [Sprint 85]: `SHARE_ROUTE_MODAL_CONFIG.tabs` (Details/Map/Score/Drafts short labels + icon keys), `defaultTab`, `tabsAriaLabel`, `detailsHint`, `mapPanelHeight`, Drafts badge; pure `resolveShareRouteTabId` fallback
- [x] Composer layout [Sprint 85]: one full-width ARIA tabpanel replaces nested collapsibles; keyboard tab cycling; footer reduced to Save Draft + Share; Drafts count badge
- [x] Cross-section actions [Sprint 85]: Details nudge buttons switch to Map/Score; Find on map switches to Map; draft restore returns to Details; tour score anchor moved to the Score tab
- [x] FAQ/tests [Sprint 85]: `share-route-tabs` en + PCM, Map-tab wording in `map-find-on-map`; new `shareRouteTabs.test.ts`; full gate green (tsc 0, 117/117 suites 1246/1246, build clean)

## Sprint 84 — Tour viewport safety + drafts footer + Nigeria-aware journey times (2026-10-21, execute-feature)

- [x] Tour layout [Sprint 84]: config knobs (`tooltipGapPx`, `tooltipMarginPx`, `tooltipMaxHeightRatio`) + pure `resolveTourTooltipLayout`; explicit card width, edge flip/clamp, internal scroll cap; measured tooltip/end/offline/centered cards keep actions reachable
- [x] Drafts footer [Sprint 84]: composer footer stacks on mobile, drafts toggle truncates, Save Draft/Share stay on their own row
- [x] Journey calibration [Sprint 84]: per-vehicle boarding wait, per-stop pick-up/drop-off dwell, toll/agbero allowance, provider free-flow multiplier; overhead applied exactly once and hard-capped
- [x] Duration wiring + persistence [Sprint 84]: `geo.estimateRoute`, `useRouteTrace`, `ShareRouteModal` (persists `totalDistanceKm`/`estimatedMins`), post detail stops, `mapProxyService` straight-line/provider fallbacks
- [x] FAQ + QA [Sprint 84]: `route-time-estimates` en+pcm; calibration/layout tests; tsc 0, jest 116/116 suites 1231/1231, lint no new findings, build clean

---

## Sprint 83 — Platform tour enhancements (2026-10-20, execute-feature)

- [x] Guest access + triggers [Sprint 83]: mount `PlatformTour` at the root layout (removed from dashboard layout), audience-filtered steps (`guest`/`authenticated`/`all`), `TourLaunchButton` on FAQ + config-driven footer `actionEvent` link, guest-safe `TOUR_START_EVENT` replay
- [x] Auth walkthrough [Sprint 83]: `auth-sign-in`/`auth-register` guest steps with `login-email`/`register-email` anchors; `stepId` persisted so registration/sign-in reloads resume at the first still-visible step (`resolveTourResumeIndex`)
- [x] Click-through spotlight [Sprint 83]: `pointer-events-none` scrim + `pointer-events-auto` cards; theme toggle, share trigger and modal controls stay usable; route guard per tick
- [x] Route-composer coverage [Sprint 83]: origin input / use-current-location / find-on-map / route-score steps anchored via `data-tour` in `ShareRouteModal`, per-step `timeoutMs`; persistent mobile "Near me" button fixes the explore step on small screens
- [x] Persistence without hijack [Sprint 83]: top-center resume prompt (`resume.enabled`, `resume.autoResume:false`, configurable delay/copy), auto-start restricted to `autoStartRoutes` (default `/home`), state survives config-fetch failure/timer races via `bootstrapConfigRef`
- [x] Docs/tests [Sprint 83]: en+pcm auth/composer/resume/takeTour keys (17), FAQ guests-auth/composer/resume (en+pcm), `platformTour.test.ts` audience/resume/timeout/anchor/mount contract, `locales.test.ts` keys; full gate green in-runner (tsc 0, 116/116 suites 1221/1221, lint clean touched, build clean)

---

## Sprint 82 — Platform tour + review notice (2026-10-20, execute-feature)

- [x] Platform tour [Sprint 82]: config/metadata-driven interactive spotlight wizard (5 steps, 3 interactive, stable selectors, spot-ring + scrim, mascot w/ app-logo fallback, prev/next/skip + "Step n of m", Esc), thank-you end card with CTA, resume/auto-start-once, replay via profile quick-link `kind: "action"` → `TOUR_START_EVENT`; offline-first (step content in code config; `/api/tour` serves admin override SWR-cached + registered in sw.js/PWA prefixes/apiRegistry); admin `platformTourConfig` operational-knobs simple card + central validator + seed entry
- [x] Review notice [Sprint 82]: dismissible floating quick-review prompt on a dedicated `reviewNoticeBottomPx` lane; pure gate matrix (authed, ≥3-day account age, no review, 7-day dismissal TTL, done-forever flag, fail-safe unknown-probe), `/api/reviews?mine=1` best-effort probe + POST via `useRequireOnline`; mounted root-layout
- [x] Shared work: FAQ `tour` category (3 items en+pcm) + `review-prompt` item; en/pcm `tour.*`/`reviewNotice.*` keys (27); `REQUIRED_KEYS` extended; NEW `platformTour.test.ts` (18) + `reviewNotice.test.ts` (16); full gate green in-runner (tsc 0, 116/116 suites 1216/1216, lint clean touched, build clean)

---

## Sprint 80 — Duplicate-proof bug assignment + admin notification deep links + auth session persistence (2026-10-19, execute-feature)

- [x] Duplicate-proof report writes: dedup-read + assignee + insert in ONE transaction serialised by a per-reporter advisory lock (`bugReportDedupService` + `pg_advisory_xact_lock`) in both `/api/bug-reports` and `/api/reports`; assignee written in the INSERT; unassigned duplicates self-heal to the single algorithmic admin (no more "assigned to multiple admins")
- [x] Dedup matcher tightened: idempotency key > error identity (metadata.path + digest — title no longer required) > exact description, reporter-scoped, candidate window bounded by `dedupMaxCandidates`
- [x] Admin assignment notifications deep-link: additive `Notification.metadata Json?` threaded through `createNotification` → push mirror → resolvers; REPORT/MODERATION with `bugId` → `/admin/bugs?highlight=<id>` (assignee pings only — reporter rows carry no bugId and keep today's targets)
- [x] Admin bug page consumes `?highlight=` (capture + strip via `history.replaceState`, `GET /api/admin/bugs?id=` fetch-by-id fallback, prepend off-page rows, one-shot scroll + ring highlight)
- [x] Admin assignee email CTA: `{{appUrl}}{{reportLink}}` in the default `bugReportNotification` template + `sendBugReportNotification(..., reportId?)` + preview sample
- [x] Auth session persistence: `authSession.ts` single-source config, refresh-JWT `rm` remember-me claim (legacy tokens keep old lifetime), dedicated `authRefresh` rate bucket, middleware refresh-grace with downstream cookie forwarding (PWA >1h relaunch no longer bounces to /login), Google `prompt=select_account` + httpOnly remember-me handshake, AuthProvider 429 exponential backoff + throttled online/visibility revalidation

## Sprint 79 — Legacy announcement-banner deprecation + bug-report pipeline tightening (2026-10-18, execute-feature)

- [x] Deprecate legacy `announcementBanner` admin UI (SimpleConfigCard + editor registration + SiteNotices strip removed; `ADMIN_DEPRECATED_CONFIG_KEYS` hides the key everywhere; defaults/validator/API field kept for back-compat)
- [x] ChunkLoadError auto-recovery: one session-guarded `location.reload()` from both error boundaries (`ERROR_REPORTING_CONFIG.chunkLoad` patterns/copy/once-flag; second match falls through to the report flow)
- [x] Bug-report dedup: stable timestamp-free idempotency key (`eb:` + FNV-1a of title|path|digest) from `reportClientError` + tightened server pre-read (key OR error identity OR exact description, reporter-scoped)
- [x] Admin bug modal: collapsible full context (description + source/route/digest + category), Reported-by email, Assigned-to reviewer (modal + card)
- [x] Status-change note prefill with `BUG_REPORT_STATUS_COPY[status]`; re-prefill only when empty/untouched-default; reset-to-default button; server whitespace-empty fallback preserved

## Sprint 78 — SEO title suffix + feed page size + pagination compliance (2026-10-18, execute-feature)

- [x] Single-source the ` | Along` SEO title suffix (`DEFAULT_META.titleSuffix` + root `title.template`; OG/Twitter composed once in builders — no more double suffix on any page)
- [x] Feed default page size 10 → 20 across server fallback, `DEFAULT_FEED_CONFIG`, `FEED_STREAM_CONFIG`, and the zod query schema
- [x] Platform-wide pagination compliance: central `PAGINATION_CONFIG` + `clampPageLimit` on every cursor route, id sort-key determinism, limit-scoped notifications cache keys (badge `limit=1` can no longer poison the page cache)
- [x] `feedStream` transient-fetch hardening: failures keep cursor/`hasMore` intact with config-driven exponential backoff + chained retry (one 500 no longer permanently strands infinite scroll)
- [x] Cursor load-more everywhere it was missing: followers/following (was unbounded), post-detail comments, and all six profile tabs on both profile pages (reusable `useCursorList` hook + `ViewMoreButton`)

---

## Sprint 77 — DB pooler strategy + sanitized style proxy (2026-10-18, execute-feature)

- [x] Runtime Prisma resolves the TRANSACTION-mode pooler first (DATABASE_URL-first prod, LOCAL_DB-first dev; CLI stays DIRECT-first) — fixes the EMAXCONNSESSION 500s that blanked every DB-backed route post-Supabase-migration
- [x] Config-driven pooler-aware pg adapter (`dbPool.ts`: small per-instance pool via `DB_POOL_MAX` default 5, connect timeout, idle release, `prepare:false` iff transaction-mode) + globalThis Prisma singleton in every env + one-time session-mode prod warn
- [x] Same-origin sanitized vector-style proxy (`/api/maps/style?name=`, whitelisted, Redis read-through) + coalesce-wrap sanitizer silencing the MapLibre null-type console warning class; renderers load styles through the proxy

---

## Sprint 76 — Refresh-notice once-flag (2026-10-18, execute-feature)

- [x] Locally persisted once-flag (`along-safe-refresh-done-at`, 7-day TTL, preserve-whitelisted) stops the "kindly refresh" strip from re-nagging users who already tapped Refresh now
- [x] Catch-all note ("Already refreshed or updated? You can ignore this notice.") covers manual-refresh / lost-flag edge cases (en + pcm)

---

## Sprint 75 — Notice tightening (2026-10-18, execute-feature)

- [x] Opaque `--color-warning-surface` token fixes translucent dark maintenance/offline strips
- [x] Admin-configurable (default OFF) post-maintenance refresh notice with safe client reboot (protected-key storage clear + Cache Storage wipe + SW unregister + cache-busted reload; drafts/session/prefs survive; cookies untouched)
- [x] Multiple announcements with optional CTA (central validator + href safety gate + per-id dismiss + bespoke admin list editor; legacy single-string banner DEPRECATED Sprint 79 — admin UI + strip render removed, key kept registered for back-compat)
- [x] Unified config-driven tag limits (10×30) with comma parsing, limit/length toasts, honest placeholders, and server-side rejection
- [x] Scrollable 42vh stop-assignment picker card

---

## Sprint 73 — Supabase Database Transfer and Recovery

- [x] Resumable, checksummed Prisma Postgres to Supabase migration with transactional restore and rollback
- [x] Config-driven local backup, verified restore, and Supabase-to-Prisma offsite mirror scripts
- [x] Raw-text PostgreSQL temporal codec and cyclic-FK load planning
- [x] Environment template, README runbook, connection review, focused tests, live read-only probes, and QA gate

---

## Phase 0 — Ground Zero (Infrastructure)

> **Section summary:** Core infrastructure already in place. Verified during bootstrap.

- [x] Project scaffolded (Next.js 15, TypeScript, Tailwind 4, PostCSS)
- [x] Prisma schema with 14 models and 8 enums created
- [x] Prisma migrations applied (3 migrations)
- [x] Seed script written for development data
- [x] Sentry integration (client, server, edge)
- [x] Jest + RTL testing infrastructure configured
- [x] CI pipeline (build, type-check, test, lint)
- [x] PWA service worker and manifest in place
- [x] Design system (17 HTML design files) complete
- [x] Environment variables and configuration files populated

---

## Phase 1 — Config Registry & Universal Components

> **Section summary:** Foundation layer that all other code depends on. Generate first.

- [x] Config registry files created (25 files in `app/lib/config/`)
- [x] BaseRepository class implemented
- [x] Universal App\* component library built (34 components, including AppLogo, GuestBanner, OfflineIndicator)
- [x] Context providers wired (Auth, OnlineStatus, Push, GlobalModal, GlobalToast, CookieConsent)
- [x] Root layout with 6 providers, SEO metadata, Inter font, PWA meta tags
- [x] Global styles (globals.css) with Tailwind v4 theme tokens

---

## Phase 2 — Auth & User Management (Partial)

> **Section summary:** User registration, login, profile management, and JWT auth flow.

- [x] Auth API routes (register, login, logout, refresh, OTP, google, me) in `app/api/auth/`
- [x] Auth middleware with JWT verification (jose) for edge-protected routes
- [x] Auth pages (Login, Register, OTP verification) in `app/(auth)/`
- [x] User profile pages and edit functionality in `app/(dashboard)/profile/`
- [x] Avatar upload config (`app/lib/config/avatar.ts`)
- [x] Auth "Remember Me" with configurable session durations
- [x] Follower/following system (follow/unfollow API, followers/following pages, clickable stats) #session-5

---

## Phase 3 — Core Social Features (Feed & Posts) (Partial)

> **Section summary:** The primary user-facing features — posting routes, feed, interactions.

- [x] Post creation API (`app/api/posts/route.ts`)
- [x] Feed with pagination (`app/api/posts/feed/`, `app/lib/services/feedService.ts`). Sprint 57: first-load readiness gate (single geo-aware fetch, `isReady` skeleton hold, seeded diversity jitter per viewer + UTC day). Sprint 59: explicit own-posts pool at `ownPostsWeight` (= followingWeight) — self + non-followed posts never excluded, ranking gap closed. Sprint 60: two explicit out-of-network discovery pools (open requests from non-followed, no age window; general recent from anyone not followed) at `discoveryWeight` 0.5 + `openRequestWeight` 0.6 — strangers always enter the candidate set, feed/carousel parity
- [x] Like/unlike posts (`app/api/posts/[id]/like/`, PostCard, post detail page)
- [x] Comment system (`app/components/features/comments/`)
- [x] Bookmark/save posts (`app/(dashboard)/bookmarks/`)
- [x] Post detail page (`app/(dashboard)/posts/[id]/`)
- [x] ImageLightbox reusable component (`app/components/ui/ImageLightbox.tsx`)
- [x] Explore page (`app/(dashboard)/explore/`) — full-viewport map, side panel, bottom sheet, filters
- [x] NavigationGuide component (`app/components/features/posts/NavigationGuide.tsx`) — step-by-step directions
- [x] RouteStepInput with live Nominatim geocoding (`app/components/features/posts/RouteStepInput.tsx`)
- [x] Drag-and-drop route step reordering in ShareRouteModal
- [x] Draft saving with localStorage auto-load in ShareRouteModal

---

## Phase 4 — Route Intelligence & Verification (Partial)

> **Section summary:** Trust and verification systems that differentiate the platform.

- [x] ValidityEngine for route verification scoring (`app/lib/services/ValidityEngine.ts`)
- [x] DraftingCoach for post quality guidance (`app/lib/services/DraftingCoachService.ts`)
- [x] TrustBadge component for verified reporters (`app/components/ui/TrustBadge.tsx`)
- [x] Search — unified posts + users + tags search (`GET /api/search`, `searchService.ts`, `/search` page; contains/insensitive queries + Redis cache, no migration needed; 2026-10-08). Sprint 39: explore search expansion — `ExploreSearchInput` suggestions (routes incl. requests + people + tags) + localStorage recents + full-search footer over untouched client filter (`EXPLORE_SEARCH_CONFIG`); shared `PostCommentsModal` on feed/profile/search/detail (`COMMENTS_CONFIG`); 3 pre-existing red suites fixed, jest 461/461 (2026-10-11)
- [x] Map integration with route polyline rendering (`app/components/features/posts/RouteMap.tsx`, `app/lib/services/routeTracingService.ts`, `app/api/routes/trace/`)
- [x] Route requests E2E — PostType enum, quotedPost self-relation, RequestRouteModal, Respond CTA + quote block, /api/suggestions (Sprint 7, 2026-10-07/08)
- [ ] Clustering for dense map markers (supercluster dependency listed but not wired)

---

## Phase 5 — Notifications & PWA (Partial)

> **Section summary:** Real-time engagement and offline capability.

- [x] In-app notification feed (`app/(dashboard)/notifications/`, `app/api/notifications/`)
- [x] Push notification subscription and sending (Web Push API) via `app/api/push/*`, PushProvider, pushSubscriptionService
- [x] QStash background jobs (`app/lib/services/qstashService.ts`, `app/api/workers/*`)
- [x] Offline page and caching strategies (`public/offline.html`, `public/sw.js`)
- [x] Service worker update flow (`public/sw.js`) — full prompt lifecycle since Sprint 49 (was install-time auto-skipWaiting only; now periodic checks + user-approved single-reload)

---

## Phase 6 — Admin Dashboard & Analytics (Partial)

> **Section summary:** Platform management and business intelligence.

- [x] Admin dashboard with live API data, loading skeletons, error/retry states (`app/admin/`, `AdminShell.tsx`)
- [x] User management (`app/admin/users/`, `app/api/admin/users/`)
- [x] Bug report management (`app/admin/bugs/`, `app/api/bug-reports/`)
- [x] User review management (`app/admin/reviews/`)
- [x] Site configuration editor (`app/admin/config/`)
- [x] GlobalConfirmModal wired into admin pages (replaces `confirm()` dialogs)
- [x] Analytics content — user analytics page with KPI tiles, engagement charts, quick stats (`app/(dashboard)/analytics/`, `app/api/analytics/user/`, responsive sweep Sprint 7)
- [ ] Accessibility audit (WCAG AA)

---

## Phase 7 — Rewards & Gamification (Partial)

> **Section summary:** Incentive system for active contributors.

- [x] Reward tiers and badge system (`app/lib/config/rewards.ts`, `app/lib/services/rewardsService.ts`)
- [x] Points accumulation via `app/api/rewards/`
- [x] Leaderboards — global leaderboard page + API (top 100 by rewardPoints)
- [x] Profile trust scoring (integrated with ValidityEngine)

---

## Phase 8 — Quality, Testing & Launch (Partial)

> **Section summary:** Reliability, performance, and production readiness.

- [x] Unit tests for services and utilities (149 tests across 15 suites incl. mutation E2E + posts API + search API/service + uxTightening config + routeDrafts config/service, per 2026-10-08 Sprint 11; full gate green in-runner: tsc 0, jest 149/149, build clean)
- [x] Mutation E2E tests (post/like/comment/bookmark/follow) + error handling and undefined edge cases (`app/__tests__/api/mutations.test.ts`, `posts.test.ts`)
- [ ] Component tests for App\* components
- [ ] Integration tests for API routes
- [ ] Performance audit (Lighthouse, bundle analysis)
- [ ] Accessibility audit (WCAG AA)
- [ ] Production environment configuration
- [ ] Security audit (auth, input validation, secrets management)
- [ ] Documentation complete
- [ ] Deployment pipeline configured and tested

---

## Completed

> **Section summary:** Features fully shipped. Archived here for reference.

- [x] Infrastructure setup (Phase 0 — Ground Zero)
- [x] Config registry & universal components (Phase 1 — Foundation Layer)
- [x] Transact Marketplace integration — proxy API, webhook, /marketplace page
- [x] Tega Events integration — proxy API, webhook, EventsWidget in feed sidebar
- [x] Sprint 7 (2026-10-07/08) — seed/mock hygiene, welcome notification, live route preview + autofill, client caching, route requests E2E, suggestions rail/carousel, scroll-aware prompt, analytics/responsive sweep, profile tab filtering, state-strategy decision, QA gate green
- [x] Sprint 9 (2026-10-08) — scroll-based suggestions carousel with own overflow container, share-modal collapsed preview/score + footer actions, RequestRouteTrigger ("Request?") icon, 3-col footer grid, config tests (143 tests / 14 suites; newest 4 not yet executed — no node_modules in runner)
- [x] Sprint 10 (2026-10-08) — carousel reordered above feed below share/request triggers, route-drafts library (config + service + panel + modal integration + home resume chip), config/service tests (147 tests / 15 suites; newest 8 not yet executed — no node_modules in runner)
- [x] Sprint 11 (2026-10-08) — posting validation fix (generic description input, empty-tolerant schema, first-field feedback), response tag inheritance + draft linkage, toast single-timer, PostCard copy-link/report, About reviews on shared EndlessCarousel (149 tests / 15 suites, full gate green in-runner)
- [x] Sprint 12 (2026-10-08) — posting hardening (submit guard + idempotency ACID), like/dislike undo removal, ImageLightbox rewrite, EndlessCarousel autoplay fix (154 tests / 16 suites, full gate green in-runner)
- [x] Sprint 13 (2026-10-08) — post/comment moderation (edit/delete/archive, owner + admin, global confirm + undo), report lifecycle E2E (`/api/reports`, admin triage, anonymity both ways), request display rules (no map/nav/trust, responses as comments), trust tooltip viewport fix (160 tests / 17 suites, full gate green in-runner)
- [x] Sprint 14 (2026-10-08) — post-nature immutability (PATCH strip), profile routes/requests/archived tabs, notification coverage (MENTION/DISLIKE/NEW_ROUTE, service-routed likes/comments, WELCOME fix), auth-agnostic referrals (shared service, Google `state=ref:`), invite points-cap policy, flag contrast fix (188 tests / 21 suites, full gate green in-runner)
- [x] Auth hardening — Redis timeout fallback, non-blocking reset mail, durable DB reset tokens (Sept 15/16/29)
- [x] Sprint 15 (2026-10-08) — notification nav/badges, referral+points coverage, username edit, landing guest-link, one-time prod reset (198 tests / 22 suites, full gate green in-runner)
- [x] Sprint 16 (2026-10-08) — vercel-build reset unhooked (clean-DB build confirmed; script retained manual-only) + early-adopter "First N Users #n" badge E2E (config-driven SiteConfig row, createdAt-asc rank, admin toggle/limit/label card, profile badges, list + per-user APIs, admin early-adopter filter; no migration)
- [x] Sprint 19 (2026-10-09) — keyless map stack (OpenFreeMap vector + keyless raster step-down, OSRM-first cached server proxy with env-gated ORS/Mapbox + straight-line guarantee, `/api/maps/*` geocode proxy, renderer + geocode client cutover, trace delegate, optional-override env hygiene; 234 tests / 27 suites, full gate green in-runner)
- [x] Sprint 20 (2026-10-09) — tightening (anchor-stable numbered pins + token user dot via shared MapPins, dark light-parity, draft update-in-place with update-vs-new prompt + per-draft Update, FAQ maps category + report/edit accuracy; 241 tests / 28 suites, full gate green in-runner)
- [x] Sprint 24 (2026-10-09) — PWA fulfillment (v3 SW, manifest, heartbeat toasts, fallback cached-pages, session preservation, push fan-out mirror) + Pidgin +44 keys + FAQ Offline & App (18 new tests; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 25 (2026-10-09) — PWA tightening (v4 SW: locales precache + cache-first, config/reviews cacheable, collapsible offline banner, bundled-EN + last-good + cookie locale sync) + Pidgin depth (+74 keys, FAQ_PCM, toggle wired via tf() across post actions/menus/footer/landing/About/FAQ/leaderboard/invite/feed) + platform reviews E2E (`/api/reviews` self-pair upsert, ReviewsPanel, profile tabs + #reviews link, About real-reviews tape + CTA cadence, thank-you notify, anonymize-on-archive, null-safe admin; no migration) (309 tests / 36 suites, full gate green in-runner: tsc + jest + build)
- [x] Sprint 27 (2026-10-09) — admin verify actions (PATCH verify/unverify/resend-verification + notifications + undo, Email-status column + row/bulk actions) + push-prompt handling (env guards, in-gesture permission, detailed reasons, local enabled/dismiss flags, per-outcome guidance, granted-only auto-subscribe) + OTP feedback (per-email cooldown 429s, honest sent/expiresIn payloads, 5-attempt revoke, server-adopted client timer, masked email) (authVerificationPush.test.ts 6 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 31 (2026-10-10) — universal post share (postShareService + usePostShare, PostCard fallback, feed/search/detail/bookmarks wired) + dynamic trust engine (ValidityEngine v2 reputation/engagement/report signals, canonical scorers, recompute triggers on all signals, live breakdown + TrustBadge live rows) (postShareService 8 + ValidityEngine +9 + TrustBadge +2 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 32 (2026-10-10) — trust breakdown consistency, feed card == detail (canonical trustBreakdownService single+batched, trustDisplay compact/full config, TrustBadge variant + live-score tier, PostCard compact, all read APIs + worker on the same live object) (trustBreakdownConsistency 5 + TrustBadge +2 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 33 (2026-10-10) — Cloudinary orphan prevention on deletions (MEDIA_CLEANUP_CONFIG + cloudinaryUrls + mediaCleanupService + upload/cleanup, post/admin/moderation/edit/draft/account-avatar paths wired ACID-safely, posts retained on account finalize per policy) (mediaCleanup 5 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 34 (2026-10-10) — Location toasts + feed/explore soundness + invite-link tightening (locationFeedback copy/helper, feed SiteConfig + viewer-location bonus + trust tie-break, invite canonical redirects) (full gate deferred to CI — no node_modules in runner)
- [x] Sprint 35 (2026-10-11) — Leaderboard cross-links + auth-link tightening (LEADERBOARD_LINKS_CONFIG + PROFILE_QUICK_LINKS_CONFIG + AUTH_LINK_STATUS_CONFIG, link/status DB re-read with server-only booleans, profile link-result toasts + URL cleanup, invite CTA, 3 locale keys en/pcm parity) (leaderboardAuthLink 5 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 36 (2026-10-11) — Response-linkage persistence + composer false-validation fix (EditPost linkage fields + edit-response banner + drafts-in-edit, GET /api/posts quotedPost include, validator destination fare/vehicle skip) (routeValidation +2, routeDrafts +1 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 37 (2026-10-11) — Owner-only post menu + admin edit with audit + friendly audit trail (PostMenu owner-gated, PUT /api/admin/posts nature-preserving edit, logAudit on admin mutations, AUDIT_DISPLAY_CONFIG + rebuilt /admin/audit) (audit 6 + PostMenu 4 suites; tsc zero + build passes + jest 436/439 pre-existing-only in-runner)
- [x] Sprint 38 (2026-10-11) — Profile post parity + corroboration tightening (PostItem forwards validityBreakdown/quotedPostId/quotedPost/responsesCount; CORROBORATION_CONFIG evidence blend + pure engine scorers + single/batched/create-path reuse; TRUST_BREAKDOWN_DESCRIPTIONS tooltip help) (corroboration 8 suites; tsc zero + jest 443/446 pre-existing-only in-runner, build deferred to Vercel)
- [x] Sprint 39 (2026-10-11) — Trust detail-42 fix (DETAIL_SCORING_CONFIG richness bonuses + computePostDetailScore/detailContextFromPost, service single+batched + create + worker reuse) + error-boundary bug-report CTA (prefill builder + URL, toast action-slot CTA + inline link, report-bug query prefill + hint, EMPTY_STATES.error honest copy) + search discoverability (NAV_REGISTRY + sidebar user-row icon + footer + profile quick-links + footer.search en/pcm) (detailScoring 8 + errorReportPrefill 6 + searchLinks 3 suites; tsc zero + jest 478/478 + lint clean in-runner, build deferred to Vercel)
- [x] Sprint 42 (2026-10-11) — Dislike parity + comment-avatar consistency (server `_isDisliked` on detail/list/feed-service + feedStream mutual-exclusion cache, PostCard seed/sync + config-driven dislike fill via POST_ACTIONS_CONFIG warning tokens, post-detail handleDislike + optimistic counts + rollback, feed toggle-payload corrections, AuthProvider avatarConfig + all four comment viewers forward it) (dislikeSync 15 + profilePosts +1 suites; tsc zero new-errors + all 30 assertions grep-verified in-runner, jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 44 (2026-10-11) — Deleted-account view-only gating + Active filter + row-actions dropdown (config-driven filters/allow-list, API active branch + deleted skip with honest counts, AppTableRowActions dropdown preserving colors on users/posts/deletions tables) (admin +2 suites; static review in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 43 (2026-10-11) — Admin destructive user deletion + dashboard period toggle (per-request Reverse/Delete-now + per-user Request/Reverse/Delete-now through the same anonymize pipeline with confirm/undo/audit; stats `?period=7|30|90` with windowed deltas; dashboard toggle wired to overview + chart) (admin +3 suites; node 9/9 in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 45 (2026-10-12) — Chart hover tooltips platform-wide (shared ChartTooltip components + charts config) + dedicated admin analytics page/API (KPIs, growth/engagement/validity/audience, top posts/contributors) + admin sidebar scrollability + platform-consistent profile-linked admin avatar (AppUserLabel role-tag extension) (charts + ChartTooltip + AdminAnalyticsShell suites; node strip-types 6/6 in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 47 (2026-10-12) — PWA notice icon/theme compliance + deleted/archived-user visibility + avatar consistency (PWA_FAQ_LINKS + userVisibility registry + FaqClient deep-links; notices on lucide icons + theme tokens + FAQ help; suggestions/search/follow/lists visibility + 410 + live counts; Panel/Rail/UserList AppAvatar + FollowButton unavailable; admin avatar selects + pages) (sprint47 9 suites; static + node execution in-runner, full gate deferred to CI — no node_modules in runner)
- [x] Sprint 50 (2026-10-13) — Reports + pagination + geo + floating + README tightening (report screenshots 3/2MB along/reports via metadata.images + ReportImageUpload + admin thumbnails; ViewMoreButton/PageNavigator on notifications/search/comments/reviews/leaderboard/blog; openmeteo merge/dedupe/near-rank + geoBias + routes-JSON stop recall; floating lanes + mobile left dock; README service attributions) (sprint50 10 suites; node --check + strip-types green in-runner, full gate deferred to CI — no node_modules in runner)
- [x] Sprint 51 (2026-10-13) — notification deep-routing, bug-report ACID + admin pagination/screenshots, table sort, validity-top correctness, reporter email lifecycle (all templates in Studio; deferred admin-table pagination closed bulk-safely via append-only cursor lists)
- [x] Session 2026-10-13 — Right-dock rounds + upload-before-submit + landmark geocode (mobileDockSide right; ConfigDrivenForm.beforeSubmit + report-bug wiring + isLoading; overpass keyless fallback + LANDMARK_GEOCODE_CONFIG + photon street labels + nominatim addressdetails/dedupe) (sessionTightening 7 suites; strip-types --check green in-runner, full gate deferred to CI)
- [x] Session 2026-10-13 — Broad location suggestions (LOCATION_SUGGESTIONS_CONFIG min2/debounce/limit/timeout + coordinate fast-path + parallel fast fan-out + empty-only overpass/reorder batch + Photon/Nominatim upstream bias + short empty TTL; route + RouteStepInput/ShareRouteModal/RequestRouteModal on shared config) (locationSuggestBroad 13 suites; node pure-logic green in-runner, full gate deferred to CI)

- [x] Session 2026-10-13 — Blog share/SEO/defaults/variables + bug action modal (share service + detail buttons; per-post article SEO; defaults-merge + restore rollback; guest-safe variables + Studio insert UI; status-note modal + API override) (blogShareVariables suites; structural review in-runner, full gate deferred to CI)
- [x] Sprint 52 (2026-10-13) — Audit trail reports+blogs (report.create/status/moderate hooks + report entity + specific action labels) + defaults 2→6 (STE100, emdash-free, fallback vars) + featured blogs tape (config + shared section on landing/about/invite with Read + View-all CTAs) + Studio parsing without loss (bare text, wrappers, recursion, plain-text contract kept) (featuredBlogs 17 assertions; node strip-types green in-runner, full gate deferred to CI)
- [x] Sprint 54 (2026-10-14) — Blog Studio image uploads + faithful preview (BLOG_IMAGE_CONFIG + blogImages resolve/extract/collect/diff; /api/upload blog policy admin-gated + cleanup blog sources + SiteConfig guard; BlogImageUpload cover/inline + BlogPostArticle shared by public page + preview; covers on detail/list/featured/tape; save/delete purges post-commit) (blogImages 7 suites; FULL gate green in-runner: tsc 0, jest 77/77 656/656, lint clean, build clean)
- [x] Sprint 55 (2026-10-14) — Trust tooltip portal + admin collapse + scrollbars + feed diversity + loose search (portal escapes hover-lift transforms + edge-aware/flip/hover-bridge; rail spacing + shrink-0 icons; token scrollbars + SCROLLBAR_CONFIG; FEED_DIVERSITY_CONFIG + applyFeedDiversity post-sort/pre-slice; SEARCH_CONFIG + two-phase recall + in-memory relevance rank + index cursor, same envelope) (feedSearchTightening 19 suites; FULL gate green in-runner: tsc 0, jest 78/78 679/679, lint clean, build clean)
- [x] Sprint 56 (2026-10-14) — Studio tightening: blog reorder parity + CTA buttons (token CSS, sanitizer allowlist, round-trip) + generous sticky previews via STUDIO_LAYOUT_CONFIG (Email/Blog/AvatarEditor) + feedDiversity Studio card (KEY/META/normalize/validate, API guard, reset) + zero-result query analytics (AnalyticsEvent log, admin aggregation + dashboard section) (studioTightening 4 suites + blogCompliance CTA/allowlist; FULL gate green in-runner: tsc 0, jest 79/79 684/684, lint clean on touched files, build clean)
- [x] Sprint 61 (2026-10-15) — Design-system visibility + Config Studio parity (vehicle `-100` washes + borders; TrustBadge tokens; tier-shield display registry + white-on-pastel pill fixes; admin hardcoded defaults + stored-wins merge + central validation + no-code cards + restore + audit + idempotent delete) (designCompliance 7 + vehicles +1 suites; FULL gate green in-runner: tsc 0, jest 85/85 736/736, lint clean on touched files, build deferred to CI/Vercel)
- [x] Sprint 62 (2026-10-15) — Community route-request fan-out + location-only draft restore (routeRequestAudience config + getRouteRequestAudienceIds + POST audience fan-out + admin card; applyDraft 1-step restore + legacy hasContent; FAQ en+pcm) (routeRequestAudience 4 + routeDrafts +2 + posts community case; FULL gate green in-runner: tsc 0, jest 86/86 742/742, lint clean on touched files, build deferred to CI/Vercel)
- [x] Sprint 63 (2026-10-15) — Optimistic location-aware route-request fan-out + notification preferences (audience location { enabled/radiusKm/minNearby } + ephemeral-fix fan-out with community fallback; preferences config + NotificationPreference model/migration + service + central filter + GET/PUT API + gear modal; PM-verdict + location + preferences FAQs en+pcm) (notificationPreferences 5 + routeRequestAudience +3 location + posts audience-arg update; FULL gate green in-runner: tsc 0, jest 87/87 750/750, lint clean on touched files, build clean)
- [x] Sprint 64 (2026-10-15) — Offline coverage for landing/profile/notifications + authenticated-offline guest-banner fix (authOffline snapshot + pwa v6 destinations/APIs + GuestBanner suppression + LandingOfflineNotice + CachedDataNotice + offline.html/FAQ updates) (authOffline 5 + pwa +3; FULL gate green in-runner: tsc 0, jest 88/88 757/757, lint clean on touched files, build clean)
- [x] Sprint 65 (2026-10-16) — Post-card detail links + response-banner dismiss + vehicle contrast (postActions detailTextLinks fields + PostCard text Links; shareRoute dismiss copy + onClearResponse/dismissResponse + home/detail wiring; vehicles light text -800→-900) (postCardDetailLinks 4 + vehicles updates; FULL gate green in-runner: tsc 0, jest 89/89 761/761, lint exit 0 with 1 pre-existing untouched-file error, build clean)
- [x] Sprint 67 (2026-10-16) — Vehicle-aware journey times + persistent traffic overlay + post-card Navigate link (journeyTime registry speeds/sensitivity + geo/hook/service/API wiring; remapTrafficSegments + RouteMap/hook persistence; postActions navigate fields + PostCard link + ?navigate=1 auto-open) (journeyTime 16 assertions; node strip-types 27/27 in-runner, full gate deferred to CI — no node_modules in runner)
- [x] Sprint 68 (2026-10-16) — Navigation-guide map parity + tracing tooltips (shared trafficOverride zero re-retrieval; expand z-[70]; mapTooltips registry + detailed/mini tap tooltips) (mapTooltips 15 assertions; FULL gate green in-runner: tsc 0, jest 91/91 790/790, lint clean, build clean)
- [x] Sprint 69 (2026-10-16) — Leg-aware stretch tooltips + summary-bar tightening (leg helpers + tap-at-anchor; mapSummary guards; totalFareForSteps; guarded/dynamic bars) (mapSummary 10 + routeLegs 8 assertions; FULL gate green in-runner: tsc 0, jest 93/93 806/806, lint clean, build clean)
- [x] Sprint 70 (2026-10-16) — Consistent journey totals + resilient traffic cache + docs (range totals + largest-remainder stretch splits; persistent geometry-scoped cache + stale-while-revalidate + 120s refresh + local rebase; FAQ/privacy/terms/README refresh en+pcm) (journeyConsistency 10 assertions; FULL gate green in-runner: tsc 0, jest 94/94 816/816, lint clean, build clean)
- [x] Sprint 71 (2026-10-17) — Location input power-ups (paren/bracket coords, offline Plus Code decode + short-code recovery vs viewer `near`, numeric-address recall round-2; placeholders/empty-state from config) (locationIntent 22; FULL gate green in-runner: tsc 0, jest 95/95 838/838, lint pre-existing only, build clean)
- [x] Sprint 72 (2026-10-17) — Map tightening: friendly intent labels + plus-code locality, tap-to-assign pick card + Find on map CTA, vehicle-aware traces (mode pass + legacy fallback), deferred baseline recenter (followActive + idle watcher), 4 FAQ items en+pcm (mapVehicleProfiles + mapView + mapPicker suites; locationIntent →28; FULL gate green in-runner: tsc 0, jest 98/98 865/865, lint clean on touched files, build clean)
