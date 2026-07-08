# Along — Development Roadmap
> Version 1.0 · Clean Rebuild
> Stack: Next.js 15 · React 19 · TypeScript 5 · Tailwind 4 · Ant Design 5 · Prisma 7 · PostgreSQL · Upstash Redis · MapLibre GL · Lucide React
> Architecture: Config-Driven · OOP Services · Repository Pattern · Universal Components

---

## ARCHITECTURE PRINCIPLES (Non-Negotiable)

Before reading phases, internalize these. Every task executes under these constraints.

1. **Config-first.** Every list, option set, status map, icon map, and weight lives in `app/lib/config/`. If you are hardcoding a value that could change, you are doing it wrong.
2. **Universal components.** `app/components/ui/` contains wrappers for all repeated UI patterns. No raw Ant Design imports in page or feature files. No ad-hoc styling of common elements.
3. **OOP services.** Business logic lives in class-based services in `app/lib/services/`. Pages and components call services; services call repositories; repositories call Prisma.
4. **Repository pattern.** No direct `prisma.*` calls outside of `app/lib/db/`. All DB access through typed repository classes extending `BaseRepository<T>`.
5. **Zero emoji.** All iconography is Lucide React. Zero exceptions. Existing emoji in the codebase are a bug to be fixed.
6. **Role-aware, not role-specific.** No separate components for admin vs user. One component, filtered by role via config (`filterNavItems`, etc.).
7. **ACID transactions.** Any mutation touching more than one table uses `prisma.$transaction([])`.
8. **Confirmations.** Every destructive or sensitive user action is gated by `ModalService.confirm()`.
9. **Interface first.** Define the TypeScript interface before writing the implementation. No `any` types in new files.
10. **Build passes always.** `npm run build` must pass before any task is marked complete. Never leave the codebase broken.
11. **Overwrite, don't patch.** When a file violates these principles, rewrite it completely. Patching non-compliant code produces worse results than starting fresh.

---

## FILE STRUCTURE (Target)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── otp/page.tsx
├── (dashboard)/
│   ├── layout.tsx               ← auth guard + nav
│   ├── loading.tsx
│   ├── home/page.tsx
│   ├── explore/page.tsx
│   ├── posts/[id]/page.tsx
│   ├── profile/
│   │   ├── page.tsx             ← own profile
│   │   └── [username]/page.tsx  ← other profiles
│   ├── bookmarks/page.tsx
│   ├── marketplace/page.tsx
│   ├── notifications/page.tsx
│   ├── analytics/page.tsx
│   └── invite/page.tsx
├── (admin)/
│   ├── layout.tsx               ← role guard
│   ├── page.tsx                 ← admin dashboard
│   ├── users/page.tsx
│   ├── posts/page.tsx
│   ├── config/page.tsx
│   ├── bugs/page.tsx
│   └── reviews/page.tsx
├── (public)/
│   ├── page.tsx                 ← landing
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── privacy/page.tsx
│   └── terms/page.tsx
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── register/route.ts
│   │   ├── logout/route.ts
│   │   ├── refresh/route.ts
│   │   ├── otp/route.ts
│   │   └── google/
│   │       ├── route.ts
│   │       └── callback/route.ts
│   ├── users/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   ├── [id]/avatar/route.ts
│   │   ├── [id]/follow/route.ts
│   │   └── search/route.ts
│   ├── posts/
│   │   ├── route.ts
│   │   ├── feed/route.ts
│   │   ├── [id]/route.ts
│   │   ├── [id]/like/route.ts
│   │   ├── [id]/bookmark/route.ts
│   │   └── [id]/comments/route.ts
│   ├── routes/
│   │   └── trace/route.ts
│   ├── notifications/route.ts
│   ├── analytics/
│   │   └── user/route.ts
│   ├── bug-reports/route.ts
│   ├── reviews/route.ts
│   ├── invite/route.ts
│   ├── admin/
│   │   ├── users/[id]/route.ts
│   │   ├── posts/[id]/route.ts
│   │   ├── config/route.ts
│   │   └── bug-reports/[id]/route.ts
│   ├── integrations/
│   │   ├── transact/route.ts
│   │   └── tega/route.ts
│   └── webhooks/
│       ├── transact/route.ts
│       └── tega/route.ts
├── lib/
│   ├── config/                  ← ALL config registries
│   ├── services/                ← class-based business logic
│   ├── db/                      ← repository classes
│   ├── utils/                   ← helpers, metadata, structured data
│   └── schemas/                 ← Zod validation schemas
├── components/
│   ├── ui/                      ← universal reusable components
│   └── features/                ← domain-specific components
├── providers/                   ← React context providers
├── hooks/                       ← custom hooks
├── sitemap.ts
├── robots.ts
├── not-found.tsx
├── error.tsx
├── global-error.tsx
└── loading.tsx
```

---

## PHASE 0 — GROUND ZERO (Complete before anything else)
**Objective:** Establish the complete foundation. Every subsequent phase builds on this. Do not proceed until `npm run build && npx tsc --noEmit && npx next lint` all pass.

### 0.1 — Dependency Installation and Tailwind 4 Migration
- Update all packages to target versions
- Add: `lucide-react`, `maplibre-gl`, `react-map-gl`, `@mapbox/polyline`, `supercluster`, `qrcode.react`, `rxjs`, `@upstash/qstash`, `react-markdown`, `remark`, `@ant-design/charts`
- Upgrade `tailwindcss` to v4 — migrate `tailwind.config.ts` to CSS-first `@theme {}` in `globals.css`
- Define all design tokens from `DESIGN.md §2` in `@theme {}` block
- Define `.glass` utility class
- Define focus ring, reduced motion media query
- Verify Inter font loaded via `next/font/google`
- **Exit criteria:** `npm install` zero errors, `npm run build` passes

### 0.2 — Complete Config Registry
Create all files in `app/lib/config/`. Each file exports a typed interface + a typed constant. Zero hardcoded values elsewhere after this.

| File | Key Export |
|---|---|
| `vehicles.ts` | `VEHICLE_REGISTRY: Record<VehicleType, VehicleConfig>` — Lucide icons, colors, metadata |
| `routeStatus.ts` | `ROUTE_STATUS_REGISTRY: Record<RouteStatus, RouteStatusConfig>` — Lucide icons |
| `navigation.ts` | `NAV_REGISTRY: NavItem[]` + `filterNavItems()` |
| `forms.ts` | `REGISTER_FIELDS`, `LOGIN_FIELDS`, `EDIT_PROFILE_FIELDS`, `POST_CREATE_FIELDS`, `BUG_REPORT_FIELDS`, `CONTACT_FIELDS` as `FieldConfig[]` |
| `notifications.ts` | `NOTIFICATION_REGISTRY: Record<NotificationType, NotificationTypeConfig>` |
| `feedAlgorithm.ts` | `DEFAULT_FEED_CONFIG: FeedAlgorithmConfig` |
| `draftingCoach.ts` | `QUALITY_CHECKPOINTS: QualityCheckpoint[]` — `celebrationIcon: LucideIcon` (no emoji) |
| `validityConfig.ts` | `DEFAULT_VALIDITY_CONFIG: ValidityConfig` |
| `avatar.ts` | `AVATAR_STYLES`, `AvatarConfig`, `buildAvatarUrl()`, `getFallbackAvatarUrl()` |
| `footer.ts` | `FOOTER_CONFIG` with devCredit linking to `https://sotonye-dagogo.is-a.dev` |
| `teamConfig.ts` | `TeamMember` interface, `TEAM_MEMBERS: TeamMember[]` |
| `mapIntegrations.ts` | `TRANSPORT_INTEGRATION_REGISTRY: TransportIntegrationConfig[]` |
| `rewards.ts` | `REWARD_TIERS`, `POINTS_CONFIG`, `PointsAction` |
| `inviteConfig.ts` | `INVITE_CONFIG` |
| `rateLimits.ts` | `RATE_LIMITS` (migrated from wherever it currently is) |
| `validationRules.ts` | `VALIDATION_RULES` (all magic numbers/regex) |
| `cache.ts` | `CACHE_TTL`, `CACHE_KEYS` |
| `apiRegistry.ts` | `API_REGISTRY` |
| `seo.ts` | `DEFAULT_META`, `PAGE_META` |
| `emptyStates.ts` | `EMPTY_STATES: Record<string, EmptyStateConfig>` |

### 0.3 — Prisma Schema (Full)
Apply the complete schema from PRD §5.1. New enums, extended User/Post, new models (SiteConfig, BugReport, UserReview, AnalyticsEvent). All indexes. Run `prisma migrate dev --name clean-rebuild`. Run `prisma generate`.

### 0.4 — Universal Component Library
Create all files in `app/components/ui/`. Export everything from `index.ts`.

Required components (full specs in `DESIGN.md §6`):
`AppButton`, `AppCard`, `AppInput`, `AppTextarea`, `AppSelect`, `AppTable`, `AppEmptyState`, `AppModal`, `AppTag`, `AppAvatar`, `AppUserLabel`, `AppTooltip`, `AppDropdown`, `AppSkeleton` (with preset variants), `AppPagination`, `AppDivider`, `AppProgress`, `AppAlert`, `AppSpinner`, `AppPageLoader`, `AppStatusDot`, `AppFooter`, `TrustBadge`, `ConfigDrivenForm`, `ConfigDrivenList`, `GlobalConfirmModal`, `GlobalUndoToast`, `CookieConsent`, `StructuredData`

### 0.5 — Global Services
`app/lib/services/`: `modalService.ts`, `toastService.ts`, `undoService.ts`, `offlineQueue.ts`
`app/providers/`: `GlobalModalProvider.tsx`, `GlobalToastProvider.tsx`, `CookieConsentProvider.tsx`
Update `app/layout.tsx`: wrap with all providers, mount `CookieConsent`, `GlobalConfirmModal`, `GlobalUndoToast`

### 0.6 — SEO Foundation
`app/lib/utils/metadata.ts` — `buildMetadata()`, `buildPostMetadata()`, `buildProfileMetadata()`
`app/lib/utils/structuredData.ts` — `WebSite`, `Article`, `ProfilePage` schemas
`app/sitemap.ts`, `app/robots.ts`
Error/loading pages: `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx`, per-segment `loading.tsx` files

### 0.7 — Repository Layer
`app/lib/db/BaseRepository.ts` — abstract base with `findById`, `findMany`, `create`, `update`, `delete`, `count`
`UserRepository`, `PostRepository`, `NotificationRepository`, `SiteConfigRepository`, `AnalyticsRepository`

### 0.8 — Phase 0 Quality Gate
```bash
npm run build && npx tsc --noEmit && npx next lint
```
Zero errors. Zero `any` types in new files. Commit: `chore(rebuild): phase-0 foundation`.

---

## PHASE 1 — AUTHENTICATION & IDENTITY
**Objective:** Complete auth flow, user identity, avatar system, profile.

### 1.1 — Auth API Routes
`/api/auth/login` — POST — email+password → JWT pair → httpOnly cookies
`/api/auth/register` — POST — create user with `inviteCode = cuid()` → OTP email
`/api/auth/otp` — POST — verify OTP → activate user
`/api/auth/logout` — POST — clear cookies
`/api/auth/refresh` — POST — validate refresh token → new access token
`/api/auth/google` + `/api/auth/google/callback` — OAuth code flow → upsert user → JWT

### 1.2 — Auth Pages
`/(auth)/login`, `/(auth)/register`, `/(auth)/otp` — full designs per `DESIGN.md §7.2`
Both split-panel layouts (brand left, form right on desktop; stacked on mobile)
Use `ConfigDrivenForm` with `LOGIN_FIELDS` / `REGISTER_FIELDS`
Google OAuth button, OTP 6-box input, all validation via Zod schemas

### 1.3 — Auth Context + Hooks
`app/providers/AuthProvider.tsx` — user state, token refresh, logout
`hooks/useAuth.ts` — `{ user, isAuthenticated, isLoading, logout }`
`hooks/useRequireAuth.ts` — redirect to login if not authenticated
Middleware: `middleware.ts` — protect `/(dashboard)`, `/(admin)` routes server-side

### 1.4 — User API Routes
`/api/users/[id]` — GET (public profile), PATCH (own profile only)
`/api/users/[id]/avatar` — PATCH — save `AvatarConfig` JSON
`/api/users/[id]/follow` — POST (follow) / DELETE (unfollow) — ACID: Follow record + Notification
`/api/users/search` — GET `?q=` — for @mention autocomplete
`/api/users/suggestions` — GET — weighted user suggestions algorithm

### 1.5 — Profile Pages
Own profile `/(dashboard)/profile/page.tsx` and other `/(dashboard)/profile/[username]/page.tsx`
Full designs per `DESIGN.md §7.6`
Cover, avatar (AppAvatar 80px), name + verified badge, stats row, tabs
Own: Edit Profile modal (`ConfigDrivenForm` + `EDIT_PROFILE_FIELDS`), AvatarEditor modal
Other: Follow/Unfollow button with hover state, mutual follows count
`generateMetadata` using `buildProfileMetadata(user)`

### 1.6 — AvatarEditor
`components/features/profile/AvatarEditor.tsx` — style picker grid (left) + live preview + options (right)
`AppAvatar` final implementation — DiceBear URL building from config, fallback, verified badge, `linkToProfile`
Replace every remaining `<img>` avatar in the codebase with `<AppAvatar>`

### 1.7 — Phase 1 Quality Gate
```bash
npm run build && npx tsc --noEmit && npx next lint
```
Commit: `feat(phase-1): auth, identity, profiles, avatars`.

---

## PHASE 2 — POSTS & FEED
**Objective:** Complete post system, feed, interactions, comments, bookmarks.

### 2.1 — Post Data Model + API
Ensure Post schema has all Phase 0 additions (validityScore, coords, region, isPlatformGen, etc.)
`/api/posts` — POST create (auth required, Zod validation, ACID: post + UserActivity + invalidate feed cache)
`/api/posts/feed` — GET (paginated, cursor-based, auth required, feed algorithm)
`/api/posts/[id]` — GET (public), PATCH (own post only), DELETE (own or admin, ModalService.confirm)
`/api/posts/[id]/like` — POST toggle — ACID: PostLike upsert + counter update + notification + points
`/api/posts/[id]/bookmark` — POST toggle — ACID: bookmark + counter
`/api/posts/[id]/comments` — GET (paginated) + POST (create, with mentions parsed and stored)

### 2.2 — PostCard Component (Full)
`components/features/posts/PostCard.tsx` — complete implementation per `DESIGN.md §6.9`
`AppCard default + hover`, `AppUserLabel` (links to profile), `AppDropdown` (•••), vehicle chips from `VEHICLE_REGISTRY`
Route steps with connector line, fare chips, image grid (1/2/3-up), mini RouteMap (MapLibre, SSR-disabled)
Action bar: all Lucide icons, optimistic updates via `useFeedInteractions`
TrustBadge inline
Along Suggestion variant (`AppCard suggestion`)
Double-tap to like (touch), long-press context menu (mobile)
Subtle link: title → post detail, tags → explore, region → explore map

### 2.3 — Feed Algorithm
`app/lib/services/feedService.ts` — class-based, config-driven weights from `getSiteConfig('feedAlgorithm', DEFAULT_FEED_CONFIG)`
Signals: following posts (0.70), matching tags (0.20), trending (0.10), location bonus (0.15 additive)
Redis cache: `feed:{userId}:{cursor}` TTL 5min, stale-while-revalidate
Bulk enrichment: one query for all like/bookmark/follow flags — zero N+1

### 2.4 — Feed UI
`/(dashboard)/home/page.tsx` — 3-panel layout per `DESIGN.md §7.3`
Compose card at top, "New posts" banner, infinite scroll with `AppSkeleton` PostCardSkeleton
`AppEmptyState` at end, right sidebar (who to follow, trending tags, Tega events placeholder)
Back-to-top FAB (appears after 500px scroll)

### 2.5 — ShareRouteModal
`components/features/posts/ShareRouteModal.tsx` — full design per `DESIGN.md §7.7`
`AppModal xl`, draggable route steps (GripVertical), `RouteStepInput` with location autocomplete
Vehicle icon-chip selector, fare input, image upload (Cloudinary direct, max 10)
Tags tokenized input, DraftingCoach panel, live RouteMap preview
Save draft + Share Route buttons

### 2.6 — ValidityEngine + DraftingCoach
`app/lib/services/ValidityEngine.ts` — full implementation (likeRatio 35%, detailScore 35%, similarityRatio 20%, recency 10%)
`app/lib/services/DraftingCoachService.ts` — evaluates all `QUALITY_CHECKPOINTS` against current draft
`components/features/posts/DraftingCoach.tsx` — score bar, top nudge, completed chips
Wire TrustBadge into PostCard and PostDetail
Recompute score on: post update, like/dislike, new similar-tag post — cache in Redis `validity:{postId}` TTL 30min

### 2.7 — Post Detail Page
`/(dashboard)/posts/[id]/page.tsx` — full design per `DESIGN.md §7.5`
`generateMetadata` using `buildPostMetadata(post, author)`
JSON-LD `Article` schema via `StructuredData`
RouteMap (280px), route steps, image gallery (click → lightbox AppModal fullscreen)
Engagement bar, comments section with @mention input, related posts
Transact CTA card (if listing exists)

### 2.8 — Comments + Mentions System
`components/features/comments/CommentInput.tsx` — `@` trigger → user search dropdown → insert `@username`
`app/lib/utils/commentParser.ts` — render `@username` as `<Link>` to profile in comment text
Mention notifications: `NotificationType.MENTION` → notification row
`components/features/comments/CommentList.tsx` — threaded, paginated, AppUserLabel on each comment

### 2.9 — Bookmarks Page
`/(dashboard)/bookmarks/page.tsx` — `ConfigDrivenList` of bookmarked PostCards, empty state

### 2.10 — Confirmations + Undo (Full Codebase)
Apply `ModalService.confirm()` to: delete post, delete comment, unfollow, block, admin bans, admin post delete
Apply `UndoService` + `ToastService.undo()` to: post delete (10s), comment delete (10s), unfollow (5s), unlike (5s), remove bookmark (5s)
Optimistic UI + rollback on all reversible actions in `useFeedInteractions`

### 2.11 — Notifications
`/api/notifications` — GET (paginated), PATCH (mark read), PATCH all (mark all read)
`/(dashboard)/notifications/page.tsx` — tabs (All/Unread/Rewards), mark-all-read, `AppEmptyState noNotifications`
Notification items per type using `NOTIFICATION_REGISTRY` — all user references via `AppUserLabel`

### 2.12 — Phase 2 Quality Gate
```bash
npm run build && npx tsc --noEmit && npm test -- --passWithNoTests && npx next lint
```
Commit: `feat(phase-2): posts, feed, interactions, comments, validity`.

---

## PHASE 3 — MAPS & DISCOVERY
**Objective:** MapLibre integration, route tracing, geographic data, Explore page, suggestion algorithms.

### 3.1 — MapLibre Migration
Remove `leaflet` / `react-leaflet`. Add `maplibre-gl` + `react-map-gl`.
`components/features/posts/RouteMap.tsx` — full rewrite per `DESIGN.md §6.12`
Always `dynamic(() => ..., { ssr: false })`
Origin/waypoint/destination markers with numbered badges
Polyline from encoded string (decoded via `@mapbox/polyline`)
Editable mode: draggable markers, "Auto-Trace Route" button
Glass overlay card: distance + time + fare
Dark mode: MapTiler dark style when `class="dark"`

### 3.2 — Route Tracing Service
`app/lib/services/routeTracingService.ts` — call OpenRouteService `/directions`, encode polyline, fallback to straight-line segments
`/api/routes/trace` — POST `{ pins: RoutePin[] }` → `{ polyline, distance, duration }`, rate limited 20/hour

### 3.3 — Geographic Data on Posts
`RouteStepInput.tsx` — Google Places Autocomplete integration, `MapPin` icon prefix, `RoutePin` state per step
On post create/edit: compute `startCoords`, `endCoords`, `region` (Nominatim reverse geocode), `totalDistanceKm`
Store in `Post` fields

### 3.4 — Enhanced Suggestion Algorithms
`app/lib/services/suggestionsService.ts` — full weighted algorithm per PRD §3.4
Route suggestions: tag history (0.35), geographic proximity (0.30), validity (0.20), social graph (0.10), recency (0.05)
User suggestions: common tags (0.40), mutual follows (0.25), geographic (0.20), post quality (0.15)
Redis cache `suggestions:{userId}` TTL 30min

### 3.5 — Platform-Generated Suggestions ("Along Suggestions")
`app/lib/services/platformSuggestions.ts` — synthesize from existing posts, minimum validity 40, label as `isPlatformGen: true`
Feed injection: every 8th item, `AppCard suggestion` variant, "Along Suggestion" `AppTag` with `Sparkles` icon
Non-blocking: user posts render first, suggestions appended after 300ms

### 3.6 — Explore Page
`/(dashboard)/explore/page.tsx` — full design per `DESIGN.md §7.4`
Full-viewport MapLibre, search bar (Google Places), filter chips
Post pin clustering via `supercluster`
Click pin → glass popup `AppCard glass` with mini PostCard preview
Desktop side panel (320px glass), mobile bottom sheet (draggable)
"Near me" button, "Share this view" permalink with lat/lng/zoom in URL
Explore URL state: sync map viewport to/from URL query params

### 3.7 — Phase 3 Quality Gate
```bash
npm run build && npx tsc --noEmit && npx next lint
```
Commit: `feat(phase-3): maplibre, route tracing, explore, suggestions`.

---

## PHASE 4 — ECOSYSTEM & REWARDS
**Objective:** Rewards engine, invite system, marketplace integration, Tega events, analytics.

### 4.1 — Rewards Service
`app/lib/services/rewardsService.ts` — `awardPoints(userId, action, meta)` with ACID transaction
Tier upgrade detection and notification on every award
Trigger from: post create, like received, bookmark received, validity tier change, invite accepted, invited user posts

### 4.2 — Rewards UI
`components/features/profile/RewardsPanel.tsx` — tier badge, points balance, progress bar, history
Tier badge: shield icon in tier color, shown next to username throughout the app
Wire into profile page (§1.5)

### 4.3 — Invite System
`/(dashboard)/invite/page.tsx` — invite link input (copy), QR code (`qrcode.react`), stats cards, leaderboard
`/api/invite/route.ts` — GET user's invite stats
Registration flow: consume `?ref={inviteCode}`, set `invitedById`, award 100 points to inviter

### 4.4 — Transact Marketplace
`app/lib/integrations/transact.ts`, `/api/integrations/transact/route.ts`
`/api/webhooks/transact/route.ts` — HMAC verify + QStash enqueue
`/(dashboard)/marketplace/page.tsx` — listing grid, AppCard per listing, "Buy Guide" CTA
PostDetail: Transact CTA card if listing exists for that post

### 4.5 — Tega Events
`app/lib/integrations/tega.ts`, `/api/integrations/tega/route.ts`
`/api/webhooks/tega/route.ts` — HMAC verify + QStash enqueue
Feed right sidebar: "Events near you" Tega widget
PostDetail: embedded event card if post has linked Tega event

### 4.6 — Analytics Dashboard (User)
`/(dashboard)/analytics/page.tsx` — Bento grid per `DESIGN.md §7.12`
`@ant-design/charts`: line chart (engagement), bar chart (top posts), follower growth, tag donut
Data from `/api/analytics/user`

### 4.7 — Phase 4 Quality Gate
```bash
npm run build && npx tsc --noEmit && npm test -- --passWithNoTests && npx next lint
```
Commit: `feat(phase-4): rewards, invites, marketplace, tega, analytics`.

---

## PHASE 5 — ADMIN & MODERATION
**Objective:** Complete admin dashboard, user moderation, content management.

### 5.1 — Admin Layout + Guard
`/(admin)/layout.tsx` — role check (`user.role !== 'admin'` → redirect), full nav with admin section from `NAV_REGISTRY`

### 5.2 — Admin Dashboard
`/(admin)/page.tsx` — 4-stat Bento (users, posts today, avg validity, open bug reports) + signups chart + top routes

### 5.3 — Users Management
`/(admin)/users/page.tsx` — `AppTable` with `rowHref` to `/admin/users/[id]`
Sortable by: join date, post count, validity avg, reward tier
Actions: role change dropdown, ban/unban with `ModalService.confirm(destructive)`
Bulk select + bulk action

### 5.4 — Posts Moderation
`/(admin)/posts/page.tsx` — filter by validity range + status
Actions: archive, feature, delete (with confirmation)
TrustBadge in each row

### 5.5 — Site Config Editor
`/(admin)/config/page.tsx` — `AppTable` of all `SiteConfig` rows
Inline edit: click value cell → textarea + save/cancel
Keys: feedAlgorithm weights, validity thresholds, drafting coach checkpoints, reward config, rate limits

### 5.6 — Bug Reports
`/(public)/report-bug/page.tsx` — `ConfigDrivenForm` with `BUG_REPORT_FIELDS`, Cloudinary attachment
`/(admin)/bugs/page.tsx` — `AppTable` with `AppStatusDot`, status update dropdown, detail drawer

### 5.7 — Reviews System
`/(admin)/reviews/page.tsx` — approve, feature, reject. Featured reviews appear on About page.
`/api/reviews/route.ts` — POST (user submit) + GET (admin list)

### 5.8 — Phase 5 Quality Gate
```bash
npm run build && npx tsc --noEmit && npx next lint
```
Commit: `feat(phase-5): admin, moderation, config, bug reports`.

---

## PHASE 6 — PUBLIC PAGES & SEO
**Objective:** Landing, About, Contact, Privacy, Terms — fully polished, production SEO.

### 6.1 — Landing Page
`/(public)/page.tsx` — full design per `DESIGN.md §7.1`
Green gradient hero, logo, tagline, CTA row, feature grid
`buildMetadata` with OG image
JSON-LD `WebSite` schema

### 6.2 — About Page
`/(public)/about/page.tsx` — hero, team grid (from `getSiteConfig('teamMembers', TEAM_MEMBERS)`), reviews carousel (featured=true), feature highlights
`AppCard elevated` per team member, glass-morphism review cards

### 6.3 — Contact Page
`/(public)/contact/page.tsx` — `ConfigDrivenForm` with `CONTACT_FIELDS`, success → `AppEmptyState` with checkmark

### 6.4 — Privacy & Terms
`/(public)/privacy/page.tsx` + `/(public)/terms/page.tsx` — `react-markdown` rendered, clean typography
Linked from CookieConsent banner ("Privacy Policy" link)

### 6.5 — AppFooter (All Layouts)
`components/ui/AppFooter.tsx` — config-driven, devCredit link to `https://sotonye-dagogo.is-a.dev`
Add to: public layout, dashboard layout

### 6.6 — Phase 6 Quality Gate
```bash
npm run build && npx tsc --noEmit && npx next lint
```
Commit: `feat(phase-6): public pages, seo, footer`.

---

## PHASE 7 — SCALE, POLISH & HARDENING
**Objective:** Background workers, N+1 elimination, RxJS feed, full test suite, PWA, i18n foundation.

### 7.1 — QStash Workers
`/api/workers/[provider]/route.ts` — process QStash jobs for: feed cache invalidation, validity recompute, rewards award, Cloudinary cleanup, push notifications

### 7.2 — N+1 Elimination
Audit every list-rendering API route. Replace per-row queries with bulk batch queries.
Feed enrichment: one query each for likes, bookmarks, following flags across all post IDs in one response.

### 7.3 — RxJS Reactive Feed
`app/lib/streams/feedStream.ts` — `feedPoller$` Observable, `interactionCache$` BehaviorSubject
Replace polling intervals with reactive streams for new-posts detection and interaction state

### 7.4 — PWA
`manifest.json` — correct `name`, `short_name`, icons pointing to `public/icon-192.png` + `public/icon-512.png`, `theme_color: '#00623B'`
Workbox service worker via `workbox-webpack-plugin`: cache shell, static assets, API responses (stale-while-revalidate)
Offline indicator (`AppAlert` with `WifiOff` icon), offline queue flush on reconnect
Lighthouse PWA score ≥ 90

### 7.5 — Test Suite
Unit tests: `ValidityEngine`, `DraftingCoachService`, `filterNavItems`, `buildAvatarUrl`, `buildMetadata`, `suggestionsService.computeScore`, `rewardsService.computeTier`
Integration tests: `POST /api/posts`, `POST /api/posts/[id]/like`, `GET /api/posts/feed`
Component tests: `AppEmptyState`, `AppUserLabel`, `TrustBadge`, `PostCard`

### 7.6 — SEO Audit
Every page: unique `<title>`, OG tags, Twitter card. Dynamic pages: `generateMetadata`.
Public posts: JSON-LD `Article`. Profiles: `ProfilePage`. Landing: `WebSite`.
Sitemap accessible at `/sitemap.xml`. Robots correct at `/robots.txt`.
Canonical URLs on all pages.

### 7.7 — i18n Foundation
`react-intl` setup. English + Nigerian Pidgin English as Day 1 locales.
Extract all user-visible strings into `messages/en.json` and `messages/pcm.json`.
Language toggle in user settings.

### 7.8 — Final Quality Gate
```bash
npm run build && npx tsc --noEmit && npm test && npx next lint
```
Zero errors. Zero `any` in new files. Zero console.error in full user flow.
Lighthouse: Performance ≥ 85, Accessibility ≥ 90, SEO ≥ 90, PWA ≥ 90.
Commit: `feat(phase-7): workers, n+1, rxjs, pwa, tests, i18n, final-polish`.

---

## DEPENDENCY CHECKLIST

```json
{
  "next": "15.3.x",
  "react": "19.1.x",
  "react-dom": "19.1.x",
  "typescript": "5.7.x",
  "tailwindcss": "4.1.x",
  "antd": "5.23.x",
  "@ant-design/icons": "5.6.x",
  "@ant-design/charts": "latest",
  "lucide-react": "0.469.x",
  "prisma": "7.1.x",
  "@prisma/client": "7.1.x",
  "@upstash/redis": "latest",
  "@upstash/qstash": "2.7.x",
  "maplibre-gl": "4.7.x",
  "react-map-gl": "7.1.x",
  "@mapbox/polyline": "latest",
  "supercluster": "latest",
  "zod": "4.x",
  "jsonwebtoken": "latest",
  "bcrypt": "latest",
  "js-cookie": "latest",
  "next-cloudinary": "6.16.x",
  "rxjs": "7.8.x",
  "qrcode.react": "latest",
  "react-markdown": "latest",
  "remark": "latest",
  "workbox-webpack-plugin": "7.3.x",
  "@testing-library/react": "16.3.x",
  "jest": "30.x"
}
```

---

## ENVIRONMENT VARIABLES

```env
# Core
DATABASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
JWT_SECRET=
JWT_REFRESH_SECRET=
NEXT_PUBLIC_APP_URL=https://along.app

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Maps (needed from Phase 3)
GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_MAPLIBRE_STYLE_URL=
OPEN_ROUTE_SERVICE_KEY=

# Ecosystem (needed from Phase 4)
TRANSACT_API_KEY=
TRANSACT_WEBHOOK_SECRET=
TEGA_API_KEY=
TEGA_WEBHOOK_SECRET=
QSTASH_TOKEN=

# App
NEXT_PUBLIC_API_URL=/api
```
