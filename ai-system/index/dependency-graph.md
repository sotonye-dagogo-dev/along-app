# Dependency Graph

> **Metadata**
> - last-updated-by: execute-feature 2026-10-09 (Sprint 28 route accuracy + live-navigation overlay)
> - last-verified-against-code: 2026-10-09 (routePins/useRouteTrace/LiveNavigationModal edges verified in code; tsc + jest + build green in-runner)
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
    → PostCard + post detail (`POST_ACTIONS_CONFIG`, `MODERATION_CONFIG`) → PostMenu/ReportDialog → PATCH/DELETE/archive + POST /api/reports (transactional dedup, reporter receipt + admin triage notifications)
    → Platform reviews: POST /api/reviews (self-pair upsert, PENDING) → `notifyReviewThanks` (REWARD+allowSelf) → Prisma Notification + push mirror (REVIEW entry); GET /api/reviews (APPROVED + own PENDING, authorId scope, SW-cached) → About tape + ReviewsPanel + profile tabs [Sprint 25]
    → Notification fan-out: posts route (ROUTE_REQUEST/NEW_ROUTE/ROUTE_RESPONSE) + like route (LIKE/DISLIKE) + comments routes (COMMENT/MENTION) → `notificationService.createNotification` (+ `mentionService` extract/diff/resolve) → Prisma Notification + Redis invalidation
    → Referrals (auth-agnostic): register page + login/register Google buttons (`?ref=` → `state=ref:`) → register route + google callback → `referralService` (unlimited linking, send-credit cap via INVITE_CONFIG) → QStash rewards worker
    → Early adopters: `earlyAdopterConfig` SiteConfig row (seeded, admin-editable via /api/admin/config with validation + Redis invalidation) → `earlyAdopterService` (createdAt-asc rank, Redis-cached; `listEarlyAdopters`) → profile badge + admin `?earlyAdopter=true` user filter
    → Error boundaries: `global-error`/`error` → `errorReportService` (sanitized capture, never throws) → POST /api/bug-reports (category OTHER, `ERROR_REPORTING_CONFIG`) → BugReport rows for admin triage
    → Admin access: `isAdminRole()` (navigation config, case-insensitive) → DashboardNav admin section + AdminShell guard + profile Quick Links

Config Registries (app/lib/config/*)
    → (no app dependencies — pure config objects)
    → 42 files (incl. index.ts) incl. authVerification.ts (Sprint 27 OTP TTL/cooldown/attempts/keys/copy/maskEmail → otpStore sidecar keys + otp/resend/verify-email/register + useOtpResend + OTP screen/EmailSecurityPanel; fix-build 2026-10-09: durable EmailOtpToken mirror via emailOtpStore.ts + public (public)/verify-email page) + pushPrompt.ts (Sprint 27 storage keys/dismiss TTL/outcome copy/iOS-detect → PushManager/PushProvider/pushClient) + reviews.ts (Sprint 25 REVIEWS_CONFIG + insertReviewCtaPanels + reviewAuthorName; SITE_REVIEWS retained) + pwa.ts (Sprint 25 v4: locales precache, /api/{config,reviews} cacheable, banner copy, REVIEW mirror) + faq.ts (Sprint 25 FAQ_PCM) + footer.ts (Sprint 25 optional i18nKey) + rateLimits.ts (Sprint 25 reviews bucket) + routeSteps.ts (Sprint 23 destination rule + normalize: composer, PostCard, NavigationGuide, post detail, posts POST/PATCH) + mapPins.ts (Sprint 20 anchor-stable pins/user-dot/labels; Sprint 23 endpoint-snap + tracking timeouts) + mapStack.ts (Sprint 19 keyless tiles/routing/geocode/TTLs/attributions/style-stack builders/env gates; Sprint 20 dark light-parity) + routePins.ts (Sprint 28 canonical origin+intermediates+destination builder + trace input + ROUTE_PINS_CONFIG: PostCard, post detail) + navigation LIVE_NAVIGATION_CONFIG (Sprint 28 live-nav overlay copy/panel width → LiveNavigationModal), earlyAdopter.ts (Sprint 16 badge: key/defaults/limits/label+tooltip builders/validation/admin meta), reviews.ts (SITE_REVIEWS for About page), carousel/shareRoute/routeRequest (Sprint 9 UX tightening), routeDrafts (Sprint 10 drafts library + Sprint 20 update-in-place labels/prompt), toast/postActions (Sprint 11 toast timing + post actions), postSubmit (Sprint 12 idempotency), moderation (Sprint 13 report lifecycle + request display rules + Sprint 14 `immutablePostFields`), notifications (Sprint 14 DISLIKE/NEW_ROUTE), inviteConfig (Sprint 14 points-cap policy docs), navigation `isAdminRole` + errorReporting.ts (Sprint 17: report category/endpoint/caps/copy/sanitize patterns), footer layout slot

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
    → Redis (unified search cache, 120s TTL, never-throw)
    → Config: cache (CACHE_KEYS.search, CACHE_TTL.searchResults), rateLimits (search bucket)

SuggestionsService
    → UserModel, FollowModel (Prisma)
    → Redis (suggestions cache)
    → Config: feedAlgorithm

ValidityEngine
    → PostModel, UserActivityModel, FollowModel (Prisma)
    → Redis (trust scores)
    → Config: validityConfig

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
    → Non-blocking via waitUntil on hot paths (register, forgot-password, google callback)

OtpStore / ResetTokenStore
    → Redis via shared wrapper (1.5s timeout, in-memory Map fallback)
    → PasswordResetToken (Prisma, durable DB tokens — survives Redis loss; fixed Sept 29 "link expired" bug)

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
