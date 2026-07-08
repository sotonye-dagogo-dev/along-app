# Dependency Graph

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: auto-regenerable — can be derived from import analysis tools. Manual content only for conventions and rules that cannot be inferred from code.

> **Overview:** Maps how modules depend on each other in the Along application. Agents use this to understand the impact of changes before modifying a module. This file is **auto-regenerable** — prefer tool-based import analysis for ground truth, and treat manual entries as supplementary.

---

## Module Dependency Map

```
Next.js App Router (pages/layouts)
    → Context Providers (Auth, OnlineStatus, Push, Theme, Antd, GlobalModal, Toast, CookieConsent)
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
    → App-level Hooks (app/hooks/useAuth, useFeedInteractions)
    → Server Utilities (app/lib/utils/metadata, structuredData, blog)

API Routes (app/api/*)
    → Zod Schemas (app/lib/schemas/*)
    → Services (business logic)
        → RateLimiter → Redis
        → CacheLayer → Redis
        → Services → BaseRepository → Prisma
            → BaseRepository<T>
                → Prisma Client
                → CacheLayer (optional read-through)

Push API Routes (app/api/push/*)
    → pushSubscriptionService → Prisma (PushSubscription model)
    → web-push (send notification)
    → Auth utility (getUserFromRequest)

QStash Workers (app/api/workers/*)
    → qstashService → QStash SDK
    → Signature verification via Receiver
    → Prisma (feed invalidation, rewards, validity)

Service Layer (app/lib/services/*)
    → BaseRepository<T>
    → Config Registries (app/lib/config/*)
    → External SDKs (Cloudinary, Resend, web-push, QStash)
    → pushSubscriptionService → Prisma PushSubscription
    → qstashService → QStash Client/Receiver
    → offlineQueue → localStorage (client-side)
    → undoService, toastService, modalService → (App-level)

Config Registries (app/lib/config/*)
    → (no app dependencies — pure config objects)

Client Utilities (app/lib/utils/*)
    → pushClient → navigator.serviceWorker, fetch (/api/push/*)
    → sendPushNotification → fetch (QStash URL)
    → siteConfig → Prisma, Redis (cached config lookups)
    → blog → fs (MDX file reading at build time)

PWA (public/sw.js)
    → (standalone service worker — no app imports)
    → Cache strategies: static assets, API responses, pages
```

### Detailed Service Dependencies

```
AuthService
    → UserModel (Prisma)
    → JWTUtils (jsonwebtoken)
    → Redis (session store, rate limit)
    → Config: auth config

FeedService
    → PostModel, UserModel, LikeModel, BookmarkModel (Prisma)
    → Redis (feed caching)
    → Config: feedAlgorithm, cache

SearchService
    → PostModel, UserModel (Prisma full-text search)
    → Redis (search cache)
    → Config: cache

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

RouteTracingService
    → PostModel (Prisma)
    → MapLibre GL utils (polyline)
    → Config: mapIntegrations

NotificationService
    → NotificationModel, PushSubscriptionModel (Prisma)
    → sendPushNotification (utility)
    → QStash (background delivery)
    → Config: notifications, rateLimits

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
| maplibre-gl / react-map-gl | Map rendering | Explore page, route visualization |
| @mapbox/polyline | Route polyline encoding | RouteTracingService, maps |
| supercluster | Map marker clustering | Explore map |
| @prisma/client | Database ORM | All services, BaseRepository |
| @prisma/adapter-pg | Postgres adapter | Prisma client initialization |
| @upstash/redis | Caching, rate limiting, sessions | CacheLayer, AuthService, RateLimiter |
| @upstash/qstash | Background job queue | NotificationService (push) |
| jsonwebtoken / bcrypt | Auth (JWT signing, password hashing) | AuthService |
| zod | Input validation | All API routes |
| cloudinary / next-cloudinary | Image upload and optimization | Avatar upload, post media |
| resend | Transactional emails | AuthService (verification), notifications |
| @sentry/nextjs | Error tracking | instrumentation, API routes, components |
| web-push | Push notification sending | NotificationService |
| lucide-react | UI icons | All UI components |
| axios | HTTP client | Client-side API calls |
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
