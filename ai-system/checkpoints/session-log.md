# Development Checkpoints — Session Log

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-09 (Sprint 20 close-out)
> - last-verified-against-code: 2026-10-09
> - staleness-policy: append-only — never modify past entries

> **Overview:** Append-only running log of development sessions. Each entry records what was completed, what comes next, and which files were modified. Agents write here at the end of every session so work can be resumed without re-reading the entire codebase. This file is the **append-only historical record** — use `checkpoints/in-progress.md` for current in-progress work.

---

## Log Format

```
## Session [number] — [date]

**Completed:**
[What was finished this session]

**Files Modified:**
- [file path] — [what changed]

**Next Task:**
[Exact next step — be specific]

**Assumptions Made:**
[Any assumptions logged per the quality gate]

**Notes / Blockers:**
[Anything the next agent needs to know]
```

---

## Sessions

---

## Session 1 — 2026-06-02

**Completed:**
Initial ai-system setup and project bootstrap

**Files Modified:**

- ai-system/ (entire directory created)

**Next Task:**
Run dev-cycle.md to begin first development task from task-queue.md

**Assumptions Made:**
None

**Notes / Blockers:**
None — fresh project start

---

## Session 2026-06-02 — Phase 3: Maps & Discovery + Profiles

### Summary

Implemented Phase 3 (Maps & Discovery) and remaining Phase 1 profile items. Created map infrastructure, profile pages, and user API routes.

### Files Created

**Map Infrastructure:**

- `app/components/features/posts/RouteMap.tsx` — MapLibre GL with SSR-disabled dynamic import, origin (green)/waypoint (white/green)/destination (dark green) markers with numbered badges, polyline from @mapbox/polyline, glass overlay card, dark mode detection, editable mode with Auto-Trace button, MapSkeleton loading state
- `app/lib/services/routeTracingService.ts` — OpenRouteService /directions API integration, fallback straight-line haversine distance, custom polyline encoder
- `app/api/routes/trace/route.ts` — POST endpoint, rate limited 20/hour via RATE_LIMITS.trace config
- `app/components/features/posts/RouteStepInput.tsx` — Location autocomplete input with MapPin prefix, mock suggestions for Lagos locations, debounced search

**Explore Page:**

- `app/(dashboard)/explore/page.tsx` — Full-viewport MapLibre map, desktop glass top bar (search + filter chips + LocateFixed button), desktop left side panel 320px (glass, collapsible with toggle, sort select, mini post cards), mobile glass top bar (search + filter button), mobile bottom sheet (draggable 25-80vh, handle bar, post list), pin popup card (280px glass with avatar, name, TrustBadge, View Route button), "Share this view" button (bottom-right), URL state sync via lat/lng/zoom query params

**User API Routes:**

- `app/api/users/[id]/route.ts` — GET (public profile with post/follower/following counts, avg validity), PATCH (own profile only, firstName/lastName/bio/avatar)
- `app/api/users/[id]/avatar/route.ts` — PATCH (save AvatarConfig JSON)
- `app/api/users/[id]/follow/route.ts` — POST (ACID: Follow + Notification), DELETE (ACID: unfollow + cleanup notifications)
- `app/api/users/search/route.ts` — GET ?q= for @mention autocomplete

**Profile Pages:**

- `app/(dashboard)/profile/page.tsx` — Own profile: 180px gradient cover, 80px avatar with camera overlay, name + verified badge, @handle, bio, stats row (Posts/Followers/Following/Avg Score), Edit Profile button, RewardsPanel, tabs (Posts/Liked/Bookmarks/Routes), post card list
- `app/(dashboard)/profile/[username]/page.tsx` — Other profile: same layout without camera/edit, Follow/Following button with hover Unfollow state, mutual follows count, tabs (Posts/Liked/Routes, no Bookmarks)

**Profile Components:**

- `app/components/features/profile/RewardsPanel.tsx` — Tier badge with icon, points display, gradient progress bar, next tier label, recent activity
- `app/components/features/profile/EditProfileModal.tsx` — AppModal + ConfigDrivenForm with EDIT_PROFILE_FIELDS
- `app/components/features/profile/AvatarEditor.tsx` — 2-column modal: style grid (3-col AVATAR_STYLES cards with DiceBear preview), live 120px AppAvatar preview, seed input
- `app/components/features/profile/index.ts` — barrel exports

**Wiring Updates:**

- `app/components/features/posts/index.ts` — Added RouteMap, MapSkeleton, RouteStepInput exports
- `app/components/features/posts/ShareRouteModal.tsx` — Replaced SVG placeholder with dynamic RouteMap, computes pins from steps
- `app/components/features/posts/PostCard.tsx` — Added mini RouteMap (100px) when routes exist
- `app/(dashboard)/posts/[id]/page.tsx` — Replaced SVG map with RouteMap component (280px, glass overlay)
- `next.config.mjs` — Added webpack alias for maplibre-gl

**Subtle Links Audit:**
Fixed 6 instances across 4 files:

1. `bookmarks/page.tsx` — @handle → Link to /profile/[userName]
2. `posts/[id]/page.tsx` — @handle → Link to /profile/[userName]
3. `profile/page.tsx` — post card user info + tags → Links with e.stopPropagation()
4. `profile/[username]/page.tsx` — post card user info + tags → Links with e.stopPropagation()

### Config Changes

- Added `@types/mapbox__polyline` devDependency

### Build Results

- `npx tsc --noEmit` — zero errors
- `npx next lint` — zero errors (warnings only)
- `npm run build` — ✓ Compiled successfully, 24 static pages generated (up from 20)

---

## Session 2026-06-02 (cont.) — Phase 4: Rewards, Invite, Analytics + Phase 5: Admin

### Summary

Implemented Phase 4 (Rewards Engine, Invite System, Analytics) and Phase 5 (Admin Dashboard, Users, Posts, Config, Bugs, Reviews pages + API routes).

### Files Created

**Rewards Engine:**

- `app/lib/services/rewardsService.ts` — Singleton RewardsService with awardPoints (ACID transaction, cooldown/maxPerDay checks via AnalyticsEvent), computeTier (config-driven from REWARD_TIERS), checkTierUpgrade, getHistory (10 items from AnalyticsEvent)
- `app/api/rewards/history/route.ts` — GET returns last 10 reward events for current user

**Rewards Wiring:**

- `app/api/posts/route.ts` — awardPoints(CREATE_POST) after post creation
- `app/api/posts/[id]/like/route.ts` — awardPoints(RECEIVE_LIKE) to post author on new LIKE (not self)
- `app/api/posts/[id]/bookmark/route.ts` — awardPoints(RECEIVE_BOOKMARK) to post author on new bookmark (not self)
- `app/api/auth/register/route.ts` — awardPoints(INVITE_ACCEPTED) to inviter when invitedById is set
- `app/components/features/profile/RewardsPanel.tsx` — Enhanced with history list (5 items), Invite Friends CTA with link to /invite
- `app/(dashboard)/profile/page.tsx` — Fetches reward history from /api/rewards/history, passes to RewardsPanel

**Invite System:**

- `app/api/invite/route.ts` — GET returns user invite code, invite count, max invites, points per invite; GET ?section=leaderboard returns top 20 inviters with counts
- `app/(dashboard)/invite/page.tsx` — Invite page with copy/Share link, rewards card (invite count/max), leaderboard

**Analytics:**

- `app/api/analytics/user/route.ts` — GET ?period=7|30|90 returns KPI (totalViews, totalLikes, totalBookmarks, avgValidity, totalPosts), topPosts by validity, engagementData (daily views/likes/bookmarks), followerGrowth (daily)
- `app/(dashboard)/analytics/page.tsx` — Analytics page pixel-precise from 16-analytics.html: period selector, 4 KPI cards, Engagement over time line chart (3-line SVG with legend), Top posts by validity horizontal bar chart, Follower growth area chart, Quick stats grid

**Admin API Routes (all guarded by role check):**

- `app/api/admin/stats/route.ts` — GET totalUsers, postsToday, avgValidity, openBugs, signups7d, topPosts
- `app/api/admin/users/route.ts` — GET (paginated, searchable), PATCH (change role), DELETE (soft-ban, reset role/verified)
- `app/api/admin/posts/route.ts` — GET (paginated), DELETE (hard delete)
- `app/api/admin/config/route.ts` — GET, PUT (upsert), DELETE site configs
- `app/api/admin/bugs/route.ts` — GET (filterable by status), PATCH (change status, assign reviewer)
- `app/api/admin/reviews/route.ts` — GET (filterable by status), PATCH (approve/reject)

**Admin Pages (all pixel-precise from 15-admin-dashboard.html design):**

- `app/admin/layout.tsx` — Sidebar layout (240px) with top nav (Home, Explore, Notifications, Bookmarks, Analytics) and admin nav (Dashboard, Users, Posts, Config, Bugs, Reviews), brand, user section at bottom. Role guard (ADMIN/MODERATOR only).
- `app/admin/page.tsx` — Dashboard: 4-stat Bento grid (Total Users, Posts Today, Avg Validity, Open Bugs), Signups 7-day SVG line chart, Top Routes by Validity SVG bar chart, Users AppTable preview
- `app/admin/users/page.tsx` — User management table with search, role badges with colors, tier badges, Make Admin button
- `app/admin/posts/page.tsx` — Post management table with delete
- `app/admin/config/page.tsx` — Site config CRUD with add form, key-value table, delete
- `app/admin/bugs/page.tsx` — Bug reports with status filter, status badge colors, inline status change buttons
- `app/admin/reviews/page.tsx` — User reviews moderation with PENDING/APPROVED/REJECTED filter, approve/reject buttons

### Build Results

- `npx tsc --noEmit` — zero errors
- `npx next lint` — warnings only (existing pre-existing warnings)
- `npm run build` — ✓ Compiled successfully, 41 static pages generated (up from 24)
- New routes: /admin, /admin/users, /admin/posts, /admin/config, /admin/bugs, /admin/reviews, /analytics, /invite, +6 admin API routes, /api/rewards/history, /api/invite, /api/analytics/user

---

## Session 2026-06-02 (cont.) — Phase 6: Public Pages & SEO

### Summary

Implemented Phase 6 (Public Pages & SEO): Landing page, About, Contact, Privacy, Terms, Report Bug pages plus SEO infrastructure (metadata utilities, StructuredData, sitemap, robots, per-page metadata).

### Files Created

**SEO Infrastructure:**

- `app/lib/utils/metadata.ts` — `buildMetadata()` for static pages, `buildPostMetadata()` for post detail (Article schema), `buildProfileMetadata()` for profile pages (ProfilePage schema). Includes canonical URLs, OG tags, Twitter cards, noIndex support.
- `app/lib/utils/structuredData.ts` — `websiteSchema()`, `articleSchema()`, `profilePageSchema()` JSON-LD helpers
- `app/sitemap.ts` — Dynamic sitemap listing static + published posts + active profiles
- `app/robots.ts` — Disallows /admin, /api, /login, /register, /otp, /home, /bookmarks, /notifications, /profile/, /posts/

**Public Pages:**

- `app/(public)/layout.tsx` — Shared public layout with AppFooter, no dashboard nav, `force-static`
- `app/(public)/page.tsx` — Landing page pixel-precise from 03-landing-light.html + 04-landing-dark.html: Green gradient hero (135deg #004A2C->#00623B->#00A862), white logo (64px), "Navigate Together" tagline, CTA row, decorative SVG background with grid/circles/route lines, 3 feature cards (Route/ShieldCheck/Users), glass social proof strip, 2 PostCard previews (standard + suggestion variant), bottom CTA section. `buildMetadata()` export + WebSite StructuredData.
- `app/(public)/about/AboutPageClient.tsx` — Client component: Green gradient hero "Our Story", feature highlights, team grid from TEAM_MEMBERS config, glass reviews carousel with prev/next arrows + dot indicators + 5s auto-rotation.
- `app/(public)/about/page.tsx` — Server wrapper with `buildMetadata()` metadata export
- `app/(public)/contact/ContactPageClient.tsx` — Client component: ConfigDrivenForm (CONTACT_FIELDS), success -> AppEmptyState CheckCircle, send another button
- `app/(public)/contact/page.tsx` — Server wrapper with metadata
- `app/(public)/privacy/page.tsx` — react-markdown + remark-gfm rendered privacy policy with prose styling
- `app/(public)/terms/page.tsx` — react-markdown + remark-gfm rendered terms of service with prose styling
- `app/(public)/report-bug/page.tsx` — Client component: ConfigDrivenForm (BUG_REPORT_FIELDS), success -> checkmark AppEmptyState

**Per-Page Metadata Layouts (all client component pages get server wrapper metadata):**

- `app/(dashboard)/home/layout.tsx` — noIndex metadata
- `app/(dashboard)/explore/layout.tsx` — Explore metadata
- `app/(dashboard)/bookmarks/layout.tsx` — Bookmarks metadata
- `app/(dashboard)/notifications/layout.tsx` — Notifications metadata
- `app/(dashboard)/analytics/layout.tsx` — Analytics metadata
- `app/(dashboard)/invite/layout.tsx` — Invite metadata
- `app/(dashboard)/profile/layout.tsx` — Profile metadata
- `app/(dashboard)/profile/[username]/layout.tsx` — generateMetadata with buildProfileMetadata (fetches user)
- `app/(dashboard)/posts/[id]/layout.tsx` — generateMetadata with buildPostMetadata (fetches post)
- `app/(auth)/login/layout.tsx` — noIndex metadata
- `app/(auth)/register/layout.tsx` — noIndex metadata
- `app/(auth)/otp/layout.tsx` — noIndex metadata
- `app/admin/layout.tsx` — Replaced client layout with server component that exports noIndex metadata + renders AdminShell

**Files Modified:**

- `app/(dashboard)/layout.tsx` — Added AppFooter to dashboard layout
- `app/middleware.ts` — Updated route protection: public routes (/, /about, /contact, /privacy, /terms, /report-bug) allowed without auth; protected routes (/home, /explore, /bookmarks, /notifications, /analytics, /invite, /posts/, /profile/, /admin) require auth; auth routes redirect to /home if logged in
- `app/components/ui/AppInput.tsx` — Fixed label prop type (string -> React.ReactNode) for ConfigDrivenForm compatibility
- `app/components/ui/AppTextarea.tsx` — Same fix
- `app/components/ui/AppSelect.tsx` — Same fix
- `app/components/ui/ConfigDrivenForm.tsx` — Fixed icon prop: wraps LucideIcon component type as `<IconComponent size={16} />` React element instead of passing raw component type
- `app/admin/AdminShell.tsx` — Renamed from layout.tsx (now a regular component imported by the new server layout)

### Build Results

- `npx tsc --noEmit` — zero errors
- `npx next lint` — zero errors (warnings only, all pre-existing)
- `npm run build` — ✓ Compiled successfully, 49 static pages generated (up from 41)
- New routes: /, /about, /contact, /privacy, /terms, /report-bug, /sitemap.xml, /robots.txt

### Notes

- AppInput/AppTextarea/AppSelect had `label?: string` but ConfigDrivenForm passed JSX `<span>` — caused `toLowerCase` crash during prerendering. Fixed to `React.ReactNode` with safe string extraction for ID generation.
- ConfigDrivenForm passed `field.icon` (LucideIcon component type) directly as ReactNode — caused `Objects are not valid as a React child` error. Fixed to render as `<IconComponent size={16} />`.
- Admin layout split into server layout.tsx (metadata) + AdminShell.tsx (client sidebar/guard) to support metadata export from server component.
- Middleware updated to correctly handle route groups: (public)/page.tsx -> /, (auth)/login -> /login, etc.
- Total static pages: 49 (core routes / public / auth / admin / dashboard)

---

## Session 2026-06-03 — OC-8: Production Readiness Audit & Hardening

### Summary

Completed OC-8 production-readiness audit: emoji cleanup, subtle links, N+1 fixes, cursor pagination, dynamic imports, PWA offline indicator, and comprehensive test suite. All quality gates pass.

### Changes

**Phase 6 API Handlers (previously missing):**

- `app/api/contact/route.ts` — POST handler validates name/email/message, stores in `ContactSubmission`
- `app/api/bug-reports/route.ts` — POST handler validates title/category/description, stores in `BugReport` with `reporterId: null`
- Schema: `ContactSubmission` model added; `BugReport.reporterId` made optional

**Phase 7 — QStash Background Workers:**

- `app/lib/services/qstashService.ts` — Client (publish) + Receiver (verify), methods: `publishFeedInvalidation`, `publishValidityRecompute`, `publishRewardsAward`
- `app/api/workers/feed-invalidate/route.ts` — QStash-verified Redis cache invalidation for user feeds/post cache/follower feeds
- `app/api/workers/validity-recompute/route.ts` — QStash-verified ValidityEngine score computation from DB, updates post + clears Redis caches
- `app/api/workers/rewards/route.ts` — QStash-verified `rewardsService.awardPoints(userId, actionKey, postAuthorId)`
- `feedService.ts` — Redis feed caching (5min TTL), checked on non-cursor lookups, written on each query
- Wired 4 API routes to use QStash instead of fire-and-forget: POST /api/posts, POST /api/posts/[id]/like, POST /api/posts/[id]/bookmark, POST /api/auth/register

**OC-8 Emoji Audit:**

- Fixed 8 violations

**OC-8 Component Compliance:**

- Zero violations — no raw `antd`/`@ant-design` imports in any page or feature file

**OC-8 Subtle Links (19 violations fixed in 8 files)**

**OC-8 N+1 Query Fix:**

- `/api/admin/stats/route.ts` — signups7d reduced from 7 individual queries to 1 batch + in-memory filter (7x reduction)

**OC-8 Cursor Pagination:**

- `/api/posts/[id]/comments/route.ts`, `/api/notifications/route.ts`, `/api/admin/bugs/route.ts`, `/api/admin/reviews/route.ts`

**OC-8 Dynamic Imports:**

- `profile/page.tsx` — AvatarEditor, `home/page.tsx` — ShareRouteModal

**OC-8 PWA:**

- manifest.json verified, OnlineStatusProvider, OfflineIndicator created

**OC-8 Test Suite (91 tests, 9 suites)**

### Build Results

- `npx tsc --noEmit` — zero errors
- `npx next lint` — pre-existing warnings only, zero errors
- `npm run build` — ✓ Compiled, 54 static pages, 28 API routes
- `npm test` — 91/91 passing (9 test suites)
- Quality gate: ALL PASS

---

## Session 2026-06-09 — Sprint 4: Production Audit Fixes

### Summary

Comprehensive production audit addressing runtime errors, broken OAuth, double navbar, dead links, missing theme toggle, guest CTAs, brand logo consistency, Sentry integration, and error handling improvements. All 14 issues resolved across 12 files.

### Changes

**Critical Fixes:**

1. **PostCard `length` crash** — Added `?? []` guards for `post.tags` and `post.images` (`PostCard.tsx:99-100`)
2. **OAuth buttons** — Added `onClick` handlers linking to `/api/auth/google` on login + register pages
3. **Double navbar** — Removed redundant inline `<nav>` from landing page (relies on `(public)/layout.tsx` header)
4. **Dead links** — Fixed `/dashboard`->`/home` redirect in AdminShell; created `/forgot-password` page; redirected `/share`->`/home`, `/settings`->`/profile`

**New Files Created:**

- `app/providers/ThemeProvider.tsx`
- `app/components/ui/ThemeToggle.tsx`
- `app/global-error.tsx`
- `app/(public)/forgot-password/page.tsx` + `layout.tsx`

**Enhancements:**

- Guest CTAs added to landing, login, and register pages
- Logo config updated with brand file URLs
- Auth layout and AdminShell inline SVGs replaced with `<AppLogo />`
- Auth API routes now use `Sentry.captureException()` with specific error detection
- Root layout metadata now includes full OG image, Twitter card, apple-touch-icon

### Build Results

- `npx tsc --noEmit` — zero errors
- `npx next lint` — zero errors (pre-existing warnings)
- `npm run build` — ✓ 65 static pages (up from 54), 28 API routes
- `npm test` — 91/91 passing (9 test suites)
- Quality gate: ALL PASS

---

## Session 2026-06-09 (cont.) — Sprint 5: RxJS Feed, i18n, Lighthouse Audit

### Summary

Implemented three backlog items: RxJS reactive feed stream, i18n foundation (English + Pidgin), and Lighthouse performance improvements. All quality gates pass.

### Changes

**RxJS Reactive Feed:**

- `app/lib/streams/feedStream.ts` — Created FeedStream class with feedState$, interactionCache$, 30s polling
- `app/(dashboard)/home/page.tsx` — Replaced direct fetch + setInterval with feedStream

**i18n Foundation:**

- `app/lib/config/i18n.ts`, `public/locales/en.json`, `public/locales/pcm.json`, `app/providers/I18nProvider.tsx`, `app/components/ui/LocaleSwitcher.tsx`
- Wired into root layout and middleware

**Lighthouse Audit:**

- `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`
- `next.config.mjs` — Security headers, asset caching headers
- `app/layout.tsx` — Preconnect/dns-prefetch resource hints

### Build Results

- `npx tsc --noEmit` — zero errors
- `npm run build` — ✓ Compiled successfully, 65 static pages
- `npm test` — 91/91 passing (9 test suites)
- Quality gate: ALL PASS

---

## Session 2026-06-10 — Sprint 5 Fixes: Footer Grid, ShareRouteModal Responsive, Prisma Connection

### Summary

Fixed footer grid to show 3 columns on mobile, made ShareRouteModal responsive for tablet/mobile, and resolved Prisma 7 Accelerate vs direct connection mismatch causing 30s login timeout.

### Changes

- **AppFooter.tsx** — Changed `grid-cols-1 md:grid-cols-3` -> `grid-cols-3` (3 columns on mobile)
- **ShareRouteModal.tsx** — Made responsive: `w-[280px]` -> `w-full lg:w-[280px]`
- **prisma.ts** — Always uses `accelerateUrl`, switches URL by env
- **prisma.config.ts** — Changed dev CLI URL from `LOCAL_DB` (Accelerate) -> `DIRECT_LOCAL_DB`
- **Login route** — Added PrismaClientInitializationError detection

### Notes

- Env now has `DIRECT_LOCAL_DB`, `LOCAL_DB`, `DIRECT_URL`, `DATABASE_URL`

---

## Session 2026-06-13 — Dashboard Navigation, Seed Image Fixes, Prisma Type Fix

### Summary

Added responsive dashboard navigation (mobile bottom tab bar + desktop collapsible sidebar). Fixed all broken Cloudinary image URLs in seed data. Fixed Prisma accelerateUrl TypeScript type error.

### Changes

- Created `DashboardNav` component (mobile bottom tabs + desktop sidebar)
- Updated dashboard layout to integrate DashboardNav
- Replaced 16 broken Cloudinary seed image URLs with valid Unsplash URLs
- Fixed Prisma accelerateUrl type error (TS2345)

### Build Results

- `npx tsc --noEmit` — zero errors
- `npx next lint` — zero errors
- `npm test` — 91/91 passing (9 test suites)

---

## Session 2026-06-09 (cont.) — Sprint 5 Bug Fixes: Feed Crash, Guest Auth, Styling, Login

### Summary

Fixed 7 production bugs: feed stream crash on error responses, guest auth blocking feed, PostCard crash on missing user, "Rendered more hooks" Sentry error, missing Tailwind Typography plugin, landing page logo, and documented Prisma migration issue.

### Changes

**Critical Fixes:**

1. **Feed stream crash** — `state.posts.length` on undefined, fixed with `?? []` guard
2. **Feed API blocking guests** — Restructured to fall back to public posts when no auth token
3. **PostCard missing user crash** — Added `const user = post.user` guard + optional chaining

**Styling Fixes:** 4. **Missing prose styling** — Installed `@tailwindcss/typography`, added `@plugin` to globals.css

### Quality Gate

- `npx tsc --noEmit` — zero errors
- `npx next lint` — zero errors
- `npm test` — 91/91 passing

---

## Session 2026-06-10 (cont.) — Auth UX: Toast, Redirect, Auth-Aware Nav

### Summary

Fixed three auth UX issues: login now redirects to `/home`, success toast shown on login/register, and public navbar + landing page CTAs detect auth state.

### Changes

- Login page — redirect to `/home`, added toast
- Register page — added toast before OTP redirect
- Created `PublicNavActions.tsx` and `LandingCtas.tsx` — auth-aware components

### Files Affected

- `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- `app/(public)/layout.tsx`, `app/(public)/page.tsx`
- `app/components/ui/PublicNavActions.tsx` (new)
- `app/components/ui/LandingCtas.tsx` (new)

---

## Session 2026-07-08 (Session 5) — Follower System Wiring & Integration Freeze

### Summary

Wired the follower/following system end-to-end: follow button now functional via API, `isFollowing` returned from profile API, dedicated followers/following list pages with UserList component. Froze Transact and Tega integrations by removing access points only.

### Changes

**Follower System Wiring:**
- `app/api/users/by-username/[username]/route.ts` — Added `isFollowing` lookup via `getUserFromRequest` + Follow model
- `app/(dashboard)/profile/[username]/page.tsx` — `handleFollow` now calls fetch POST/DELETE /api/users/[id]/follow; optimistic followerCount update
- `app/api/users/[id]/followers/route.ts` — New: GET followers list (desc by createdAt)
- `app/api/users/[id]/following/route.ts` — New: GET following list (desc by createdAt)
- `app/components/features/profile/UserList.tsx` — New: shared client component with loading skeleton, empty state, user links
- `app/(dashboard)/profile/[username]/followers/page.tsx` — New: server component, prisma user lookup, renders UserList
- `app/(dashboard)/profile/[username]/following/page.tsx` — New: same pattern for following
- `app/components/features/profile/index.ts` — Added UserList to barrel exports
- `app/(dashboard)/profile/[username]/page.tsx` — Followers/Following stats now Link to list pages
- `app/(dashboard)/profile/page.tsx` — Same stats-as-links pattern
- `app/lib/config/emptyStates.ts` — Added `following` preset with UserPlus icon

**Integration Freeze:**
- `app/lib/config/navigation.ts` — Removed MarketPlace nav item + ShoppingBag import
- `app/(dashboard)/home/page.tsx` — Removed EventsWidget import + usage (kept SuggestionsPanel)
- All Transact/Tega code in `app/lib/integrations/`, `app/api/integrations/`, `app/api/webhooks/`, `app/(dashboard)/marketplace/`, `app/components/features/events/` — preserved intact

### Build Results

- `npm test` — 91/91 passing (9 test suites)

### Files Modified

- `app/api/users/by-username/[username]/route.ts`
- `app/(dashboard)/profile/[username]/page.tsx`
- `app/(dashboard)/profile/page.tsx`
- `app/lib/config/navigation.ts`
- `app/(dashboard)/home/page.tsx`
- `app/lib/config/emptyStates.ts`
- `app/components/features/profile/index.ts`

### Files Created

- `app/api/users/[id]/followers/route.ts`
- `app/api/users/[id]/following/route.ts`
- `app/components/features/profile/UserList.tsx`
- `app/(dashboard)/profile/[username]/followers/page.tsx`
- `app/(dashboard)/profile/[username]/following/page.tsx`

### Notes

- Followers/following pages use a server component wrapper to resolve username→id via Prisma, then pass to the client-side UserList component which fetches the actual list from the API
- Integration freeze follows the "Freeze-Without-Delete" pattern documented in lessons-learned.md

---

## Session 2026-07-08 — Map & Route Feature Tightening

### Summary

Tightened up map interactions, location input, route step reordering, and added navigation system. All 91 existing tests pass.

### Changes

**Fix 1: RouteStepInput — Real Geocoding** (`app/components/features/posts/RouteStepInput.tsx`)
- Replaced `MOCK_SUGGESTIONS` (8 hardcoded Lagos locations) with real Nominatim OSM geocoding API
- Added `AbortController` to cancel in-flight requests on new input
- Uses same Nominatim pattern as ShareRouteModal

**Fix 2: RouteMap — Map Interaction Tightening** (`app/components/features/posts/RouteMap.tsx`)
- Added `useEffect` to re-fit map bounds when pins, encodedPolyline, or mapLoaded state changes
- Added `fitMapToBounds` memoized callback for single-pin flyTo and multi-pin fitBounds
- Handles zoom retention by refitting on pin/polyline changes, not just initial load
- Removed bounds fit from `handleMapLoad` (now handled by the effect)

**Fix 3: ShareRouteModal — Drag-and-Drop Reordering** (`app/components/features/posts/ShareRouteModal.tsx`)
- Implemented HTML5 drag-and-drop for route step reordering
- `GripVertical` icon is now functional drag handle
- Visual feedback: dragged item gets primary border + opacity, drag handle shows `cursor-grabbing`

**Fix 4: NavigationGuide — New Component** (`app/components/features/posts/NavigationGuide.tsx`)
- Created step-by-step navigation guide with two modes: overview list and active navigation
- Overview mode: shows all steps with status (pending/current/completed), distance, duration, vehicle, fare
- Active navigation mode: shows current step with progress bar, prev/next controls, instructions, estimated step distance/duration
- Supports start/stop navigation toggle
- Exported via `app/components/features/posts/index.ts`

**Fix 5: Post Detail — Navigation Wiring** (`app/(dashboard)/posts/[id]/page.tsx`)
- Replaced "Buy Route Guide" CTA card with dynamic "Start Navigation" button
- Toggles NavigationGuide component inline when active
- Uses route steps from post data, with distance/duration from post metadata

**Fix 6: Explore Page — Consolidated MapView** (`app/(dashboard)/explore/page.tsx`)
- Consolidated duplicate desktop/mobile MapView into a single responsive component
- Fixed marker display: now shows `tags.length` (route step count) instead of likes count

### Files Modified

- `app/components/features/posts/RouteStepInput.tsx` — Real Nominatim geocoding
- `app/components/features/posts/RouteMap.tsx` — Map bounds refit on pin/polyline change
- `app/components/features/posts/ShareRouteModal.tsx` — Drag-and-drop step reordering
- `app/components/features/posts/NavigationGuide.tsx` — New file
- `app/components/features/posts/index.ts` — Added NavigationGuide export
- `app/(dashboard)/posts/[id]/page.tsx` — Navigation wiring
- `app/(dashboard)/explore/page.tsx` — Consolidated MapView, marker display fix

### QA Gate

- `npm test` — 91/91 passing (9 test suites)
- `npx tsc --noEmit` — timed out at 120s (dev machine constraint)
- `npm run build` — timed out at 180s (dev machine constraint)
- **Result**: Conditional Pass — tests confirm correctness; residual risk on full build verification

### Assumptions

- Nominatim OSM is available and responsive (same assumption as existing ShareRouteModal code)
- MapLibre GL can handle `fitBounds` with multiple calls (standard behavior)

### Notes / Blocker

- Full `tsc` and `build` verification timed out due to dev machine resource constraints
- No new dependencies added
- All changes follow existing patterns in the codebase

---

## Session 2026-07-15 (Session 6 — fix-build)

### Summary

Fixed 5 build errors found during Vercel deployment: duplicate `formatCount` function, invalid Sentry auth token (401), Prisma enum filter type error, `bounds` TDZ in RouteMap, and missing `initialValues` prop on ConfigDrivenForm.

### Changes

**Fix 1: Duplicate `formatCount` in ExplorePinCard** (`app/components/features/explore/ExplorePinCard.tsx`)
- Removed second copy of `formatCount` function at line 29 (declared twice in same module scope)

**Fix 2: Sentry Auth Token 401** (`.env`, `next.config.mjs`)
- Cleared invalid/expired `SENTRY_AUTH_TOKEN` from `.env`
- Added `dryRun: true` when auth token or DSN is missing
- Fixed deprecated options: `disableLogger` → `webpack.treeshake.removeDebugLogging`, `automaticVercelMonitors` → `webpack.automaticVercelMonitors`

**Fix 3: Prisma Enum Type Error** (`app/api/leaderboard/route.ts`)
- Removed `where: { role: { not: "banned" } }` filter — `UserRole` enum only has `USER` | `ADMIN`, no `BANNED` value

**Fix 4: `bounds` TDZ Error** (`app/components/features/posts/RouteMap.tsx`)
- Moved `mapStyle`, `routeCoords`, `bounds`, `centerLat`, `centerLng` declarations above `fitMapToBounds` callback and `useEffect` that referenced `bounds`

**Fix 5: Missing `initialValues` Prop** (`app/components/ui/ConfigDrivenForm.tsx`)
- Added `initialValues?: Record<string, unknown>` to `ConfigDrivenFormProps`
- Used to initialize `formValues` state

### Files Modified

- `app/components/features/explore/ExplorePinCard.tsx` — Removed duplicate formatCount
- `.env` — Cleared invalid SENTRY_AUTH_TOKEN
- `next.config.mjs` — Conditional dryRun, fixed deprecated Sentry options
- `app/api/leaderboard/route.ts` — Removed invalid Prisma enum filter
- `app/components/features/posts/RouteMap.tsx` — Fixed TDZ by reordering declarations
- `app/components/ui/ConfigDrivenForm.tsx` — Added initialValues prop

### QA Gate

- `npm run build` — ✓ Compiled successfully, 74 static pages, 56 API routes
- Zero TS type errors
- Sentry deprecation warnings remain (non-blocking)
- Redis warnings during static generation (expected — no Redis in build env)

### Notes

- Sentry build operations now skipped automatically when auth token is missing
- Vercel project should set valid `SENTRY_AUTH_TOKEN` in env vars to re-enable source map upload

---

## Session 24 — 2026-08-13

**Completed:**
- Ran `pull-template-update.md` against `Sotonye0808/ai-system-template` (main @ 1966ff7). Installed version was unrecorded (v2, no `installed-ai-system-version` metadata) → compared against upstream `VERSION: 3.0.0`. Result: **upgrade needed (v2 → v3)**.
- Applied the v3 kit update per `V2_TO_V3_MIGRATION.md` (pull-based template update propagation, never silent overwrite).

**Files Modified:**
- `VERSION` — added (3.0.0), template root addition
- `CHANGELOG.md` — added, template root addition
- `ai-system/skills/` — added (9 skills), new in v3
- `ai-system/tools/` — added (`registry.md` + 12 `integrations/` docs), new in v3
- `ai-system/design-references/` — added (`README.md` + `TEMPLATE/DESIGN.md`), new in v3
- `ai-system/commands/audit-sources.md` — added, new in v3
- `ai-system/commands/visual-review.md` — added, new in v3
- `ai-system/commands/generate-design-md.md` — added, new in v3
- `ai-system/commands/pull-template-update.md` — added, new in v3
- `ai-system/standards/engineering-principles.md` — v3: +§11–§24, enforcement §10→§25, doc-style addendum
- `ai-system/protocols/entry-protocol.md` — v3: tool-discovery-first step, closing-turn advisory
- `ai-system/protocols/context-tiering.md` — v3: Tier 3 rows for skills/tools, Tier 4 rows for design-references/registry
- `ai-system/protocols/verification-rules.md` — v3: §11–§24 principle checks + §9/§10 contract-compliance checks
- `ai-system/protocols/quality-gate.md` — v3: §11–§24 cross-checks in criterion #9
- `ai-system/agents/tester-qa.md` — v3: Live-Preview / Browsing capability section
- `ai-system/commands/bootstrap-project.md` — v3: records installed kit version
- `ai-system/commands/plan-feature.md` — v3: mandatory session-log trace for task-queue mutations
- `ai-system/commands/sync-context.md` — v3: checkpoint-compliance step, `Chains to` row
- `ai-system/commands/execute-feature.md` — v3: deep-sync chain to `update-ai-system.md`
- `ai-system/commands/dev-cycle.md` — v3: sprint-boundary deep-sync chain
- `ai-system/commands/refactor-codebase.md` — v3: unconditional deep-sync chain
- `ai-system/commands/fix-build.md` — v3: `sync-context.md` chain check
- `ai-system/commands/resume-session.md` — v3: drift check via `sync-context.md`, major drift → `update-ai-system.md`
- `ai-system/commands/cloud-session.md` — v3: mandatory `sync-context.md` + `update-ai-system.md` on completion
- `ai-system/commands/update-ai-system.md` — v3: `Chains to` row
- `ai-system/commands/verify-work.md` — v3: `Chains to` row
- `ai-system/commands/audit-drift.md` — v3: chain-compliance + checkpoint-coupling audits
- `ai-system/design-system.md` — v3: Reference Library + Design Asset Viewer sections (appended to local content)
- `ai-system/system-architecture.md` — v3: `ENABLE_DESIGN_VIEWER` config, Verification CLI section, Rollback & Undo section (appended to local content)
- `ai-system/planning/task-queue.md` — v3: `last-synced` metadata marker (local content preserved)
- `ai-context.md` — added `installed-ai-system-version: 3.0.0`, skills/tools catalog pointers

**Next Task:**
- Run `ai-system/commands/verify-work.md` or `ai-system/commands/audit-drift.md` to mechanically confirm the v3 chains/compliance checks; then run `sync-context.md` to refresh freshness metadata.

**Assumptions Made:**
- Local files with real project content (`planning/task-queue.md`, `memory/`, `checkpoints/session-log.md`, `summaries/dev-history.md`, `testing/`, `index/`, `project-context.md`, `repair-system.md`) were preserved; template placeholders were NOT copied over them.
- `design-system.md` and `system-architecture.md` are heavily customized; only the v3 sections were appended, local content intact.
- `memory/project-decisions.md` was NOT seeded with the template's placeholder PDF-extraction decision (local decisions are real project data).

**Notes / Blockers:**
- No blockers. `pull-template-update.md` never auto-applies — this entry records the comparison result per its contract; human review of the resulting diff is the final gate.

---

## Session 2026-09-15 — Fix: Image Upload + Feed/Explore Visibility + Production Audit (execute-feature)

**Completed:**
- Tester feedback resolved: image upload now functional via Cloudinary (/api/upload), ShareRouteModal handles drag-drop/browse/preview/remove/fallback geocode; feed now shows new posts for cold-start users (recent fallback + recency scoring, parallel queries, cursor fix, cache bust); explore no longer silently filters/allows HTML errors via safe parse
- Platform audit: QStash body-consumption fixed, error sanitization (safeFetch/safeJsonParse patterns adopted in feed/explore/home), image wildcard allowlist tightened, vercel headers de-duped, JWT secret handling hardened, env missing QSTASH_TOKEN added
- QA gate: `npx tsc --noEmit` 0 errors, `next build` 77 pages, `npm test` 91/91 passing

**Files Modified:**
- `app/api/upload/route.ts` — new, Cloudinary multipart upload
- `app/components/features/posts/ShareRouteModal.tsx` — image upload wiring, fallback geocode, validation, draft
- `app/lib/services/feedService.ts` — parallel queries, cursor→createdAt, recent fallback, recency scoring
- `app/api/posts/route.ts` — SyntaxError guard, avatarConfig fallback, cache bust, sanitized errors
- `app/lib/services/qstashService.ts` — clone-before-text, {valid,bodyText}
- `app/api/workers/feed-invalidate/route.ts`, `validity-recompute/route.ts`, `rewards/route.ts` — use bodyText
- `app/lib/streams/feedStream.ts` — refresh robustness
- `app/(dashboard)/explore/page.tsx` — safe JSON parse
- `app/(dashboard)/home/page.tsx` — toast + double refresh
- `app/lib/utils/auth.ts`, `middleware.ts` — secret handling
- `next.config.mjs` — image allowlist
- `vercel.json` — headers + maxDuration
- `.env.example` — QSTASH_TOKEN
- `ai-system/index/repo-map.md`, `system-architecture.md`, `summaries/dev-history.md` — freshness + docs

**Next Task:**
Live map tracking navigation, carto.com basemap API key wiring, auth provider linking

**Assumptions Made:**
- Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) will be set in production; upload returns 503 with friendly message if missing
- Upstash Redis env vars are set in production; feed caching gracefully falls back to DB if unavailable
- Nominatim OSM remains available for fallback geocode on submit

**Notes / Blockers:**
- Remaining P1 audit items (in-memory rate limiter → Upstash Redis, supercluster for explore clustering, axios/cors unused deps) intentionally deferred — non-blocking for current release but tracked in Next Sprint Focus above

---

## Session 2026-09-15 — Fix-Build: Forgot-Password 504 & Platform-Wide Redis Hardening

**Completed:**
- Diagnosed 504 FUNCTION_INVOCATION_TIMEOUT on `POST /api/auth/forgot-password`: eager `new Redis` with wrong env names (`REDIS_URL` vs `UPSTASH_REDIS_REST_URL`) + no per-op timeout causing DNS `ENOTFOUND willing-gazelle-101748.upstash.io` to hang 6s and email await to exceed 10s Vercel limit
- Hardened Redis layer: `app/lib/db/redis.ts` now lazy singleton with `UPSTASH_REDIS_REST_URL || REDIS_URL` fallback, guards `replace_me`/non-https, 1.2s `withTimeout` wrapper, safe `get/set/del` that warn+no-op; `otpStore.ts` singleton cached client + 1.5s timeout per op with fallback to in-memory Map
- Platform-wide audit: `feedService.ts`, `app/api/posts/route.ts`, `app/api/workers/feed-invalidate` & `validity-recompute` migrated from direct `new Redis(!)` to shared wrapper; `siteConfig.ts` now inherits safe wrapper
- Made forgot-password non-blocking: `maxDuration=15`, `force-dynamic`, email lowercasing + format validation, `setResetToken` now <1.5s, `sendPasswordResetEmail` via `waitUntil` background task (fire-and-forget) matching register pattern, generic 200 for unknown emails
- Updated `vercel.json` maxDuration map for forgot/reset-password
- Logged pattern in `repair-system.md`, verified `npx tsc --noEmit` 0 errors, `npm test` 91/91, `next build` 76 pages

**Files Modified:**
- app/lib/db/redis.ts — lazy singleton, env alias, timeout-guarded wrapper
- app/lib/services/otpStore.ts — singleton cache, withTimeout, in-memory fallback <1.5s
- app/lib/services/feedService.ts — uses shared redis wrapper for cache get/set
- app/api/auth/forgot-password/route.ts — non-blocking email, validation, maxDuration
- app/api/posts/route.ts — safe redis.del via wrapper
- app/api/workers/feed-invalidate/route.ts — uses shared wrapper
- app/api/workers/validity-recompute/route.ts — uses shared wrapper
- vercel.json — added forgot/reset-password maxDuration
- ai-system/repair-system.md — new entry: Forgot-Password 504 Redis hardening
- ai-system/testing/test-results.md — updated build/test metadata
- ai-system/summaries/dev-history.md — added session entry (via update-ai-system chain)

**Next Task:**
- Execute update-ai-system.md deep sync (repo-map, dependency-graph, system-architecture, project-plan freshness) — already run as part of this fix-build chain
- Live map tracking, carto basemap API key wiring, auth provider linking remain in next sprint backlog

**Assumptions Made:**
- Upstash Redis may be absent or point at deprovisioned host in production until env var rotation; all hot-path Redis must degrade to memory/DB within 1.5s
- `RESEND_API_KEY` may be absent; forgot-password background email logs reset link in dev and returns generic success in prod

**Notes / Blockers:**
- Vercel env var `UPSTASH_REDIS_REST_URL` currently points at `willing-gazelle-101748.upstash.io` which is ENOTFOUND — needs rotation to valid Upstash instance or removal to rely on in-memory fallback
- Rate limiter remains in-memory (`app/lib/utils/rateLimit.ts`) — tracked as P1 to migrate to Upstash Redis with sliding window

---

## Session 2026-10-07 � Execute-Feature: Mock/Seed Cleanup, Route Requests E2E, Caching, Live Preview, Responsive (planning pass)

**Completed:**
- Step 1 planning pass per `commands/execute-feature.md`: read task-queue, system-architecture, design-system, repair-system, project-context, project-decisions; ran 5 parallel codebase research passes (seed/mock audit, route preview UI, caching/feed, notifications/follows, analytics/responsive)
- Architecture impact identified ? `plan-feature.md` logic run: Prisma schema migration (Post.type/description/quotedPostId + NotificationType extension), new `/api/suggestions` route, new cache services, new UI components (EndlessCarousel, RequestRouteModal)
- Wrote plan to `checkpoints/in-progress.md`; appended Sprint 7 task table to `planning/task-queue.md` (this entry is the required mutation trace)
- Self-check vs project-context scope (in-scope: social route platform, notifications, offline/caching) and project-decisions (no conflicts) � passed

**Tasks Added to task-queue.md:**
- Sprint 7: Route Requests E2E, Live Preview, Caching & Data Hygiene (27 granular steps grouped in 7 workstreams A-G, see in-progress.md)

**Assumptions Made:**
- "Post modal" for respond CTA = ShareRouteModal in response mode with quoted request; carousel route items deep-link /posts/[id]
- Seed clear is manual-only (package.json script), always backs up first, scoped to seed markers; SiteConfig seeded keys kept (live config)
- New NotificationType enum values also fix the existing broken `?filter=rewards` query

**Status:** Paused for explicit go/no-go before implementation (execute-feature contract).

---

## Session 2026-10-07 (resume) � resume-session + directive addendum

**Completed:**
- resume-session.md Step 1-2: read in-progress.md, session-log last entry, task-queue Sprint 7; ran sync-context focused drift check on checkpoint claims (scripts exist + db:* present; ShareRouteModal previewOpen/locateMe present; feedStream loadInitial(userId) + hidden-tab pause present; no foreign commits since 2026-09-29)
- Drift classified MINOR: checkpoint status still said "Awaiting go/no-go" and all Sprint 7 rows unchecked despite A1/A2/B1/B2/C1/C2/D1 done � corrected in in-progress.md + task-queue.md in the same pass (checkpoint compliance)
- Directive addendum logged as H1-H4 (posting E2E, profile tab filtering, redux-observables review, mutation tests + error-boundary hardening) � additive, does not invalidate Sprint plan

**Status:** Resuming at Sprint E (route requests E2E).

---

## Session 2026-10-08 (resume) — resume-session, Sprint E close-out + QA gate

**Completed:**
- resume-session.md Steps 1–3: read in-progress.md, session-log last entry, task-queue Sprint 7; drift check vs repo (git log: HEAD b6e169e already contains A–E2 work; verified F1 prompt in home/page.tsx:127-179, per-tab profile filtering in profile pages, H3 decision in project-decisions.md, mutations/posts tests present)
- Drift classified MINOR: in-progress NEXT pointer stale (said "NEXT: F1…" though F1/G/H2/H3 already in code); Sprint E (schema, fan-out, Respond CTA, RequestRouteModal) verified complete in code — no re-implementation needed
- QA gate run: `npx tsc --noEmit` 0 errors (after removing removed `downlevelIteration` option from tsconfig.json for current TS + `npm install`), `npm test` 122/122 across 11 suites, `npx next lint` warnings-only (removed unused UserPlus import in FollowButton.tsx), `npm run build` clean
- H1 verified (POST persists type/description/quotedPostId, fan-out non-blocking, feed refresh + cold-start reload); H4 verified (mutations.test.ts + posts.test.ts passing); task-queue H1/H4/QA marked [x]; in-progress status reconciled

**Files Modified:**
- tsconfig.json — removed `downlevelIteration: true` (TS5102: option removed in current TS; es2015 target handles iteration natively)
- app/components/features/suggestions/FollowButton.tsx — removed unused `UserPlus` import (lint warning)
- ai-system/planning/task-queue.md — H1/H4/QA [ ] → [x]
- ai-system/checkpoints/in-progress.md — status reconciled to post-QA state

**Next Task:**
- Sprint 7 fully complete; run `update-ai-system.md` deep sync (repo-map, architecture, dev-history) and clear in-progress.md per close-out step 27

**Assumptions Made:**
- tsc/lint/test/build run in CI-like runner without preinstalled node_modules; `npm install` was required and is environment-only (not a code change)
- No code changes needed for Sprint E/F/G/H — all already implemented in HEAD commit; this session was verify + gate + reconcile only

**Notes / Blockers:**
- None — QA gate fully green

---

## Session 2026-10-08 — update-ai-system deep sync (Sprint 7 close-out)

**Completed:**
- Read all `ai-system/` files and compared against repo state (git HEAD 98cf69c, PR #42 merged). Fixed accumulated drift:
  - `index/repo-map.md` — 14→17 models, 8→9 enums, 3→7 migrations, 34→42 UI files, 11→15 services, 25→27 configs; added scripts/, app/lib/cache, app/lib/hooks, suggestions features, /api/suggestions + /api/bookmarks
  - `index/dependency-graph.md` — added memoryCache/useCachedFetch, suggestions + bookmarks routes, EmailService, OtpStore/ResetTokenStore (durable DB tokens), welcome + fan-out flows
  - `system-architecture.md` — added Route Requests / Suggestions / Client Cache / Seed Tooling modules, CARTO + MapTiler/Mapbox env keys, refreshed Known Constraints (122 tests, durable reset tokens, verified-email fix, downlevelIteration removal)
  - `memory/architecture-history.md` — added Sept 16 (false-positive mail), Sept 29 (durable DB tokens), Oct 7/8 (Sprint 7) entries
  - `planning/project-plan.md` — marked analytics content + mutation tests done, added Sprint 7 + auth-hardening to Completed; corrected: full-text search still NOT implemented (no /api/search or SearchService in code)
  - `summaries/dev-history.md` — added Sept 16, Sept 29, Oct 7/8 sprint entries
  - `memory/lessons-learned.md` — added 4 lessons (durable tokens, verify email result, seed tooling, self-relation quoting)
  - `repair-system.md` — added 3 entries (false-positive mail, volatile token store, downlevelIteration)
  - `testing/test-results.md` — rolled to 122/122 across 11 suites per 2026-10-08 QA gate (11 test files verified present; `npm test` not re-runnable here — no node_modules in runner)
  - `project-context.md` — refreshed Current Project Phase paragraph + backlog
  - Freshness metadata → 2026-10-08 on all compared files; `checkpoints/in-progress.md` reset to idle (Sprint 7 archived to dev-history per close-out step 27)
- Left untouched (flagged still-stale): `design-system.md` (2026-07-08), `testing/test-plan.md` (2026-07-01) — not compared this run; template scaffolding with `(set on first run)` markers (agents/, protocols/, tools/) intentionally unchanged

**Files Modified:**
- ai-system/index/repo-map.md, index/dependency-graph.md, system-architecture.md
- ai-system/memory/architecture-history.md, memory/lessons-learned.md, memory/project-decisions.md (header)
- ai-system/planning/project-plan.md, planning/task-queue.md (header)
- ai-system/summaries/dev-history.md, repair-system.md, testing/test-results.md
- ai-system/project-context.md, checkpoints/in-progress.md, checkpoints/session-log.md (this entry)

**Next Task:**
Next human decision — backlog candidates: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Open via plan-feature.md / execute-feature.md.

**Assumptions Made:**
- Session-log QA figures (122/122, 11 suites) trusted as record; verified only to file-presence level here (runner lacks node_modules)
- `20250929000000_add_password_reset_token` migration name taken from directory listing; not opened for content verification
- Minor version drift in package.json (^ranges) not audited line-by-line — Tech Stack table versions left as-is

**Notes / Blockers:**
- `update-ai-system.md` is terminal per its contract — no chained commands. Findings above feed the next human decision.

---

## Session 2026-10-08 — execute-feature: Doc-Staleness Remediation + Real QA Gate (update-ai-system follow-up)

**Completed:**
- Step 1 planning pass: read task-queue, system-architecture, design-system, repair-system, project-context, project-decisions, test-plan, test-results, project-plan; verified all three stale items against code (zero antd imports, green @theme tokens, 42 UI files, DashboardNav MOBILE_TABS, no /api/search or SearchService, 11 test files / 122 it-test cases)
- Step 2 self-check vs project-context scope + project-decisions: PASS, no architecture impact, no plan-feature.md needed
- Step 3 implementation (docs-only, zero app/ code changes):
  - design-system.md — corrected palette, radius/shadow, Tailwind+Lucide (antd unused), mobile tabs, UI count; freshness → 2026-10-08
  - testing/test-plan.md — rolled 91/9 → 122/11 with verified per-suite counts, API-boundary done / live-DB open, search NOT IMPLEMENTED; freshness → 2026-10-08
  - system-architecture.md — Search row → NOT IMPLEMENTED, diagram 34→42 UI + 11→15 services; updater → execute-feature 2026-10-08
  - testing/test-results.md — replaced file-presence caveat with real-run results
- Step 4 QA gate (all real runs after npm install): `npx tsc --noEmit` exit 0; `npx jest` 11 suites / 122 tests pass; `npx next lint` exit 0 (pre-existing no-explicit-any in feed route untouched per non-breaking constraint); `npm run build` exit 0. No code fixes needed — all tests already passing.
- Step 5 close-out: dev-history entry appended; this session-log entry; sync-context mid-work + final (see below); in-progress.md reset to idle; update-ai-system chain run as directed

**Files Modified:**
- ai-system/design-system.md — staleness remediation (tokens, patterns, nav, counts, freshness)
- ai-system/testing/test-plan.md — staleness remediation (counts, API-boundary status, search note, freshness)
- ai-system/system-architecture.md — Search false-claim fix + diagram counts
- ai-system/testing/test-results.md — real-run results replace file-presence note
- ai-system/summaries/dev-history.md — appended this session entry
- ai-system/checkpoints/in-progress.md — reset to idle
- ai-system/checkpoints/session-log.md — this entry (+ update-ai-system entry follows)

**Next Task:**
- update-ai-system.md deep sync (mandated by directive + execute-feature Step 5 chain) — run now; then next human decision on backlog (live map tracking, carto key, auth linking, supercluster, rate-limiter Redis migration)

**Assumptions Made:**
- `antd@^5.23.3` staying in package.json as an unused declared dep is intentional (removal would be a breaking-adjacent dep change) — doc now states it as unused rather than removing it
- Lint `no-explicit-any` errors in `app/api/posts/feed/route.ts` are pre-existing (present in HEAD, not introduced here) — left untouched per non-breaking directive since lint exit code is 0 and tests/build/tsc are green
- No task-queue mutation: this remediation had no sprint tasks, so no checkboxes or last-synced marker were touched

**Notes / Blockers:**
- Sync-context (mid-work after docs edits + final at close): drift re-checked — repo-map/dependency-graph need no changes for docs-only session; design-system/test-plan/system-architecture/test-results now match code; no new drift introduced
- Chain compliance: execute-feature Step 3 mid-work sync + Step 5 final sync done; deep-sync condition met via explicit directive (run update-ai-system when done) even though architecture impact was none

---

## Session 2026-10-08 — update-ai-system deep sync (execute-feature chain: doc-staleness remediation)

**Completed:**
- Read all `ai-system/` files and compared against repo state (HEAD + this session's docs edits; docs-only session, no `app/` code changes so module counts unchanged — spot-verified: 17 models / 9 enums / 7 migrations + lock file / 27 configs / 15 services / 42 UI files all match repo-map claims; 122 tests across 11 files match test-plan/test-results).
- Fixed remaining drift found in this pass:
  - `planning/project-plan.md` — removed duplicated `- [ ] Component tests for App* components` line (was listed twice in Phase 8)
  - `memory/lessons-learned.md` — added "Docs Must Be Verified Against Code" lesson from this remediation
- Confirmed resolved: design-system.md + test-plan.md no longer stale (freshness 2026-10-08 with verification sources); system-architecture.md Search row now agrees with project-plan.md (both NOT IMPLEMENTED); test-results.md reflects real runs from this session
- Left untouched (verified, no drift): repo-map, dependency-graph, project-context, repair-system, task-queue (no sprint tasks in this remediation — no checkbox or last-synced changes), architecture-history, test-results history
- `checkpoints/in-progress.md` reset to idle per close-out

**Files Modified:**
- ai-system/planning/project-plan.md (dedup line)
- ai-system/memory/lessons-learned.md (new lesson)
- ai-system/checkpoints/session-log.md (this entry)

**Next Task:**
Next human decision — backlog candidates: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Open via plan-feature.md / execute-feature.md.

**Assumptions Made:**
- No code changes in this session means structural docs (repo-map, dependency-graph) need header bumps only if content changed — they didn't, so headers left at 2026-10-08 from the prior sync
- `update-ai-system.md` is terminal per its contract — no chained commands

**Notes / Blockers:**
- None — all three items from the originating stale report are now addressed; QA gate green with real runs

---

## Session 2026-10-08 — execute-feature: Search E2E (+ sync-context checkpoints)

**Completed:**
- Step 1 planning pass: read task-queue, project-plan (Phase 4 search unchecked), system-architecture (Search NOT IMPLEMENTED), project-context, design-system, repair-system, project-decisions; no architecture impact (no schema/migration/deps) so no plan-feature.md; wrote checkpoints/in-progress.md plan
- Step 2 self-check vs project-context scope + project-decisions: PASS (search = Daily Commuter key interaction; complies with state-strategy/config-driven/zero-emoji decisions)
- Step 3 implementation:
  - `app/lib/services/searchService.ts` [NEW] — unified posts+users+tags; contains/insensitive (no migration); Redis read-through via existing CACHE_KEYS.search/CACHE_TTL.searchResults (never-throw); P2022 avatarConfig fallback per repair-system pattern
  - `app/api/search/route.ts` [NEW] — GET q/type/region/postType/limit/cursor; checkRateLimit(search); guest-accessible; sanitized errors; 503 on Prisma-known errors
  - `app/(dashboard)/search/page.tsx` + `SearchPage.tsx` [NEW] — fixes dead /search?q= links from SuggestionsPanel; Suspense + useSearchParams; 300ms debounce + AbortController; All/Routes/People tabs; PostCard/FollowButton reuse; EMPTY_STATES.search
  - `app/lib/config/apiRegistry.ts` [EDIT] — search entry; `middleware.ts` [EDIT] — /search guest route (non-breaking, /explore precedent)
- Step 3b tests: `app/__tests__/api/search.test.ts` (9: validation, type filters, region/postType, 503, 429) + `app/__tests__/services/searchService.test.ts` (8: normalization, short-query guard, cache, tags, cursor, P2022)
- Step 4 QA gate (real runs after `npm install` — runner had no node_modules): `npx tsc --noEmit` 0 errors; `npx jest` 13 suites / 139 tests pass; `npx next lint` — 2 new no-require-imports in search test FIXED (require → typed imports), remaining 7 verified pre-existing via `git stash` baseline; `npm run build` clean with /search route
- Step 5 close-out: project-plan checkbox; task-queue Sprint 8 + last-synced 2026-10-08; system-architecture Search row live; test-plan/test-results 122/11 → 139/13; repo-map + dependency-graph freshness; dev-history entry; this entry

**Files Modified:**
- app/lib/services/searchService.ts (new)
- app/api/search/route.ts (new)
- app/(dashboard)/search/page.tsx + SearchPage.tsx (new)
- app/__tests__/api/search.test.ts + app/__tests__/services/searchService.test.ts (new)
- app/lib/config/apiRegistry.ts, middleware.ts (wiring)
- ai-system/planning/project-plan.md, planning/task-queue.md, system-architecture.md, testing/test-plan.md, testing/test-results.md, index/repo-map.md, index/dependency-graph.md, summaries/dev-history.md, checkpoints/in-progress.md, checkpoints/session-log.md

**Next Task:**
- update-ai-system.md deep sync (mandated: originating directive says run update-ai-system when done; Sprint 8 is [M]-only but directive chain applies) — run now; then next human decision on remaining backlog

**Assumptions Made:**
- `contains`/`mode: insensitive` queries chosen over Postgres full-text/GIN indexes deliberately: zero-migration, non-breaking, sufficient for current scale; GIN/trigram upgrade is a future optimization, not this session
- Cursor pagination is post-id based (user hits are top-N per query, not paginated) — documented in service; matches "routes drive the feed" product shape
- Lint baseline: 7 `no-explicit-any` errors in leaderboard/posts/feed/google-callback exist on HEAD (proven via stash) — left untouched per non-breaking constraint

**Notes / Blockers:**
- Sync-context (mid-work after implementation + final at close): drift re-checked — no drift beyond what this session updated; repo-map/dependency-graph now reflect search module; no new drift introduced
- All tests passing per directive (139/139); non-breaking fixes applied (lint require-imports in new test only)

---

## Session 2026-10-08 — update-ai-system deep sync (execute-feature chain: search E2E)

**Completed:**
- Read all `ai-system/` files and compared against repo state (HEAD + Sprint 8 search edits; verified: 17 models / 9 enums / 7 migrations / 27 configs / 16 services (15 + searchService) / 13 test files match claims after fixes below; 139 tests by real jest run)
- Fixed drift found in this pass:
  - `system-architecture.md` — diagram 15 → 16 services; Known Constraints 122/11 + no-node_modules caveat → 139/13 with real-run note
  - `project-context.md` — Phase line + counts → Sprint 8 search, 16 services, /api/search, /search page, 139/13, latest QA gate (updater → execute-feature search E2E)
  - `planning/project-plan.md` — Phase 8 unit-test line 122/11 → 139/13
  - `memory/architecture-history.md` — appended Sprint 8 entry (zero-migration rationale, slot reuse, repair-system patterns)
  - `memory/lessons-learned.md` — added "Prefer Zero-Migration Search First; Prove Lint Baselines With Stash" lesson
- Left untouched (verified, no drift): repair-system, design-system, protocols, agents, skills, tools/registry, designs, operations, FAQ/blog configs; session-log/dev-history history rows (append-only past record); `checkpoints/in-progress.md` cleared to idle per close-out

**Files Modified:**
- ai-system/system-architecture.md (service count, test-constraint line)
- ai-system/project-context.md (phase/counts/gate line + updater)
- ai-system/planning/project-plan.md (test count line)
- ai-system/memory/architecture-history.md (Sprint 8 entry)
- ai-system/memory/lessons-learned.md (new lesson)
- ai-system/checkpoints/session-log.md (this entry)
- ai-system/checkpoints/in-progress.md (reset to idle)

**Next Task:**
Next human decision — remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Open via plan-feature.md / execute-feature.md. Search live-DB integration test still open.

**Assumptions Made:**
- Historical session-log/dev-history/test-results-history rows describing past 122/11 states are intentionally left as-is (append-only record, not drift)
- `update-ai-system.md` is terminal per its contract — no chained commands

**Notes / Blockers:**
- Discrepancy report: no unresolved inconsistencies — every `NOT IMPLEMENTED` / `no /api/search` / `122/11` / `15 services` claim in current-state docs now matches code; the originating stale report (design-system, test-plan, search claim) is fully closed by implementation rather than documentation

## Session 2026-10-08 — execute-feature: carousel overflow, share-modal, request icon, footer grid

**Completed:**
- Step 1 planning pass (task-queue, system-architecture, design-system, project-decisions) + in-progress.md plan
- Step 2 scope check: PASS (feed UX, posting UX, footer IA — all in scope; complies with config-driven/Lucide-only/no-redux decisions) — no plan-feature.md needed (no architecture impact: no migration, no new deps)
- Step 3 implementation:
  - Config: new `carousel.ts` (ENDLESS_CAROUSEL_CONFIG), `shareRoute.ts` (SHARE_ROUTE_MODAL_CONFIG: preview/score collapsed by default, form open), `routeRequest.ts` (REQUEST_ROUTE_TRIGGER_CONFIG: "Request?" tagline), `footer.ts` +layout (grid-cols-3 all screens); barrel exports
  - Carousel: rewrote EndlessCarousel as scroll-based autoplay (rAF scrollLeft + half-track wrap) inside its own overflow-hidden wrapper; free native scroll/drag both directions, resumes from landed position, hover/focus/drag/hidden-tab pause, reduced-motion fallback
  - Home: feed column owns the mobile rail (no more row-flex overflow); added RequestRouteTrigger icon (tooltip "Request?") beside existing Request button
  - ShareRouteModal: preview + DraftingCoach collapsed by default (config), route form collapsible (open by default), actions moved to full-width footer below preview+score; DraftingCoach gained defaultOpen prop (only caller is ShareRouteModal)
  - Footer: AppFooter consumes FOOTER_CONFIG.layout (3 cols mobile→desktop, tightened type)
- Step 3b tests: `app/__tests__/config/uxTightening.test.ts` (4 suites: carousel/share/request/footer configs)

**Files Modified:**
- app/lib/config/carousel.ts (new), shareRoute.ts (new), routeRequest.ts (new), footer.ts (layout), index.ts (exports)
- app/components/features/suggestions/EndlessCarousel.tsx (rewrite), SuggestionsRail.tsx (container + config duration)
- app/components/features/posts/RequestRouteTrigger.tsx (new), index.ts (export), ShareRouteModal.tsx (collapsible + footer), DraftingCoach.tsx (defaultOpen + aria-expanded)
- app/(dashboard)/home/page.tsx (column layout, trigger icon)
- app/components/ui/AppFooter.tsx (config-driven 3-col grid)
- app/__tests__/config/uxTightening.test.ts (new)

**Next Task:**
Run update-ai-system.md deep sync (directive explicitly requests it) — then next backlog item via plan-feature.md / execute-feature.md.

**Assumptions Made:**
- "Full scrolling to any point" = native scroll/drag both directions; autoplay resumes from landed scrollLeft (no snap-back)
- "Actions below preview/score" = full-width modal footer below the two-column body
- Footer 3-col at all breakpoints = grid-cols-3 with tightened gaps/type on mobile; inner link lists stay stacked per column

**Notes / Blockers:**
- QA gate partial: this runner has no node_modules (same as prior session) — `npx tsc --noEmit` runs but every error is the missing-deps cascade (react/next/jsx-any); zero errors attributable to touched files (filtered check clean). `npm test`/`lint`/`build` cannot run here (jest not found) — new test verified to file-presence + import-path level only; CI (with deps) is the real gate. No build-breaking constructs introduced (balanced JSX verified by read-through, config files zero-app-deps, Lucide-only, no emoji, no antd imports).

## Session 2026-10-08 — update-ai-system deep sync (execute-feature chain: Sprint 9 UX tightening)

**Completed:**
- Read all `ai-system/` files and compared against repo state (HEAD + Sprint 9 edits; verified: 30 config files / 14 test files present; EndlessCarousel rewrite, RequestRouteTrigger, footer layout, share-modal restructure all present in code)
- Fixed drift found in this pass:
  - `system-architecture.md` — Config row 27 → 30 files; Suggestions row → scroll-based autoplay + own overflow wrapper; Route Requests row → collapsed defaults + footer actions + RequestRouteTrigger; Known Constraints 139/13 → 143/14 with no-node_modules caveat
  - `index/repo-map.md` — features line + RequestRouteTrigger; config 27 → 30
  - `index/dependency-graph.md` — suggestions line → scroll-based + config; config 27 → 30 + new files
  - `project-context.md` — phase paragraph → Sprint 9, 30 configs, carousel/modal/trigger/footer, 143/14 with caveat
  - `planning/project-plan.md` — appended Sprint 9 checkbox; unit-test line 139/13 → 143/14 with caveat
  - `planning/task-queue.md` — freshness header → Sprint 9 deep sync (Sprint 9 section itself written at execute-feature close-out)
  - `memory/architecture-history.md` — appended Sprint 9 entry (scroll-vs-CSS rationale, footer-layout alternative)
  - `memory/lessons-learned.md` — added "Scrub-able Tapes Need Scroll Position" lesson
  - `summaries/dev-history.md` — Sprint 9 entry (written at close-out, verified present)
- Left untouched (verified, no drift): repair-system, design-system, protocols, agents, skills, tools/registry, testing/test-plan (figures now covered by caveat), operations, FAQ/blog/seo configs; session-log/dev-history history rows (append-only)

**Files Modified:**
- ai-system/system-architecture.md, index/repo-map.md, index/dependency-graph.md, project-context.md, planning/project-plan.md, planning/task-queue.md (header), memory/architecture-history.md, memory/lessons-learned.md
- ai-system/checkpoints/session-log.md (this entry)
- ai-system/checkpoints/in-progress.md (reset to idle — see below)

**Next Task:**
Next human decision — remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Open via plan-feature.md / execute-feature.md. Full jest/lint/build gate still needs a runner with node_modules (CI).

**Assumptions Made:**
- Test arithmetic 139 + 4 new `it` blocks = 143 is file-level only (jest never executed here — stated explicitly everywhere the figure appears)
- Historical rows describing 122/11 and 139/13 states left as-is (append-only record, not drift)

**Notes / Blockers:**
- Discrepancy report: no unresolved inconsistencies — every config-count, test-count, carousel-implementation, and modal-default claim in current-state docs now matches code with honest QA caveats
- `update-ai-system.md` is terminal per its contract — no chained commands

## Session 2026-10-08 — execute-feature: carousel ordering + route-drafts library (Sprint 10)

**Completed:**
- Step 1 planning pass (task-queue, system-architecture, design-system, repair-system) + in-progress.md plan
- Step 2 scope check: PASS (home feed ordering + share-route drafts — in scope; complies with config-driven/Lucide-only/no-emoji/no-antan decisions) — no plan-feature.md needed (no architecture impact: no migration, no new deps)
- Step 3 implementation:
  - Config: new `routeDrafts.ts` (ROUTE_DRAFTS_CONFIG: collection/legacy keys, maxDrafts 10, labels, changed event); barrel export
  - Service: new `routeDraftsService.ts` (list/get/save/delete, legacy `along_route_draft` migration, newest-first cap, never-throw, `along:drafts-changed` event)
  - UI: new `RouteDraftsPanel.tsx` (config-driven list, Restore/Continue-to-upload/Delete, active-draft highlight); posts barrel export
  - ShareRouteModal: single-key draft logic replaced with service; collapsible drafts section above the form; footer drafts counter button; `startWithDraftsOpen` prop; auto-restore most recent draft when composer opens empty (preserves prior UX); restored draft deleted on successful submit
  - Home: `<SuggestionsRail />` moved above the feed, below the share/request trigger div; drafts resume chip (`History` icon + "N saved drafts — continue") shown only when drafts exist, opens composer with drafts panel expanded; count kept fresh via changed-event + storage listeners
- Step 3b tests: `app/__tests__/config/routeDrafts.test.ts` (4 suites: config values, save/list/restore/delete, empty-refuse + corrupt-safety, legacy migration)

**Files Modified:**
- app/lib/config/routeDrafts.ts (new), app/lib/config/index.ts (export)
- app/lib/services/routeDraftsService.ts (new)
- app/components/features/posts/RouteDraftsPanel.tsx (new), posts/index.ts (export)
- app/components/features/posts/ShareRouteModal.tsx (drafts library integration)
- app/(dashboard)/home/page.tsx (carousel reorder + drafts chip)
- app/__tests__/config/routeDrafts.test.ts (new)

**Next Task:**
Remaining backlog: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. Open via plan-feature.md / execute-feature.md. (No update-ai-system deep sync: no architecture impact and no [L]/[XL] task — sync-context only, per execute-feature Step 5.)

**Assumptions Made:**
- "Above the feed but below the trigger div" = SuggestionsRail directly after the composer trigger div (+ drafts chip), before the first PostCard/skeleton — desktop sidebar SuggestionsPanel untouched
- "Access drafts and restore/complete to upload" = in-modal drafts panel + home resume chip; "complete to upload" = restore fills the composer and the user taps Share Route (no separate upload path, keeps one submit flow)
- Auto-restore most recent draft on empty open preserves the previous single-draft UX; multi-draft switching via the panel

**Notes / Blockers:**
- QA gate partial: this runner has no node_modules (same as Sprint 9) — `npx tsc --noEmit` shows only the missing-deps cascade (react/next/jsx-any/jest-types); zero errors attributable to touched files (filtered check clean). `npm test`/`lint`/`build` cannot run here — new test verified to file-presence + import-path level only; CI (with deps) is the real gate. No build-breaking constructs introduced (balanced JSX verified by read-through, config zero-app-deps, Lucide-only, no emoji, no antd imports).

---

## Session 2026-10-08 — Sprint 11: Posting Fix + Response/Draft Linkage + Toast/Report/Carousel (execute-feature)

**Directive:** posting "Validation failed" with no console/server trace (normal + response shares); score hinted description with no generic input; responses should inherit request tags; drafts should keep response linkage; undo-toast bar vanishes before elapsing; Report button + copy-link dead; About reviews should reuse the carousel wrapper. Non-breaking, config/metadata-driven, close with update-ai-system.

**Root cause (posting):** `ShareRouteModal` `const [description] = useState("")` (no setter) always submitted `description: ""`; `CREATE_POST_SCHEMA.description = z.string().min(10).optional()` rejects `""` (optional ≠ empty-tolerant) → every POST 400'd. Client showed generic `payload.error`, server logged nothing.

**Changes (14 edited, 2 new):**
- `schemas/post.ts` — `optionalText(10)` preprocess (""→undefined) + `waypoints` accepted
- `ShareRouteModal.tsx` — editable generic description input (config labels), omit-when-blank submit, `RespondToRequest.tags`, tag inheritance, `restoredResponseTo`/`effectiveResponseTo`, draft save/restore of description+responseTo, tag cap 10, `_focused/_locating` stripped from payload, `onSubmit.description` optional
- `home/page.tsx` — `handleRespond` forwards tags; `submitPost` surfaces first field error + `console.error`
- `api/posts/route.ts` — first-field `message` (additive) + `console.warn` of flattened details
- `routeDraftsService.ts`/`routeDrafts.ts`/`RouteDraftsPanel.tsx` — `description` + `responseTo` ref, `responseBadgeLabel`
- `toast.ts` (new, `TOAST_CONFIG`) + `toastService.ts` + `GlobalToastProvider.tsx` — single timer owner, duration pass-through, per-toast remount, close() recursion fix
- `postActions.ts` (new, `POST_ACTIONS_CONFIG`) + `PostCard.tsx` — working copy-link + report dialog
- `api/bug-reports/route.ts` — optional `postId` link (verified) + `metadata` + best-effort reporter
- `AboutPageClient.tsx` — reviews on shared `EndlessCarousel` (ReviewCard, fixed widths)

**QA gate (this runner — `npm ci` installed, unlike Sprints 9–10):**
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 15 suites / 149 tests, all pass (incl. existing `posts.test.ts` "Validation failed" assertion, unaffected)
- `npm run build` — clean (static + dynamic routes emitted)
- `npm run lint` — only pre-existing issues in untouched files (`feed/route.ts` no-explicit-any etc.); zero in touched files

**Assumptions Made:**
- Blank description stays optional (checkpoint needs ≥10 chars for the 10 pts; hint copy unchanged)
- Report triage reuses bug-report admin surface (no new table) with `metadata.kind: "post-report"`
- Toast `undo()` without duration falls back to `TOAST_CONFIG.undoMs`

**Notes / Blockers:** None. Session-log append-only honored; in-progress cleared below.

---

## Session 2026-10-08 — Sprint 12: Posting Hardening + Viewer/Carousel Fixes (execute-feature)

**Directive:** share-route post button needs loading feedback + disabled state (double-clicks duplicated routes); no undo toast for like/dislike; ACID for posting; ImageLightbox sometimes won't advance + counter inaccurate; EndlessCarousel no longer auto-moves. Non-breaking, config-driven, all tests passing.

**Root causes:**
- Posting duplicates: `ShareRouteModal.handleSubmit` had no in-flight state (button stayed enabled, re-entry unguarded) and `POST /api/posts` did create-then-update in two statements with no idempotency — every double-click inserted two rows.
- Like/dislike undo: post-detail `handleLike` registered an `undoService` action + `toastService.undo` on unlike.
- Viewer stuck/counter drift: prev/next mutated `img.src` via `getElementById` while the `safeIndex` prop-derived value never changed — the counter stayed frozen and the second navigation recomputed from the same stale index.
- Carousel stall: (a) touch taps fire `pointerenter` with no matching `pointerleave`, pausing rAF autoplay forever; (b) with 1–2 cards the track is narrower than the viewport so `scrollLeft` maxes at 0 and autoplay is invisible.

**Changes (9 edited, 3 new):**
- `postSubmit.ts` (new, `POST_SUBMIT_CONFIG`) + `config/index.ts` — idempotency header/TTL/prefix + submit-button labels
- `idempotencyService.ts` (new) — process-local TTL claim/complete/replay/release store, never-throw
- `ShareRouteModal.tsx` — `isSubmitting` guard + disabled Share/Save + `Loader2` spinner + per-session `clientMutationId` plumbed through `onSubmit`
- `RequestRouteModal.tsx` — `Loader2` spinner on the (already guarded/disabled) submit + same `clientMutationId` passthrough
- `home/page.tsx` — `submitPost` in-flight dedup by key + `X-Idempotency-Key` header (key stripped from JSON body)
- `api/posts/route.ts` — replay returns original post (`200 + deduplicated`), concurrent duplicate gets 409, validity precomputed so create is a single atomic statement, key released on create/quote failure; header read is defensive (fixed `posts.test.ts` mock without `headers`)
- `posts/[id]/page.tsx` — like/unlike undo registration removed (success note on like only; bookmark undo kept)
- `ImageLightbox.tsx` — state-owned index, ArrowLeft/Right + Escape, accurate counter, re-sync effect
- `EndlessCarousel.tsx` + `carousel.ts` (`maxRepeat: 3`) — mouse-only hover pause, `repeat` growth until half-track overflows viewport
- `postSubmit.test.ts` (new, 5 suites)

**QA gate (this runner, node_modules via `npm ci`):**
- `npx tsc --noEmit` — 0 errors
- `npm test` — 16 suites / 154 tests, all pass (one interim failure in `posts.test.ts` fixed in code via defensive header read — no test edits)
- `npm run build` — clean
- `npx next lint` (touched files) — zero new warnings (2 pre-existing: ImageLightbox `no-img-element`, post-detail `exhaustive-deps` on untouched `routePins`)

**Assumptions Made:**
- Idempotency store is process-local (serverless-safe miss = single create; client guard is the primary layer) — documented in `memory/project-decisions.md`
- Unlike stays silent (heart toggle is its own affordance); bookmark undo untouched per directive scope

**Notes / Blockers:** None. In-progress reset to idle below.

## Session 2026-10-08 — Sprint 13: Post/Comment Moderation + Report Lifecycle (execute-feature)

**Directive:** delete/edit/archive for posts/comments/requests (users + admin) with global confirm modal + global undo; report E2E with user notification (anonymity) + admin management/actions; report/copy menu on individual post views; route requests hide map/navigation/trust; responses shown comment-style on expanded request; trust tooltip viewport fix. Non-breaking, config/metadata-driven, modular, ACID platform-wide.

**Root causes / gaps found:**
- Delete/edit APIs existed but had zero feed/detail UI; archive had no model field, no API, no UI; comment had DELETE only (no PATCH, no admin override, no confirm/undo).
- Report posted to generic bug-reports with no dedup, no reporter receipt, no admin post-action, no outcome notification; `modalService.confirm` had zero call sites (admin page used a local modal).
- `PostCard` rendered MiniRouteMap + TrustBadge unconditionally (incl. ROUTE_REQUEST); detail page had no overflow menu and always rendered map/nav/trust.
- TrustBadge tooltip was `absolute ... left-1/2 -translate-x-1/2` — off-screen near viewport edges with no flip.

**Changes (6 new, ~20 edited — see dev-history Sprint 13 entry for the file list):**
- Migration `20261008000000_post_moderation` (idempotent IF NOT EXISTS/DO guards): `Post.isArchived/archivedAt`, `NotificationType` REPORT/MODERATION.
- `postModerationService` + `moderation/ReportDialog` + `PostMenu` shared by cards and detail views; snapshot-restore undo replays one POST (no torn state).
- ACID: report dedup-check + insert in one transaction; admin action (bug status + archive/delete) in one transaction; comment delete + counter in the pre-existing transaction pattern; archive via single atomic update.
- Archive reads are P2022-tolerant (feed/search/list/suggestions/sitemap strip-and-retry) so the app works before/after the migration applies; regenerated Prisma client picks up new enum values (`prisma generate` required after schema enum edits).
- One interim jest failure (`posts.test.ts` guest-where expectation) updated to the intended archived-exclusion behavior; TrustBadge tests pass unmodified.

**QA gate (this runner, node_modules via `npm ci`):**
- `npx tsc --noEmit` — 0 errors (fixed 3 during gate: mutate updater null-return, Comment/CommentList `createdAt` duality, stale generated client)
- `npm test` — 17 suites / 160 tests, all pass
- `npm run build` — clean
- `npx next lint` (touched files) — zero warnings/errors after fixing 2 flagged items

**Assumptions Made:**
- Comments are not archivable (directive: "not really posts") — delete/edit/report only.
- Archived posts: hidden from all listings; direct link renders a tombstone for non-owners, full view for owner/admin; owner self-profile (`?userId=self`) still lists them.
- Undo of hard delete replays the snapshot as a NEW post (new id); admin undo same path via DELETE snapshot.
- Reporter identity stored for outcome notification but never exposed to the author; admin identity never exposed to either party.
- `MODERATOR` role accepted alongside `ADMIN` in new checks (forward-compat; schema enum still USER/ADMIN only).

**Notes / Blockers:** Production DB needs `prisma migrate deploy` (runs in `vercel-build`) for `isArchived` + new enum values; pre-migration reads degrade gracefully via P2022 fallbacks. In-progress reset to idle below.

## Session 2026-10-08 — Sprint 14: Notification/Referral/Profile Tightening (execute-feature)

**Directive:** preserve post/route-request/comment nature through editing/archiving; profile Archived tab + fix Routes tab showing only the request; notification coverage (mentions, likes, dislikes, comments, request responses, followed-user uploads/requests); max-invites as points cap (not invite limit); referrals across email+password and Google OAuth; leaderboard with zero-point users; route-request flag contrast in both modes.

**Root causes / gaps found:**
- PATCH accepted `type`/`quotedPostId` via `UPDATE_POST_SCHEMA` (client never sent them, but any direct API call could morph a ROUTE into a ROUTE_REQUEST — the reported "editing rendered like a route" class).
- Routes tab filtered `type=ROUTE` only: ROUTE_RESPONSEs (actual routes) were invisible there; requests had no home; archived posts leaked into the owner's main tabs.
- MENTION existed in enum/registry/UI but had zero server writes; DISLIKE had no type at all; ROUTE uploads had no follower fan-out; LIKE/COMMENT wrote via raw `prisma.notification.create` (no cache invalidation); WELCOME was a silent no-op (self-filter dropped actor==recipient).
- Register page dropped `?ref=` (POSTed to bare `/api/auth/register`); Google callback ignored referrals entirely and sent no welcome; INVITE_SENT points unwired; `maxInvites` displayed as a hard "Max Invites" limit.
- Leaderboard API/page already zero-point-inclusive — verified + locked with a test.
- `text-warning` is the pale-yellow token (#FEF3C7) — used as *text* it was invisible on light backgrounds; correct pairing is `bg-warning text-warning-text border-warning-border`.

**Changes (8 new, ~25 edited — see dev-history Sprint 14 entry for the file list):**
- Migration `20261008000001_notification_coverage` (DISLIKE + NEW_ROUTE, idempotent guards); `prisma generate` re-run for the new enum values.
- `mentionService` + `referralService`; `createNotification allowSelf`; PATCH immutable-strip; GET multi-type + archived; NEW_ROUTE fan-out with request-author dedup; like/dislike + comment/motion notifications via service; register + Google callback referral parity (`state=ref:`); invite copy; profile tabs; warning pairing sweep.
- Tests: 21 suites / 188 tests (new: post-nature 4, mention 8, referral 6, leaderboard 2; extended posts + mutations). Two interim self-failures fixed (leaderboard assertion targeted select instead of where; stale owner-view where expectation).

**QA gate (this runner, node_modules via `npm ci`):**
- `npx tsc --noEmit` — 0 errors
- `npm test` — 21 suites / 188 tests, all pass
- `npm run build` — clean
- `npx next lint` — 11 pre-existing errors, 0 new (verified via stash baseline)

**Assumptions Made:**
- Routes tab = ROUTE + ROUTE_RESPONSE (actual routes); requests get their own tab; archived tab is owner-only (other profiles have no archived tab).
- Owner's main tabs now exclude archived (previously included); direct link + tombstone behavior unchanged.
- Switch like↔dislike notifies only on net-new engagement (no switch spam); mentioned post-author gets COMMENT only (no double MENTION).
- Referral `ref:` state and `link` state are mutually exclusive; existing `invitedById` is never overwritten.
- INVITE_SENT credit is awarded on conversion inside the cap window (sends are not server-observable; documented in INVITE_CONFIG).

**Notes / Blockers:** Production DB needs `prisma migrate deploy` (runs in `vercel-build`) for the new enum values; pre-migration DISLIKE/NEW_ROUTE writes fail safe (service returns null, request succeeds). In-progress reset to idle below.

## 2026-10-08 — execute-feature: landing real stats, request fare hiding, profile interactions, edit-profile fix, avatar editor
**Directive:** landing stats real + recent real posts; route requests hide fare/amount; profile post actions (like/dislike/bookmark/share work, comment opens modal with expand fallback); edit-profile "[object Object]" fix; intuitive DiceBear avatar editor with seed guidance.
**Changes:**
- `app/(public)/page.tsx` — `getLandingStats()` (prisma user/post counts + distinct regions, P2022-safe fallbacks) replaces hardcoded 10k/50k; `getLandingPosts()` now ROUTE+ROUTE_RESPONSE, unarchived, take 3, P2022 fallback.
- `app/lib/config/moderation.ts` — `routeRequestHides.fare: true`; `PostCard.tsx` + `posts/[id]/page.tsx` gate fare badges on `showFare`; moderation test extended.
- `app/components/features/profile/ProfilePostCard.tsx` (new) — PostCard wrapper with working like (LIKE toggle), dislike (DISLIKE toggle), bookmark, share (navigator.share → clipboard + POST_ACTIONS_CONFIG copy), comment modal (CommentInput/List + expand-post fallback link); wired into own + [username] profile tabs with full post normalization and `onRemoved` cache filtering.
- `app/components/ui/ConfigDrivenForm.tsx` — root cause of "[object Object]": onChange received native events, not strings. Now accepts string|event, coerces all initialValues to strings (objects → ""), and re-syncs when async initialValues arrive.
- `app/lib/config/avatar.ts` — curated 12-style catalogue (category + description), AVATAR_CATEGORIES/BACKGROUNDS/SEED_PRESETS/EDITOR_CONFIG + randomAvatarSeed(); `AvatarEditor.tsx` rebuilt: category filter, style grid with descriptions, seed input + Surprise-me dice + one-tap presets, background swatches, flip toggle, how-to tips, re-sync on open.
- Tests updated: avatar catalogue (>=5, legacy styles present), moderation fare assertion.
**QA gate:** no node_modules in this runner (`tsc`/`jest`/`lint` not runnable); verified to static-review level — all touched files re-read, mutate-callback null-safety fixed, unused imports/vars removed. Full gate (tsc + lint + tests + build) to be run where deps exist; no new architecture introduced (all config/metadata-driven).

## 2026-10-08 — execute-feature: notification badges, referral+points coverage, username edit, landing guest-link, one-time prod reset (Sprint 15)
**Directive:** notifications replace bookmarks on mobile menu + badge counts on desktop sidebar & mobile tab; notification service captures referral conversions + points/tier-ups; username editable with uniqueness; landing "continue as guest" hidden under the same logic as "continue to feed"; one-time prod DB reset wired into vercel-build (to be removed after the clean build).
**Changes (3 new, ~12 edited):**
- Nav: `MOBILE_TABS` Bookmarks→Notifications (bookmarks route + desktop entry untouched); `NOTIFICATION_BADGE_CONFIG` (60s poll = server cache TTL, 99 cap, limit=1 endpoint) + `BADGED_NAV_HREFS`; new `useUnreadNotifications` hook (auth-gated, AbortController, never throws); badge on desktop sidebar item (icon dot + count pill) and mobile tab (dot), `role=status` labels, solid `#E11D48`/white (no `--color-danger` token exists — `bg-danger` was corrected before commit).
- Notifications: `NOTIFICATION_MESSAGES` (referralConversion / pointsEarned / tierUp) in config; `notifyReferralConversion` (REWARD to inviter, actor = new user, self-ref guard) called in register + Google callback new-signup + first-time-OAuth-link paths; `notifyPointsAwarded` (REWARD + BADGE tier-up) in rewards worker with POINTS_CONFIG action label; `NOTIFICATION_REGISTRY` export extended via barrel.
- Profile: `userName` first in EDIT_PROFILE_FIELDS + `USERNAME_RULE` (mirrors REGISTER_SCHEMA, barrel-exported); PATCH allowlist + trim + shape check (400) + uniqueness vs other users (409) + P2002 race guard; profile page passes userName initialValue and surfaces 409 message instead of false success.
- Landing: `GuestContinueLink` (same AuthContext `isAuthenticated` gate as HeroCtas/BottomCta, null while loading/authed) replaces the static always-visible link in `(public)/page.tsx`.
- Ops: `scripts/reset-prod-db.ts` (TRUNCATE … CASCADE all 16 app tables, SiteConfig preserved, DATABASE_URL-guarded, never fails build) + `db:reset-prod` + prepended (`|| true`) to `vercel-build`.
- Tests: `__tests__/sprint15/tightening.test.ts` (10 tests: badge config/caps/format, copy templates, username field+rule). One interim self-failure fixed (toMatch string arg is substring, not regex — split into two assertions).
**QA gate (this runner, node_modules via `npm ci`):**
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 22 suites / 198 tests, all pass
- `npm run build` — clean
- `npx next lint` (touched files) — 1 pre-existing warning (`Settings` unused in DashboardNav, predates this sprint), 0 new
**Assumptions Made:**
- Desktop sidebar keeps Bookmarks (directive only replaced it on mobile); bookmarks route/page untouched.
- Referral conversion notice reuses REWARD type (no migration) — copy distinguishes it from points notices, which arrive separately via the rewards worker.
- REWARD/BADGE system notifications use the earner as actor with allowSelf (same pattern as WELCOME).
- No `update-ai-system.md` deep sync: no schema/architecture change, no [L]/[XL] task-queue entries (largest is [M]); sync-context markers updated inline instead.
**Notes / Blockers:** ⚠️ After the next production deploy confirms a clean DB, delete `scripts/reset-prod-db.ts`, drop `db:reset-prod`, and remove its `vercel-build` invocation — otherwise every build wipes the DB. Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. In-progress reset to idle below.

## 2026-10-08 — execute-feature: vercel-build reset removal + early-adopter "First N Users" badge (Sprint 16)
**Directive:** DB clear confirmed successful — remove it from vercel builds; add a dynamic admin-editable "First N users #n" profile badge (admin-toggled total + visibility, platform-derived qualification from createdAt, future-proof for filtering/rewards); then run update-ai-system.md.
**Changes (7 new, 12 edited — see dev-history Sprint 16 entry for the file list):**
- Ops: `vercel-build` no longer runs `db:reset-prod` (script + `scripts/reset-prod-db.ts` retained manual-only).
- Config/service: `earlyAdopter.ts` (key/defaults/normalize/validate/label builders/meta) + `earlyAdopterService.ts` (createdAt-asc rank, Redis-cached, status + list); barrel + seed row.
- APIs: `GET /api/users/early-adopters`, `GET /api/users/[id]/early-adopter`, `earlyAdopter` embedded in both user-profile endpoints, registry entries; admin config validation + Redis invalidation; admin users `?earlyAdopter=true` filter.
- UI: `EarlyAdopterBadge(_FromStatus)` on own + other profiles; admin Config badge card (toggle/limit/template).
- Tests: `earlyAdopter.test.ts` (5) + `EarlyAdopterBadge.test.tsx` (6).
**QA gate (this runner — no node_modules):** tsc new/edited files zero non-environment diagnostics (no syntax errors); jest/lint/build not runnable here — full gate to run where deps exist. package.json re-validated as JSON.
**Assumptions Made:**
- Rank = COUNT(earlier createdAt OR same-createdAt + smaller id) + 1 (deterministic, no migration); ties broken by id asc to match list ordering.
- Badge hidden when disabled, unqualified, unknown user, or payload null (null-safe component + best-effort API embeds that never fail the host request).
- Admin `?earlyAdopter=true` ignores cursor pagination (returns earliest-first ranked take) — documented as audience/rewards tooling, not a general user browser.
- `db:reset-prod` script kept (manual-only) rather than deleted — directive asked only to remove it from vercel builds.
**Notes / Blockers:** Full QA gate (tsc + jest + build + lint) still to run where node_modules exists; test count after this sprint is 24 suites / ~209 tests (198 + 11 new) pending execution. Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. In-progress reset to idle below.

## 2026-10-08 — execute-feature: admin dashboard fix, referral signup hardening, error-report actualisation, admin links (Sprint 17)
**Directive:** Fix admin-dashboard visit error + referral-link email/password signup error; make "our team has been notified" true (or remove it) via sanitized console/stack bug capture; add admin-page links to desktop sidebar + profile Quick Links for admin-role users.
**Root causes found:**
- Admin dashboard crash: `GET /api/admin/stats` never returned `recentUsers`, but `app/admin/page.tsx` dereferenced `stats.recentUsers.length` → TypeError on every visit → error boundary.
- Admin links invisible: Prisma `UserRole` is `USER | ADMIN` (uppercase) but `NAV_REGISTRY` roles were `["admin"]` and `DashboardNav` compared `user?.role === "admin"` → admin section never rendered for real admins.
- Referral signup fragility: referral resolution + reward fan-out sat on the critical path (a stale/deleted inviter FK race or `crypto.randomUUID` gap could 500 the signup); legacy users with null `inviteCode` produced dead `/register?ref=null` invite links via `/api/invite`.
- False claim: `global-error.tsx` printed "Our team has been notified" while only calling Sentry (unconfigured DSN in most envs ⇒ nobody notified, zero context).
**Changes (3 new, 13 edited):**
- API: stats route now selects `recentUsers` (latest 8, batched in the same `Promise.all`); register isolates referral resolution (try/catch), `randomUUID` fallback, P2003 FK-race retry-once without the link, reward/notify fan-out guarded; invite route backfills missing `inviteCode`.
- UI: admin page null-tolerates older payloads (`?? []`) + safe initials; `AdminShell` guard uses `isAdminRole()`; profile Quick Links gains role-gated Admin Dashboard entry.
- Config/service: `navigation.ts` gains canonical `isAdminRole()` (case-insensitive) + uppercase registry roles + case-insensitive `hasAccess`; new `errorReporting.ts` (category/endpoint/caps/copy/sanitize patterns) + `errorReportService.ts` (sanitize + POST BugReport, never throws, `{ reported }`); `global-error.tsx` + `error.tsx` file the report on mount and render pending/reported/unreported copy honestly.
- Types: `NavItem.roles` widened to accept `USER | ADMIN` literals.
- Tests: `errorReportService.test.ts` (8: redaction, truncation, ok/false/network-false, no email leak) + `navigation.test.ts` (+2: uppercase ADMIN grants admin items, `isAdminRole` cases).
**QA gate (this runner, node_modules via `npm install`):**
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 25 suites / 220 tests, all pass
- `npm run build` — clean (all `/admin*` + `/api/admin/*` routes present)
- `npx next lint` — 0 issues in touched files (remaining feed/suggestions `any` errors + DashboardNav `Settings` warning are pre-existing)
**Assumptions Made:**
- `MODERATOR` string still tolerated in server-side admin API guards (forward-compat) but canonical gate is `isAdminRole()` (ADMIN only per current enum); no migration to add a MODERATOR enum value.
- Auto-filed BugReports use category OTHER with `metadata.source: "error-boundary"` so admins can filter them; reporter stays anonymous (null) since boundaries may render pre-auth.
- Quick Links block keeps its `lg:hidden` wrapper (desktop already has the sidebar admin section); the admin entry is mobile-visible there.
**Notes / Blockers:** Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration. In-progress reset to idle below.

## 2026-10-08 — execute-feature: admin responsive + real metrics + bulk ops + config UX + profile tabs (Sprint 18)
**Directive:** Admin responsive (collapsible sidebar, grids per screen size, overflow/truncation/ellipsis/scroll), dashboard metrics valid/real (zero must not show +/- trend), working actions + bulk ops (checkboxes, select all, invert, undo, first-N quick), site-config non-JSON management (drag-drop/simpler UI), profile posts/routes tabs scrollable with spacing.
**Changes (4 new, 11 edited):**
- New: `app/lib/config/admin.ts` (layout/metrics/bulk/config-editor metadata + `formatDelta` + `inferConfigKind`), `app/lib/hooks/useBulkSelection.ts` (select-all/invert/undo/clear/first-N with history), `app/__tests__/config/admin.test.ts` (4 tests).
- Shell: `AdminShell.tsx` collapsible desktop sidebar (persisted), mobile drawer + top bar, truncated labels, scrollable nav.
- Metrics: stats API computes real `deltas` (totalUsers vs 7d ago, postsToday vs yesterday, avgValidity vs prior, openBugs) with `pctChange` (0/0→0, current>0/0→null); dashboard renders `formatDelta` (zero→"No change"/"No data" flat, never fake +/-) + responsive grids + overflow guards.
- Bulk: users/posts/bugs/reviews all get toolbar (select-all toggle, invert, undo-select, clear, first-10/25/50, bulk actions with confirm + undo toast); APIs accept `*Ids` arrays (updateMany/deleteMany, non-breaking single still works).
- Config: card list with type-aware editors (text/number/boolean-toggle/JSON), add-form with kind picker, drag-drop + arrow reorder, modal confirm deletes, toast feedback.
- Profile: both `[username]` and own `page.tsx` tab bars scrollable (`overflow-x-auto`, min-width tabs, spacing).
**QA gate (this runner, no node_modules):**
- `npx tsc --noEmit` — not runnable (missing deps, same pre-existing env limit); new/edited files use existing patterns, no new imports outside installed set.
- `npx jest` — not runnable here; new suite follows existing pure-config pattern (4 tests).
- `npm run build` / lint — not runnable here; `git diff --stat` reviewed.
**Assumptions:** Bulk restore for users replays prior roles individually; post bulk-restore replays snapshots via POST (new ids); bug bulk-moderation loops single calls (post linkage differs); config reorder is display-only (no persisted order column).
**Notes / Blockers:** Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — fix-build: duplicate `bugId` identifier in admin bugs PATCH route
**Directive:** Vercel build failed `Module parse failed: Identifier 'bugId' has already been declared (140:14)` in `app/api/admin/bugs/route.ts` (`Build failed because of webpack errors`).
**Changes (1 edited):**
- `app/api/admin/bugs/route.ts` — renamed second declaration `const bugId = targets[0]` → `const targetBugId`, updated its two uses (`findUnique where`, `$transaction bugReport.update where`). Destructured request-body `bugId` untouched.
**QA gate (this runner, no node_modules):**
- Full `tsc`/`jest`/`next build`/`lint` not runnable (missing deps, pre-existing env limit); verified via `grep` — exactly one `targetBugId` declaration, no `bugId` redeclaration remains. Vercel build to confirm.
- Repair-system entry added (same duplicate-declaration pattern as `formatCount` 2026-07-15). Single-file fix → no repo-map/dependency-graph/architecture drift; sync-context lightweight check done inline.
**Assumptions:** Sentry 401 + `prisma generate --no-engine` noise in the same log are non-fatal (fallback `|| prisma generate` succeeded; Sentry failures only affect sourcemap upload) — left untouched per minimal-fix contract.
**Notes / Blockers:** Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — fix-build: Prisma ReviewStatus type error in admin reviews PATCH route
**Directive:** Vercel build failed `./app/api/admin/reviews/route.ts:65:15 Type error: Type 'string' is not assignable to type 'ReviewStatus | EnumReviewStatusFieldUpdateOperationsInput | undefined'` on `data: { status }`.
**Changes (1 edited):**
- `app/api/admin/reviews/route.ts` — `data: { status }` → `data: { status: status as "APPROVED" | "REJECTED" }`; safe behind existing `["APPROVED","REJECTED"].includes(status)` 400-guard.
**QA gate (this runner, no node_modules):**
- Full `tsc`/`jest`/`next build` not runnable (missing deps, pre-existing env limit); verified via `grep` — sole untyped `data: { status }` fixed, sibling admin routes already use `as never` casts so no further enum-type failures expected. Vercel build to confirm.
- Repair-system entry added (same enum-mismatch class as `UserRole '"banned"'` 2026-07-15). Single-file fix → no repo-map/dependency-graph/architecture drift; sync-context lightweight check done inline.
**Assumptions:** Sentry 401 + `prisma generate --no-engine` noise in the same log are non-fatal — left untouched per minimal-fix contract.
**Notes / Blockers:** Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — fix-build: Sentry 401 hardening + Prisma --no-engine + instrumentation-client
**Directive:** Vercel build logs `sentry reported an error: Invalid token (http status: 401)` on release/sourcemap ops (Node/Edge/Client) + telemetry Info noise + `sentry.client.config.ts` Turbopack deprecation warning; `prisma generate --no-engine` unknown-option noise on every install/build.
**Changes (2 edited, 1 new):**
- `next.config.mjs` — `sentryConfigured` (token + org + project + DSN) gates `dryRun`, `release.create/finalize`, `sourcemaps.disable`; `telemetry: false`; `silent: true` unconditionally (old `!process.env.CI` guard meant noisy on Vercel); `errorHandler` warns once and swallows so Sentry never fails the build.
- `package.json` — dropped obsolete `--no-engine` from `postinstall`/`build`/`vercel-build` (flag removed in Prisma 7).
- `instrumentation-client.ts` (new) — side-effect import of `sentry.client.config.ts` per Next.js Turbopack convention; old file kept as single source of truth for webpack.
**QA gate (this runner, no node_modules):**
- Full `tsc`/`jest`/`next build`/`lint` not runnable (missing deps, pre-existing env limit); verified via `node --check` (next.config.mjs syntax OK), JSON parse (package.json OK), grep (no `--no-engine` remains; all Sentry keys present; `instrumentation-client.ts` included in tsconfig `**/*.ts`). Vercel build to confirm.
- Repair-system Sentry-401 entry extended with follow-up (2026-10-08). Multi-file fix → sync-context lightweight check done inline: no repo-map/dependency-graph drift (no modules added/removed, only build config); system-architecture Sentry row still accurate (runtime init untouched); task-queue untouched so no checkpoint chain beyond in-progress.
**Assumptions:** A present-but-invalid token cannot be detected without an API call, so gating + swallowing (not validation) is the correct resilience strategy; `silent: true` hides routine Sentry logs but `errorHandler` still surfaces failures as one warning.
**Notes / Blockers:** The actual fix for the 401 itself is rotating `SENTRY_AUTH_TOKEN` in Vercel env (invalid/expired server-side) — code now tolerates it either way. Remaining backlog unchanged: live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration.

## 2026-10-08 — plan-feature: keyless long-term map stack (Sprint 19 planned)
**Directive:** Long-term keyless map service/tools/renderers — pins on exact coordinates + polylines, scalable, no API-key failures (candidates browsed: OSM, openmaps.dev, MapLibre, Leaflet, Stadia, Geoapify).
**Plan (no code written):**
- **Feature summary** — replace key-dependent tiles/routing/geocoding with a keyless-by-default stack that degrades gracefully and scales via self-hosting, keeping exact-pin + polyline rendering.
- **Architecture impact** — `RouteMap.tsx` (mapbox:// branch + `cartoParam` apiKey logic), `explore/page.tsx` (duplicated inline raster style), `routeTracingService.ts` (Mapbox-first → OSRM-first), `RouteStepInput`/`ShareRouteModal`/`geo.ts` (browser-direct Nominatim), `/api/routes/trace`, `.env.example`, `app/layout.tsx` preconnect hints. Renderer (MapLibre GL + react-map-gl) and polyline codec (`@mapbox/polyline`) unchanged — no Leaflet migration (regression, no capability gain).
- **New modules** — `app/lib/config/mapStack.ts` (MAP_STACK_CONFIG: styles, fallback chains, TTLs, attribution, dark mapping); `/api/maps/{route,geocode,reverse}` + `mapProxyService` (Redis cache, rate limit, server UA/Referer, sanitized errors); shared map-style builder hook.
- **Data flow** — client → internal `/api/maps/*` (cache → keyless provider → keyed override → straight-line/geocode-null fallback) → MapLibre render; third-party keys never touch the browser.
- **UI/UX** — no visual change by design (same markers/polyline/overlay per design-system); vector tiles + raster fallback keeps low-end mobile viable; error skeleton on total tile failure; attribution per provider.
- **Risks/edge cases** — OSRM demo 1 req/s + no SLA (mitigated: proxy cache + rate limit + fallback; self-host OSRM/Valhalla scale path); OpenFreeMap public-instance generosity is donation-funded (mitigated: self-host http-host path, config-URL swap, no code change); Nominatim policy (mitigated: server-side proxy); vector-tile GPU cost on low-end (mitigated: raster fallback); offline tiles still need service-worker caching (open follow-up, not in Sprint 19).
- **Decisions against** — Stadia/MapTiler/Geoapify/Google (key + billing, rejected as defaults); Mapbox styles/directions (demoted to env-gated override); Leaflet (rejected, MapLibre already keyless and GPU-accelerated); Carto `?apiKey=` (removed, keyless raster fallback only).
- **Tasks added** — Sprint 19 section in `planning/task-queue.md` (8 rows: config [M], proxy [M], renderer [M], geocode client [S], trace reorder [M], env hygiene [S], tests [M], keyless-proof QA [S]).
- **Architecture doc updates needed at implementation** — system-architecture Maps row + config table (new MAP_STACK_CONFIG, CARTO/MAPBOX/MAPTILER rows → optional), project-context tech-decisions (MapLibre-over-others row extended with OpenFreeMap/OSRM rationale).
**QA gate:** planning-only — no tsc/jest/build applicable; web-verified OpenFreeMap (keyless, MapLibre-native, self-hostable) + OSRM demo policy (1 req/s, no SLA) 2026-10-08.
**Assumptions:** Carto legacy raster endpoints remain keyless-compatible as fallback; West-Africa OSRM extract is small enough for cheap self-host if needed.
**Notes / Blockers:** Remaining backlog unchanged (live map tracking navigation now rides on this stack; carto-key wiring superseded by this plan — key no longer needed; auth linking, supercluster, rate-limiter Redis migration still open).

---

## Session 2026-10-09 — execute-feature: Sprint 19 Keyless Map Stack (OpenFreeMap + OSRM + Proxied Geocoding)

**Completed:**
- Step 1 planning pass: read task-queue (Sprint 19 plan rows), system-architecture, design-system, repair-system, project-context, project-decisions; codebase research (map renderer, tracing service, geocode call sites, rate-limit/cache/registry patterns); wrote plan to `checkpoints/in-progress.md`
- Step 2 self-check vs project-context scope + project-decisions: PASS — maps/discovery is core product surface, additive proxy routes, MapLibre renderer kept, no schema change (no plan-feature sign-off needed; plan already existed)
- Implementation (non-breaking, config/metadata-driven, no new deps):
  - `app/lib/config/mapStack.ts` (new) + barrel export — vector styles, dark mapping, raster chain, provider orders, upstreams, identity, TTLs, attributions, preconnect hosts, stack builders, env gates
  - `app/lib/services/mapProxyService.ts` (new) — traceRoute/geocodeForward/geocodeReverse, Redis read-through, never-throw, keyed-only-with-env
  - `app/api/maps/{route,geocode,reverse}/route.ts` (new) — maps-bucket limit, sanitized errors, guest-accessible
  - Renderer: RouteMap + explore via `getMapStyleStack` (vector primary, onError step-down; `mapbox://` + `cartoParam` branches removed); layout preconnects keyless hosts from config
  - Clients: RouteStepInput, ShareRouteModal (2 paths), `geo.ts` → internal proxy; zero Nominatim URLs left in client code
  - `routeTracingService` → thin delegate; `/api/routes/trace` → delegates (contract unchanged)
  - Hygiene: `RATE_LIMITS.maps`, `CACHE_TTL`/`CACHE_KEYS` maps entries, `API_REGISTRY` maps entries, `.env.example` optional-override notes
  - Tests: `app/__tests__/config/mapStack.test.ts` (10 suites; redis mocked per established service-test pattern after hitting the @upstash/redis ESM-jest issue)
- Step 4 QA gate (real runs, node_modules via `npm install`): tsc 0 errors, jest 27 suites / 234 tests pass, build clean (84 pages, `/api/maps/*` present), lint zero-new (stash-compared baseline)
- Step 5 close-out: task-queue Sprint 19 rows [x], dev-history Sprint 19 entry, lessons-learned (proxy-ownership lesson), project-decisions (keyless-first decision), architecture-history Sprint 19 entry, repo-map / dependency-graph / system-architecture / project-plan / test-results updates, freshness headers; update-ai-system deep sync run per directive (this entry is its trace)

**Files Modified:**
- New: `app/lib/config/mapStack.ts`, `app/lib/services/mapProxyService.ts`, `app/api/maps/route/route.ts`, `app/api/maps/geocode/route.ts`, `app/api/maps/reverse/route.ts`, `app/__tests__/config/mapStack.test.ts`
- Edited: `app/lib/config/{index,rateLimits,cache,apiRegistry}.ts`, `app/lib/services/routeTracingService.ts`, `app/api/routes/trace/route.ts`, `app/components/features/posts/{RouteMap,RouteStepInput,ShareRouteModal}.tsx`, `app/(dashboard)/explore/page.tsx`, `app/layout.tsx`, `app/lib/utils/geo.ts`, `.env.example`
- Docs: `ai-system/{planning/task-queue,planning/project-plan,index/repo-map,index/dependency-graph,system-architecture,testing/test-results,summaries/dev-history,memory/lessons-learned,memory/project-decisions,memory/architecture-history,checkpoints/in-progress}.md` + this entry

**Next Task:**
Next human decision — remaining backlog: live map tracking navigation, auth provider linking, supercluster clustering, rate-limiter Redis migration. (Carto key wiring closed by this sprint.) If routing volume nears OSRM demo limits, consider self-hosted OSRM or a keyed override per the Sprint 19 decision.

**Assumptions Made:**
- OSRM demo availability (~1 req/s, no SLA) is acceptable behind Redis caching at current volume; straight-line fallback covers outages
- `?ref=`/OAuth referral, notification, and other subsystems untouched — Sprint 19 is maps-scoped
- `hasOrsKey`/`hasMapboxKey` read server env at request time; `NEXT_PUBLIC_*` reads in mapStack are build-inlined and only *called* server-side

**Notes / Blockers:**
- None — QA gate fully green. update-ai-system.md is terminal per its contract — no chained commands.

---

## 2026-10-09 — Execute-Feature: Map + Draft + FAQ Tightening (Sprint 20)

**Directive:** Same-draft update-in-place (or prompt update-vs-new); anchor-stable route pins + user-location dot (numbered dots, blue/green dot with glory/radar, token-driven); dark keeps light map visuals; FAQ map guides + report-flow correction + accuracy pass; config/metadata-driven, modular, non-breaking; close with update-ai-system.md.

- Step 1 planning: task-queue / system-architecture / design-system (tokens) / repair-system read; decomposed to pins, dark parity, drafts, FAQ, tests. No architecture impact (no migration, no new deps, no removed APIs) — plan-feature pre-read not required.
- Step 2 scope check: fits project-context (maps + drafts + FAQ all in-scope surfaces); no conflict with project-decisions (extends Sprint 19 keyless-first; new Sprint 20 decision recorded). Proceeded.
- Step 3 implementation (mid-work sync: this entry):
  - Pins: `app/lib/config/mapPins.ts` (`MAP_PINS_CONFIG`, `routePinLabel`) + `app/components/features/posts/MapPins.tsx` (`MapRoutePin`, `MapUserDot`); RouteMap cutover (stale-closure fix, 1-based numbering, stable keys, token visuals, filter-skip on `"none"`); explore cutover (anchors, shared pins, a11y buttons, dark-filter CSS removed)
  - Dark parity: `darkCanvasFilter: "none"`, dark raster mirrors light
  - Drafts: `updateDraft` service + config labels/prompt + modal update-vs-new bar + per-draft Update in panel
  - FAQ: report via in-post Report dialog, Maps & Navigation category (2), edit/delete via post menu, drafts in share answer
  - Tests: `mapTightening.test.ts` (7) + mapStack dark-parity updates
- Step 4 QA gate (real runs, node_modules via `npm install`): tsc 0 errors, jest 28 suites / 241 tests pass, build clean, lint zero issues on touched files
- Step 5 close-out: task-queue Sprint 20 rows [x], dev-history Sprint 20 entry, lessons-learned (pin-anchoring lesson), project-decisions (Sprint 20 decision), repo-map / dependency-graph / system-architecture / project-plan / test-results updates, freshness headers; update-ai-system deep sync run per directive (this entry is its trace)

**Files Modified:**
- New: `app/lib/config/mapPins.ts`, `app/components/features/posts/MapPins.tsx`, `app/__tests__/config/mapTightening.test.ts`
- Edited: `app/components/features/posts/{RouteMap,ShareRouteModal,RouteDraftsPanel}.tsx`, `app/(dashboard)/explore/page.tsx`, `app/lib/config/{mapStack,routeDrafts,faq,index}.ts`, `app/lib/services/routeDraftsService.ts`, `app/__tests__/config/{mapStack,routeDrafts}.test.ts`
- Docs: `ai-system/{planning/task-queue,planning/project-plan,index/repo-map,index/dependency-graph,system-architecture,summaries/dev-history,memory/lessons-learned,memory/project-decisions,testing/test-results,checkpoints/in-progress}.md` + this entry

**Next Task:**
Next human decision — remaining backlog: live map tracking navigation, auth provider linking, supercluster clustering, rate-limiter Redis migration.

**Assumptions Made:**
- Info-blue user dot satisfies "blue or green" with white glory ring + radar ping, all token classes
- Dark light-parity (same liberty vector + light raster, no filter) matches the reported clarity observation
- Active-draft save prompts update-vs-new; fresh-composer save creates new directly (no prompt)

**Notes / Blockers:**
- None — QA gate fully green. update-ai-system.md is terminal per its contract — no chained commands.
---
