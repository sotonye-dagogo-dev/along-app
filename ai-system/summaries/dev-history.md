# Development History

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-08 (Sprint 16 early-adopter badge + reset unhook)
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
