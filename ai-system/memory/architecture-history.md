# Architecture History

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
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

[New entries added here as architecture evolves]
