# Project Plan

> **Metadata**
> - last-updated-by: execute-feature 2026-10-09 (Sprint 27 admin verify + push prompt + OTP feedback)
> - last-verified-against-code: 2026-10-09 (Sprint 27 rows: authVerification/pushPrompt registries + useOtpResend + admin PATCH actions present in code; static-level verification only — tsc/jest/build deferred to CI, no node_modules)
> - staleness-policy: re-verify if project scope or phase changes

> **Overview:** High-level feature checklist for Along — a social travel-intelligence platform for West African urban commuters. Phases follow the Roadmap (docs/ROADMAP.md). Agents update checkboxes as work is completed.

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
- [x] Universal App* component library built (34 components, including AppLogo, GuestBanner, OfflineIndicator)
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
- [x] Feed with pagination (`app/api/posts/feed/`, `app/lib/services/feedService.ts`)
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
- [x] Search — unified posts + users + tags search (`GET /api/search`, `searchService.ts`, `/search` page; contains/insensitive queries + Redis cache, no migration needed; 2026-10-08)
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
- [x] Service worker update flow (`public/sw.js`)

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
- [ ] Component tests for App* components
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
