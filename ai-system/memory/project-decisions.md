# Project Decisions

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-20 (Sprint 83: platform tour enhancements)
> - last-verified-against-code: 2026-10-20 (Sprint 83 in-runner QA: tsc 0, jest 116/116 suites 1221/1221, build clean)
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

## Journey Estimates Model Local Conditions in Config, Applied Exactly Once

**Decision:** Treat routing-provider (OSRM/ORS/Mapbox) durations as free-flow car ETAs. Convert them to display estimates through per-vehicle config: a `providerCalibration` multiplier, plus `boardingWaitMins` + `perStopDwellMins × intermediateStops` + one `checkpointDelayMins` toll/agbero allowance, hard-capped by `maxOverheadMins`. Modes whose durations must be re-derived from distance (trekking/bike/boat/train) keep using their own average speed. The overhead is applied by `resolveJourneyDuration` exactly once; the distance-based fallback is already complete and is returned unchanged.
**Date:** 2026-10-21
**Made by:** AI agent (execute-feature Sprint 84)
**Supersedes:** None (extends the Sprint 67 journey-time registry)
**Superseded by:** None

**Reason:** Provider ETAs assume ideal car flow and omit boarding, pick-ups/drop-offs and Nigerian toll/roadside-levy time, so posted journeys read unrealistically short. Centralizing the adjustments keeps every caller (composer preview, post detail, trace fallbacks) consistent and tunable without touching UI code.

**Alternatives Considered:** Inline padding in each call site (rejected: drift/double-counting); adding traffic delay into the stored estimate (rejected: traffic remains a separate live overlay with its own sensitivity and range); a schema migration to store overhead components (rejected: the resolved `estimatedMins` is sufficient for display/fallback).

**Implications:** Any new duration call site must pass `intermediateStops` when known and must not add its own overhead. New vehicles need all four meta fields (defaults fall back to the bus profile). Distance-derived and provider-derived paths must stay visibly distinct to avoid double-counting.

## Viewport-Safe, Measured Tour Cards (Explicit Width; Flip/Clamp; Scroll Last)

**Decision:** Tour cards use a measured, explicit width from config (`tooltipMaxWidthPx`) capped by the viewport, and a pure `resolveTourTooltipLayout` chooses a placement that fits the safe viewport (requested → opposite → other sides → clamp). Height comes from the rendered card; `tooltipMaxHeightRatio` caps it and the card scrolls internally as a last resort. Welcome/end/offline cards share the same centering + caps.
**Date:** 2026-10-21
**Made by:** AI agent (execute-feature Sprint 84)
**Supersedes:** None (hardens the Sprint 82/83 tour tooltip placement)
**Superseded by:** None

**Reason:** `maxWidth` alone let short copy shrink the card and long copy grow past the viewport; bottom-anchored placement could render the action row off-screen. Measuring the real card and fitting before rendering keeps Next/Finish reachable on small screens.

**Alternatives Considered:** CSS-only `max-height` without measurement (rejected: bottom/right placements still overflow); fixed top/bottom anchoring (rejected: targets near edges clip); forcing centered modals for every step (rejected: loses spotlight context).

**Implications:** Tour display tuning is config-only. Any new overlay card in the tour must attach the shared ref/measurement effect (or use the helper) rather than computing `top/left` inline. Layout tests cover width stability, flips, clamping and centering.

## Supabase as Primary PostgreSQL; Prisma Endpoint Retained as Offsite Mirror

**Decision:** Keep Prisma ORM, move the application database to Supabase, use
`DATABASE_URL` for runtime pooling and `DIRECT_URL` for migrations and transfer
loads, and retain `PREVIOUS_DIRECT_URL` as a manually operated offsite mirror.
`PREVIOUS_DATABASE_URL` may remain for Prisma Accelerate compatibility but is not
a SQL endpoint for `pg`-based backup tooling.
**Date:** 2026-10-17
**Made by:** AI agent (execute-feature resume)
**Supersedes:** [Prisma 7 Client Construction](#prisma-7-client-construction) for the production connection preference
**Superseded by:** None

**Reason:** Prisma Postgres usage limits caused service disruptions; Supabase
provides the primary PostgreSQL capacity while the retained Prisma database
provides a second recovery location until managed backups are available.

**Alternatives Considered:** Removing the legacy database immediately was
rejected because it removes rollback and offsite recovery; using the Accelerate
URL in `pg` was rejected because it is not a SQL socket.

**Implications:** Development aliases must be updated to Supabase by operators;
the transfer scripts warn when they still resolve to Prisma. Non-empty loads
require explicit replacement consent and a verified safety snapshot.

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

## Universal Component Library (App\* Wrappers)

**Decision:** Wrap all Ant Design components in App\* (AppButton, AppCard, etc.) wrappers and prohibit direct Ant Design imports outside `app/components/ui/`.
**Date:** 2026-06-02
**Made by:** Project team
**Supersedes:** None
**Superseded by:** None

**Reason:**
Direct Ant Design usage creates tight coupling to the library, making future UI library swaps expensive. App\* wrappers provide a consistent API surface, enforce project-specific styling defaults, and make it easy to add cross-cutting concerns (loading states, analytics tracking, accessibility) in one place.

**Alternatives Considered:**

- **Direct Ant Design usage everywhere**: Faster initial development, but tight library coupling
- **Custom CSS-only components**: Too much reinvention for a component library as comprehensive as Ant D
- **ThemeProvider-only approach**: Doesn't prevent direct imports or enforce consistent patterns

**Implications:**

- All UI code must go through App\* wrappers
- Adding a new Ant Design component requires creating an App\* wrapper first
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
Two silent-failure classes shared one shape: code that _looked_ correct but never fired — lowercase `"admin"` comparisons against an uppercase enum hid every admin entry point, and a Sentry-only `global-error` claimed notification in environments where no DSN delivers. Centralising the role rule in config and tying boundary copy to the actual POST result makes both claims verifiable.

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

## Decision 2026-10-17 (Sprint 71): offline Plus Codes + paren coords + round-2 numeric-address recall

**Context:** users paste coordinates with parentheses from map apps, share Plus Codes (Open Location Codes) that free keyless providers do not resolve, and type house-numbered addresses that the fast index providers miss.
**Decision:** (1) `parseCoordinateQuery` accepts optional `()`/`[]` wrappers. (2) Plus Codes are decoded offline via a port of google/open-location-code (Apache-2.0) in `locationSuggestions.ts` — full codes pin without a reference; short codes recover against viewer `near` only (no hemisphere guessing); provider name `plus-codes`. (3) `geocodeForward` optionally reverse-geocodes coordinate/plus-code pins in parallel for a human label (raw pin stays first; failure silent). (4) House-numbered queries get a round-2-only fallback (merge-empty gate): strip leading number → retry fast providers + Overpass `addr:housenumber`/`addr:street` scan. All config-driven (`numericAddressFallback`, placeholder/empty-state copy); client never hits upstreams.
**Reason:**
Nominatim/Photon explicitly do not support plus codes (upstream issues closed/out-of-scope) — local decode is the correct keyless approach, not a new provider. Parentheses are common paste artefacts. Reverse enrichment costs nothing on the happy path (parallel race). Numeric-address recall is gated so the hot path latency contract (parallel fan-out + one fallback batch) is unchanged.
**Alternatives Considered:**

- **Upstream plus-code lookup**: Rejected — no keyless free provider supports it.
- **Always reverse-geocode coordinates (sequential)**: Rejected — would add latency to the coordinate fast-path; parallel + silent-failure keeps the pin-first contract.
- **Round-1 numeric-address strip**: Rejected — would fire extra provider legs on every house-number keystroke; merge-empty gate preserves the Sprint 50 latency budget.
  **Implications:**
- New exact-intent classes (coords, plus codes) pin via the same `pinned` Set in `geocodeForward` — future intent providers add one name + one pin builder.
- OLC helpers are pure/config-free and unit-tested against official vectors — safe to reuse for share/encode later.
- Clients must keep using `LOCATION_SUGGESTIONS_CONFIG.locationPlaceholder` / `locationEmptyStateHint` — no hardcoded "Search location..." strings.
  **Supersedes:** None (extends the Sprint 50/13 merged-geocode + coordinate fast-path decisions).
  **Superseded by:** Sprint 72 (2026-10-17) — PARTIAL: decision (3)'s "raw pin stays first" ordering is superseded by label-first pinning (same exact coords, friendly label becomes THE hit, raw text only when the label fails); items (1), (2), (4) and the OLC/pin-set machinery stand unchanged.

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

## Sprint 72 decisions (2026-10-17)

**Decision:** (1) Friendly label-first pinning: `geocodeForward` keeps the EXACT coordinate/plus-code pin but promotes the reverse-geocode (or canonical plus-code) label to THE hit — raw query text survives only when the label fails; addresses keep full `display_name` (never shortened). (2) Plus-code locality queries split into `{code, remainder}` (`extractPlusCodeToken`, legacy whole-query classification first) — the remainder geocodes as a bounded short-code reference in the SAME stage-1 batch AND as a plain locality in round 1 (`plusCodeLocalityFallback`), so suggestions surface even when the pin fails. (3) Tap-to-assign is armed only by explicit `pickOptions`+`onPickOption`: empty-area taps open the card, route-line taps keep the Sprint 68/69 stretch/mini tooltips, and `focusRequest` (nonce-gated) is the ONE camera owner that bypasses the baseline-fit deferral; picked points get a reverse label under a supersede guard so text and pin can never disagree. (4) Vehicle traces: non-default profiles run a mode-aware pass (keyed ORS/Mapbox walking/cycling; keyless OSRM demo driving-only → skipped) then fall through the BYTE-IDENTICAL legacy driving chain; `routingProfileSlug` suffixes cache keys only for non-default profiles (all-null boat/train profiles count as default — same chain, same key), so existing driving traces never invalidate. (5) Baseline recentering defers behind interaction: the fit effect depends on `followActive` boolean (never per-fix `userLocation` identity) and queues through a token-guarded idle watcher keyed off container pointer/wheel/key activity (`MAP_VIEW_CONFIG.recenterIdleDelayMs` 3000 / `interactionPollMs` 250); expand-resize and Find-on-map focus flyTos bypass by design.
**Reason:**
Users paste coords/plus codes but think in place names — a readable label that matches the pin is the product, and Sprint 71's raw-first ordering was a sequencing safety net, not a UX goal (failure still falls back to raw text, so nothing is lost). Splitting the remainder into reference + locality queries covers both failure modes upstreams actually have (short codes need a reference; localities need a normal geocode). Arming the picker only when the preview passes options keeps every other RouteMap's tap contract byte-for-byte intact while still delivering the directive's flow. Driving-only demos would otherwise turn walking/bike routes into driving-shaped or straight lines; the mode pass only ever adds attempts and the legacy chain is the guaranteed floor. GPS-tick refits were the confirmed post-detail pan-yank; a boolean dep fixes the trigger and the idle watcher fixes the collateral bounds-change case, while explicit user requests (expand, focus) must never wait.
**Alternatives Considered:**

- **Appending the friendly label after the raw pin (Sprint 71 order)**: Rejected — the directive wants the friendly name as THE displayed intent; coords remain the machine pin either way.
- **Always-on pick mode on every map**: Rejected — feed-card/detail tap contracts (stretch/mini tooltips) would regress; explicit arming is additive.
- **Mode pass falling straight to straight-line on failure**: Rejected — the directive explicitly contrasts "legacy driving fallback" against an outright straight line; the driving chain stays the floor.
- **Dep-guarding only (no idle watcher)**: Rejected — bounds/pins can change mid-pan (trace arrival, edits); without deferral those refits still yank the camera.
  **Supersedes:** PARTIAL — Sprint 71 decision (3) "raw pin stays first" (see its Superseded-by link); extends the Sprint 68/69 tooltip decisions (line taps unchanged) and the Sprint 58/67 traffic/vehicle registry decisions (profiles live beside speeds, not inside them).
  **Superseded by:** None

## Sprint 75 decisions (2026-10-18)

**Decision:** (1) Post-maintenance recovery is a USER-TRIGGERED strip button (`safeClientRefresh`), never an auto-reload — no surprise unloads; the existing SW update prompt keeps handling automatic worker updates. (2) Storage clearing uses a protected-key WHITELIST (`SAFE_REFRESH_CONFIG`: exact drafts/`along-auth-snapshot`/theme/locale/push/PWA/consent keys + `along-locale-cache` prefix; sessionStorage fully cleared): everything not listed is disposable cache so unknown future cache-y keys still clear, while session/drafts/prefs are positively protected; cookies are never touched; every step is fail-open and the reload is cache-busted (`?_fresh=<ts>`) so the fresh client actually wins. (3) Announcement CTA hrefs restricted to same-origin `/…` (never `//protocol-relative`) or absolute `https://…` — kills javascript:/data:/http-open-redirect vectors; CTA renders only when BOTH label and href normalize non-empty; external links `target=_blank rel="noopener noreferrer"`. (4) Server tag cap REJECTS over-limit input (Zod max count 10 + per-tag 30, trims + strips leading `#`) rather than silently slicing — client toasts already explain the limit, so silent truncation would desync user intent. (5) Unified tag limits live in ONE config module (`ROUTE_TAG_CONFIG`) consumed by both modals, the placeholder copy, toasts, the drafts sanitizer, and the schema — limits stay config-driven, not hard-coded at call sites. (6) Dark warning surfaces get an OPAQUE token (`--color-warning-surface`) rather than alpha compositing — identical result across light/dark without per-theme rgba math.
**Reason:**
A "maintenance over" notice that strands users on stale cached code is worse than no notice; the refresh must be safe enough to recommend from a banner (drafts + signed-in session survive) yet thorough enough to actually retire old caches/worker. Announcements are public content — href allow-listing is the minimum XSS/open-redirect posture. Centralizing tag limits keeps client, server, drafts, and copy in lockstep (the pre-sprint divergence — Share 10 silent vs Request 5 Enter-only — was exactly this missing module).
**Alternatives Considered:**

- **Auto-reload on config flip**: Rejected — yanks the user mid-interaction; a button makes refresh explicit and opt-in.
- **Clear-all storage (no whitelist)**: Rejected — destroys drafts and the offline auth snapshot (explicitly forbidden by the directive).
- **Confirm() dialog before refresh**: Rejected — the strip itself is the confirmation; an extra modal adds friction for a reversible action (refresh is always safe now).
- **Allow any http(s) href on CTAs**: Rejected — http downgrade + arbitrary hosts widen the open-redirect/XSS surface for admin-authored but user-rendered links.
- **Silent server-side tag slicing**: Rejected — user sees a tag they typed; silent drop looks like a bug.
- **Leave request-form cap at 5**: Rejected — directive requires unified 10/30; loosening is non-breaking.
  **Supersedes:** None — extends the Sprint 52 admin config registry decisions (validators + shipped defaults backfill) and Sprint 18 maintenance-strip decisions (opaque surfaces over translucent washes).
  **Superseded by:** None

## Sprint 76 decisions (2026-10-18)

**Decision:** (1) The refresh-notice once-flag is a preserve-whitelisted localStorage timestamp (`along-safe-refresh-done-at`, written by `safeClientRefresh` itself at sequence start, 7-day TTL via `isSafeRefreshCompleted`) — suppressed strip while fresh, fail-open visible on missing/garbage/expired values. (2) The 7-day TTL (not indefinite) mirrors the push-prompt dismiss window and bounds staleness so a future admin cycle can re-prompt; the always-rendered catch-all note ("Already refreshed or updated? You can ignore this notice.") covers every in-between case (manual browser refreshes, private-mode storage loss, TTL expiry while the toggle is still on). (3) The flag is recorded inside `safeClientRefresh` (not the strip's onClick) so completion is part of the refresh contract and any future caller records it for free. (4) No dismiss (X) button was added to the refresh strip — the directive asked specifically for the flag + text catch-all, and the strip remains admin-controlled urgency; the once-flag alone removes the repeat-nag for everyone who acts.
**Reason:**
The Sprint 75 strip reappeared on every page load after a successful refresh because the only controlling signal was the admin SiteConfig boolean — a still-enabled toggle kept nagging already-up-to-date users. A local flag is the only mechanism that works offline/for guests without server state; the TTL + catch-all copy together cover the full edge matrix without any migration or admin-surface change.
**Alternatives Considered:**

- **Indefinite suppression (no TTL)**: Rejected — a forgotten admin toggle could never re-prompt after major future deploys; 7 days bounds staleness while still killing the repeat-nag.
- **Server-side "refreshed at" field per user**: Rejected — heavier (schema + API), doesn't cover guests, and adds nothing the local flag doesn't (the strip is per-browser, not per-account).
- **Detecting admin toggle off→on transitions to re-prompt**: Rejected — requires preserving a second state key through the storage clear and adds cycle-tracking complexity; the TTL achieves the same re-prompt capability far more simply.
- **Dismiss (X) button as the catch-all**: Rejected — directive explicitly asked for text; a dismiss would let users hide the strip without refreshing, undermining the admin's intent.
  **Supersedes:** None — extends the Sprint 75 safe-refresh/protected-key decisions and the Sprint 27/46/49 local dismiss-flag + TTL pattern (push/PWA/install prompts).
  **Superseded by:** None

## Sprint 77 decisions (2026-10-18)

**Decision:** (1) The runtime PrismaClient resolves the TRANSACTION-mode pooler FIRST (prod: `DATABASE_URL → DIRECT_URL → …`; dev: `LOCAL_DB → DIRECT_LOCAL_DB → …`); the Prisma CLI (`prisma.config.ts`) intentionally stays DIRECT-first because DDL/migrations need session continuity — the two consumers have opposite needs and now encode them explicitly. (2) Per-instance pool is config-driven and SMALL (`DB_POOL_CONFIG.defaultMax` 5, `DB_POOL_MAX` override clamped 1–20): on serverless, transaction-mode multiplexing makes local connection count overhead, not throughput — Supabase guidance is 1–5. (3) `prepare: false` is set on the pg adapter IFF the resolved URL is transaction-mode (port 6543 or `pgbouncer=` flag) — Supavisor transaction mode rejects prepared statements and the `?pgbouncer=true` URL param is a classic-engine switch the pg driver ignores. Session-mode/direct URLs keep prepared statements. (4) The Prisma singleton is cached on `globalThis` in EVERY environment — a second module copy (route-split chunks, dual ESM/CJS evaluation) opens a second pg pool, which is the same EMAXCONNSESSION class at smaller scale. (5) A one-time production `console.warn` fires when the runtime still resolves a session-mode pooler URL (mis-set Vercel var detection) — observability only, never control flow. (6) Vector styles are served through a same-origin sanitized proxy (`/api/maps/style?name=`, whitelisted names, Redis read-through 86400s); the sanitizer coalesce-wraps ONLY numeric props whose expression tree reads feature data (`get`/`has`/`feature-state`/`id`) with config fallbacks — static values, zoom-only expressions, and already-coalesced values are untouched, so the transform is idempotent and cannot change how valid features render. Raster fallback ladder unchanged.
**Reason:**
The Sprint 76→77 production 500s (`DriverAdapterError EMAXCONNSESSION max clients reached in session mode - max clients are limited to pool_size: 15`) traced to `resolveDatabaseUrl()` preferring `DIRECT_URL` (session mode, 15-client cap) over `DATABASE_URL` (transaction mode) while pg opened `max: 10` per warm instance — N×10 ≫ 15 under any concurrency. The CLI must keep session continuity for migrations, so the fix is per-consumer precedence, not one global order. `prepare: false` is mandatory against transaction-mode Supavisor (prepared statements break there); detecting it from the URL keeps direct/session URLs fully compatible. The MapLibre null-type warning (maplibre-gl-js#7856) is a data-driven-expression artifact — hardening at the style-serve boundary silences it for every renderer at once without forking styles.
**Alternatives Considered:**

- **Keep DIRECT-first runtime, raise Supabase Pool Size**: Rejected — the cap exists to protect the DB; scaling it up per lambda instance is an unbounded client-multiplier and still serializes session mode badly.
- **`allowPretend`/PgBouncer workaround flags or `?pgbouncer=true` reliance alone**: Rejected — the param is ignored by the pg driver; an explicit `prepare: false` (URL-detected) is the only reliable switch.
- **Per-query PrismaClient (no pool)**: Rejected — connection setup per query multiplies latency and still counts against the pooler cap.
- **Fork OpenFreeMap styles to coalesce-wrap inline**: Rejected — styles are upstream assets; wrapping at serve time keeps one source of truth and survives upstream style updates.
- **Browser-direct styles + upstream tracking only**: Rejected — the warning class is user-visible noise on every map; the proxy additionally removes browser→OpenFreeMap availability coupling for the style document.
  **Supersedes:** PARTIAL — the implicit "DIRECT-first runtime" behavior (never a recorded decision; documented contract in `.env.example` always said DATABASE_URL is the runtime URL — the code disagreed with the docs). Extends the Sprint 73 Supabase-transfer decisions (two-pooler contract).
  **Superseded by:** None

## Sprint 79 decisions (2026-10-18)

**Decision:** (1) Deprecated config keys live in a first-class `ADMIN_DEPRECATED_CONFIG_KEYS` list folded into `ADMIN_DEDICATED_CONFIG_KEYS` — they keep their shipped default + validator + API field for stored-value back-compat but have NO admin editor anywhere (simple cards, studio links, or raw JSON list). The legacy `announcementBanner` key is the first member; its `SiteNotices` strip render was removed outright (directive confirmed no admin ever set it in production). (2) Stale-chunk failures (`ChunkLoadError` and dynamic-import cousins) get ONE automatic `location.reload()` per browser session from the error boundaries, driven by a config block (`ERROR_REPORTING_CONFIG.chunkLoad`: patterns, sessionStorage once-flag key, recovering/toast copy); a second match in the same session falls through to the normal report flow — the guard lives in sessionStorage (per-tab-session, private-mode safe) precisely so a persistently broken deploy can never reload-loop. (3) Automatic error-boundary reports carry a stable timestamp-free idempotency key (`eb:` + double FNV-1a of title|path|digest) in BOTH the `x-idempotency-key` header and body `clientToken`; the server dedup pre-read matches idempotency key OR the same error identity (title + `metadata.path` + `metadata.digest`, null-digest equality included) OR the exact description — always scoped to `reporterId ?? null` so two different users (or a user vs an anonymous visitor) can never collapse onto each other's rows. (4) Admin status-change notes are PREFILLED with the status default copy in the action modal; switching status re-prefills only when the textarea is empty or still holds the previous default verbatim; the server-side whitespace-empty → default fallback remains the authoritative legacy behavior (the prefilled default being sent explicitly is semantically identical).
**Reason:**
The rich `announcements` list superseded the single-string banner but the old card lingered in the admin UI causing confusion; a formal deprecation list keeps the pattern reusable for future key retirements without breaking stored rows or the public site-config shape. The reported `/login` ChunkLoadError was a stale-tab-after-deploy class where the user fix is a hard refresh — automating exactly one refresh removes the support burden without trading it for reload loops. The duplicate admin bug rows from ONE email report came from error-boundary double-fires whose descriptions each embed a fresh `When:` timestamp, so content-only dedup can never catch them — a timestamp-free identity key does, and reporter scoping prevents the anonymous cross-user collapse the old unscoped query allowed. Note prefill removes admin guesswork about what the reporter will receive while preserving the blank-box contract.
**Alternatives Considered:**

- **Fully delete `announcementBanner` (defaults/validator/API)**: Rejected — stored SiteConfig rows and the public endpoint shape would change; a deprecated-but-registered key is zero-risk and self-documenting.
- **Keep rendering the legacy strip (hide only the editor)**: Rejected — leaves dead product surface for a value that has never been set; directive said "actually deprecated".
- **Reload-loop protection via localStorage timestamp instead of sessionStorage**: Rejected — localStorage survives tab close, so a user who closes and reopens would be permanently denied the recovery; sessionStorage matches the "once per session" intent.
- **Content-hash the full description for the idempotency key**: Rejected — the description intentionally contains a fresh timestamp; hashing it would reproduce the exact dedup failure being fixed.
- **Unique DB constraint / migration for true create-race ACID**: Deferred — no migration appetite for this class; the tightened pre-read + idempotency key closes the reported double-fire path, and a schema-level unique expression index remains a future option.
  **Supersedes:** None — supersedes the implicit Sprint 75 note "legacy announcementBanner still renders as its own strip (non-breaking)" (now deprecated, render removed; the back-compat surface is the API field + validator only).
  **Superseded by:** None

## Sprint 80 decisions (2026-10-19)

**Decision:** (1) Duplicate-proof report writes use a per-reporter Postgres advisory lock (`pg_advisory_xact_lock(hashtextextended('bug-report:<reporterId|anon>', 0))`) INSIDE one `prisma.$transaction` — dedup-read, assignee resolution, and insert are serialised per reporter, so two concurrent submissions of one error can never both insert; two different reporters never serialise against each other (lock key is per-reporter, not global). The lock is BEST-EFFORT: `acquireBugReportDedupLock` swallows errors — a lock failure must never fail the user's report (the tx still runs, just without serialisation). Assignee is resolved ONCE before the tx and written in the INSERT (no nested pool use, no unassigned window, no separate update). (2) The dedup matcher order is idempotency key > error identity (`metadata.path` + digest, TITLE NOT REQUIRED) > exact description; requiring a title on identity matches was silently defeating dedup because boundary reports often share path/digest with differing titles. Unassigned duplicates self-heal by assigning the single algorithmic admin (heal-only fan-out — never a second notification). (3) `Notification.metadata` is a nullable JSON column exposed as-is by `/api/notifications`; `resolveNotificationRoute` routes REPORT/MODERATION with `metadata.bugId` to `/admin/bugs?highlight=<id>` and falls back to the legacy target when `bugId` is absent — so `bugId` is attached ONLY to assignee pings; reporter-facing receipts/status/moderation rows intentionally carry NO bugId because non-admins would bounce to an admin-only page. (4) Admin email CTA uses a path-only `reportLink` variable (`/admin/bugs?highlight=<id>`) rendered as `{{appUrl}}{{reportLink}}` — a full absolute URL stored in the template body could not be protected by `sanitizeStoredBody`'s URL allowlist, whereas the path-only var keeps the composed href safe. (5) Stored SiteConfig `emailTemplates` rows continue to win per-name over `DEFAULT_EMAIL_TEMPLATES` (precedence unchanged) — the new CTA therefore appears on an existing DB only after an Email Studio re-save or `db:seed`; documented as residual rather than changing precedence, which would silently overwrite admin-customised templates. (6) Auth session persistence is configuration-driven from a new `app/lib/config/authSession.ts` (access 1h/7d, refresh 7d/30d, cookie maxAges, OAuth prompt/handshake, middleware grace toggle, client revalidate/backoff cadence) — legacy numbers preserved so the fix changes WHO observes the TTLs (refresh JWT `rm` claim, middleware grace) rather than the TTLs themselves; legacy refresh tokens WITHOUT the `rm` claim keep their refresh-cookie lifetime via `includeRefresh:false` (never silently downgraded). (7) Middleware refresh-grace forwards the re-issued access token DOWNSTREAM on the request (`NextResponse.next({ request: { headers } })`) — a `Set-Cookie` header on the response only reaches the browser AFTER the response, so without forwarding the current request would still see the expired token. (8) Refresh calls got their own `authRefresh` rate bucket (45/15min) instead of sharing the auth bucket — refresh fires far more often than login/OTP and could otherwise starve them (or vice versa), and AuthProvider treats 429 as transient: session kept, exponential-backoff retry (2^n capped 300s, server `Retry-After` honored, counter reset on success). (9) Google OAuth in installed PWAs forces `prompt=select_account` (account chooser) with remember-me carried through the httpOnly `oauth_session_prefs` handshake cookie and consumed at every token-issuance exit via `redirectWithPrefsCleanup` (307 — never a 302 that could drop the Set-Cookie) — query params alone can't survive the OAuth round-trip, and browsers appeared to work only because their own Google session/chooser cookies were present.
**Reason:**
The reported "bug assigned to multiple admins" symptom was duplicate BugReport rows for one issue: the pre-existing dedup was a non-transactional read-then-write, so two concurrent submits both missed the read and both inserted, each auto-assigning a different admin (the single `reviewerId` column makes true multi-assignment impossible — the race creates the duplicates). ACID comments on the code had described intent, not behavior. The notification deep link must reach admins on both in-app and push paths (both funnel through `resolveNotificationRoute`) while never leaking an admin-only destination to reporters. The session expiry class (PWA, remember-me, Google) came from three compounding gaps: remember-me not reaching the refresh JWT, refresh sharing a rate bucket that could 429 it into a permanent re-login loop, and middleware redirecting whenever the access token was expired even though a valid refresh token existed.
**Alternatives Considered:**

- **Global advisory lock (not per-reporter)**: Rejected — unrelated reporters would serialise, adding latency for no correctness gain.
- **Unique DB constraint / expression index on bug reports**: Kept as a future backstop only — the advisory lock closes the reported race without a second migration, and a unique expression over (reporter, identity) would need careful NULL/digest semantics.
- **Fail hard when the lock cannot be acquired**: Rejected — a Redis/DB hiccup would fail the user's report; best-effort locking degrades to today's behavior instead.
- **Attach bugId to ALL REPORT/MODERATION notifications**: Rejected — reporter-facing receipts/status/moderation rows would deep-link non-admins to /admin (403 bounce); assignee-ping-only preserves every existing target for everyone else.
- **Full absolute URL as the email CTA href**: Rejected — `sanitizeStoredBody`'s URL allowlist protects `{{var}}`-bearing hrefs best when the stored template holds a path; composing with `{{appUrl}}` keeps the stored value safe and origin-flexible.
- **Change template precedence so new defaults ship automatically**: Rejected — stored per-name precedence exists to preserve admin customisations; silently overwriting them would be breaking.
- **Server-side remember-me field on the user row / re-prompt at refresh**: Rejected — the refresh JWT already exists on every refresh; carrying one boolean claim is zero-schema and works offline.
- **Drop the access token only (no grace) and redirect harder**: Rejected — the redirect IS the reported bug (PWA users bounced to /login with a perfectly valid refresh token).
- **AuthProvider: clear session on 429**: Rejected — 429 is transient server pressure, not credential failure; clearing logs the user out exactly when the refresh bucket is hot.
  **Supersedes:** PARTIAL — supersedes the Sprint 79 decision's "Unique DB constraint / migration for true create-race ACID: Deferred" (the advisory-lock transaction now provides the create-race ACID; a unique index remains optional future insurance). Extends the Sprint 79 dedup decisions (idempotency key + reporter scoping kept; title requirement on identity matches dropped as actively harmful).
  **Superseded by:** None

## Sprint 82 decisions (2026-10-20)

**Decision:** (1) The platform tour's step LIST and step CONTENT (copy, routes, selectors, end card, offline notes, mascot alt) live in the shipped code config (`platformTour.ts`) and are NEVER admin-editable; only operational knobs (`enabled`, `autoStart`, `autoStartDelayMs`) are admin-editable via SiteConfig `platformTourConfig` merged FIELD-WISE over the default (a bad stored row degrades field-by-field to safe values; it can rename/disable nothing about steps). The seed ships ONLY the operational subset. (2) The gates that decide visibility live as pure helpers in config modules (not the components): the tour's `coerceStepIndex`/`isLastStep`/`isTourTerminal`/`readTourStateShape`, and the review notice's ordered matrix `shouldShowReviewNotice` — done-flag > dismissal (7-day TTL) > account age (≥3 days) > has-review probe — with the matrix exported so tests exercise the real code, not a copy of it. (3) The review notice's has-review probe (`GET /api/reviews?mine=1`) is best-effort and fails SAFE to hidden: unknown/offline/failed = do not show. (4) The tour's interactive steps WATCH BY ELEMENT (focus/pointerdown/keyup capture on the spotlighted control) rather than intercepting clicks: the app stays fully interactive during the tour, and the wizard merely notices the interaction, confirms, then offers Continue/End. (5) Tour state is a versioned localStorage blob (`along-tour-state-v1`, `v:1` required, unknown version = never resume) so a future step-revision can force a re-walk without a schema; replay goes through a CustomEvent (`TOUR_START_EVENT`) dispatched by a `kind: "action"` profile quick link — no context/provider plumbing. (6) `/api/tour` is guest-accessible and SWR-cacheable (`s-maxage=300 stale-while-revalidate=600`) + registered cacheable in sw.js/PWA prefixes, but the offline DEFAULTS are self-sufficient: a failed config fetch changes nothing (code fallback serves the identical default config), so PWA-offline tour use never depends on the request.
**Reason:**
Admin config keys require a no-code card (design-compliance gate), and step content is UX copy that must evolve with the bundle it targets — selectors like `[aria-label="Share a route"]` MUST match the page version that selector names, so editing them from a DB row bypassing deploys would corrupt the tour for older/other clients. Offline-first: if steps needed a network fetch, the PWA-offline case would need per-step caching logic; shipping defaults makes offline free. Fail-safe gating: nagging a user we cannot vet (unknown review status) is worse than missing a prompt — the notice is an ask, not an alert. Element-watch interactivity keeps one spotlight ring while letting real handlers run (click-interception would double-fire Submit/Explore actions we do not own).
**Alternatives Considered:**

- **Admin-editable steps (JSON card)**: Rejected — designDH-compliance would force a bespoke editor for a high-risk surface (broken selector = invisible scrim or stray highlight), and content-in-DB desyncs from the pages it points at.
- **Vet the account age server-side (a `seenTour`/fields migration)**: Rejected — localStorage versioned state covers tour progress with zero schema; the review age gate uses the auth snapshot's `createdAt` (already shipped by OAuth/credentials flows, no migration).
- **Block page interaction under a full-screen shield during spot steps**: Rejected — trapping navigation breaks "the rest of the app stays usable while on", and the target's own handler is exactly the thing we want to run.
- **Suspend/force the review probe before render (async gate)**: Rejected — mount-delay + fail-closed keeps the first paint cheap and non-flickering; waiting on a network probe before every page load to decide "maybe show a pill" is the wrong trade.
- **TTL-based dismiss in cookies**: Rejected — per-user localStorage blob matches the existing floating-notice pattern (push-prompt, safe-refresh flags) and survives across sessions like cookies do, without cookie consent plumbing.
- **SiteConfig-tunable TTLs (min age / dismiss ttl)**: Deferred — pure constants today; they'd need card + validator surface without an immediate ask; FAQ documents the fixed values.
- **auto-skip silently on missing target**: Rejected as the ONLY path — offline stops on uncached pages get an explicit, honest offline phase (note + Skip-this-stop/End); when online, a missing target after the knob timeout advances politely so the wizard can never strand mid-tour.
  **Supersedes:** None
  **Superseded by:** None

## Sprint 83 decisions (2026-10-20)

**Decision:** (1) **Root-mount the tour, filter by audience.** `PlatformTour` lives in `app/layout.tsx` (not the dashboard layout) and each step declares `audience: "all" | "guest" | "authenticated"`; the component derives the visible list from `useAuth`. Guests therefore get welcome + auth + share + composer + explore steps, and signed-in users get welcome + share + composer + explore + profile + notifications. The guest walkthrough is opt-in through explicit triggers (`TourLaunchButton` on FAQ, footer `actionEvent` link, replay event); auto-start is restricted to `autoStartRoutes` (default `/home`) so public/auth pages never take over first paint. (2) **Persist a step id, not just an index.** `PlatformTourState` gains `stepId`; resume matches the id first, otherwise takes the first still-visible step at/after the stored config index (`resolveTourResumeIndex`). This is what makes the tour survive the full-page reloads of sign-in and registration: the auth stop disappears from a member's list and the tour resumes at share-route instead of skipping or resetting. (3) **Interactive overlays never own the pointer.** The outer scrim is `pointer-events-none`; only tooltip/resume/offline/end cards opt back in with `pointer-events-auto`. Spotlighted controls (share trigger, theme toggle, modal form) remain fully usable. (4) **Resume asks; it does not hijack.** `resume.autoResume` defaults to `false`; an interrupted tour shows a top-center card (Resume / Not now), deliberately outside the bottom-right theme-toggle/toast lane. (5) **Start-timer ownership is a ref.** `bootstrapConfigRef` is set before the config fetch resolves so the effect re-run caused by that resolution cannot cancel the pending auto-start timer. (6) **Config remains backward-compatible.** Every new field (`audience`, `timeoutMs`, `autoStartRoutes`, `guest`, `resume`, state `stepId`) is optional at the stored-row boundary, normalized field-wise over the shipped defaults, and validated at the admin boundary; `/api/tour` needs no change and the seed still stores only `enabled`/`autoStart`/`autoStartDelayMs`.
**Reason:**
A single shipped step list must serve two different audiences without duplicating config or hiding the tour from guests; audience tags + pure filtering keep that testable. Step indexes are unstable across auth transitions (the list shrinks by two), while step ids are stable identities authored next to the content. The reported "pressing share route did nothing" was the transparent full-screen overlay, not the share handler — guided overlays must document that their scrim never owns pointer events. A silent resume after a refresh is surprising and hard to dismiss; an explicit prompt is the non-intrusive contract the directive asked for. The config-fetch race was a lifecycle bug: the auto-start timer belongs to the bootstrap decision, not to an effect that the fetch can retrigger.
**Alternatives Considered:**
- **Keep the dashboard mount and render a second copy on auth pages**: Rejected — two instances share one localStorage blob and can double-render the scrim during navigation; a single root mount with audience filtering is simpler and testable.
- **Store only `stepIndex` and clamp on resume**: Rejected — after registration the index points into a shorter/different list and silently skips the composer journey; a stable `stepId` is the minimum information needed.
- **Make auth steps interactive (wait for sign-in click)**: Rejected — the actual submit navigates/reloads the page; watching for a click cannot survive it, whereas persisted state + first-visible-step resume does.
- **`pointer-events-auto` on the scrim and forward clicks**: Rejected — re-implementing hit-testing/forwarding duplicates the browser and breaks modal stacking; `pointer-events-none` lets the real handlers run.
- **Auto-resume on refresh**: Rejected as default — the directive explicitly asked for non-interference; `resume.autoResume` stays as an opt-in for deployments that prefer the old behavior.
- **Add admin knobs for the new fields**: Rejected — no-code surface has no demonstrated admin need; step content/audience is bundle-coupled like the rest of the step list, and operational `enabled`/`autoStart`/`autoStartDelayMs` remain the admin contract.
  **Supersedes:** PARTIAL — supersedes Sprint 82 decision (4)'s "capture-click detection" wording only insofar as the overlay must be click-through; interactive steps still watch element focus/pointer/key events, but the scrim never intercepts. Extends Sprint 82 decision (1) by moving the mount to the root and adding audience-gated steps; the content-in-code/config-in-SiteConfig split is unchanged.
  **Superseded by:** None
