# System Architecture

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: re-verify before trusting if any architecture-affecting commits have been made since last-verified-against-code

> **Overview:** Along is a single Next.js 15 application serving both frontend and API routes. The architecture follows a layered pattern: Next.js App Router (pages + layouts) on top of API routes, which delegate to an OOP service layer using the repository pattern, backed by PostgreSQL via Prisma and Redis for caching. The frontend uses a universal component library (App* wrappers around Ant Design) with context-driven state management. The application is PWA-enabled with offline support and push notifications.

---

## Architecture Diagram

```
Client (Browser / PWA)
         ↓
    Next.js 15 App Router
    ┌──────────────────────────────┐
    │   Pages & Layouts            │
    │  (auth, dashboard, admin,    │
    │   public: faq, blog, etc.)   │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   UI Components              │
    │  (34 App* wrappers ← AntD)   │
    │  (AppLogo, GuestBanner,      │
    │   OfflineIndicator, etc.)    │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   Context Providers          │
    │  (Auth, OnlineStatus, Push,  │
    │   GlobalModal, GlobalToast,  │
    │   CookieConsent)             │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   API Routes (REST)          │
    │  Zod validation, JWT auth    │
    │  /api/push/* (subscriptions) │
    │  /api/workers/* (QStash)     │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   Service Layer              │
    │  11 OOP services including:  │
    │  pushSubscriptionService     │
    │  qstashService               │
    │  offlineQueue (client-side)  │
    │  undoService, toastService   │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   Data Layer                 │
    │  Prisma ORM / Redis          │
    │  (siteConfig read-through)   │
    └──────────┬───────────────────┘
               ↓
    PostgreSQL  /  Upstash Redis  /  External APIs
    (primary)      (cache/queue)   (Cloudinary, Resend, web-push,
                                    MapLibre tiles, QStash workers)
```

---

## Module Breakdown

| Module | Responsibility | Key Files | Dependencies |
|--------|----------------|-----------|--------------|
| Auth | JWT-based authentication, registration, login, OTP | `app/(auth)/`, `app/lib/services/auth*` | Prisma, JWT, bcrypt, Redis |
| Feed | Social feed with posts, comments, likes, bookmarks | `app/(dashboard)/`, `app/lib/services/feed*` | Prisma, Redis (cache) |
| Maps | Route visualization with MapLibre GL, clustering | `app/components/features/map*` | MapLibre GL, supercluster, polyline |
| Notifications | Real-time + push notifications via Web Push API | `app/lib/services/notification*` | Prisma, web-push, QStash |
| Admin | Dashboard, user management, site config, bug reports | `app/(admin)/` | Prisma, Sentry |
| Search | Route and post search with full-text indexes | `app/lib/services/search*` | Prisma (full-text search) |
| Profile | User profiles, follower system, rewards | `app/lib/services/profile*` | Prisma, Cloudinary |
| Rewards | Gamification: tiers, badges, points | `app/lib/services/rewards*` | Prisma |
| ValidityEngine | Route verification and trust scoring | `app/lib/services/validity*` | Prisma, Redis |
| DraftingCoach | AI-assisted post composition guidance | `app/lib/services/drafting*` | N/A (rule-based) |
| PWA | Service worker, offline page, push notifications | `public/sw.js`, `public/manifest.json` | Web Push API |
| Push Notifications | Browser push subscription and delivery | `app/api/push/*`, `app/lib/services/pushSubscriptionService.ts`, `app/providers/PushProvider.tsx` | Prisma, web-push, QStash |
| QStash Workers | Background job processing (feed, rewards, validity) | `app/api/workers/*`, `app/lib/services/qstashService.ts` | QStash SDK, Prisma, Redis |
| Offline Queue | Client-side mutation queue with auto-flush | `app/lib/services/offlineQueue.ts`, `app/providers/OnlineStatusProvider.tsx` | localStorage, fetch |
| Blog | Public blog with MDX posts, categories, featured posts | `app/(public)/blog/*`, `app/lib/utils/blog.ts`, `app/lib/config/blog.ts` | fs (build-time), MDX, remark |
| FAQ | Public FAQ page with categorized searchable Q&A | `app/(public)/faq/*`, `app/lib/config/faq.ts` | None (config-driven) |
| Config | Centralized config registries for all domains (25 files) | `app/lib/config/*` | None |

---

## Data Flow

### Standard Request Flow
```
Browser → Next.js Route Handler (page.tsx)
  → Client component mounts → calls API route (fetch/axios)
    → API route (route.ts) validates with Zod
      → Service method (business logic)
        → Repository/Prisma query
          → PostgreSQL response
        → Redis cache check/set
      → JSON response
    → Client component renders with data
```

### Authentication Flow
```
Login → POST /api/auth/login
  → Validate credentials with Zod
  → Verify password with bcrypt
  → Generate JWT token
  → Set httpOnly cookie
  → Return user profile
  → Client stores session via AuthProvider context
  → Subsequent requests: JWT verified middleware via cookies()
```

### Data Persistence Flow
```
Write operation → API route
  → Zod validation (input sanitization)
  → Service method (business rules)
  → Prisma transaction (ACID)
  → Invalidate related cache keys in Redis
  → Return created/updated entity
  → On failure: rollback transaction, log to Sentry
```

---

## Configuration Points

| Config Key | Purpose | Location | Default |
|------------|---------|----------|---------|
| DATABASE_URL | PostgreSQL connection | .env | — |
| JWT_SECRET | JWT signing key | .env | — |
| JWT_EXPIRES_IN | Token expiration | .env | 7d |
| REDIS_URL | Upstash Redis connection | .env | — |
| CLOUDINARY_URL | Cloudinary image upload | .env | — |
| RESEND_API_KEY | Email service | .env | — |
| SENTRY_DSN | Error tracking | .env | — |
| VAPID_PUBLIC_KEY | Web Push public key | .env | — |
| VAPID_PRIVATE_KEY | Web Push private key | .env | — |
| QSTASH_TOKEN | QStash worker token | .env | — |
| NEXT_PUBLIC_MAPBOX_TOKEN | MapLibre tile access | .env | — |
| RATE_LIMIT_WINDOW | API rate limit window (ms) | `app/lib/config/rateLimits` | 60000 |
| RATE_LIMIT_MAX | Max requests per window | `app/lib/config/rateLimits` | 100 |
| CACHE_TTL | Default Redis TTL (s) | `app/lib/config/cache` | 300 |

All config points listed here should follow the fallback discipline from `standards/engineering-principles.md` §1 and §3 — every config-driven value must have a documented, safe fallback so the system degrades gracefully if the value is missing or malformed.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.3.5 |
| UI Library | React | 19.1.0 |
| Language | TypeScript | 5.x |
| UI Components | Ant Design | 5.23.3 |
| Styling | Tailwind CSS | 4.1.7 |
| ORM | Prisma | 7.2.0 |
| Database | PostgreSQL | — |
| Cache | Upstash Redis | 1.35.8 |
| Auth | JWT (jsonwebtoken + bcrypt) | 9.0.3 / 6.0.0 |
| Validation | Zod | 4.2.1 |
| Maps | MapLibre GL + react-map-gl | 4.7.1 / 7.1.9 |
| Error Tracking | Sentry | 10.51.0 |
| Images | Cloudinary | — |
| Email | Resend | 3.2.0 |
| Push | Web Push API + web-push | 3.6.7 |
| Workers | QStash | 2.7.9 |
| Icons | Lucide React | 0.469.0 |

---

## Known Constraints & Technical Debt

- Prisma schema is PostgreSQL-specific — not portable to SQLite or MySQL
- Tailwind CSS v4 uses the new `@tailwindcss/postcss` plugin — v3-style `@tailwind` directives will not work
- Dual PostCSS config files exist (`postcss.config.js` CJS + `postcss.config.mjs` ESM) — may cause confusion
- Sentry DSN and all secrets are populated in `.env` — must not commit or expose
- 91 Jest tests across 9 suites (services, config, utils, components)
- Coverage thresholds configured: branches 70%, functions 70%, lines 80%, statements 80%
- Prior codebase with Phases 1-7 was removed as part of a planned clean rebuild
- Two `useRequireAuth` hooks exist: one in `app/hooks/` (router-based redirect) and one in `app/lib/hooks/` (permission check) — potential confusion
- Blog posts are read from the filesystem at request time (no CMS integration yet)
- `app/lib/streams/` directory is empty — placeholder for future reactive streams

---

## Architecture History

See `memory/architecture-history.md` for full chronology.
