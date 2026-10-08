# Development History

> **Metadata**
>
> - last-updated-by: update-ai-system 2026-10-08
> - last-verified-against-code: 2026-10-08
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
- `next.config.mjs` — Restricted `images.remotePatterns` from wildcard `**` to explicit allowlist (res.cloudinary.com, *.cloudinary.com, lh3.googleusercontent.com, etc.)
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
- design-system.md — primary tokens corrected to green brand (#00623B/#00A862/#004A2C from globals.css @theme), radius/shadow tokens corrected to real scale, App* described as Tailwind + Lucide (zero antd imports in app/, antd dep unused), mobile tabs corrected to Home/Explore/Share-FAB/Bookmarks/Profile, UI count 42 files, freshness → 2026-10-08
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
