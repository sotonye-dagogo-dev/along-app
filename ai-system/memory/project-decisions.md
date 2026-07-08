# Project Decisions

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: each entry has its own staleness — check supersedes links

> **Overview:** Log of significant architectural, technical, and product decisions made during Along development. Agents consult this before proposing changes to avoid contradicting prior reasoning. Each entry records what was decided, why, and what the alternatives were. Uses supersedes/superseded-by links so contradictory entries are explicitly resolved rather than both appearing equally valid.

---

## Decision Format

```
## [Decision Title]

**Decision:** [What was decided]
**Date:** [YYYY-MM-DD]
**Made by:** [Developer / AI agent / team]
**Supersedes:** [link to any prior decision this replaces, or None]
**Superseded by:** [link to any newer decision that replaces this, or None]

**Reason:**
[Why this choice was made]

**Alternatives Considered:**
[What else was evaluated and why it was rejected]

**Implications:**
[What this decision affects going forward]
```

---

## Decisions

## Tailwind v4 CSS-First @theme Migration

**Decision:** Remove `tailwind.config.ts` and migrate all design tokens to CSS-based `@theme {}` block in `globals.css`.
**Date:** 2026-06-02
**Made by:** AI agent (opencode)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Tailwind CSS v4 with `@tailwindcss/postcss` supports CSS-first configuration via `@theme {}` blocks, which is the recommended approach. This eliminates the need for a separate `tailwind.config.ts` file and keeps all design tokens in one place (globals.css). The `@theme` block generates both CSS custom properties and Tailwind utility classes from a single source of truth.

**Alternatives Considered:**
- **Keeping tailwind.config.ts alongside @theme**: Creates two sources of truth for tokens
- **Keeping only tailwind.config.ts**: Loses access to v4 CSS-first features and auto-detection

**Implications:**
- All design tokens are now in `app/globals.css` as `@theme` tokens
- `darkMode: "class"` is the default in v4 — no config needed
- Content paths are auto-detected in v4
- Removed `postcss.config.js` (CJS) — kept only `postcss.config.mjs` (ESM)

---

## Prisma 7 Client Construction

**Decision:** Configure PrismaClient to use Prisma Accelerate via `DATABASE_URL` environment variable, with `@prisma/adapter-pg` as a secondary path.
**Date:** 2026-06-02
**Made by:** AI agent (opencode)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Prisma 7 requires either an `adapter` (for direct database connections) or `accelerateUrl` (for Prisma Accelerate) in the client constructor options. The project `.env` has both: `DATABASE_URL` set to a Prisma Accelerate connection string and `DIRECT_URL`/`LOCAL_DB` for direct connections. Using Accelerate is preferred for production as it provides connection pooling and caching.

**Alternatives Considered:**
- **Adapter-only approach**: Would require running a direct Postgres connection, losing Accelerate benefits
- **Dual client instances**: Unnecessarily complex for a project where DATABASE_URL is always set

**Implications:**
- PrismaClient constructed with `{ accelerateUrl: process.env.DATABASE_URL }`
- `npx prisma migrate dev` uses DIRECT_URL/LOCAL_DB via prisma.config.ts (direct database for schema changes)
- Seed script uses the same PrismaClient instance via Accelerate

---

## Config Registry — Typed Constants with Lucide Icons

**Decision:** All config files export typed interfaces + typed constants using Lucide React icons exclusively.
**Date:** 2026-06-02
**Made by:** AI agent (opencode)
**Supersedes:** None
**Superseded by:** None

**Reason:**
ROADMAP §0.2 requires a complete config registry where each file exports a typed interface and a typed constant. All config files reference Lucide React icons (not emoji), CSS variable references (not raw hex values), and typed enums (not magic strings).

**Implications:**
- 20 config files created in `app/lib/config/`
- Shared type definitions in `app/lib/types/index.ts`
- Barrel export via `app/lib/config/index.ts`
- Any new feature must add its config file before implementation

---

## Initial Architecture — Next.js 15 + TypeScript + Prisma + Ant Design

**Decision:** Build Along as a single Next.js 15 App Router application with TypeScript, Prisma 7 (PostgreSQL), Ant Design 5, and Tailwind CSS 4.
**Date:** 2026-06-02
**Made by:** Project team
**Supersedes:** None
**Superseded by:** None

**Reason:**
Next.js provides both frontend and API routes in a single codebase, simplifying deployment and development. Prisma offers type-safe database access with excellent migration tooling. Ant Design provides a comprehensive component library suitable for the data-heavy dashboard and admin interfaces. Tailwind CSS 4 enables rapid UI development with utility classes and CSS custom property theming.

**Alternatives Considered:**
- **Separate frontend/backend** (React + Express): More complex deployment, duplicated TypeScript types
- **Next.js Pages Router**: Older paradigm, no React Server Components or streaming SSR
- **Drizzle ORM**: Lighter weight but less mature migration tooling and ecosystem
- **shadcn/ui**: Less comprehensive for complex tables, forms, and data display components
- **styled-components / CSS Modules**: More verbose than Tailwind, harder to maintain design token consistency

**Implications:**
- Single deployable unit (Vercel or Node.js hosting)
- Prisma schema is PostgreSQL-specific — no SQLite fallback for development
- Ant Design increases initial bundle size (mitigated by tree-shaking and dynamic imports)
- Tailwind v4 requires the new `@tailwindcss/postcss` plugin and CSS-first configuration approach

---

## Config-Driven Architecture

**Decision:** Centralize all hardcoded values into config registry files under `app/lib/config/`.
**Date:** 2026-06-02
**Made by:** Project team
**Supersedes:** None
**Superseded by:** None

**Reason:**
Hardcoded values scattered across the codebase are difficult to find, audit, and change. A config registry provides a single source of truth for domain-specific constants, enables easy environment-specific overrides, and makes the system auditable — any agent or developer can see all configurable values in one place.

**Alternatives Considered:**
- **Environment variables for everything**: Too many config values would pollute the env namespace
- **Database-backed config**: Adds latency for values that rarely change
- **Constants files per module**: Harder to discover and maintain than a centralized registry

**Implications:**
- Every module should import its config from `app/lib/config/`, not define inline constants
- Config files must have zero application dependencies
- Adding a new feature requires adding a corresponding config file

---

## Universal Component Library (App* Wrappers)

**Decision:** Wrap all Ant Design components in App* (AppButton, AppCard, etc.) wrappers and prohibit direct Ant Design imports outside `app/components/ui/`.
**Date:** 2026-06-02
**Made by:** Project team
**Supersedes:** None
**Superseded by:** None

**Reason:**
Direct Ant Design usage creates tight coupling to the library, making future UI library swaps expensive. App* wrappers provide a consistent API surface, enforce project-specific styling defaults, and make it easy to add cross-cutting concerns (loading states, analytics tracking, accessibility) in one place.

**Alternatives Considered:**
- **Direct Ant Design usage everywhere**: Faster initial development, but tight library coupling
- **Custom CSS-only components**: Too much reinvention for a component library as comprehensive as Ant D
- **ThemeProvider-only approach**: Doesn't prevent direct imports or enforce consistent patterns

**Implications:**
- All UI code must go through App* wrappers
- Adding a new Ant Design component requires creating an App* wrapper first
- Feature components never import from `antd` directly

---

## Zero Emoji Policy + Lucide React Only

**Decision:** Use Lucide React for all icons; prohibit emoji usage in UI text.
**Date:** 2026-06-02
**Made by:** Project team
**Supersedes:** None
**Superseded by:** None

**Reason:**
Emoji rendering varies significantly across platforms (different designs, missing characters, inconsistent sizing) and can cause accessibility issues (screen readers interpret them inconsistently). Lucide React provides consistent, vector-based icons that are tree-shakeable, accessible, and render identically everywhere.

**Alternatives Considered:**
- **Ant Design Icons only**: Less consistent design language than Lucide
- **Mixed Lucide + Ant Design Icons**: Allowed in some areas, but creates visual inconsistency
- **Emoji as icons**: Fastest during development but inconsistent and inaccessible

**Implications:**
- No emoji in any user-facing text, button labels, empty states, or notifications
- All icons must use Lucide React components
- Content moderation may need to handle user-generated emoji content

---

## QStash Over Fire-and-Forget for Async Jobs

**Decision:** Route all deferred work (rewards, feed invalidation, validity recompute) through Upstash QStash workers instead of `.catch(() => {})` fire-and-forget pattern.
**Date:** 2026-06-03
**Made by:** AI agent (opencode)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Fire-and-forget promises with `.catch(() => {})` silently swallow errors, making failures undetectable. QStash provides guaranteed delivery with 3 retries, signature verification, and observability through the QStash dashboard. All worker endpoints verify the QStash signature before processing.

**Alternatives Considered:**
- **Fire-and-forget (`.catch(() => {})`)**: No observability, silent failures
- **In-process execution**: Blocks the API response on non-critical work
- **Bull/BullMQ**: Requires Redis persistence, heavier setup than QStash

**Implications:**
- Worker endpoints at `/api/workers/*` verify QStash signatures
- `qstashService.ts` wraps publish methods for each job type
- 3 retries with exponential backoff by default

---

## Cursor-Based Pagination (Not Offset)

**Decision:** Use cursor-based pagination with `?cursor=ID&limit=N` on all list API routes instead of offset-based `?page=N&limit=N`.
**Date:** 2026-06-03
**Made by:** AI agent (opencode)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Offset pagination is unstable under concurrent writes — new/removed items shift page boundaries, causing duplicates or missed items. Cursor pagination is deterministic regardless of concurrent mutations. Standardized on `take: limit + 1` pattern to detect `hasMore`.

**Alternatives Considered:**
- **Offset pagination (`?page=N`)**: Simple but unstable under write load
- **Keyset pagination**: More complex queries
- **Infinite scroll via IntersectionObserver**: Client-side pattern, cursor pagination on the server

**Implications:**
- All list endpoints respond with `data: [...], nextCursor: string | null`
- Client uses `nextCursor` to fetch the next page
- Applied to: comments, notifications, admin/bugs, admin/reviews

---

## OnlineStatusProvider with Auto-Flush

**Decision:** Create an `OnlineStatusProvider` context that tracks `navigator.onLine` and auto-flushes the `offlineQueue` on `window.online` event.
**Date:** 2026-06-03
**Made by:** AI agent (opencode)
**Supersedes:** None
**Superseded by:** None

**Reason:**
The `offlineQueue` service existed but had no trigger to flush queued requests when connectivity returned. An `OnlineStatusProvider` wraps the root layout and provides both `isOnline` state for UI indicators and automatic flush on reconnect, ensuring no queued actions are lost.

**Alternatives Considered:**
- **Manual flush in each component**: Duplication and easy to forget
- **Only `isOnline` state without flush**: Queued requests would never be sent
- **setInterval polling for connectivity**: Less efficient than event-driven

**Implications:**
- `OnlineStatusProvider` must wrap all children (placed in root layout)
- `useOnlineStatus()` hook available for any component
- `OfflineIndicator` component shows `AppEmptyState preset="offline"` overlay when offline
