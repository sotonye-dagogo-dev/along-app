# Dependency Graph

> **Metadata**
> - last-updated-by: execute-feature 2026-10-11 (Sprint 44 deleted-account view-only gating + Active filter + AppTableRowActions dropdown)
> - last-verified-against-code: 2026-10-11 (static review + diff review; tsc/jest/build deferred to CI — no node_modules in runner)
> - staleness-policy: auto-regenerable — can be derived from import analysis tools. Manual content only for conventions and rules that cannot be inferred from code.

> **Overview:** Maps how modules depend on each other in the Along application. Agents use this to understand the impact of changes before modifying a module. This file is **auto-regenerable** — prefer tool-based import analysis for ground truth, and treat manual entries as supplementary.

---

## Module Dependency Map

```
Next.js App Router (pages/layouts)
    → Context Providers (Auth, OnlineStatus, Push, Theme, Antd, GlobalModal, Toast, CookieConsent, I18n)
        → I18nContext → bundled EN import + localStorage last-good + fetch (/locales/*.json, SW-precached v4) + along-locale cookie (middleware SSR agreement) [Sprint 25]
        → AuthContext → AuthService → Prisma / JWT / Redis
        → OnlineStatusContext → offlineQueue (flush on reconnect)
        → PushContext → pushClient → navigator.serviceWorker
        → ThemeContext → (no app deps)
        → AntdContext → Ant Design theme config
        → GlobalModal → AppModal
        → ToastContext → (App-level)
        → CookieConsent → (no app deps)

Page Components (app/(auth|dashboard|admin|public|admin)/)
    → UI Components (app/components/ui/App*)
    → Feature Components (app/components/features/*)
        → posts/RequestRouteModal (route-request composer, response-mode ShareRouteModal)
        → suggestions/EndlessCarousel (scroll-based autoplay, own overflow wrapper, ENDLESS_CAROUSEL_CONFIG) + SuggestionsRail (mobile, xl:hidden, feed-owned) + FollowButton + About reviews tape (same wrapper, real /api/reviews + ReviewCtaPanel cadence [Sprint 25])
        → reviews/ReviewsPanel (star form + guest gate + FAQ + list; own profile reviews tab + #reviews deep link; other-profile read-only authorId scope [Sprint 25])
        → (public)/LandingCopy (landing i18n islands: hero/features/CTA/feed-preview [Sprint 25])
        → ui/SuggestionsPanel (live /api/suggestions: who-to-follow, open requests, trending tags)
    → App-level Hooks (app/hooks/useAuth, useFeedInteractions)
    → Client Cache (app/lib/cache/memoryCache + app/lib/hooks/useCachedFetch)
    → User Location (app/lib/hooks/useUserLocation → explore + post-detail maps [Sprint 23])
    → Server Utilities (app/lib/utils/metadata, structuredData, blog)

API Routes (app/api/*)
    → Zod Schemas (app/lib/schemas/*)
    → Services (business logic)
        → RateLimiter → Redis / In-Memory Map
        → CacheLayer → Redis
        → Services → BaseRepository → Prisma
            → BaseRepository<T>
                → Prisma Client
                → CacheLayer (optional read-through)

Integration API Routes (app/api/integrations/*)
    → External services (Transact, Tega)
    → Auth middleware (getUserFromRequest)

Integration Webhooks (app/api/webhooks/*)
    → HMAC signature verification
    → QStash (background processing)

Follower API Routes (app/api/users/[id]/follow*, app/api/users/[id]/followers, app/api/users/[id]/following)
    → Prisma (Follow model)
    → Auth utility (getUserFromRequest)
    → Notification (on follow)

Profile Pages (app/(dashboard)/profile/*)
    → Follower API Routes
    → UserList component (app/components/features/profile/UserList.tsx)
    → EarlyAdopterBadge / EarlyAdopterBadgeFromStatus (app/components/features/profile/EarlyAdopterBadge.tsx — renders only when API `earlyAdopter` payload qualifies)
    → User badge APIs: /api/users/[id] + /api/users/by-username/[username] (embed `earlyAdopter`), /api/users/[id]/early-adopter (per-user), /api/users/early-adopters (list for filtering/rewards tooling)
    → AppAvatar, AppEmptyState

Push API Routes (app/api/push/*)
    → pushSubscriptionService → Prisma (PushSubscription model)
    → web-push (send notification)
    → Auth utility (getUserFromRequest)

QStash Workers (app/api/workers/*)
    → qstashService → QStash SDK
    → Signature verification via Receiver
    → Prisma (feed invalidation, rewards, validity)

Suggestions API Route (app/api/suggestions/*)
    → Prisma (Post ROUTE_REQUEST/ROUTE + Follow)
    → Redis (suggestions cache, 1800s TTL)
    → Auth utility (getUserFromRequest)

Bookmarks API Route (app/api/bookmarks/*)
    → Prisma (Bookmark model, per-tab post/liked/bookmarks/routes filtering)
    → Auth utility (getUserFromRequest)

Client Cache Layer (app/lib/cache/memoryCache + app/lib/hooks/useCachedFetch)
    → TTL Map with prefix invalidation, never-throw (mirrors redis.ts semantics)
    → read-through + stale-while-revalidate + in-flight request dedup
    → Consumers: home feed (hydrates feedStream, pauses poll when tab hidden), notifications, analytics, post detail, profile, explore

Service Layer (app/lib/services/*)
    → BaseRepository<T>
    → Config Registries (app/lib/config/*)
    → External SDKs (Cloudinary, Resend, web-push, QStash)
    → pushSubscriptionService → Prisma PushSubscription
    → qstashService → QStash Client/Receiver
    → offlineQueue → localStorage (client-side)
    → undoService, toastService (TOAST_CONFIG durations), modalService → (App-level)
    → GlobalToastProvider (single-timer owner: GlobalUndoToast auto-close + progress bar share one duration, remount per toast) → GlobalUndoToast
    → PostCard + post detail (`POST_ACTIONS_CONFIG`, `MODERATION_CONFIG`) → PostMenu/ReportDialog → PATCH/DELETE/archive + POST /api/reports (transactional dedup, reporter receipt + admin triage notifications); PostMenu management actions owner-only — admins moderate via /admin/posts (PUT edit + PATCH archive + DELETE, all `logAudit`-audited) and read the trail on /admin/audit (`AUDIT_DISPLAY_CONFIG` + AppTable/AppTag) [Sprint 37]
    → Platform reviews: POST /api/reviews (self-pair upsert, PENDING) → `notifyReviewThanks` (REWARD+allowSelf) → Prisma Notification + push mirror (REVIEW entry); GET /api/reviews (APPROVED + own PENDING, authorId scope, SW-cached) → About tape + ReviewsPanel + profile tabs [Sprint 25]
    → Notification fan-out: posts route (ROUTE_REQUEST/NEW_ROUTE/ROUTE_RESPONSE) + like route (LIKE/DISLIKE) + comments routes (COMMENT/MENTION) → `notificationService.createNotification` (+ `mentionService` extract/diff/resolve) → Prisma Notification + Redis invalidation
    → Referrals (auth-agnostic): register page + login/register Google buttons (`?ref=` → `state=ref:`) → register route + google callback → `referralService` (unlimited linking, send-credit cap via INVITE_CONFIG) → QStash rewards worker
    → Early adopters: `earlyAdopterConfig` SiteConfig row (seeded, admin-editable via /api/admin/config with validation + Redis invalidation) → `earlyAdopterService` (createdAt-asc rank, Redis-cached; `listEarlyAdopters`) → profile badge + admin `?earlyAdopter=true` user filter
    → Error boundaries: `global-error`/`error` → `errorReportService` (sanitized capture + prefill builder + bug-report URL, never throws) → POST /api/bug-reports (category OTHER, `ERROR_REPORTING_CONFIG`) → BugReport rows for admin triage; boundaries also toast the CTA (toastService action slot) + inline prefilled link → `/report-bug` (?title=&description= → initialValues) [Sprint 40]
    → Admin access: `isAdminRole()` (navigation config, case-insensitive) → DashboardNav admin section + AdminShell guard + profile Quick Links

Config Registries (app/lib/config/*)
    → (no app dependencies — pure config objects)
    → 57 files (incl. index.ts) incl. leaderboardLinks.ts (Sprint 34 canonical /leaderboard: footer + profileQuickLinks + invite CTA) + profileQuickLinks.ts (Sprint 34 accountTab/scroll/route quick-links → own-profile page) + authLink.ts (Sprint 34 connected-state copy/resolver → AuthLinkPanel + EmailSecurityPanel) + locationFeedback.ts (Sprint 34 denied/timeout/unavailable/tracking copy + code helper → geo.ts, explore Near-me, NavigationGuide) + mediaCleanup.ts (Sprint 33 allowlist/toggles/account-retention/dry-run → mediaCleanupService + upload/cleanup + all delete paths) + routeValidation.ts (fix-build 2026-10-09 composer/fare/sanitize validators → ShareRouteModal, schemas/post, posts POST/PATCH, home/post-detail submits; Sprint 36 destination-skip) + audit.ts (Sprint 37 audit-trail display labels/variants/sanitizers → /admin/audit page) + authVerification.ts (Sprint 27 OTP TTL/cooldown/attempts/keys/copy/maskEmail → otpStore sidecar keys + otp/resend/verify-email/register + useOtpResend + OTP screen/EmailSecurityPanel; fix-build 2026-10-09: durable EmailOtpToken mirror via emailOtpStore.ts + public (public)/verify-email page; Sprint 41: REGISTER_EMAIL_DISPATCH_CONFIG patient budgets 15s/10s + clearCooldownOnFailure + resendUseVerifyTemplate → register/resend/verify-email routes + clearSendCooldown in otpStore + per-send timeoutMs in emailService) + pushPrompt.ts (Sprint 27 storage keys/dismiss TTL/outcome copy/iOS-detect → PushManager/PushProvider/pushClient) + reviews.ts (Sprint 25 REVIEWS_CONFIG + insertReviewCtaPanels + reviewAuthorName; SITE_REVIEWS retained) + pwa.ts (Sprint 25 v4: locales precache, /api/{config,reviews} cacheable, banner copy, REVIEW mirror) + faq.ts (Sprint 25 FAQ_PCM) + footer.ts (Sprint 25 optional i18nKey) + rateLimits.ts (Sprint 25 reviews bucket) + routeSteps.ts (Sprint 23 destination rule + normalize: composer, PostCard, NavigationGuide, post detail, posts POST/PATCH) + mapPins.ts (Sprint 20 anchor-stable pins/user-dot/labels; Sprint 23 endpoint-snap + tracking timeouts) + mapStack.ts (Sprint 19 keyless tiles/routing/geocode/TTLs/attributions/style-stack builders/env gates; Sprint 20 dark light-parity) + routePins.ts (Sprint 28 canonical origin+intermediates+destination builder + trace input + ROUTE_PINS_CONFIG: PostCard, post detail) + navigation LIVE_NAVIGATION_CONFIG (Sprint 28 live-nav overlay copy/panel width → LiveNavigationModal), earlyAdopter.ts (Sprint 16 badge: key/defaults/limits/label+tooltip builders/validation/admin meta), reviews.ts (SITE_REVIEWS for About page), carousel/shareRoute/routeRequest (Sprint 9 UX tightening), routeDrafts (Sprint 10 drafts library + Sprint 20 update-in-place labels/prompt), toast/postActions (Sprint 11 toast timing + post actions), postSubmit (Sprint 12 idempotency), moderation (Sprint 13 report lifecycle + request display rules + Sprint 14 `immutablePostFields`), notifications (Sprint 14 DISLIKE/NEW_ROUTE), inviteConfig (Sprint 14 points-cap policy docs), navigation `isAdminRole` + errorReporting.ts (Sprint 17: report category/endpoint/caps/copy/sanitize patterns), footer layout slot

Client Utilities (app/lib/utils/*)
    → pushClient → Notification permission (in-gesture) + navigator.serviceWorker + PushManager API, fetch (/api/push/*) [Sprint 27: getPushSupport/ensurePushPermission/subscribeToPushDetailed, boolean wrapper kept]
    → useOtpResend → fetch (otp/resend, verify-email trigger) + AUTH_VERIFICATION_CONFIG timers [Sprint 27]
    → sendPushNotification → fetch (QStash URL)
    → siteConfig → Prisma, Redis (cached config lookups)
    → blog → fs (MDX file reading at build time)
    → geo → fetch (/api/maps/reverse; Sprint 19 — no browser-direct upstream calls)

PWA (public/sw.js)
    → (standalone service worker — no app imports; mirrors app/lib/config/pwa.ts — bump both)
    → Cache strategies: static assets, API responses, pages, /locales/ dictionaries (cache-first [Sprint 25]), SWR map tiles
```

### Detailed Service Dependencies

```
AuthService
    → UserModel (Prisma)
    → JWTUtils (jsonwebtoken, jose for edge middleware)
    → Redis (session store)
    → In-Memory Map (rate limit — app/lib/utils/rateLimit.ts)
    → Config: auth config

FeedService
    → PostModel, UserModel, LikeModel, BookmarkModel (Prisma)
    → Redis (feed caching)
    → Config: feedAlgorithm, cache

SearchService (`app/lib/services/searchService.ts`, live 2026-10-08 — powers `GET /api/search`)
    → PostModel, UserModel (Prisma `contains`/`insensitive`, no migration; P2022 avatarConfig fallback)
    → Redis (unified search cache, 120s TTL, never-throw; empty first-pages return by reference, non-empty re-enriched with live trust [Sprint 39])
    → Config: cache (CACHE_KEYS.search, CACHE_TTL.searchResults), rateLimits (search bucket)
    → Consumed by: explore `ExploreSearchInput` suggestions + `/search` page (Sprint 39 additive; map client filter untouched)

PostCommentsModal (`app/components/features/comments/PostCommentsModal.tsx`, new Sprint 39 — shared feed/profile/search/detail comment modal)
    → CommentInput + CommentList (AppAvatar, config caret) + AppModal + POST_ACTIONS_CONFIG + COMMENTS_CONFIG
    → Config: comments (COMMENTS_CONFIG title/expand/loading copy)

SuggestionsService
    → UserModel, FollowModel (Prisma)
    → Redis (suggestions cache)
    → Config: feedAlgorithm

ValidityEngine
    → PostModel, UserActivityModel, FollowModel, BugReportModel, UserModel (Prisma)
    → Redis (trust scores)
    → Config: validityConfig (+ VALIDITY_SIGNAL_BOUNDS, + CORROBORATION_CONFIG [Sprint 38], + DETAIL_SCORING_CONFIG richness bonuses [Sprint 40])
    → Pure corroboration scorers [Sprint 38]: normalizeCorroborationToken, tagSimilarityScore, geoCorridorScore, routeContentScore (destination-excluded), pairSimilarityScore, endorsementScore, computeCorroborationScore (computeSimilarityRatio kept for compat/fallback)
    → Pure detail scorers [Sprint 40]: computePostDetailScore (legacy base + capped bonuses; no-context parity) + detailContextFromPost (destination-excluded vehicle/fare; computeRouteDetailScore untouched)
    → Triggered by: posts POST (sync, same helper as reads [Sprint 38]), workers/validity-recompute, like/bookmark/comments/[id]/reports/follow routes (fire-and-forget)
    → Consumed by: trustBreakdownService (canonical live breakdowns), TrustBadge (breakdown prop), PostCard, posts/[id] page + GET (validityBreakdown)

TrustBreakdownService (`app/lib/services/trustBreakdownService.ts` — single + batched live breakdowns, same engine/inputs on every surface)
    → ValidityEngine (evaluate + canonical scorers), PostModel/FollowModel/BugReportModel/UserModel (Prisma, best-effort)
    → Config: trustDisplay (compact/full keys, tier derivation, + TRUST_BREAKDOWN_DESCRIPTIONS tooltip help [Sprint 38]), CORROBORATION_CONFIG (30d window, 0.55/0.25/0.20 blend [Sprint 38])
    → Consumed by: GET /api/posts (list), GET /api/posts/feed (via feedService + guest path), searchService, GET /api/suggestions, GET /api/bookmarks, GET /api/posts/[id], workers/validity-recompute, POST /api/posts (create-time score [Sprint 38; + richness context Sprint 40])

PostShareService + usePostShare
    → Config: postActions (shareLabel/shareTitleDefault/postPath + like/dislike active + icon classes [Sprint 42])
    → Services: toastService (hook only; service is dep-free)
    → Consumed by: PostCard (fallback), ProfilePostCard, home/page, search/SearchPage, posts/[id]/page, bookmarks/page

MediaCleanupService (`app/lib/services/mediaCleanupService.ts` — ACID-safe post-commit Cloudinary orphan purge, never throws) + cloudinaryUrls (pure host/extract/allowlist/diff, client+server safe)
    → Config: mediaCleanup (enabled, allowedFolderPrefixes along/*, per-flow toggles, account-retain policy, dry-run)
    → SDK: cloudinary (server-only; draft discards go through POST /api/upload/cleanup instead)
    → Consumed by: DELETE /api/posts/[id] (post-delete), PATCH /api/posts/[id] (removed-images diff), DELETE /api/admin/posts (bulk snapshots), PATCH /api/admin/bugs REMOVE_POST (pre-tx capture), accountDeletionService.finalizeOne (legacy avatar only — post images retained by policy), POST /api/upload/cleanup (draft-discard with live-post reference guard), routeDraftsService.deleteDraft (fire-and-forget, publish path skips)

DraftingCoachService
    → Config: draftingCoach (rule-based, no DB)

RewardsService
    → UserModel, UserActivityModel (Prisma)
    → Config: rewards

EarlyAdopterService (`app/lib/services/earlyAdopterService.ts` — badge rank/status/list, no migration)
    → UserModel (Prisma: createdAt-asc count + ordered take), SiteConfig via siteConfig util
    → Redis (per-user rank cache 600s, best-effort; config via siteConfig read-through)
    → Config: earlyAdopter (key/defaults/normalize/label builders)

RouteTracingService
    → mapProxyService.traceRoute (thin validating delegate — no direct upstream calls)
    → Config: mapStack (env-gate helpers only)

MapProxyService (`app/lib/services/mapProxyService.ts` — Sprint 19 keyless stack, owns ALL upstream map calls)
    → OSRM demo (keyless, GeoJSON → polyline5) → env-gated ORS → env-gated Mapbox → straight-line guarantee (never throws)
    → Nominatim server-side (identity UA/Referer) → Photon fallback (forward + reverse)
    → Redis (route/geocode/reverse read-through caches; never-throw wrapper)
    → Config: mapStack (orders, upstreams, identity, TTLs), cache (CACHE_TTL maps*), rateLimits (maps bucket via API routes)

Map API Routes (`app/api/maps/route|geocode|reverse`)
    → mapProxyService (traceRoute / geocodeForward / geocodeReverse)
    → checkRateLimit(request, "maps") → sanitized JSON errors (never leak upstream details)
    → Consumers (client-only, same-origin): RouteStepInput + ShareRouteModal (debounced, abortable) + geo.ts reverseGeocode

Map Renderers (RouteMap.tsx, explore/page.tsx)
    → Config: mapStack (`getMapStyleStack` vector-primary + raster step-down, onError walk, theme reset; dark light-parity — filter `"none"`, dark raster mirrors light) + mapPins (`MAP_PINS_CONFIG` center anchor/zero offset, `routePinLabel` 1-based, `snapEndpointsToPolyline`, `tracking` timeouts [Sprint 23]) + routePins (`buildRoutePinsFromPost` origin+intermediates+destination, `buildTraceInputFromPins`, `ROUTE_PINS_CONFIG` [Sprint 28])
    → Shared visuals: MapPins.tsx (`MapRoutePin` numbered dot, `MapUserDot` info-blue + glory ring + radar) — token classes only, no hardcoded hex
    → Shared location: `useUserLocation` hook (passive fix + watch; explore override + post-detail fallback [Sprint 23])
    → Shared trace: `useRouteTrace` hook (estimate + debounced `/api/routes/trace` + memory cache + silent fallback [Sprint 28] — composer preview + post detail)
    → Live overlay: `LiveNavigationModal` (map + NavigationGuide together, `LIVE_NAVIGATION_CONFIG` [Sprint 28] — post detail)
    → MapLibre GL vector tiles (keyless) — zero `NEXT_PUBLIC_*` map keys read (+ `maplibre-gl.css` import required by every renderer [Sprint 23])

NotificationService
    → NotificationModel, PushSubscriptionModel (Prisma)
    → Fan-out: ROUTE_REQUEST → followers; ROUTE_RESPONSE → requester (non-blocking)
    → WELCOME notification on signup (non-blocking)
    → sendPushNotification (utility)
    → QStash (background delivery)
    → Config: notifications, rateLimits

EmailService
    → Resend (transactional: otp, welcome incl. Google OAuth, password reset, verify/change-email/change-password, contact/bug, deletion lifecycle)
    → Shared wrapper (logo/header/CTA/footer) + escaped interpolation (missing→"") + toggle-pauses-send + EmailLog audit
    → Awaited with bounded timeouts + honest sent flag on gate-critical paths (register 6s/mail via REGISTER_EMAIL_DISPATCH_CONFIG, forgot-password 6s, resend/verify-email trigger awaited, google welcome 5s); only non-critical notices via Next after()

OtpStore / ResetTokenStore
    → Redis via shared wrapper (1.5s timeout, in-memory Map fallback)
    → PasswordResetToken (Prisma, durable DB tokens — survives Redis loss; fixed Sept 29 "link expired" bug)

AccountDeletionService (`app/lib/services/accountDeletionService.ts` — request → 7-day grace → finalize; ACID tx, anonymize-in-place, best-effort side-effects)
    → Config: accountDeletion (grace/retention/backup windows, anon identity) + admin (`ADMIN_USER_DELETION_META` copy/guards [Sprint 43]) + charts.ts (tooltip behaviour/series colours/format helpers + `ADMIN_ANALYTICS_CONFIG` KPIs/sections/buckets → ChartTooltip host + admin/user analytics charts + /admin/analytics [Sprint 45])
    → Prisma: AccountDeletionRequest + User/Post/Like/Bookmark/Follow/PushSubscription (tx) + counters recompute + EmailOtpStore mirror
    → Exports: requestAccountDeletion / cancelAccountDeletion / finalizeDueDeletions / finalizeSingleRequest (force-gated) / cancelDeletionRequestById / deleteUserNow (request-if-needed + force-finalize) [Sprint 43]
    → Consumed by: profile AccountDeletionPanel, POST /api/account/deletion/*, POST /api/admin/deletions/finalize (`request`/`cancel`/`finalizeOne`/`deleteNow`/`finalizeDue`, all audited [Sprint 43]), cron finalize worker
    → Admin UI: `app/admin/deletions/` (queue + per-row Reverse/Delete-now) + `app/admin/users/` (per-user Request/Reverse/Delete-now + bulk request) → confirm modal (modalService) + undo toast (undoService) only where reversible [Sprint 43]; `app/admin/analytics/` + `GET /api/admin/analytics` (period KPIs/deltas/series/buckets/roles/tiers/top lists, `ADMIN_ANALYTICS_CONFIG`-driven, chart tooltips via shared ChartTooltip host) + overview/user-analytics tooltip wiring [Sprint 45]
    → Row-action UX [Sprint 44]: `AppTableRowActions` (`app/components/ui/AppTableRowActions.tsx`, metadata-driven, className-preserving) over `AppDropdown` (className/disabled/title passthrough) — consumed by users/posts/deletions tables; gating via `ADMIN_USER_FILTERS` + `allowedUserRowActions`/`canShowUserRowAction` (`app/lib/config/admin.ts`), enforced in `GET/PATCH /api/admin/users` (active filter + deleted skip with `skippedDeleted` counts)

AdminUsers list (`app/api/admin/users` — GET filters + PATCH verify/resend/role [Sprint 44])
    → Config: admin (`ADMIN_USER_FILTERS` All/Active/Pending/Deleted + `parseAdminUserFilter`/`deletionQueryForFilter`; `ADMIN_USER_ROW_ACTIONS` + `isDeletedAdminUser`/`allowedUserRowActions`/`canShowUserRowAction` view-only rule)
    → Prisma: `isDeleted`/`deletionScheduledFor` where clauses (active = `isDeleted:false AND deletionScheduledFor:null`, AND-combined with search)
    → Consumed by: `app/admin/users/page.tsx` (config-driven tablist with counts, `AppTableRowActions` per row, bulk live/deleted partition)

AdminStats (`app/api/admin/stats` — period-aware overview [Sprint 43])
    → Config: admin (`ADMIN_DASHBOARD_PERIODS` + `parseAdminDashboardPeriod` 7/30/90 clamp)
    → Prisma (batched): user/post/bug counts + validity aggregates + windowed signup series
    → Consumed by: `app/admin/page.tsx` (period `<select>` drives fetch + cards + signups chart + labels)

PushSubscriptionService
    → PushSubscriptionModel (Prisma)
    → upsert/find/delete subscriptions

QStashService
    → QStash Client (publishing jobs)
    → QStash Receiver (signature verification)
    → Endpoints: feed-invalidate, validity-recompute, rewards

OfflineQueue
    → localStorage (persist queue)
    → fetch (flush on reconnect)

siteConfig Utility
    → Prisma (SiteConfig model)
    → Redis (cached config lookups)
    → Config: cache (CACHE_TTL, CACHE_KEYS)
```

---

## External Dependencies

| Package | Purpose | Used In |
|---------|---------|---------|
| next | Framework (App Router) | All pages, API routes |
| react / react-dom | UI library | All components |
| antd / @ant-design/icons | UI component library | App* wrappers in `app/components/ui/` |
| @ant-design/charts | Analytics charts | Admin dashboard |
| @ant-design/nextjs-registry | Ant Design SSR registry | Root layout |
| maplibre-gl / react-map-gl | Map rendering (keyless OpenFreeMap vector + keyless raster fallbacks since Sprint 19) | Explore page, route visualization |
| @mapbox/polyline | Route polyline encoding | mapProxyService (GeoJSON→polyline5), straight-line fallback |
| supercluster | Map marker clustering | Explore map |
| @prisma/client | Database ORM | All services, BaseRepository |
| @prisma/adapter-pg | Postgres adapter | Prisma client initialization |
| @upstash/redis | Caching, rate limiting, sessions | CacheLayer, AuthService, RateLimiter |
| @upstash/qstash | Background job queue | NotificationService (push) |
| jsonwebtoken / jose / bcrypt | Auth (JWT signing, edge JWT verification, password hashing) | AuthService, middleware.ts |
| zod | Input validation | All API routes |
| cloudinary / next-cloudinary | Image upload and optimization | Avatar upload, post media |
| resend | Transactional emails | AuthService (verification), notifications |
| @sentry/nextjs | Error tracking | instrumentation, API routes, components |
| web-push | Push notification sending | NotificationService |
| lucide-react | UI icons | All UI components |
| axios | HTTP client | Client-side API calls, integrations (transact, tega) |
| js-cookie | Cookie management | AuthProvider (client-side) |
| rxjs | Reactive streams | Feed service, real-time updates |
| react-markdown / remark | Markdown rendering | Post content, about page |
| qrcode.react | QR code generation | Share route functionality |
| pg | PostgreSQL driver | Prisma adapter |
| cors | CORS headers | API routes |
| dotenv | Environment variable loading | Configuration |

---

## Circular Dependency Warnings

> **Section summary:** Any detected circular dependencies that need to be resolved.

None detected — architecture is layered with unidirectional dependencies:
- Pages → Components → Hooks → Services → BaseRepository → Prisma
- Services → Config Registries (no reverse dependency)
- Components → UI Library (no reverse dependency)

---

## Dependency Rules

- Pages may import Components, Hooks, and Services — not the other way around
- Components may import only UI library and Hooks — never Services directly
- Hooks may import Services — never the other way around
- Services may import BaseRepository and Config — never Pages or Components
- BaseRepository may import only Prisma Client and CacheLayer
- Config Registries must have zero application dependencies
- Utility functions must have zero application dependencies
- Never import Ant Design directly from feature components — always use App* wrappers
