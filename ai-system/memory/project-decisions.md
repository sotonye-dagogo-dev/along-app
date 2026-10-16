# Project Decisions

> **Metadata**
> - last-updated-by: execute-feature 2026-10-16 (Sprint 65: post-card detail links + response-banner dismiss + vehicle contrast)
P26-10-12 (node --check sw.js + JSON/parity green; tsc shows only missing-module noise, jest/build deferred to CI — no node_modules in runner)
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

## Email OTP Durability via Postgres Mirror, Single-Active Preserved (fix-build 2026-10-09)

**Decision:** Email-verification OTPs (register/resend/verify-email trigger) and change-email confirmations are mirrored into a durable `EmailOtpToken` Postgres table (single-active per email+purpose[+userId], bcrypt-bound candidates); verification falls back to the DB only when Redis/memory holds no hash. Resend/invalidation semantics stay single-active — older codes are replaced, never multi-valid.
**Date:** 2026-10-09
**Made by:** AI agent (opencode — fix-build verify-email 404 + fresh-OTP)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Fresh codes read as "expired or replaced" because `otp:{email}` is Redis with a per-instance memory fallback — non-durable across serverless instances (same class as reset links, fixed via `PasswordResetToken`). A DB mirror consulted only on Redis miss fixes the false-expired without changing any success path; single-active keeps the "use the newest email" copy honest.

**Alternatives Considered:**
- **Multi-valid concurrent codes (keep last N)**: Rejected — contradicts the documented/shipped copy (`invalidatesPrevious`, locale `otp.newestOnly`) and weakens brute-force bounding; the observed false-expired came from durability, not from invalidation.
- **Replace Redis with DB entirely**: Rejected — Redis stays the fast primary; DB is a best-effort fallback that also swallows pending-migration (P2021/P2022) so deploys never fail auth mid-rollout.
- **SHA-256 OTP hashes like reset tokens**: Rejected — 6-digit numeric OTPs are brute-forceable unsalted; bcrypt (already the OTP hash) is kept.

**Implications:**
- Any future code-send flow reusing `otp:{email}` must also write the `EmailOtpToken` mirror or document why not (same rule already logged for the cooldown key).
- Every emailed link must resolve to a real route — grep link builders against `app/**/page.tsx` before shipping a template.

## Destination Step Carries No Fare/Vehicle (Sprint 23)

**Decision:** The final route step IS the destination: fare/vehicle inputs are hidden there in the composer (hint shown), hidden in PostCard/post-detail/NavigationGuide, excluded from totals, and stripped from payloads client-side (composer) and server-side (POST + PATCH `normalizeRouteSteps` backstop). Readers hide the last step's fare/vehicle even when legacy rows carry them.
**Date:** 2026-10-09
**Made by:** AI agent (execute-feature)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Fare/vehicle describe the leg STARTING at a stop; the destination has no onward leg, so showing them is logically wrong and confused users.

**Alternatives Considered:**
- Making fare/vehicle nullable in the DB with a migration — rejected: zod fields are already optional and JSON drops `undefined`, so payload-level stripping needs no schema change (non-breaking).
- Keeping stored values and hiding only in UI — rejected as half-measure; strip at write time AND hide at read time (defense in depth, legacy rows still render correctly).

**Implications:**
All future route-step renderers must consult `showStepFare`/`showStepVehicle`; all write paths must pass through `normalizeRouteSteps`.

## Road-Trace Endpoint Snapping for Pins (Sprint 23)

**Decision:** When a road-snapped trace is on screen, origin/destination dots render at the trace endpoints (snapped versions of their own coords); intermediate stops stay at exact geocoded coords; raw coords are the fallback. Flagged by `MAP_PINS_CONFIG.snapEndpointsToPolyline`.
**Date:** 2026-10-09
**Made by:** AI agent (execute-feature)
**Supersedes:** None
**Superseded by:** None

**Reason:**
The trace (OSRM via server proxy) is authoritative for where the line runs; snapping endpoints is the cheapest way to use "the same pipeline as the polyline" so the line visibly meets the dots.

**Alternatives Considered:**
- Per-pin server-side snap (nearest-road lookup per stop) — rejected: extra requests/rate-limit cost for metre-level gains already covered by endpoint snapping.
- Moving pins off-road is "less accurate" — accepted trade-off: displacement is metres, and visual line-meets-dot coherence is what users read as accuracy.

**Implications:**
`displayPins` in RouteMap is the render source; editing maps back to original indices (1:1 correspondence preserved).

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

---

## Freeze-Without-Delete for Unready External Integrations

**Decision:** When an external platform is not ready, remove only the user-facing access points (nav, sidebar) while preserving all infrastructure code.
**Date:** 2026-07-08
**Made by:** AI agent (opencode)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Transact Marketplace and Tega Events integrations were fully implemented but the external platforms aren't available. Deleting the code would require reimplementing it later. Keeping everything but removing nav/sidebar access points prevents user confusion while preserving the implementation for activation with one-line changes.

**Alternatives Considered:**
- **Full code deletion**: Loses all implementation work, must be redone
- **Leave everything live**: Users see empty listings/pages with no value
- **Feature flags using env vars**: Adds runtime complexity to simple gating

**Implications:**
- All integration code stays in the repository — compilation passes but routes are unreachable via normal UX
- Re-activation requires only: re-add nav item + re-add component import
- Document frozen modules with `[FROZEN]` tag in architecture docs

---

## State Strategy: No Redux/Redux-Observables — Keep memoryCache + useCachedFetch + feedStream

**Decision:** Keep the current client state stack (`memoryCache` + `useCachedFetch` for server reads, `feedStream` (RxJS) for the home feed, `AuthContext` for session, local component state for UI). Do not introduce redux, redux-observables, Zustand/Jotai, or a third-party data-fetching library (SWR/React Query).
**Date:** 2026-10-07
**Made by:** AI agent (opencode) — H3 review, evidence-based
**Supersedes:** None
**Superseded by:** None

**Reason:**
Evidence from the codebase: `package.json` contains `rxjs@^7.8.1` and no redux/zustand/jotai/swr/react-query dependencies; `grep` for `createStore|useSelector|useDispatch|configureStore|@reduxjs` across `app/` returns zero matches — there is no existing redux surface to extend. The dominant client state class is server data (feed, notifications, analytics, profiles), which is already handled by `app/lib/hooks/useCachedFetch.ts` (per-key envelopes, TTL freshness, in-flight request dedup, manual `mutate`) over `app/lib/cache/memoryCache.ts`, with viewer-scoped cache keys. Streaming/subscription behavior (hydration, polling, load-more, hidden-tab pause, persistence) is already implemented once in `app/lib/streams/feedStream.ts` using an RxJS `Subject` — the exact capability redux-observables would provide, without a global store. Introducing a redux store would duplicate server state client-side (two sources of truth, staleness bugs), require migrating every feature that currently works with local state, and add epic/middleware plumbing with no capability gap.

**Alternatives Considered:**
- **Redux + redux-observables**: Rejected — no existing store to build on; epics would mostly re-implement feedStream and useCachedFetch network effects; global client copy of server data conflicts with the cache-key strategy already built
- **Zustand/Jotai (lightweight global stores)**: Rejected — the only plausible global UI state (feed, auth) already has dedicated homes; adding stores would fragment the caching story
- **SWR / React Query library**: Rejected — `useCachedFetch` already implements the needed subset (TTL, dedup, mutate); migration churn with no feature gain

**Implications:**
- New client state follows existing patterns: server reads → `useCachedFetch` + namespaced `memoryCache` keys (viewer-scoped where user-specific); event/feed streams → `feedStream`-style RxJS subject; auth → `AuthContext`; everything else → component state
- Any future proposal to add a global store must reference this decision and demonstrate a concrete capability gap
- Revisit only if requirements emerge for cross-tree realtime collaboration or complex client-only global state beyond feeds

---

## Sprint 11: Post Reports Reuse BugReport (No New Table/Route)

**Decision:** Post reports file through the existing `POST /api/bug-reports` (extended additively with optional `postId` link, `metadata`, best-effort reporter) with `metadata.kind: "post-report"`, triaged on the existing bug-report admin surface — no dedicated reports table or endpoint.
**Date:** 2026-10-08
**Made by:** AI agent (opencode) — execute-feature Sprint 11
**Supersedes:** None
**Superseded by:** None

**Reason:**
`BugReport` already carries `postId` + `metadata` + reporter/reviewer relations; moderation triage needs a queue with states, which the bug admin surface already provides. A dedicated table would duplicate that machinery for one reason-code field.

**Alternatives Considered:**
- **New `/api/reports` + Report model**: Rejected — zero migration, zero new admin UI needed with the additive extension.
- **Client-only report (mailto/toast)**: Rejected — reports must be persisted and triaged server-side.

**Implications:**
- Report reasons are metadata-driven (`POST_ACTIONS_CONFIG.reportReasons`); adding reasons needs no API change.
- If moderation volume outgrows the bug queue (SLA/routing needs), revisit with a dedicated surface and reference this decision.

---

## Sprint 12: Post Idempotency Is Process-Local (No DB Column)

**Decision:** Deduplicate `POST /api/posts` double-submits with a per-composer `clientMutationId` sent as `X-Idempotency-Key`, checked against a process-local TTL (`POST_SUBMIT_CONFIG.idempotencyTtlMs`) `idempotencyService` — replay returns the original post, concurrent duplicates get 409, the key releases on failure. No `idempotencyKey` column or migration.
**Date:** 2026-10-08
**Made by:** AI agent (opencode) — execute-feature Sprint 12
**Supersedes:** None
**Superseded by:** None

**Reason:**
Double-clicks are already stopped at two client layers (disabled submit button + re-entry guard; in-flight dedup in `submitPost`), so the server layer only needs to catch the residual race (retry storms, multi-tab). A process-local store does that with zero migration and zero schema coupling; a serverless replay landing on a cold instance simply misses and creates once — still exactly one row per user intent in every realistic path. The atomic single-statement create (validity precomputed) removes the old create-then-update window entirely.

**Alternatives Considered:**
- **Unique `clientMutationId` DB column**: Rejected — migration + unique-violation handling for a race the client layers already absorb; revisit if duplicate-post reports persist.
- **Redis-backed idempotency**: Rejected — adds a hot-path Redis dependency to posting (which must stay up when Redis is down, per the Redis-hardening decision); process-local is sufficient for a 5-minute replay window.
- **409-then-poll for concurrent duplicates**: Rejected — client in-flight dedup makes the concurrent case vanishingly rare; a friendly 409 message is enough.

**Implications:**
- `POST_SUBMIT_CONFIG.idempotencyHeader` is the contract between composer, `submitPost`, and the route — renaming needs all three.
- If duplicate posts are ever reported again, check server logs for 409s/deduplicated-200s before touching the client; escalate to a DB column and reference this decision.

---

## Sprint 14: Post Nature Is Immutable After Creation

**Decision:** `type` and `quotedPostId` are set once at creation and stripped from every PATCH payload server-side (`MODERATION_CONFIG.immutablePostFields`), for owners and admins alike. Archive/unarchive never touches content or type.
**Date:** 2026-10-08
**Made by:** AI agent (opencode) — execute-feature Sprint 14
**Supersedes:** None
**Superseded by:** None

**Reason:**
A route request edited through the route composer rendered as a route — the edit schema (`UPDATE_POST_SCHEMA = CREATE_POST_SCHEMA.partial()`) accepted `type`, so any client or direct API call could morph a post's nature. Client omission is not a guarantee; the server must enforce it.

**Alternatives Considered:**
- **Separate edit schemas per type**: Rejected — triples schema surface for a two-field constraint; the strip list is one config line.
- **Client-only fix (don't send type)**: Rejected — already true and still insufficient against direct API calls.

**Implications:**
- Changing a post's nature requires delete + recreate (undo-restore already replays via POST, so it keeps working).
- Adding a mutable field needs no change; making a new field immutable means one config entry + test.

---

## Sprint 14: Profile Routes Tab Shows Actual Routes (ROUTE + ROUTE_RESPONSE)

**Decision:** The profile Routes tab queries `type=ROUTE,ROUTE_RESPONSE`; route requests live on a dedicated Requests tab; archived posts live on an owner-only Archived tab (`?archived=true`), and the owner's main tabs now exclude archived posts.
**Date:** 2026-10-08
**Made by:** AI agent (opencode) — execute-feature Sprint 14
**Supersedes:** None
**Superseded by:** None

**Reason:**
Users asked whether requests belong on the Routes tab — they don't (requests are not routes and render no map/score). Responses are real routes and were invisible on the tab. Owner main tabs including archived posts made feeds confusing once a dedicated library exists.

**Alternatives Considered:**
- **Routes = ROUTE only + requests stay in Posts**: Rejected — leaves responses undiscoverable and the original confusion intact.

**Implications:**
- `GET /api/posts` accepts comma-separated `type`; `?archived=true` is owner-only (non-owners silently get unarchived).
- Other-user profiles have no Archived tab (privacy); direct-link + tombstone rules unchanged.

---

## Sprint 14: Invite Cap Applies to Send-Credit Points, Never to Inviting

**Decision:** `INVITE_CONFIG.maxInvitesPerUser` caps only `INVITE_SENT` send-credit points (first N converted invites); linking (`invitedById`) is unlimited on every auth method and `INVITE_ACCEPTED` conversion points always pay.
**Date:** 2026-10-08
**Made by:** AI agent (opencode) — execute-feature Sprint 14
**Supersedes:** None
**Superseded by:** None

**Reason:**
Capping the ability to invite throttles the growth loop the program exists to create; the cheap-to-farm part is send points for invites that never convert. Sends are not server-observable (links are shared client-side), so send credit is awarded on conversion inside the cap window.

**Alternatives Considered:**
- **Hard invite limit**: Rejected — directly contradicts growth intent.
- **Track sends via a send-endpoint**: Rejected — adds a gameable endpoint for points already covered at conversion.

**Implications:**
- Invite page shows "Bonus Invites Left" instead of "Max Invites"; referral linking code must never count-check before linking.
- If send tracking ever becomes real (e.g. in-app share sheet with receipts), revisit and reference this decision.

---

## Sprint 16: Early-Adopter Rank Derives From User.createdAt — No New Columns

**Decision:** The "First N Users #n" badge qualifies the N earliest users by `(User.createdAt asc, id asc)` counted at read time; no rank column, no backfill, no migration. Live values (enabled/limit/label template) live in the `earlyAdopterConfig` SiteConfig row.
**Date:** 2026-10-08
**Made by:** AI agent (opencode) — execute-feature Sprint 16
**Supersedes:** None
**Superseded by:** None

**Reason:**
The prod DB had just been cleaned and any schema change reintroduces P2022-window risk plus a `vercel-build` migration dependency (see lessons-learned "Additive Schema Changes"). createdAt is already indexed and recorded for every user, so rank is exact without new state to keep consistent.

**Alternatives Considered:**
- **Stored `earlyAdopterRank` column with backfill**: Rejected — needs a migration + backfill + ongoing consistency on every signup; heavier and riskier for identical results.
- **Hardcoded N in code**: Rejected — directive requires admin-togglable total and visibility; KV row + seeded default + validation gives that with zero deploys.

**Implications:**
- Rank is read-time computed (per-user COUNT, Redis-cached 600s); list views use ordered takes. If user volume ever makes the COUNT hot, add a dedicated cache key or materialized rank — reference this decision.
- `db:reset-prod` script retained manual-only (unhooked from `vercel-build` 2026-10-08); never re-hook a destructive step into a build command.

---

## Sprint 17: Canonical isAdminRole() + Error Boundaries Must Prove Notification

**Decision:** All admin gating goes through `isAdminRole()` (case-insensitive, canonical `ADMIN` per the Prisma enum); error boundaries may only claim "team notified" after `errorReportService` gets a 2xx persist of a sanitized `BugReport`, otherwise they render the unreported fallback copy.
**Date:** 2026-10-08
**Made by:** AI agent (opencode) — execute-feature Sprint 17
**Supersedes:** None
**Superseded by:** None

**Reason:**
Two silent-failure classes shared one shape: code that *looked* correct but never fired — lowercase `"admin"` comparisons against an uppercase enum hid every admin entry point, and a Sentry-only `global-error` claimed notification in environments where no DSN delivers. Centralising the role rule in config and tying boundary copy to the actual POST result makes both claims verifiable.

**Alternatives Considered:**
- **Adding a MODERATOR enum value**: Rejected — no such role exists in data or product; server guards already tolerate the string for forward-compat, which is enough.
- **Removing the "notified" line entirely**: Rejected — the directive allowed actualisation, and real BugReport rows give the team triageable context (sanitized stack + route + digest) that Sentry alone wasn't providing here.
- **Auto-report with full console capture**: Rejected — unbounded console capture risks PII/secret exfiltration and payload rejection; fixed-field sanitized capture stays within API validation and privacy bounds.

**Implications:**
- Any new admin entry point must use `isAdminRole()` — never a raw string comparison (see lessons-learned "Enum-Literal Case Drift").
- Any new error surface must use `ERROR_REPORTING_CONFIG.copy` states — never a static "notified" string.
- Auto-filed reports carry `metadata.source: "error-boundary"`; admin bugs triage can filter on it.

---

## Sprint 19: Keyless-First Map Stack (OpenFreeMap + OSRM-via-Proxy + Straight-Line Guarantee)

**Decision:** The map pipeline works with zero keys configured. Tiles: OpenFreeMap keyless vector primary with keyless raster step-down (plain Carto → OSM → Esri), shared via `MAP_STACK_CONFIG` style-stack builders. Routing: OSRM demo via cached server proxy first, then env-gated ORS/Mapbox, then straight-line — never throwing. Geocoding: internal `/api/maps/*` proxy only (Nominatim server-side + Photon fallback); browser-direct upstream calls are banned. All keyed map env vars are optional overrides, skipped (not failed) when unset.
**Date:** 2026-10-09
**Made by:** AI agent (opencode) — execute-feature Sprint 19
**Supersedes:** None
**Superseded by:** None

**Reason:**
Recurring API-key failures (Carto `?apiKey=` demands, Mapbox/ORS key dependence) and a Nominatim browser-direct policy violation shared one root: the client owned provider relationships it couldn't guarantee. Server proxy ownership restores policy compliance (identity headers, referer), absorbs OSRM's ~1 req/s demo policy via Redis caching, and keeps every keyed provider as a strictly-optional upgrade.

**Alternatives Considered:**
- **Stadia/Geoapify/MapTiler keyed primaries**: Rejected — replaces one key dependency with another; evaluated in plan-feature and demoted to optional overrides.
- **Self-hosted tiles/routing now**: Rejected — operational cost unjustified at current volume; OpenFreeMap documents a self-host path if volume outgrows the free tier.
- **Removing `/api/routes/trace` in favour of `/api/maps/route`**: Rejected — non-breaking contract; trace stays as a delegate so existing clients (ShareRouteModal live preview) keep working.

**Implications:**
- New map clients must consume `MAP_STACK_CONFIG` builders and `/api/maps/*` — never add upstream URLs or `NEXT_PUBLIC_*` map keys to client code.
- If routing volume approaches OSRM demo limits, the next step is self-hosted OSRM or a keyed override — reference this decision.
- `.env.example` documents all keyed map vars as optional; do not reintroduce required map keys without revisiting this decision.

---

## Sprint 20: Pin Parity + Draft Update-in-Place (Numbered Dots, Dark Light-Parity, Update-vs-New)

**Decision:** All map renderers share `MapRoutePin`/`MapUserDot` from `MAP_PINS_CONFIG` (center anchor, zero offset, 1-based stop numbers, token-only classes); dark mode renders the identical light visual params (`darkCanvasFilter: "none"`, dark raster mirrors light). Draft saves on an active draft prompt update-in-place vs save-as-new (`updateDraft` keeps id, refreshes `savedAt`, moves to top); per-draft Update is available from the drafts panel.
**Date:** 2026-10-09
**Made by:** AI agent (opencode) — execute-feature Sprint 20
**Supersedes:** None
**Superseded by:** None

**Reason:**
Pin drift was an anchoring/identity divergence between renderers, not a tile fault — sharing one marker implementation removes the class of bug. Users verified light tiles read clearer, so dark keeps them verbatim instead of a second style path. Draft duplication came from save-always-creates; prompting update-vs-new on the active draft preserves intent without losing the explicit new-entry path.

**Alternatives Considered:**
- **Per-renderer pin fixes**: Rejected — leaves the divergence class in place for the next renderer.
- **New dark tile style**: Rejected — user evidence says the light params are already clearer; parity is cheaper and provably consistent.
- **Silent auto-update on save**: Rejected — prompt preserves the user's explicit "new entry" intent.

**Implications:**
- New map surfaces must use `MapPins.tsx` + `MAP_PINS_CONFIG` — no bespoke marker divs or hardcoded hex.
- Do not reintroduce a dark canvas filter or dark-only raster without revisiting this decision.

---

## Sprint 21: Safe Deletion Lifecycle + Email Studio on SiteConfig

**Decision:** Ship deletion as `AccountDeletionRequest` (PENDING→CANCELLED/COMPLETED) with 7-day archive grace and in-place anonymization; keep email templates in `SiteConfig` (no new EmailTemplate table) with enable toggles + custom rows; first-N bulk presets resolve earliest signups via `?order=oldest`.
**Date:** 2026-10-09
**Made by:** AI agent (opencode) — execute-feature Sprint 21
**Supersedes:** None
**Superseded by:** None

**Reason:**
A SiteConfig-backed template store reuses the existing admin-override pattern (no migration, backfill-merge for new system templates) and matches the crellab-described builder shape without copying unavailable code. In-place anonymization preserves post integrity where row deletion would cascade. Earliest-signup selection matches the badge/reward semantics the presets were built for.

**Alternatives Considered:**
- **New EmailTemplate table**: Rejected — heavier migration for no behavioral gain; SiteConfig JSON already supports the builder.
- **Hard row delete + cascade**: Rejected — violates anonymised-retention policy and destroys counters/links.
- **On-screen first-N selection**: Rejected — list order is newest-first; presets must mean earliest signups.

**Implications:**
- New notification/email types must be added to both Prisma enum (migration) and TS registries together.
- Template toggles audit to EmailLog (`template_toggle`); paused templates skip sends without throwing.

---

## Sprint 22: Email hardening + verify/change flows without migration + env single source

**Decision:** Missing email vars render as "" (never literal `{{ident}}`); no Prisma migration for verify/change-email (otpStore keys, address bound into hash); `change-password` is hasPassword-only (first credential stays in link/password); env decisions go through `lib/config/env.ts` (PROJECT_ENV wins); Studio keeps blocks as single source with lossless mode conversions.
**Date:** 2026-10-09
**Made by:** AI agent (opencode) — execute-feature Sprint 22
**Supersedes:** None
**Superseded by:** None

**Reason:**
Literal `{{var}}` in inboxes was caused by preview/send filling gaps with the identifier itself; empty-string fallback plus readable preview samples fixes the class. otpStore reuse avoids a migration for flows with identical durability needs (same caveat as OTP already documented). Splitting first-credential creation from password change avoids two writers racing on Google-only accounts. PROJECT_ENV-wins fixes the observed split (prisma honored it, cookies/logs/secrets did not).

**Alternatives Considered:**
- **EmailVerificationToken table**: Rejected — same durability as OTP store, extra migration for no gain.
- **Keep literal placeholders in sends**: Rejected — the reported bug; empty fallback is the safe default.
- **Direct NODE_ENV reads kept**: Rejected — preserves the differentiation gap the directive called out.

**Implications:**
- New email vars must be added to template `variables` + `EMAIL_BUILDER_CONFIG.variableCatalog` together so Studio/composer/preview agree.
- New env-dependent behavior must use `getEffectiveEnv()/isProduction()`, never raw `process.env.NODE_ENV`.
---

## Sprint 25: Platform reviews on UserReview self-pair + bundled-locale fallback + config-fallback i18n

**Decision:** Platform reviews reuse `UserReview` with `reviewerId === revieweeId === authorId` (no migration; @@unique gives one-per-user + ACID upsert); thank-you reuses REWARD+allowSelf (no NotificationType migration); offline translation resilience comes from three layers (SW-precached dictionaries → localStorage last-good → bundled-EN import, never empty map); component i18n uses `tf(key, fallback)` with config literals as fallback (footer gains optional `i18nKey` only).
**Date:** 2026-10-09
**Made by:** AI agent (opencode) — execute-feature Sprint 25
**Supersedes:** None
**Superseded by:** None

**Reason:**
A dedicated PlatformReview model would need a migration + new admin surface for identical shape/moderation needs; the self-pair marker distinguishes platform from (unimplemented) user-to-user reviews with zero schema change. Raw keys observed offline (`guest.signIn`) came from fetch-or-empty provider logic — bundled + cached layers remove the empty-map state entirely. `tf()` with config fallback keeps config as single source of truth while making the pidgin toggle visibly seamless.

**Alternatives Considered:**
- **New PlatformReview model + migration**: Rejected — same fields/moderation as UserReview, extra migration + admin work for no gain.
- **Per-item FAQ keys in locale JSON**: Rejected — 40+ key bloat across two files; FAQ_PCM beside source copy is single-file reviewable and equally toggleable.
- **Server-side locale rendering**: Rejected — would split the translation source of truth; client islands (LandingCopy) keep one dictionary.

**Implications:**
- If user-to-user reviewing is ever built, it must exclude self-pairs (or migrate platform reviews out) to avoid collisions.
- New user-facing copy must add en+pcm keys together (parity test enforces) or a config fallback via `tf()`.
- New notification types needing distinct icons/copy should still prefer existing types + allowSelf unless product requires a migration.
---

**Decision:** OTP resend throttling uses a per-email cooldown key alongside (never inside) the `otp:{email}` hash; verify attempts use a separate counter key with revoke-at-cap; all three reuse the otpStore Redis-timeout + memory pattern with no schema change. Push subscription uses a detailed-result core (`subscribeToPushDetailed`) with the old boolean kept as a wrapper; prompt visibility is driven by localStorage flags + server status, not server status alone.
**Date:** 2026-10-09
**Made by:** AI agent (opencode) — execute-feature Sprint 27
**Supersedes:** None
**Superseded by:** None

**Reason:**
Changing the OTP hash shape (to bundle expiry/cooldown) would break every existing Redis row and every reader; sidecar keys keep `otp:{email}` reads byte-identical while giving the client an authoritative timer that matches the throttle — the exact mismatch behind "wasn't sent any". A boolean push API cannot distinguish denied/unsupported/offline, which is why Enable went silent; the detailed core lets the UI instruct per outcome while old callers keep compiling. Server-only prompt visibility fails offline (status endpoint unreachable) and forgets dismissals — local flags close both gaps without touching the API.

**Alternatives Considered:**
- **DB-backed OTP table + migration**: Rejected — heavier than the need; sidecar keys fix the feedback/throttle bugs, and the memory-durability caveat (already documented for OTP) is now user-visible via honest delivery flags instead of silent failure.
- **Separate rate-limit bucket for OTP sends**: Rejected — non-breaking constraint; per-email cooldown composes with the shared auth bucket instead of splitting accounting, and 429s now carry `retryAfter` either way.
- **Auto-requesting notification permission on page load**: Rejected — browsers ignore/reject out-of-gesture requests; permission is requested inside the Enable click, auto-subscribe only fires when already granted.

**Implications:**
- Any future code-send flow reusing `otp:{email}` must honour the same cooldown key or document why not (verify-email and resend already share it).
- New push callers should use `subscribeToPushDetailed`; the boolean wrapper stays for compatibility.
- New user-facing copy must add en+pcm keys together (parity test enforces) or fall back to config copy.
---

**Decision:** `waypoints` on a Post stores the INTERMEDIATE stops only (excludes origin + destination, which live in `startLat/startLng` + `endLat/endLng`); every map renderer must compose pins via the canonical `buildRoutePinsFromPost` (origin + intermediates + destination in step order) and never treat `waypoints` as the full route. Post detail fetches a road-snapped trace for the full pin sequence via the shared `useRouteTrace` hook (same pipeline as the composer preview); legacy waypoint-less rows backfill missing stops with a bounded best-effort geocode rather than rendering a start→destination skip.
**Date:** 2026-10-09
**Made by:** AI agent (opencode) — execute-feature Sprint 28
**Supersedes:** None
**Superseded by:** None

**Reason:**
The composer sends `waypoints` as intermediates-only and previews all steps, but POST dropped `waypoints` server-side while post detail read them as the whole route — so both states of the data rendered wrong (skip vs origin-loss). One canonical builder plus one shared trace hook makes preview and post views structurally incapable of diverging again. The bounded geocode backfill rescues rows stored during the drop window without a migration.

**Alternatives Considered:**
- **Store full pin list (incl. origin/destination) in `waypoints`**: Rejected — duplicates start/end coords, breaks the existing composer contract and every stored row's shape; the builder handles both shapes' composition instead.
- **Backfill via migration/geocode-all script**: Rejected — heavier than the need and rate-limit-hostile; lazy bounded client backfill fixes views on read with zero schema change.
- **Auto-start geolocation when the nav modal opens**: Rejected — permission requests must stay inside the user's Start-tap gesture; the modal mounts map + guide together and tracking starts on Start.

**Implications:**
- Any future renderer (feed maps, suggestions, admin previews) must use `buildRoutePinsFromPost` — never hand-roll start/waypoints/end composition.
- Any future trace consumer must use `useRouteTrace` (or the same estimate→debounced-trace→cache→fallback discipline) so offline/429 behaviour stays uniform.
- If `waypoints` semantics ever change, the builder (not each call site) is the single migration point.

## Sprint 31: additive trust-signal weights + single share service

**Decision:** Trust bonuses/penalties are additive on top of the unchanged legacy 4-signal base (reputation .15 / engagement .10 / report-pressure .25, bounds in `VALIDITY_SIGNAL_BOUNDS`); share is one zero-dep service + hook with a fallback inside `PostCard`.
**Date:** 2026-10-10
**Made by:** AI agent (opencode — execute-command Sprint 31)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Additive (not renormalised) weights keep every legacy score bit-identical when new signals are absent, so no migration, no rescore backfill, and existing tests hold by construction. Follower leg is log-scale saturating at 500 (linear would let one viral author dominate; log keeps 10 followers meaningful and 500 near-max). Report pressure saturates at 4 open reports so a single report dents but cannot nuke. Share fallback lives inside `PostCard` (not each page) so future surfaces inherit working share by default; the `onShare` override is retained for callers/tests.

**Alternatives Considered:**
- **Renormalise all six weights to sum 1.0**: Rejected — shifts every stored score, invalidates the verified-tier test band, and would need a backfill to avoid visible score jumps on old posts.
- **Persist `validityComponents` JSON column**: Rejected — needs a migration for what the detail API can already compute live and best-effort; stored score + triggers + live breakdown cover freshness without schema change.
- **Recompute synchronously in every interaction route**: Rejected — adds write latency to likes/comments; fire-and-forget QStash with best-effort fallbacks keeps interactions fast and never fails them.

**Implications:**
- Tuning trust = edit `DEFAULT_VALIDITY_CONFIG` / `VALIDITY_SIGNAL_BOUNDS` only; engine code needs no change.
- Any new post surface must use `usePostShare` (or at minimum render `PostCard`, which self-shares).
- Any new interaction that should move trust must call `publishValidityRecompute` (bounded for fan-outs like follow).

## Sprint 37: owner-only post menu, dashboard-based admin moderation, audited admin mutations

**Decision:** Post management in public surfaces is gated by ownership alone; admins moderate exclusively from `/admin/posts` (now with Edit); every admin post mutation is audit-logged; the audit trail is a config-driven friendly table.
**Date:** 2026-10-11
**Made by:** AI agent (opencode — execute-feature Sprint 37)
**Supersedes:** None
**Superseded by:** None

**Reason:**
Showing Archive/Delete to admins on other users' posts leaks moderation affordances into the public UI and confuses role boundaries — an admin browsing the feed should see what any viewer sees. Concentrating moderation on `/admin/posts` keeps one audited surface (confirm modal + undo + audit log) instead of two divergent ones. Owner self-edits/archives stay unaudited (noise); only admin-not-owner mutations log, keeping the trail meaningful.

**Alternatives Considered:**
- **Keep admin Archive/Delete in PostMenu, add admin Edit there too**: Rejected — preserves the reported bug (admins seeing destructive actions on others' posts) and splits moderation across two surfaces with different audit coverage.
- **Audit owner self-actions as well**: Rejected — floods the trail with routine self-management; admin accountability is the trail's purpose.
- **Bespoke audit table markup**: Rejected — `AppTable`/`AppTag`/`AppCard` already encode sorting/selection/empty/loading states; config-driven labels keep future entities/actions metadata-only.

**Implications:**
- Any new post-management affordance in public UI must be owner-gated in `PostMenu` (handlers must also no-op without ownership).
- Any new admin mutation route must `void logAudit(...)` fire-and-forget; new audit entities/actions need only `AUDIT_DISPLAY_CONFIG` entries to render.

## Sprint 38: corroboration as a three-leg evidence blend, profile parity by forwarding
**Decision:** Corroboration = 0.55 route-evidence (best pair similarity × coverage) + 0.25 endorsement (approval × vote/views confidence) + 0.20 response linkage, all under `CORROBORATION_CONFIG`; profile tabs reach parity by forwarding API-shipped fields rather than new endpoints or a second card component.
**Alternatives Considered:**
- **Keep tag-exact N×10, just widen window/lowercase**: Rejected — still zero for tagless posts and ignores geo/routes/likes/views/responses, the exact signals the platform actually records.
- **New profile card component**: Rejected — `ProfilePostCard`→`PostCard` already renders everything when given the fields; the bug was field-stripping in the page mapping, fixed additively.
- **Changing base weights (0.35/0.35/0.20/0.10) or other sub-scores**: Rejected — audit found all other factors already driven by real signals; only corroboration's input was degenerate, so only its input changed.
**Implications:**
- Tuning trust = editing `CORROBORATION_CONFIG`/`VALIDITY_SIGNAL_BOUNDS` only; engine stays pure, service stays the only DB reader.
- Any new list surface must forward `quotedPost/quotedPostId/validityBreakdown/responsesCount` or it silently degrades (marker hidden, badge placeholders) — no error is raised.

## Sprint 39: one shared comment modal, additive explore suggestions, AppAvatar everywhere in comments
**Decision:** A single `PostCommentsModal` (config title/expand/loading copy) serves feed, profile tabs, search, and detail; explore search gains an additive `ExploreSearchInput` dropdown (unified `/api/search` + localStorage recents) over the untouched client filter; all comment faces render via `AppAvatar`; caret color is explicit config, not `currentColor`.
**Alternatives Considered:**
- **Duplicate the profile modal markup into feed/search**: Rejected — two copies already drifted (feed navigated, profile modal'd); one component keeps behaviour identical by construction.
- **New explore search endpoint or replacing the client filter**: Rejected — `/api/search` already covers posts+users+tags and the map filter works offline; the dropdown is additive with silent fallback, so offline/rate-limited degrades to today's behaviour.
- **Passing avatar URLs as plain img/initials in comments**: Rejected — `AppAvatar` already encodes upload/DiceBear/fallback + profile linking; hand-rolled divs re-created the inconsistency.
**Implications:**
- New surfaces that need comments use `PostCommentsModal` (viewer + postId + title); no new comment UI.
- Explore search tuning = `EXPLORE_SEARCH_CONFIG` only; comment tuning = `COMMENTS_CONFIG` only.

## Sprint 40: richness-bonused detail, prefilled error CTAs, registry-verified search links
**Decision:** Detail = untouched legacy leg base + capped `DETAIL_SCORING_CONFIG` richness bonuses (photos/tags/description/vehicle/fare/stops/locations), threaded through service single + batched paths + create + worker via `detailContextFromPost`; error boundaries pair every auto-filed report with a sanitized prefill (`buildErrorReportPrefill`/`buildBugReportUrl`) surfaced through the EXISTING toast action slot + an inline link, with `/report-bug` hydrating `?title=&description=` into `initialValues`; search reachability is asserted in registries (nav + footer + profile quick-links + sidebar user-row icon), with mobile bottom tabs deliberately unchanged.
**Alternatives Considered:**
- **Reweighting the 0.35/0.35/0.20/0.10 base or rewriting the leg scorer**: Rejected — the weights are fine; the bug was the scorer's blindness to post-level richness. Additive bonuses preserve legacy scores exactly when context is absent (proven by test), while a rewrite would have shifted every stored score.
- **New toast action API / new report-form component**: Rejected — `ToastOptions.onUndo + undoLabel` already renders an action button on any toast type, and `ConfigDrivenForm` already accepts `initialValues`; reusing both keeps the change additive with zero component API churn.
- **Adding Search to the mobile bottom tabs**: Rejected — 6 items + center FAB breaks the 5-tab layout; the footer (rendered on mobile) + explore suggestions + sidebar carry mobile reachability without layout risk.
**Implications:**
- Tuning detail = editing `DETAIL_SCORING_CONFIG` only; engine stays pure, service stays the only DB reader.
- Any new error surface must offer the same prefilled CTA (prefill builder + URL + `ERROR_REPORTING_CONFIG` copy) — never a static "notified" string.
- Any new top-level page needs registry entries (nav and/or footer and/or quick-links) plus a searchLinks-style test, or it is unreachable by construction.
- **Dislike active styling (Sprint 42)**: warning-token pairing (`text-warning-text` + `fill-warning-text` + `bg-warning`) for the active dislike state, mirroring the like state's error-token pairing. Alternatives (primary tint, error reuse) rejected — primary implies endorsement, error reuse would make like/dislike indistinguishable; warning reads as "downvote" in both themes without `text-white` contrast failures. Lives in `POST_ACTIONS_CONFIG` (`dislikeActiveClass/dislikeIconClass`) so future vote-style changes are config edits.

## Sprint 43: destructive admin user deletion through the grace pipeline + honest undo boundaries
**Decision:** The 7-day grace request flow is kept untouched; the destructive path (`finalizeOne{force:true}` / `deleteNow`) runs the SAME anonymize transaction (archive → anonymize PII, retain anonymised posts, wipe likes/bookmarks/follows/push, recompute counters, final email to the snapshotted address) with the due-date check skipped. Undo is offered only where reversal exists (request → cancel; cancel → re-request); the force path gets an explicit irreversibility warning + 30-day backup-recovery note and NO undo toast. All new actions are `logAudit`-audited; per-request/per-user actions supplement (never replace) the bulk finalize-due trigger.
**Alternatives Considered:**
- **True hard-delete (drop user + post rows)**: Rejected — policy retains anonymised post data for platform integrity, and hard deletes would cascade unpredictably; anonymize-in-place keeps ids stable for reviews/posts.
- **Undo for the force path via snapshot-restore**: Rejected — restoring wiped PII (email/username/password) from a client snapshot would be a fabrication risk and a uniqueness minefield; the honest contract is warning + audit + off-platform backup recovery.
- **Replacing the grace flow with immediate-only deletion**: Rejected — users rely on the 7-day reversal window; admins get both paths and choose per case.
**Implications:**
- Any future destructive admin action must follow the same pattern: shared config copy, confirm modal, undo only when a real reversal path exists, audit log entry, recovery note when irreversible.
- Tuning deletion = editing `ADMIN_USER_DELETION_META` + `ACCOUNT_DELETION_CONFIG` only; the service stays the only writer.

## Sprint 49: user-approved SW updates (prompt + single reload) over silent auto-apply
**Decision:** Installed updates surface through a non-blocking prompt (`ServiceWorkerUpdatePrompt` on `PWA_UPDATE_CONFIG.updateReadyEvent`) instead of silent auto-`skipWaiting()`: Update posts `SKIP_WAITING` and `controllerchange` reloads exactly once; Later snoozes 1 day; the registrar polls `registration.update()` hourly + on visible/focus/online. First installs still claim silently with no prompt and never reload. Cadence/copy/TTLs live in `PWA_UPDATE_CONFIG`; the client↔SW vocabulary lives in `PWA_SW_MESSAGES`; cache generation bumped v4→v5 in both `pwa.ts` and `sw.js`.
**Alternatives Considered:**
- **Keep auto-skipWaiting (silent apply)**: Rejected — the worker seizes control without reloading, so the open page runs stale hashed JS until the next navigation; with no polling and no prompt, day-long installed sessions never update at all. This was the exact reported gap.
- **Force-reload on updatefound**: Rejected — yanking a running page (mid-post, mid-payment, mid-navigation) violates the non-interference contract and risks data loss; the prompt preserves user agency.
- **Shorter poll interval (<15min)**: Rejected — `/sw.js` revalidation is cheap but not free on metered connections; hourly + event-driven checks catch updates within a session without background-chatter.
**Implications:**
- Every future `sw.js` change MUST bump `PWA_CACHE_VERSION` in both `app/lib/config/pwa.ts` and `public/sw.js` or old caches won't purge on activate.
- Tuning update behaviour = editing `PWA_UPDATE_CONFIG` only (interval, TTLs, copy, event name); the registrar/prompt/SW read it, so no logic edits are needed.

## Sprint 50: Report Images Ride in metadata.images (No New Column)

**Decision:** Optional report screenshots (≤3, ≤2MB, Cloudinary `along/reports`) are stored in `BugReport.metadata.images`, validated by `sanitizeReportImageUrls` (https Cloudinary URLs under the reports folder only). No `images` column, no migration.
**Date:** 2026-10-13
**Made by:** AI agent (opencode — execute-feature Sprint 50)
**Supersedes:** None
**Superseded by:** None

**Reason:**
A new column would need a migration plus a P2022-tolerant read window across every bug-report reader (admin list, triage actions, notifications) for zero behavioral gain — `metadata` is already JSON, already read everywhere, and already absent-tolerant. Folder separation (`along/reports` vs `along/posts`) keeps post-image pipelines and cleanup guards disjoint; the cleanup allowlist + `report-discard` source reuses the Sprint 33 orphan-prevention machinery instead of inventing another.

**Alternatives Considered:**
- **`images String[]` column + migration**: Rejected — migration + P2022 window for identical behavior; revisit only if reports need indexed image queries (they don't — admin renders them inline).
- **Storing data-URLs/base64 in metadata**: Rejected — blows up row size and bypasses Cloudinary optimization/cleanup entirely.

**Implications:**
- Report readers must treat `metadata.images` as optional (may be absent); writers must go through `sanitizeReportImageUrls`.
- New upload folders must be added to both the upload `FOLDER_POLICIES` allowlist and `MEDIA_CLEANUP_CONFIG.allowedFolderPrefixes` together, or uploads land where cleanup cannot purge them.

## Sprint 50: Geocode Merges All Keyless Providers; Bias Is a Re-rank, Never a Filter

**Decision:** `geocodeForward` queries every provider in `geocodeOrder` (nominatim → photon → openmeteo, all keyless, server-side only) and merges + dedupes into one list capped at `limit`; an optional viewer position re-ranks nearby-first but never removes hits. The client bias helper (`geoBias`) only reads position when permission is already granted (or a cached fix exists) — it never prompts.
**Date:** 2026-10-13
**Made by:** AI agent (opencode — execute-feature Sprint 50)
**Supersedes:** None
**Superseded by:** None

**Reason:**
First-provider-wins hid suggestions that existed in another source (the reported "Google finds it, we don't" gap). Merging keeps the response shape identical while strictly increasing recall; dedupe keys (normalized label + 3dp coords) collapse the same place across providers. Ranking-without-filtering means a stale/missing bias degrades to the unranked list, never to an empty one; promptless bias means suggestion typing can never trigger a permission sheet.

**Alternatives Considered:**
- **Replacing Nominatim with a single "better" source**: Rejected — uproots the working stack the directive explicitly protected; every free source has coverage gaps, merging dominates any single pick.
- **Keyed provider (Mapbox/Geoapify/Stadia) as primary**: Rejected — reintroduces the API-key failure class Sprint 19 eliminated; keyed providers stay optional overrides.
- **Filtering to a radius around the viewer**: Rejected — would hide valid distant results (users share routes for places they aren't standing in).

**Implications:**
- New geocode consumers must call `/api/maps/geocode` (never upstream browser-direct) and should forward bias coords when available.
- Adding a future provider = one `MapGeocodeProvider` entry + one `geocodeVia*` parser returning canonical `MapGeocodeHit` — callers never branch on provider.
- Route-step stop names (community wording no map source knows) are recalled separately via the best-effort `routes::text` prefetch in `searchService`, not via geocoding.

## Decision 2026-10-13: broad suggestions via parallel bounded fan-out + fallback-only Overpass + coordinate fast-path
**Context:** suggestions blanked for everything but exact address starts.
**Decision:** `geocodeForward` runs fast providers in parallel inside `LOCATION_SUGGESTIONS_CONFIG.providerTimeoutMs` (4s) each; Overpass + token-reorder retry run only when the fast merge is empty, in one batch (worst case ~8s < 10s budget); `lat, lng` input resolves to a pinned coordinate hit; Photon `lat/lon` + Nominatim `viewbox&bounded=0` carry the viewer position rank-only; empty merges cache 1h vs 30d for hits; route + all three autocomplete clients share min-2/debounce-350ms/limit-6 from the same config.
**Reason:**
Sequential awaiting turned provider latency into missing results; parallelism restores the full budget to the merge. Fallback-only Overpass keeps the slow global scan off the hot path while preserving landmark recall. Order-tolerance and coordinate support close the input classes users actually type. One shared config prevents gate drift across the four suggestion entry points.
**Alternatives Considered:**
- **Raising the serverless timeout / streaming partial hits**: Rejected — timeout is platform-fixed; streaming would change the route contract all clients share.
- **Overpass in the parallel hot path**: Rejected — its global scan routinely exceeds the per-provider budget and would burn the fallback margin on every keystroke.
- **Radius-filtering around the viewer**: Rejected (as before) — users share routes for places they aren't standing in; bias stays rank-only.
**Implications:**
- New suggestion consumers must use `buildGeocodeUrl` + `LOCATION_SUGGESTIONS_CONFIG` gates and forward `biasQuerySuffix` — never hardcode min-chars/debounce/limit.
- Provider changes keep the canonical `MapGeocodeHit` shape; `overpassFallbackOnly=false` restores round-1 Overpass without code changes.
**Supersedes:** None (extends the Sprint 50 merged-geocode decision).
**Superseded by:** None

## Decision 2026-10-13 (Sprint 52): report audit on a new `report` entity; parser contract-first; zero new locale keys
**Context:** report lifecycle had no audit rows; Studio parsing dropped content in edge cases; featured sections needed copy on three surfaces without breaking the en/pcm parity test.
**Decision:** (1) audit report actions under a new `report` entity (blog hooks already existed and were kept), retaining the `bug` entity entry for backward compatibility; specific action prefixes ordered before generic ones since `auditActionMeta` is first-prefix-match. (2) `htmlToBlocks` hardening keeps the established plain-text paragraph contract (an existing suite explicitly asserts no raw HTML in paragraphs) — fidelity gains come from structure (bare-text capture, wrapper recursion, more container tags), not inline-HTML retention. (3) featured copy ships as `tf(key, configFallback)` with no dictionary additions, so locale parity suites stay green.
**Reason:**
A separate `report` entity reads clearly in the admin trail while old rows keep rendering. Overriding the tested strip contract would have traded one directive (no loss) against another (no raw HTML in paragraphs) and broken green suites; structure-level fidelity satisfies both. `tf()` fallbacks are the established offline-safe pattern for new surfaces.
**Alternatives Considered:**
- **Inline-HTML retention in paragraphs**: Rejected — contradicts the tested no-raw-HTML contract and risks markup leaking into Studio textareas.
- **New en/pcm keys for featured copy**: Rejected — unnecessary; config fallbacks already satisfy offline rendering and parity tests.
- **Featured via server component with direct DB reads on about/invite**: Rejected — about/invite are client pages; one client section with `initialPosts?` prop serves all three surfaces.
**Implications:**
- New auditable report/blog flows must `void logAudit(...)` with the `report.*`/`blog.*` action vocabulary; display-only additions need just `AUDIT_DISPLAY_CONFIG` entries.
- Parser changes must keep the emailStudio `htmlToBlocks` contract cases green; bare-text/wrapper/recursion cases live in featuredBlogs.test.ts.
**Supersedes:** None (extends the Sprint 37 audit-trail decision).
**Superseded by:** None

## Decision 2026-10-14 (Sprint 55): recall-then-rank search; diversity as post-sort pass; portal for viewport overlays
**Context:** search missed order-swapped ("B from A") and typo'd queries; feed clustered same-author runs; trust tooltip flew off-screen on desktop cards.
**Decision:** (1) search separates recall (broad tokenized ORs + typo head-prefix top-up + stop-name prefetch, capped at `candidateCap`) from ranking (deterministic in-memory relevance, exact-phrase first) with index-based cursor pagination over the ranked set — unknown cursors end the list; single-letter-only queries fall back to phrase recall. (2) feed diversity is a post-sort/pre-slice pass (`applyFeedDiversity`: ±jitter + lookahead anti-cluster swap, rows never dropped) with a SiteConfig `feedDiversity` merge — no Studio card yet. (3) viewport-positioned overlays portal to document.body with config-owned geometry; collapsed rails use conditional spacing (never additive conflicting utilities) + shrink-0 icons.
**Reason:**
Recall/rank separation makes looseness additive (nothing exact is ever lost) while keeping pagination deterministic and the API envelope unchanged. A post-sort diversity pass preserves every relevance signal the scorers produce and degrades to relevance order when separation is impossible. Portals are the only robust escape from transformed ancestors; conditional utilities are the only safe way to write collapsed/expanded variants under Tailwind's conflict resolution.
**Alternatives Considered:**
- **pg_trgm / full-text search**: Rejected — requires a DB extension that cannot be guaranteed on the hosted database; the token + Levenshtein design needs no migration and no new deps.
- **Jitter inside the scorer weights**: Rejected — scattering randomness through four candidate pools is untestable; one pure post-sort pass with injectable rand is deterministic under test.
- **Removing the card hover lift instead of portalling**: Rejected — the lift is a design-system interaction; portalling fixes the whole class (carousel tapes, modals) not just the one card.
**Implications:**
- New search consumers must use `tokenizeSearchQuery` + `scoreTextRelevance` — never bespoke LIKE chains; recall caps and fuzzy thresholds live in `SEARCH_CONFIG`.
- New `fixed` overlays inside cards/tapes must portal; new collapsed/expanded variants must use exclusive (ternary) spacing classes.
- Search mocks must honor `id.notIn` and return matching content; rankers must coerce invalid dates.
**Supersedes:** None (extends the Sprint 8 unified-search and Sprint 7 feed decisions).
**Superseded by:** None

**Decision (Sprint 56, studio tightening):** (1) Blog `button` blocks render as Email-Studio-style CTAs (`.blog-cta`, token CSS in globals.css) — deliberate override of the Sprint 54 degrade-to-link rule, keeping its no-inline-style/dark-safe rationale (styles live in CSS on design tokens, sanitizer allowlists exactly `blog-cta-wrap`/`blog-cta`). (2) Studio previews use viewport-capped sticky panes (`STUDIO_LAYOUT_CONFIG`, 78vh caps) with `self-start` + `items-start` grids — the pair is required for sticky to engage. (3) `feedDiversity` gets a Studio card (KEY/META/normalize/validate shared by resolver + UI + API 400-guard) — stored shapes still degrade to defaults at read time. (4) Zero-result searches log one fire-and-forget `AnalyticsEvent(search_zero_results)` on empty first-page computes (cached-empty not re-logged) and surface top queries on the analytics page to tune stopwords/fuzzy thresholds.

## Decision 2026-10-14 (Sprint 57): cleanup guards belong at the destroy choke-point; share icons as serializable keys; seeded feed jitter + readiness gate
**Context:** cross-post image destruction (unguarded edit/delete paths vs guarded draft path); generic share icons; feed paint-then-reshuffle.
**Decision:** (1) live-reference guards live inside `cleanupImagesByUrls` (just-before-destroy re-check), not at each call site — every present and future caller inherits the invariant; route-level checks remain as early-outs only. Guard deps are injectable for tests; failures fail OPEN (keep the asset). (2) share-network icons are string keys in config (`BlogShareNetworkIcon`), mapped to glyphs by one component — config stays JSON/SiteConfig-safe; brand gaps in lucide are filled with inline SVGs, unknown keys fall back to the previous generic glyph (never nothing). (3) feed diversity jitter is seeded per viewer + UTC day (stable across cached/fresh/geo fetches; tiers still dominant), and first paint is gated on a single settled snapshot (`isReady`) rather than progressive re-renders — background freshness still flows through the stream after readiness.
**Reason:**
Choke-point guards can't be bypassed by the next delete path someone adds; serializable icon keys survive DB-backed config where component refs cannot; seeded jitter + one settled paint remove reshuffles without changing ranking inputs or removing background revalidation.
**Alternatives Considered:**
- **Per-caller guards at each delete path**: Rejected — four call sites today, more tomorrow; the TOCTOU window stays open unless the check is adjacent to the destroy.
- **Storing LucideIcon components in BLOG_SHARE_CONFIG**: Rejected — breaks SiteConfig/JSON serialization and admin editability.
- **Disabling background revalidation to freeze the feed**: Rejected — freshness matters; holding the first paint while keeping the stream live after readiness preserves both.
**Implications:**
- New media-destroy callers must route through `cleanupImagesByUrls` (never raw `cloudinary.uploader.destroy`); new share networks add an `icon` key + a `ShareNetworkIcon` branch.
- New feed ordering inputs must keep the seeded jitter (pass-through `rand`); first-load must keep the `isReady` hold.
**Supersedes:** None (extends the Sprint 33 orphan-prevention and Sprint 55 diversity decisions).
**Superseded by:** None

## Decision 2026-10-14 (Sprint 58): keyless traffic as labeled estimate; opaque notice surfaces; feed mini-maps skip traffic
**Context:** push banner washed out in dark theme; traffic requested from employed-or-keyless providers for maps + navigation with durations and legend.
**Decision:** (1) traffic provider order is Mapbox congestion (keyed) → TomTom flow (keyed, `TOMTOM_TRAFFIC_KEY`) → deterministic WAT rush-pattern heuristic (always, flagged `estimated: true` in API + legend + FAQ) — keyless users get an honest estimate, never fake "live" data; (2) notice banners use opaque token surfaces (`--color-bg-card` + semantic border/text), never translucent fills, in light and dark; (3) feed mini-maps render untrafficked (`showTraffic={false}`) to avoid per-card lookup fan-out against the shared maps bucket — full overlay on detail/share-preview/live-nav.
**Reason:**
No public keyless live-traffic API exists; labeling the estimate preserves trust while the keyed path auto-upgrades when configured. Opaque card surfaces read identically across themes and Android WebViews. One shared traffic hook + cache (Redis 300s, memory 120s) keeps map and guide durations consistent.
**Alternatives Considered:**
- **TomTom/Mapbox as hard requirements**: Rejected — breaks the keyless-first stack guarantee (Sprint 19) and fails with no keys.
- **Per-segment live colors on feed mini-maps**: Rejected — 20+ POSTs per feed page against a 60/min shared bucket starves geocode/route lookups.
- **New locale keys for legend copy**: Rejected — parity test enforces identical en/pcm sets; config copy + FAQ_PCM pidgin is the established pattern.
**Implications:**
- New traffic consumers must use `useRouteTraffic` (or the same debounce→cache→silent-fallback discipline) and render `TrafficLegend` with the `estimated` flag.
- New floating/inline notices must use opaque `--color-*` surfaces (see `PUSH_PROMPT_CONFIG.surface`).
**Supersedes:** None (extends Sprint 19 keyless map-stack decision).
**Superseded by:** None

## Decision 2026-10-15 (Sprint 62): community fan-out with followers-first cap; location-only drafts pad to Origin + Destination
**Context:** route-request notifications reached followers only (empty follower list = silent no-op); location-only drafts vanished on restore while fuller drafts survived.
**Decision:** (1) ROUTE_REQUEST fans out to a capped community audience — followers first (legacy promise holds under cap pressure), then recent non-deleted members to `maxRecipients` (500), self excluded, one Notification row with N recipient rows; mode/cap live in SiteConfig `routeRequestAudience` (hardcoded fallback, `followers` legacy mode, central admin validation, no-code card). (2) a 1-step draft restores as Origin (coords kept) + empty Destination with the title reset unconditionally; Share stays disabled until the second location is filled (savable-but-not-shareable); legacy migration uses the same usable-content rule as the saver.
**Reason:**
Followers-first keeps the prior guarantee while the cap bounds the write; one notification row reuses the existing fan-out/push-mirror shape with no migration. Padding to two rows respects the composer's ≥2-row invariant instead of special-casing it, and unconditional title reset prevents stale-input leaks.
**Alternatives Considered:**
- **Uncapped notify-all-users**: Rejected — unbounded NotificationRecipient writes per request on a large user base.
- **Separate follower + community notifications**: Rejected — duplicates for followers and doubles push mirrors; one row with a unioned audience is the existing shape.
- **Allowing single-row composer restore**: Rejected — validation, preview, and submit all assume ≥2 rows; padding keeps one invariant everywhere.
**Implications:**
- New fan-out callers must use `getRouteRequestAudienceIds` (never raw `getFollowerIds`) for request-type notifications; tuning is admin-side (mode/cap), not code.
- New composer restore paths must preserve the 1-step → pad rule and unconditional field resets.
**Supersedes:** None (extends the Sprint 59/60 request-visibility decisions).
**Superseded by:** None

**Decision:** (1) Route-request fan-out is optimistically location-aware: an ephemeral request fix (`requestLat/requestLng`, cached-only client attach or request start coords, never persisted/logged/exposed) is tested server-side against stored nullable `lastKnownLat/Lng` via in-memory haversine; nearby-only delivery applies only when `nearby >= location.minNearby` (default 3) inside `location.radiusKm` (default 50) — otherwise the Sprint 62 full community audience fires unchanged. (2) Per-user notification preferences gate delivery centrally in `createNotification` (all types): 13 keys, all-true defaults = current behaviour, missing row / NULL / partial JSON = opted-in, so existing users are unaffected until they toggle the gear modal on the Notifications page.
**Reason:**
Ephemeral request location + already-collected feed-boost fix gives nearby relevance with zero new tracking, zero new PII, and zero coordinate exposure; the minNearby gate guarantees sparse-data areas degrade to "everyone gets notified" rather than silence. Central prefs filtering (fail-open, never-throw) keeps every present and future fan-out caller consistent without per-callsite branches.
**Alternatives Considered:**
- **Persisting request/recipient precise locations for targeting**: Rejected — privacy/regulatory risk (the PM's own concern) plus stale-fix inaccuracy; ephemeral compute + existing nullable fix is sufficient.
- **Nearby-first ranking of the full audience (no filtering)**: Rejected as the only behaviour — ranking alone is not "filtering" as directed; the minNearby-gated subset IS the filter, with the full audience as the documented fallback.
- **Per-type boolean columns on User**: Rejected — schema churn per future type; a single nullable Json row with config-driven normalize/validate extends without migrations.
**Implications:**
- New fan-out callers pass `{ requestLat, requestLng }` where a request location exists and rely on the service fallback otherwise; never persist the fix.
- New notification types must add a key (or map to an existing one) in `NOTIFICATION_TYPE_TO_PREFERENCE_KEY`; unmapped types fail open (delivered).
- Prefs-gated push follows automatically (same recipient list drives `fanOutPush`); email-channel prefs remain future work.
**Supersedes:** None (extends the Sprint 62 community-audience decision).
**Superseded by:** None

**Decision:** (1) Post-card textual body navigates to detail: `POST_ACTIONS_CONFIG.detailTextLinksEnabled` (+ token link classes) drives PostCard description + route-step text Links to the encoded `postPath`; tags + mini-map keep their own actions and are never wrapped. (2) Response linkage is explicitly dismissible: `SHARE_ROUTE_MODAL_CONFIG.responseBannerDismissLabel/Title` + optional `ShareRouteModal.onClearResponse` — the banner X unlinks the request without closing the modal and without touching user input; edit-mode linkage stays immutable (no X). (3) Vehicle light-theme labels deepen `-800` → `-900` on the existing `-100` washes (dark variants untouched).
**Reason:**
Whole-body text navigation matches user expectation (title-only links read as broken); an inescapable response mode forced modal-close to change intent, risking drafted work — dismissal preserves input while freeing the composer for another post/draft. Darkening text (rather than reworking washes/borders) was the directive's suggested minimal fix and maximises contrast against both badge wash and card surface.
**Alternatives Considered:**
- **Wrapping the entire card in a link**: Rejected — action buttons, tag links, map interactions and the lightbox inside the card would become nested-interactive violations.
- **Clearing title/tags on dismiss**: Rejected — destructive to user input; only linkage drops, and post-dismiss drafts simply carry no linkage.
- **Reworking badge backgrounds/borders for contrast**: Rejected as over-broad — the Sprint 61 wash/border system already works; the residual gap was label grade only.
**Supersedes:** None (extends the Sprint 61 visibility decision: `-100` wash + border system kept, label grade `-800` → `-900`).
**Superseded by:** None

**Decision:** (1) The navigation map is a second viewport onto the SAME route data, not a second route: `LiveNavigationModal.trafficOverride` receives the post detail page's single traffic result and forwards it as the inner map's `trafficOverride` (trace polyline was already shared) — one lookup, identical colors, zero re-retrieval; omission preserves legacy self-fetch. (2) Expanded map layers above the live modal (`MAP_EXPAND_CONFIG` z-[70] over the modal's z-[60]) rather than disabling Expand inside the guide; `RouteMap.expandable` (default true) exists for future full-container callers. (3) Tracing tooltips are depth-graded by rate cost: `mapTooltips.ts` registry + `RouteMap.tooltipMode` auto|detailed|mini (auto follows `showTraffic`) — detailed stretch tooltips (level + per-stretch ETA via level delayFactor + distance share + live/estimated note) on traffic-bearing maps, mini quick-link tooltips (post title + View-post/Navigate links, zero fetches) on feed cards; taps resolve via an invisible wide hit line + `interactiveLayerIds` (clicked traffic layer → nearest chunk → stretch marker), never throwing.
**Reason:**
Duplicate traffic lookups double upstream cost and let the two surfaces disagree mid-refetch; a shared object converges both. The "vanishing" expansion was pure layering (z-50 dialog behind a z-60 modal), so layering — not removal — is the minimal fix. Feed cards intentionally skip per-card traffic (fan-out), so their tooltip must link out rather than fetch; per-stretch ETA reuses the server's own delay factors so the slice always agrees with the shown total.
**Alternatives Considered:**
- **Disabling Expand inside the live modal**: Rejected — the directive asked for expansion to work, and the modal map is not always maximized (mobile shows 38% map); layering fixes all cases with one token change.
- **Mini tooltips fetching on demand**: Rejected — tap-to-fetch per card reintroduces the fan-out the `showTraffic={false}` policy was built to prevent; the quick links route users to surfaces that already hold the data.
- **Per-stretch server round-trip for ETA**: Rejected — the client already holds base duration + level factors; a new endpoint would add latency, cost, and a second source of truth for the same number.
**Supersedes:** None (extends the Sprint 58 traffic-overlay decision: provider chain + legend kept, surfaces now share one result; extends the 2026-10-11 expansion-containment decision: contained dialog kept, z raised above the live modal).
**Superseded by:** None

**Decision:** (1) A "stretch" is the route leg between consecutive stops (origin→stop→destination), not a traffic chunk: `mapTooltips.ts` leg helpers (`pinBordersOnRoute` monotonic borders on the snapped trace → `legIndexForCoord`/`legBounds`) resolve each tap to its leg; the leg's traffic is the worst overlapping chunk and its time/distance are polyline-length shares of the route totals — so a 4-leg post yields four distinct tooltips. (2) Stretch cards anchor AT the tap (`lngLat`, not the segment midpoint) with "Stretch N of M" + "A → B" labels, so the card is always where the finger landed. (3) Every summary bar funnels through `mapSummary.ts` guards — `shouldShowTrafficAdjusted` requires finite + positive + different base/adjusted (a loading `0` never renders "0 min with traffic"), per-chip `isValid*` hides independently, `totalFareForSteps` (destination excluded) is the single fare total for composer preview + detail overlay + guide header, and the live guide shows remaining (not total) adjusted-vs-base plus remaining-km that shrink as the user advances.
**Reason:**
Chunk shares are equal by construction (≤12 even slices), so chunk tooltips converge to the same numbers on multi-leg posts; only leg resolution varies with the stops the user actually tapped. Midpoints of long highway legs sit far from the tap, forcing the reported hunt — tap-anchoring removes the search. The "0 min" flash was a loading-state leak (hook keeps last-good `null` → service `adjusted 0` vs base 66 passes a naive `!==` check); positivity + finiteness closes it without touching the fetch pipeline. Remaining (not total) is the honest live figure once navigation has started.
**Alternatives Considered:**
- **Per-leg server round-trip for leg ETA/distance**: Rejected — the client already holds the snapped polyline (length shares), the base duration, and the level delay factors; a new endpoint adds latency/cost and a second source of truth.
- **Hiding the whole bar while traffic loads**: Rejected — distance/fare are already known; only the traffic suffix waits, so per-chip guards keep the bar useful during retrieval.
- **Midpoint anchoring with auto-pan**: Rejected — panning the map to a distant midpoint disorients the user; rendering where they tapped needs no camera move.
**Supersedes:** Extends the Sprint 68 tooltip decision (chunk → leg resolution, midpoint → tap anchor; registry kept, helpers added).
**Superseded by:** None

## Sprint 70 decisions (2026-10-16)

**Decision:** Journey totals render as a range (free-flow base – with-traffic adjusted) and per-stretch times split from those same bounds via largest-remainder apportionment, so stretches sum to the header by construction. Geometry-scoped traffic cache keys (pins+vehicle, never base) with `rebaseTrafficResult` rescaling minutes locally — a base change (pins estimate → road-snapped trace) never triggers a redundant rate-limited lookup.
**Decision:** Traffic client freshness = 300s fresh + 600s stale-while-revalidate + 120s background refresh while mounted, over the hourly server bucket. "Somewhat live" without hammering the maps rate-limit bucket; revisits within seconds render the last good overlay instantly.
