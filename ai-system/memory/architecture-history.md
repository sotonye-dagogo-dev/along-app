# Architecture History

> **Metadata**
> - last-updated-by: execute-feature 2026-10-08 (Sprint 11 close-out)
> - last-verified-against-code: 2026-10-08
> - staleness-policy: historical entries do not go stale — only the current architecture (in system-architecture.md) needs re-verification

> **Overview:** Chronological record of how the Along system architecture has evolved. Useful for understanding why things are structured the way they are, and for identifying patterns in how the codebase has grown.

---

## History

### 2026-06-02 — Initial Architecture

**State:**
Single Next.js 15 App Router application with PostgreSQL (Prisma 7), Upstash Redis caching, JWT auth, MapLibre GL maps, Ant Design 5 UI components, Tailwind CSS 4 styling, Sentry error tracking, Cloudinary images, Resend email, and Web Push API notifications. The application follows a layered architecture: Next.js App Router → API Routes (Zod validated) → OOP Service Layer (BaseRepository pattern) → Prisma ORM → PostgreSQL. The frontend uses a universal component library (App* wrappers around Ant Design) with context-driven state management.

**Rationale:**
Next.js 15 provides SSR, streaming, and API routes in a single codebase, simplifying deployment. Prisma with PostgreSQL offers type-safe database access for the complex relational data model (14 models). Ant Design provides comprehensive UI components for both the social feed and data-heavy admin dashboard. Redis caching reduces database load for the read-heavy social feed. PWA support enables mobile usage on slow connections common in the target West African market.

**Key Architectural Decisions:**
- Config-driven architecture (all hardcoded values in centralized registries)
- OOP service layer with BaseRepository<T> generic CRUD base class
- Universal component library (App* wrappers) to decouple from Ant Design
- Zero emoji policy with Lucide React for all icons
- Mobile-first responsive design with PWA offline support
- JWT auth with httpOnly cookies (no NextAuth.js)
- Cursor-based pagination for feed and search
- Zod validation on every API endpoint
- Offline-first: `OnlineStatusProvider` + `offlineQueue` for reconnection resilience
- Push notifications via Web Push API + QStash for background delivery
- Blog content as MDX files on filesystem (no CMS dependency)

---

### 2026-06-03 — Application Code Generation

**State:**
All application code modules generated: 25 config registries, 34 UI components, 6 providers, 11 services, 11 utils, auth/dashboard/admin/public pages, push notification system (4 API routes), QStash workers (3 endpoints), blog with MDX posts, FAQ page with structured data.

**Rationale:**
Full application code was needed to move from infrastructure-only state to a working product. The layered architecture (config → components → providers → services → data) was preserved, with push notifications and offline support added as critical features for the West African target market where connectivity is unreliable.

**Key Architectural Decisions:**
- Push subscriptions stored in Prisma `PushSubscription` model with upsert semantics
- QStash workers use signature verification (Receiver) for secure server-to-server calls
- blog utility uses `fs` for build-time MDX parsing — no external CMS
- `siteConfig` utility uses read-through cache (Redis → Prisma → default)
- Two `useRequireAuth` variants: router-redirect (`app/hooks/`) and permission-checker (`app/lib/hooks/`)
- `OfflineQueue` uses localStorage for persistence with `fetch` replay on flush

---

### 2026-09-16 — Reset-Mail False Positive Fix

**State:**
Forgot-password returned success without Resend ever sending. Root cause: fire-and-forget email with no send-result verification. Fix: check Resend send result and surface failure instead of false success (commit `a347a9c`).

**Rationale:**
A success toast for an unsent email is worse than an error — the user waits for mail that never arrives. Every background email must verify the provider result and degrade honestly.

---

### 2026-09-29 — Durable DB Reset Tokens

**State:**
Password-reset links reported "expired or invalid" within seconds. Root cause: tokens lived in Redis/in-memory OTP store subject to timeout fallback and multi-instance loss. Fix: `PasswordResetToken` Prisma model — reset tokens persisted in Postgres with expiry, independent of cache (commit `d589183`).

**Rationale:**
Security tokens must be durable, not cache-resident. Cache is best-effort by policy (timeout + memory fallback); anything correctness-critical (auth tokens, reset links) belongs in the database.

---

### 2026-10-07/08 — Sprint 7: Route Requests E2E, Client Caching, Seed Hygiene

**State:**
`PostType` enum (`ROUTE`/`ROUTE_REQUEST`/`ROUTE_RESPONSE`) + `Post.description` + `Post.quotedPostId` self-relation; `NotificationType` extended (`WELCOME`/`ROUTE_REQUEST`/`ROUTE_RESPONSE`/`REWARD`/`BADGE`/`VERIFIED`); new `GET /api/suggestions` (1800s cache) and `GET /api/bookmarks`; client `memoryCache` + `useCachedFetch` wired into home/notifications/analytics/post/profile/explore with `feedStream` hydration + hidden-tab pause; server `CACHE_KEYS` slots (notifications/post/analytics/leaderboard/suggestions) with write invalidation; `RequestRouteModal` + `ShareRouteModal` response mode + `PostCard` Respond CTA/quote block; `EndlessCarousel` + mobile `SuggestionsRail` + live `SuggestionsPanel`; seed backup/clear/restore scripts + `db:*` package scripts; landing preview = latest real posts, About reviews → `SITE_REVIEWS` config; scroll-aware new-posts prompt; analytics/responsive sweep; per-tab profile filtering; state-strategy decision (no redux — keep memoryCache/useCachedFetch/feedStream). QA gate green: tsc 0, lint warnings-only, 122/122 jest (11 suites), next build clean.

**Rationale:**
Route requests close the loop between "I need a route" and "here is a route" without leaving the feed; client caching removes skeleton flash and cuts redundant reads while server Redis slots bound staleness; seed tooling makes glide-path to production data safe (backup-first, markers-only).

**Key Architectural Decisions:**
- Response posts quote the request via `quotedPostId` self-relation (no duplication, deep-linkable)
- `useCachedFetch` implements the SWR subset needed (TTL, dedup, mutate) — SWR/React Query rejected as migration churn
- No global store (redux/zustand) — see `memory/project-decisions.md` 2026-10-07 entry

---

### 2026-10-08 — Sprint 8: Search E2E (no migration, no new deps)

**State:**
`searchService.ts` (unified posts + users + related-tags; Prisma `contains`/`insensitive`, P2022 avatarConfig fallback, Redis read-through 120s); `GET /api/search` (`q`/`type`/`region`/`postType`/`cursor`, search-bucket rate limit, guest-accessible, sanitized errors); guest-accessible `/search` page (debounced, All/Routes/People tabs, PostCard/FollowButton reuse) fixing dead SuggestionsPanel `/search?q=` links; `apiRegistry` search entry + `/search` middleware guest route. No schema change, no migration, no new dependencies. QA gate green: tsc 0, 139/139 jest (13 suites), lint zero-new-errors, build clean.

**Rationale:**
`contains`/`insensitive` chosen over Postgres full-text/GIN indexes deliberately — zero-migration and non-breaking for current scale; GIN/trigram is a future optimization. Cursor pagination is post-id based (user hits top-N per query), matching the routes-drive-discovery product shape.

**Key Architectural Decisions:**
- Reuse existing `CACHE_KEYS.search` / `CACHE_TTL.searchResults` / `RATE_LIMITS.search` slots instead of new config surface
- Repair-system patterns honored verbatim (P2022 fallback, never-throw Redis, sanitized errors, `data.field ?? []` guards)

---

[New entries added here as architecture evolves]

---

## Sprint 9 — Scroll-Based Carousel, Collapsed Share Sections, Request Trigger (2026-10-08)

**Change:** Replaced the CSS-keyframes EndlessCarousel (pause-only, snap-back drag) with scroll-based autoplay (`requestAnimationFrame` advancing native `scrollLeft`, wrap by half-track width) inside its own `overflow-hidden` wrapper; home feed column now owns the mobile rail so tape overflow never reaches the feed. ShareRouteModal starts with route preview + DraftingCoach collapsed (`SHARE_ROUTE_MODAL_CONFIG`), route form collapsible, Save-Draft/Share actions moved to a full-width footer below preview+score. New `RequestRouteTrigger` query-style icon ("Request?" tooltip/tagline, `REQUEST_ROUTE_TRIGGER_CONFIG`) beside the existing Request button. Footer link grid is `grid-cols-3` at all breakpoints via `FOOTER_CONFIG.layout`. Three new zero-dep configs (carousel/shareRoute/routeRequest); 30 config files, 14 test files (143 tests incl. 4 new config suites, unexecuted in this runner — no node_modules).

**Reason:** Directive UX tightening — carousel overflowed the feed and fought user scrubbing; modal buried preview/score above the actions; request flow had no icon affordance; footer stacked to one column on mobile.

**Alternatives Considered:**
- CSS animation with `animation-delay` offset tricks for scrub-resume: rejected — delay math can't track arbitrary native scroll positions; scrollLeft is the single source of truth.
- Sidebar-injected action buttons under preview/score: rejected — full-width footer below the two-column body keeps actions visible after both columns on all breakpoints with one layout.

**Implications:** Carousel autoplay speed derives from measured half-track width / configured duration; new collapsible/modal/footer behaviour is config-flippable without code edits.

---

## Sprint 11 — Posting Fix, Response/Draft Linkage, Toast Single-Timer, Post Actions, Shared Reviews Tape (2026-10-08)

**Change:** Fixed the universal share failure (`description: ""` vs `z.min(10).optional()` — new generic description input, client omits blanks, server preprocess-tolerant, friendly first-field `message` + server warn log, `waypoints` accepted by schema). Response composer inherits request tags; drafts carry `description` + `responseTo` ref with a panel badge and restore-time linkage. Toast timing centralized in `TOAST_CONFIG` with GlobalUndoToast as the single timer owner (provider remounts per toast; fixed close() self-recursion). PostCard Copy link + Report dialog (`POST_ACTIONS_CONFIG`) filing linked bug-reports with reporter attribution. About reviews now ride the shared `EndlessCarousel`. Two new zero-dep configs (toast/postActions); 33 config files, 15 test suites (149 tests). QA gate green in-runner: tsc 0, jest 149/149, next build clean, lint clean for touched files.

**Reason:** Directive tightening — posting was broken for both normal shares and request responses with misleading feedback; response drafts lost linkage; toast bar vanished early; report/copy menu items were no-ops; reviews tape was a bespoke janky implementation.

**Alternatives Considered:**
- New dedicated `/api/reports` table/route: rejected — `BugReport` already has `postId` + `metadata`, so an additive extension covers moderation triage with zero migration.
- Separate reviews carousel component with its own physics: rejected — `EndlessCarousel` already takes generic `ReactNode[]`; reuse keeps one animation implementation to maintain.

**Implications:** Description remains optional end-to-end (blank posts now pass); `message` on 400s is additive (existing `error`/`details` assertions unaffected); report triage flows through the existing bug-report admin surface.
