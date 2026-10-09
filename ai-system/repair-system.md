# Repair System — Error Knowledge Base

> **Metadata**
> - last-updated-by: update-ai-system 2026-10-08
> - last-verified-against-code: 2026-10-08
> - staleness-policy: individual entries may be stale if the code has changed around them — verify fix still applies before reusing

> **Overview:** A living knowledge base of errors encountered during development, their root causes, and how they were fixed. Agents should consult this before diagnosing new errors. Every fixed bug should be logged here to prevent recurrence. This file is pre-populated with known error patterns for the Along tech stack (Next.js 15 + React 19 + Ant Design 5 + Tailwind 4).

---

## How to Use

- **Before debugging:** Search this file for patterns matching the current error
- **After fixing a bug:** Add an entry using the template below
- **If a fix no longer applies:** Mark the entry as `[SUPERSEDED]` and link to the new entry

---

## Error Log

### [TEMPLATE — copy this for each new error]

```
## [Error Title / Short Description]

**Symptom:**
[What the developer or user sees — error message, broken behaviour, etc.]

**Root Cause:**
[The actual technical reason this happened]

**Fix Applied:**
[What change was made to resolve it]

**Prevention:**
[How to avoid this in future — pattern, lint rule, architecture change, etc.]

**Files Affected:**
[List of files that were changed]

**Date:** [YYYY-MM-DD]
**Status:** [Active / Superseded]
```

---

## Known Error Patterns

### React 19 / Next.js 15

**Hydration Mismatch**
- Symptom: `Hydration failed because the initial UI does not match what was rendered on the server`
- Cause: Browser-only logic (window, localStorage, Date.now()) running during server render
- Fix: Wrap in `useEffect` or use `dynamic(() => import(...), { ssr: false })`
- Prevention: Never access browser APIs outside useEffect in components

**Missing Key Prop**
- Symptom: `Each child in a list should have a unique "key" prop`
- Cause: `.map()` rendering without a stable unique key
- Fix: Add `key={item.id}` — use a stable unique ID, not the array index

**Server Component with Client Hook**
- Symptom: `You're importing a component that needs useState/useEffect. It only works in a Client Component.`
- Cause: Server component using client-side features
- Fix: Add `"use client"` directive at the top of the file
- Prevention: Default to server components; add "use client" only when needed

**Async Server Component Error**
- Symptom: `Error: Objects are not valid as a React child`
- Cause: Returning a raw object/Response from an async server component instead of JSX
- Fix: Ensure async components return JSX, not plain objects

### Ant Design 5 + React 19

**Ant Design Component SSR Issue**
- Symptom: Style flicker or missing styles on first page load
- Cause: Ant Design v5 CSS-in-JS not properly extracted during SSR
- Fix: Use `@ant-design/nextjs-registry` to wrap the app root
- Prevention: Always use AntdRegistry from `@ant-design/nextjs-registry` in the root layout

**Ant Design Icon Missing**
- Symptom: Blank square or missing icon
- Cause: Tree-shaking removed the icon during build
- Fix: Import icon directly from `@ant-design/icons` rather than dynamic import
- Prevention: Always use named imports for Ant Design icons

### Prisma 7 + PostgreSQL

**Prisma Client Not Found**
- Symptom: `Cannot find module '@prisma/client'`
- Cause: Prisma client not generated after schema changes
- Fix: Run `npx prisma generate`
- Prevention: Run `prisma generate` after every schema change

**Migration Conflict**
- Symptom: `Migration `xxx` was applied to the database but is not in the migrations directory`
- Cause: Migrations deleted or reset while database has applied migrations
- Fix: `npx prisma migrate resolve --applied <migration_name>`
- Prevention: Never delete migration files without resolving the database state

**Connection Pool Exhaustion**
- Symptom: `Error: Connection pool exhausted` or requests hang
- Cause: Prisma connection pool too small for request volume
- Fix: Increase pool size in `DATABASE_URL` query params (`?connection_limit=20`)
- Prevention: Configure connection pooling based on serverless/container concurrency

### Tailwind CSS 4

**@tailwind Directive Not Working**
- Symptom: `@tailwind base` / `@tailwind utilities` produces no output
- Cause: Tailwind v4 uses `@import "tailwindcss"` instead of `@tailwind` directives
- Fix: Replace `@tailwind base; @tailwind components; @tailwind utilities` with `@import "tailwindcss"`
- Prevention: Use Tailwind v4 syntax with the new `@tailwindcss/postcss` plugin

**Class Not Being Generated**
- Symptom: A utility class like `grid-cols-12` is not working
- Cause: Tailwind v4 uses CSS-first configuration; custom values need `@theme` directive
- Fix: Add `grid-cols-12` to the `gridTemplateColumns` theme extension in the plugin
- Prevention: Register all custom utility values in `tailwind.config.ts`

### Configuration / Environment

**Missing Environment Variable**
- Symptom: `undefined` values in production, features silently broken
- Cause: Variable defined in `.env` but not in production environment
- Fix: Add to deployment environment variables and validate on startup
- Prevention: Add a startup validation check that throws if required env vars are missing

**Public Env Var Not Exposed to Client**
- Symptom: `NEXT_PUBLIC_*` variable is `undefined` in the browser
- Cause: Variable missing `NEXT_PUBLIC_` prefix, or build not restarted after change
- Fix: Prefix with `NEXT_PUBLIC_` and rebuild
- Prevention: Always prefix client-exposed env vars with `NEXT_PUBLIC_`

### Jest / Testing

**Jest Cannot Find Module**
- Symptom: `Cannot find module '@/lib/something'`
- Cause: Module alias not configured in Jest or tsconfig paths mismatch
- Fix: Ensure `jest.config.js` has correct `moduleNameMapper` for `@/*` → `src/*`
- Prevention: Keep Jest module aliases in sync with tsconfig paths

**RTL Ant Design Component Test Fails**
- Symptom: `Error: Could not find `locale` in context` or missing Ant Design styles
- Cause: Ant Design ConfigProvider not wrapping the test component
- Fix: Wrap test renders with `ConfigProvider` and `AntdRegistry`
- Prevention: Create a custom render function that includes all necessary providers

---

### Feed Stream Crash on API Error Response

**Symptom:**
`TypeError: Cannot read properties of undefined (reading 'length')` at `feedStream.ts:72`. Also: "Rendered more hooks than during the previous render" because React's hook count desynchronizes when a render-time error interrupts execution.

**Root Cause:**
The `fetchFeed` method in `feedStream.ts` called `/api/posts/feed` which returns `{error: "Not authenticated"}` for unauthenticated users. The response was cast as `{posts: FeedPost[]; nextCursor: string | null}` but `data.posts` was actually `undefined` because the API returned an error object. Two crash points:
1. `feedStream.ts:72` — `state.posts.length` on undefined in the polling subscription
2. `feedStream.ts:96` — `data.posts` used directly without fallback in `fetchFeed`

**Fix Applied:**
- `fetchFeed` now defaults `data.posts ?? []` and `data.nextCursor ?? null`
- Polling subscription uses optional chaining: `(state.posts?.length ?? 0) > 0`

**Prevention:**
Always default array fields from API responses: `data.field ?? []`. Never assume the API will return the expected shape — it could return `{error: "..."}` or `{message: "..."}`.

**Files Affected:**
- `app/lib/streams/feedStream.ts`

**Date:** 2026-06-09
**Status:** Active

---

### Feed API Auth Blocking Guest Access

**Symptom:**
`GET /api/posts/feed` returned `{"error":"Not authenticated"}` for unauthenticated users, blocking guest browsing of the home feed.

**Root Cause:**
`app/api/posts/feed/route.ts` called `getUserFromRequest()` at the top and returned 401 if no user was found, with no fallback for guest access.

**Fix Applied:**
Restructured the GET handler to check auth first. If authenticated, use `feedService.getFeed()` for personalized feed. If guest, return public posts (most recent) directly from Prisma without user-specific filtering.

**Prevention:**
Public-facing GET endpoints should always have a guest fallback. Auth should gate personalization, not access.

**Files Affected:**
- `app/api/posts/feed/route.ts`

**Date:** 2026-06-09
**Status:** Active

---

### PostCard Crash on Missing User Field

**Symptom:**
`TypeError: Cannot read properties of undefined (reading 'firstName')` when a post object lacks a `user` property.

**Root Cause:**
`PostCard.tsx` accessed `post.user.firstName`, `post.user.lastName`, etc. without guarding against a missing `user` object. This happened when the feed API returned malformed data.

**Fix Applied:**
Added a `user` local constant (`const user = post.user`) at the top of the component. All downstream usage changed from `post.user.X` to `user?.X ?? ""`.

**Prevention:**
Always use optional chaining on nested data from API responses. Create local constants with fallback at the top of the render function.

**Files Affected:**
- `app/components/features/posts/PostCard.tsx`

**Date:** 2026-06-09
**Status:** Active

---

### Missing Tailwind Typography Plugin (No Prose Styling)

**Symptom:**
`prose` CSS classes on Terms, Privacy, and Blog post pages had no effect — content rendered unstyled.

**Root Cause:**
`@tailwindcss/typography` was not installed. Tailwind CSS v4 requires explicitly installing the typography plugin and importing it in `globals.css` via `@plugin "@tailwindcss/typography"`.

**Fix Applied:**
- Installed `@tailwindcss/typography@latest`
- Added `@plugin "@tailwindcss/typography";` to `app/globals.css`

**Prevention:**
Always install `@tailwindcss/typography` when using `prose` classes in Tailwind v4. Check `@plugin` directive in CSS, not just the Tailwind config.

**Files Affected:**
- `app/globals.css`
- `package.json`

**Date:** 2026-06-09
**Status:** Active

---

### Build Failure — Duplicate Function Declaration (formatCount)

**Symptom:**
Vercel build failed with `Module parse failed: Identifier 'formatCount' has already been declared (9:9)` in `ExplorePinCard.tsx`.

**Root Cause:**
The `formatCount` helper function was defined twice in the same file — first at line 6 and again at line 29. Both declarations used `function` keyword in the same module scope.

**Fix Applied:**
Removed the second (duplicate) declaration, keeping only the first.

**Prevention:**
When extracting helpers to module scope, check for existing declarations before adding new ones. Use IDE "find references" to detect duplicates.

**Files Affected:**
- `app/components/features/explore/ExplorePinCard.tsx`

**Date:** 2026-07-15
**Status:** Active

---

### Build Failure — Sentry Auth Token Invalid (401)

**Symptom:**
Vercel build logged `sentry reported an error: Invalid token (http status: 401)` for release creation and source map upload operations. Build continued but with noisy errors and wasted time.

**Root Cause:**
The `SENTRY_AUTH_TOKEN` in environment was present but expired/invalid, causing the Sentry CLI to fail with 401 on every API call. The `@sentry/nextjs` webpack plugin attempted release creation and source map upload even with a bad token.

**Fix Applied:**
1. Cleared the invalid `SENTRY_AUTH_TOKEN` from `.env`
2. Updated `next.config.mjs` to set `dryRun: true` when auth token or DSN is missing, preventing Sentry build-time operations
3. Fixed deprecated Sentry options (`disableLogger` → `webpack.treeshake.removeDebugLogging`, `automaticVercelMonitors` → `webpack.automaticVercelMonitors`)

**Prevention:**
Never commit Sentry auth tokens to `.env`. Set `dryRun` conditionally based on whether Sentry is actually configured. Use Vercel environment variables for production tokens.

**Files Affected:**
- `.env`
- `next.config.mjs`

**Date:** 2026-07-15
**Status:** Active

**Follow-up (2026-10-08):** The 2026-07-15 `dryRun` gate only covered *missing* token/DSN, so a *present-but-invalid* token (Vercel env) still attempted release creation + sourcemap upload on all three runtimes (6× 401 errors) and `silent` never applied on CI (`!process.env.CI` guard). Hardened `next.config.mjs`: `sentryConfigured` requires token + org + project + DSN and gates `dryRun`, `release.create/finalize`, and `sourcemaps.disable`; `telemetry: false` removes per-runtime Info noise; `silent: true` unconditionally; `errorHandler` warns once and swallows so Sentry can never fail the build (per Sentry docs, re-throwing is what fails the build — we don't). Same session: dropped obsolete `--no-engine` from `postinstall`/`build`/`vercel-build` (unknown option in Prisma 7, noisy on every install/build) and added `instrumentation-client.ts` (side-effect import of `sentry.client.config.ts`) for the Turbopack deprecation warning. Files: `next.config.mjs`, `package.json`, `instrumentation-client.ts` (new).

---

### Build Failure — Prisma Role Filter Invalid Enum Value

**Symptom:**
TypeScript error: `Type '"banned"' is not assignable to type 'UserRole'` in `app/api/leaderboard/route.ts`.

**Root Cause:**
The `UserRole` Prisma enum only defines `USER` and `ADMIN` — there is no `BANNED` value. The query filter `role: { not: "banned" }` references a non-existent enum member.

**Fix Applied:**
Removed the `where: { role: { not: "banned" } }` filter entirely, since the schema doesn't support excluding banned users via the role field.

**Prevention:**
Keep Prisma enum filters in sync with the schema. If banning is needed, add an `isBanned` boolean field to the User model instead of misusing the Role enum.

**Files Affected:**
- `app/api/leaderboard/route.ts`

**Date:** 2026-07-15
**Status:** Active

---

### Build Failure — TDZ Error in RouteMap.tsx (bounds used before declaration)

**Symptom:**
TypeScript error: `Block-scoped variable 'bounds' used before its declaration` at `RouteMap.tsx:90`.

**Root Cause:**
The `bounds` constant was declared at line 125 but referenced earlier in `fitMapToBounds`'s `useCallback` dependency array (line 90) and a `useEffect` dependency array (line 98). `const`/`let` declarations have a Temporal Dead Zone — they cannot be referenced before their declaration line.

**Fix Applied:**
Moved the `mapStyle`, `routeCoords`, `bounds`, `centerLat`, and `centerLng` variable declarations above the `fitMapToBounds` callback and the `useEffect` that reference them.

**Prevention:**
Declare all computed variables before any hooks (useCallback, useEffect) that reference them. Keep data declarations at the top of the component.

**Files Affected:**
- `app/components/features/posts/RouteMap.tsx`

**Date:** 2026-07-15
**Status:** Active

---

### Build Failure — Missing initialValues Prop on ConfigDrivenForm

**Symptom:**
TypeScript error: `Property 'initialValues' does not exist on type 'ConfigDrivenFormProps'` in `EditProfileModal.tsx`.

**Root Cause:**
`ConfigDrivenFormProps` interface didn't define an `initialValues` prop, but `EditProfileModal` was passing it.

**Fix Applied:**
1. Added `initialValues?: Record<string, unknown>` to `ConfigDrivenFormProps`
2. Used it to initialize the `formValues` state: `initialValues as Record<string, string> ?? {}`

**Prevention:**
When adding a new prop to component usage, update the component's TypeScript interface first. Run type checking after every edit.

**Files Affected:**
- `app/components/ui/ConfigDrivenForm.tsx`

**Date:** 2026-07-15
**Status:** Active

--- 

### Prisma 7 Accelerate URL Used as datasourceUrl (P2022 / Timeout)

**Symptom:**
`POST /api/auth/login` returns 500 "Database error. Please try again." after ~30s timeout. No `PrismaClientKnownRequestError` details visible. Fresh DB keys don't help.

**Root Cause:**
`app/lib/db/prisma.ts` passed `datasourceUrl` to the PrismaClient constructor, but Prisma 7's generated client (Accelerate mode) only accepts `accelerateUrl` or `adapter` — there is no `datasourceUrl` option in `PrismaClientOptions`. This threw `PrismaClientConstructorValidationError: Unknown property datasourceUrl` at construction time.

Additionally, `prisma.config.ts` used `LOCAL_DB` (the Accelerate `prisma+postgres://` URL) for CLI operations (migrate, seed), but CLI needs a direct `postgres://` connection — Accelerate URLs don't support DDL operations.

**Fix Applied:**
- `prisma.ts`: Always uses `accelerateUrl`, switches URL based on environment — dev uses `LOCAL_DB` (dev Accelerate), prod uses `DATABASE_URL` (prod Accelerate)
- `prisma.config.ts`: Development uses `DIRECT_LOCAL_DB` for CLI, production uses `DIRECT_URL`
- Login route error handling: Added `PrismaClientInitializationError` to the name check, and surfaces `detail` + `code` in dev mode

**Prevention:**
Never pass a `prisma+postgres://` Accelerate URL to `datasourceUrl`. Use `accelerateUrl` for Accelerate and `datasourceUrl` for direct connections. They are mutually exclusive in Prisma 7's `PrismaClientOptions`.

**Files Affected:**
- `app/lib/db/prisma.ts`
- `prisma.config.ts`
- `app/api/auth/login/route.ts`
- `app/api/posts/feed/route.ts`

**Date:** 2026-06-10
**Status:** Active

---

### Forgot-Password 504 FUNCTION_INVOCATION_TIMEOUT — Redis Blocks Request for 10s

**Symptom:**
`POST /api/auth/forgot-password` returns `504 FUNCTION_INVOCATION_TIMEOUT` (Vercel 10s limit). Logs:
`[Upstash Redis] The 'url' property is missing`, `[otpStore] redis set reset failed, falling back to memory [TypeError: fetch failed] getaddrinfo ENOTFOUND willing-gazelle-101748.upstash.io`, `Redis client was initialized without url or token. Failed to execute command.` then `Vercel Runtime Timeout Error: Task timed out after 10 seconds`. User sees generic 504 / "An error o..." truncated JSON. Occurred in production where `UPSTASH_REDIS_REST_URL` pointed at a deprovisioned host.

**Root Cause:**
Three interlocking issues:
1. `app/lib/db/redis.ts` eagerly instantiated `new Redis({ url: process.env.REDIS_URL ?? "", token: process.env.REDIS_TOKEN ?? "" })` at import time. Production sets `UPSTASH_REDIS_REST_URL/TOKEN`, not `REDIS_URL/TOKEN`, so the client was always created with empty strings, triggering Upstash warnings and `Failed to execute command` on every use.
2. `app/lib/services/otpStore.ts` created a fresh `new Redis({url, token})` per operation with no timeout. When `UPSTASH_REDIS_REST_URL` pointed at an invalid host, `redis.set()` hung on DNS/fetch for ~5-6s before throwing `fetch failed`, exceeding the 10s Vercel limit when combined with `await sendPasswordResetEmail()` (which also awaits Resend). No `Promise.race` timeout existed.
3. `app/api/auth/forgot-password/route.ts` awaited both `setResetToken` and `sendPasswordResetEmail` sequentially on the hot path, so any slow Redis or Resend call blocked the response. Identical pattern existed platform-wide in `feedService.ts`, `app/api/posts/route.ts`, `app/api/workers/*` which used `new Redis({ url: UPSTASH_REDIS_REST_URL!, token: ...! })` with non-null assertions and no timeout.

**Fix Applied:**
- `app/lib/db/redis.ts` — Replaced eager instance with lazy singleton `getRedisClient()` that resolves `UPSTASH_REDIS_REST_URL || REDIS_URL` and `UPSTASH_REDIS_REST_TOKEN || REDIS_TOKEN`, guards `replace_me` and non-https URLs, exposes timeout-guarded `redis.get/set/del` wrappers (1.2s `Promise.race` timeout, warn + no-op on failure) via `withTimeout`.
- `app/lib/services/otpStore.ts` — Singleton cached client, `resolveEnv()` guard, `withTimeout` 1.5s per op, fallback to in-memory `Map` within <1.5s on DNS/timeout, `__resetOtpStoreForTests` for tests.
- `app/lib/services/feedService.ts` — Switched from direct `new Redis` to shared `await import("@/app/lib/db/redis").redis` for get/set cache paths.
- `app/api/posts/route.ts` — Same; optimistic feed cache bust now uses safe wrapper.
- `app/api/workers/feed-invalidate` & `validity-recompute` — Use shared wrapper instead of `new Redis(!)`.
- `app/lib/utils/siteConfig.ts` — Now benefits from safe wrapper (no direct `new Redis` elsewhere).
- `app/api/auth/forgot-password/route.ts` — Added `maxDuration=15`, `dynamic="force-dynamic"`, normalized email + format validation, made `sendPasswordResetEmail` non-blocking via `waitUntil` / `void` background task (matching `register` pattern), sanitized error handling, timeout-guarded `setResetToken` ensures <1.5s fallback.
- `vercel.json` — Added `maxDuration` for `forgot-password` and `reset-password`.

**Prevention:**
- Never `new Redis` with `!` assertions or at import time. Always use `app/lib/db/redis.ts` wrapper which handles missing env, invalid host, and timeout.
- Any Redis operation on a user-facing hot path must be `withTimeout` <2s and fall back to memory/DB; cache failures must be non-critical.
- Auth routes that send email must not `await` Resend on the hot path — use `waitUntil` background pattern as in `register` and now `forgot-password`.
- Env var names: `UPSTASH_REDIS_REST_URL/TOKEN` are canonical; `REDIS_URL/TOKEN` kept as fallback alias only.

**Files Affected:**
- app/lib/db/redis.ts
- app/lib/services/otpStore.ts
- app/lib/services/feedService.ts
- app/api/auth/forgot-password/route.ts
- app/api/posts/route.ts
- app/api/workers/feed-invalidate/route.ts
- app/api/workers/validity-recompute/route.ts
- vercel.json

**Date:** 2026-09-15
**Status:** Active

---

### False-Positive Reset Email — Success Returned With No Resend Delivery

**Symptom:**
User completes forgot-password flow and sees success, but no mail ever arrives. Resend dashboard shows no send, no failure; Vercel logs show no error — only `[otpStore] redis set reset failed, falling back to memory / Redis timeout after 1500ms` warnings.

**Root Cause:**
Email send was fire-and-forget with no provider-result verification: the route returned success after queueing the send without checking whether Resend accepted it, so a silent send failure read as success.

**Fix Applied:**
Check the Resend send result and surface failure honestly instead of a false success (commit `a347a9c` "Fixed false-positive reset email").

**Prevention:**
Every background email must verify the provider result. A false success is worse than an error — see `memory/lessons-learned.md` "Background Email Must Verify the Provider Result".

**Files Affected:**
- app/lib/services/emailService.ts
- app/api/auth/forgot-password/route.ts

**Date:** 2026-09-16
**Status:** Active

---

### Reset Link "Expired or Invalid" Within Seconds — Volatile Token Store

**Symptom:**
User receives the reset mail, clicks the link promptly, but the reset page reports the link expired or invalid.

**Root Cause:**
Reset tokens lived in the Redis/in-memory OTP store, which by policy degrades to per-instance memory on timeout and loses data across restarts/instances — so a valid token could vanish before use.

**Fix Applied:**
Durable `PasswordResetToken` Prisma model — reset tokens persist in Postgres with explicit expiry, independent of cache state; routes validate against the DB (commit `d589183` "Fixed reset links via durable DB tokens"). Migration: `20250929000000_add_password_reset_token` (verify name against `prisma/migrations/` — recorded from directory listing 2026-10-08).

**Prevention:**
Security tokens must be durable, not cache-resident — see `memory/lessons-learned.md` "Security Tokens Must Be Durable, Not Cache-Resident".

**Files Affected:**
- prisma/schema.prisma (`PasswordResetToken` model)
- prisma/migrations/20250929000000_add_password_reset_token/
- app/lib/services/resetTokenStore.ts
- app/api/auth/forgot-password/route.ts, app/api/auth/reset-password/route.ts

**Date:** 2026-09-29
**Status:** Active

---

### Build Failure — Removed TS Option `downlevelIteration` in tsconfig.json
**Symptom:**
`npx tsc --noEmit` fails with `TS5102: Option 'downlevelIteration' has been removed. Please remove it from your configuration.`

**Root Cause:**
`tsconfig.json` still set `downlevelIteration: true`, an option deleted in current TypeScript (ES2015+ targets handle iteration natively).

**Fix Applied:**
Removed the `downlevelIteration` line from `tsconfig.json` (2026-10-08 QA gate, PR #42).

**Prevention:**
After TypeScript major upgrades, run `tsc --noEmit` immediately and remove deleted options instead of working around them.

**Files Affected:**
- tsconfig.json

**Date:** 2026-10-08
**Status:** Active

---

### Build Failure — Duplicate Identifier `bugId` in Admin Bugs PATCH Route

**Symptom:**
Vercel build failed with `Module parse failed: Identifier 'bugId' has already been declared (140:14)` in `app/api/admin/bugs/route.ts`, surfaced via `@sentry/nextjs` wrappingLoader + next-flight-loader. `Build failed because of webpack errors`.

**Root Cause:**
`PATCH` destructured `bugId` from the request body (`const { bugId, bugIds, ... }`) and later redeclared `const bugId = targets[0]` in the same function scope for the single-report moderation flow. Same pattern as the earlier `formatCount` duplicate (2026-07-15).

**Fix Applied:**
Renamed the second declaration to `targetBugId` and updated its two uses (`findUnique where` + `$transaction bugReport.update where`).

**Prevention:**
When narrowing a destructured value to a single-target variable, always use a distinct name (`targetX` / `singleX`). Run `tsc --noEmit` after editing API routes — it catches redeclarations before Vercel does.

**Files Affected:**
- `app/api/admin/bugs/route.ts`

**Date:** 2026-10-08
**Status:** Active

---

### Build Failure — Prisma `ReviewStatus` Type Error in Admin Reviews PATCH Route

**Symptom:**
Vercel build failed at type-check: `./app/api/admin/reviews/route.ts:65:15 Type error: Type 'string' is not assignable to type 'ReviewStatus | EnumReviewStatusFieldUpdateOperationsInput | undefined'` on `data: { status }` in `prisma.userReview.updateMany`.

**Root Cause:**
`status` was destructured as `status?: string` from the request body. Runtime validation (`["APPROVED","REJECTED"].includes(status)`) narrows the value at runtime but not at the TypeScript level, so `status` stays `string` and is not assignable to the Prisma `ReviewStatus` enum. Same class of error as the earlier `UserRole '"banned"'` enum mismatch (2026-07-15).

**Fix Applied:**
Narrowed the type at the write site: `data: { status: status as "APPROVED" | "REJECTED" }` — safe because the `includes` guard above already rejects anything else with a 400.

**Prevention:**
When writing a Prisma enum field from a request-body string, always cast after an explicit allow-list guard (or type the destructured field as the enum union up front). Sibling admin routes (`bugs`, `posts`, `users`) already use `as never` casts for this — follow the same pattern.

**Files Affected:**
- `app/api/admin/reviews/route.ts`

**Date:** 2026-10-08
**Status:** Active

---

### Build Failure — Webpack Alias Breaks `maplibre-gl/dist/maplibre-gl.css` Resolution

**Symptom:**
Vercel build failed with webpack errors:
`Module not found: Can't resolve 'maplibre-gl/dist/maplibre-gl.css'` in `app/(dashboard)/explore/page.tsx:8` and `app/components/features/posts/RouteMap.tsx:7`. `Build failed because of webpack errors`. Import trace via `app/(dashboard)/posts/[id]/page.tsx` (RouteMap).

**Root Cause:**
`next.config.mjs` declared `config.resolve.alias['maplibre-gl'] = 'maplibre-gl/dist/maplibre-gl.js'`. Webpack alias keys prefix-match, so the subpath import `maplibre-gl/dist/maplibre-gl.css` was rewritten to `maplibre-gl/dist/maplibre-gl.js/dist/maplibre-gl.css` — unresolvable. Verified by simulating webpack alias resolution (old mapping produces the doubled `dist` path; exact-match mapping leaves the CSS path untouched). The CSS file itself exists in the published package (`dist/maplibre-gl.css`, 65.5kB in maplibre-gl@4.7.1); nothing was wrong with the imports or the dependency.

**Fix Applied:**
Single-character-class fix in `next.config.mjs`: alias key `'maplibre-gl'` → `'maplibre-gl$'` (webpack exact-match suffix). Bare `import("maplibre-gl")` calls (explore page + RouteMap `mapLib`) still resolve to the dist bundle; subpath CSS imports now resolve normally.

**Prevention:**
Never alias a bare package name without the `$` exact-match suffix when subpath imports (`package/dist/...`) exist. Any future webpack alias must be exact-match unless prefix rewriting is explicitly intended.

**Files Affected:**
- `next.config.mjs`

**Date:** 2026-10-09
**Status:** Active

### Build Failure — `unknown` Metadata Not Assignable to ReactNode (Admin Audit Page)

**Symptom:**
Vercel build failed at type-check: `./app/admin/audit/page.tsx:89:13 Type error: Type 'unknown' is not assignable to type 'ReactNode'` on `{e.metadata && Object.keys(e.metadata as object).length > 0 && (...)}`.

**Root Cause:**
`AuditEntry.metadata` is typed `unknown` (Prisma `Json?`). `e.metadata && ...` does not narrow `unknown`, so the `&&` chain's left operand stays `unknown` — not assignable to `ReactNode` for rendering. The `as object` cast inside `Object.keys` doesn't narrow the outer expression.

**Fix Applied:**
Explicit type-guard helper `hasRenderableMetadata(value: unknown): value is Record<string, unknown>` (object + non-null + non-array + non-empty) plus never-throw `formatMetadata` (try/catch JSON.stringify). JSX uses `{hasRenderableMetadata(e.metadata) && (<pre>...)}`.

**Prevention:**
Never render `unknown` behind a truthiness check. Always narrow with a `value is` guard before using it in JSX. Same class as the earlier enum-string errors (ReviewStatus, UserRole): runtime checks don't narrow TS types — narrow at the expression the compiler checks.

**Files Affected:**
- `app/admin/audit/page.tsx`

**Date:** 2026-10-09
**Status:** Active

---

### Verify-Email 504 FUNCTION_INVOCATION_TIMEOUT From Profile — Sequential Redis Timeouts on Default 10s Budget

**Symptom:**
`POST /api/auth/verify-email` (triggered from profile EmailSecurityPanel resend) returns `504 FUNCTION_INVOCATION_TIMEOUT`. Logs: `[otpStore] redis get cooldown failed, checking memory Redis timeout after 2500ms`, `[otpStore] redis set failed, falling back to memory Redis timeout after 2500ms`, `[otpStore] redis set cooldown failed, falling back to memory Redis timeout after 2500ms`, then `Vercel Runtime Timeout Error: Task timed out after 10 seconds`.

**Root Cause:**
Three interlocking issues (same class as the 2026-09-15 forgot-password 504, regressed):
1. `app/lib/services/otpStore.ts` `REDIS_OP_TIMEOUT_MS` had drifted back to 2500ms (repair log records 1.5s; `redis.ts` wrapper uses 1.2s). Verify-email POST awaited three Redis ops SEQUENTIALLY (get-cooldown → set-otp → set-cooldown) = 7.5s worst-case on a slow/deprovisioned Upstash host, before Resend (5s provider timeout) even started.
2. `app/api/auth/verify-email/route.ts` (and `otp/resend`, `otp`, `change-email`, `change-password`) declared no `maxDuration`/`dynamic`, so Vercel applied the default 10s function budget — the sequential Redis worst-case alone nearly filled it.
3. `bcrypt hashPassword` ran sequentially between the Redis ops instead of concurrently with the cooldown read, adding latency on the hot path.

**Fix Applied:**
- `otpStore.ts`: `REDIS_OP_TIMEOUT_MS` 2500 → 800ms (fail fast to memory; consistent with `redis.ts` 1.2s discipline).
- `verify-email` + `otp/resend`: cooldown-read + bcrypt-hash via `Promise.all`; `setOtp` + `setSendCooldown` via `Promise.all` — Redis worst-case ~1.6s total. Added `export const maxDuration = 30; export const dynamic = "force-dynamic"`.
- `register`: `setOtp` + `setSendCooldown` via `Promise.all` (same budget win).
- `otp` verify: added `maxDuration = 15` + `force-dynamic` (get + attempt-counter + expire worst-case now ~2.4s, inside budget).
- `change-email` (`maxDuration = 30`), `change-password` (`maxDuration = 15`): explicit budgets so a slow Redis/Resend never hits the default 10s.
- `accountDeletionService` request side-effects: user + single-assignee admin mails via `Promise.all` (previously sequential ~10s worst-case); honest warn logs preserved.
- `vercel.json`: added `maxDuration` entries for `verify-email` (30), `otp/resend` (30), `change-email` (30), `change-password` (15).
- Wired-in email audit (all trigger paths verified): register (background `waitUntil`, honest payload), Google callback (fire-and-forget welcome, toggle-respecting), otp/resend + verify-email (awaited with honest `sent`/`reason` — required so the UI timer and throttle agree), forgot-password (awaited with 6s race + honest 503, token cleanup on failure), change-email (awaited, warn on failure), change-password/link-password (fire-and-forget notice), deletion lifecycle (parallel, best-effort), admin resend-verification (per-recipient honest errors), contact/bug (awaited, logged). Email provider timeout (5s `withEmailTimeout` in `emailService`) unchanged — the fix keeps the honest-`sent` contract while moving the budget win to Redis parallelism + function timeouts.

**Prevention:**
- Keep `otpStore` timeout ≤ `redis.ts` timeout (800ms vs 1.2s). Any bump must be justified against the 10s default budget.
- Every auth route that touches Redis or Resend must declare an explicit `maxDuration` + `vercel.json` entry (no reliance on the Vercel default).
- Never `await` two independent Redis writes sequentially on a user-facing hot path — use `Promise.all`.
- Run `tsc --noEmit` after editing auth routes; full `tsc`/`jest`/`build` confirm green in CI/Vercel (this runner has no node_modules — verified to file-presence/syntax level only).

**Files Affected:**
- app/lib/services/otpStore.ts
- app/api/auth/verify-email/route.ts
- app/api/auth/otp/resend/route.ts
- app/api/auth/otp/route.ts
- app/api/auth/register/route.ts
- app/api/auth/change-email/route.ts
- app/api/auth/change-password/route.ts
- app/lib/services/accountDeletionService.ts
- vercel.json

**Date:** 2026-10-09
**Status:** Active

---

### Verify-Email 404 + Fresh OTP "Expired or Replaced" — Missing Page + Volatile OTP Store

**Symptom:**
(1) The "Verify email" button in verification mails links to `/verify-email?email=…`, which renders "Page not found" — no such route exists. (2) Entering a just-received 6-digit code returns "That code expired or was replaced by a newer one. Request a new code and use the newest email." even when no newer code was requested.

**Root Cause:**
(1) Every verify-email link builder (`verify-email` POST, `otp/resend` fallback, admin resend-verification, `resolveVarsForRecipient`, email template) points at `/verify-email`, but no `app/**/verify-email/page.tsx` was ever created, and middleware had no guest entry. (2) Same class as "Reset Link Expired Within Seconds" (fixed via `PasswordResetToken`): OTP hashes live ONLY in Redis with a per-instance memory fallback (`otp:{email}` single key). On serverless, a code issued on instance A is invisible on instance B whenever Upstash is slow/misconfigured — `getOtp` misses and the shared copy blames expiry/replacement. `change-email` confirm (`change-email:{userId}`) had the identical hole, plus no resend cooldown, no attempt cap, and no rate limit on PUT.

**Fix Applied:**
- NEW `app/(public)/verify-email/page.tsx`: guest-accessible code-entry page reading `?email=` (prefill) + `?otp/?code/?token` (box prefill); verifies via PUT (no login, works on any device), resends via POST with the shared server-driven cooldown hook; verified/already-verified success states link to `/login`. Middleware `guestRoutes` += `/verify-email`.
- NEW durable `EmailOtpToken` model + migration `20261009000002_email_otp_token` + `app/lib/services/emailOtpStore.ts` (store/verify/consume, single-active per email+purpose, bcrypt-bound candidates, P2021/P2022 missing-table swallow → legacy path when the migration is rolling out).
- Issuance writes the DB mirror best-effort in parallel: register, `otp/resend`, verify-email POST, change-email POST, admin resend-verification.
- Verification consults the DB whenever Redis holds no hash: `otp` POST + verify-email PUT (consume on success/revoke), change-email PUT (userId + `newEmail::otp` binding, consume on success/revoke).
- change-email audit hardening: per-user 60s resend cooldown (429 + `retryAfter`, client-adopted), 5-attempt cap with revoke, PUT rate-limited on the auth bucket, honest `sent/reason/expiresIn/cooldown` payloads, OTP whitespace trim on confirm.
- Preview/admin Studio samples + `emailManagement` verifyLink example corrected to the real `/verify-email?email=` form (were `?token=sample` / `/verify?token=…`, routes that never existed).
- Single-active semantics preserved everywhere, so the "use the newest email" copy stays honest; no previously-valid code becomes invalid (strictly more lenient).

**Prevention:**
- Every emailed link must resolve to a real route: grep link builders against `app/**/page.tsx` before shipping a template.
- Security tokens must be durable, not cache-resident (extends the existing `PasswordResetToken` precedent to OTPs).
- Any future code-send flow reusing `otp:{email}` must also write the `EmailOtpToken` mirror or document why not.

**Files Affected:**
- app/(public)/verify-email/page.tsx (new)
- middleware.ts
- prisma/schema.prisma (`EmailOtpToken`), prisma/migrations/20261009000002_email_otp_token/
- app/lib/services/emailOtpStore.ts (new)
- app/api/auth/register/route.ts, app/api/auth/otp/route.ts, app/api/auth/otp/resend/route.ts, app/api/auth/verify-email/route.ts, app/api/auth/change-email/route.ts, app/api/admin/users/route.ts
- app/api/email/preview/route.ts, app/admin/email/page.tsx, app/lib/config/emailManagement.ts
- app/__tests__/services/emailOtpStore.test.ts (new), app/__tests__/config/verifyEmailFlow.test.ts (new)

**Date:** 2026-10-09
**Status:** Active

---

## Resolved Errors Archive

> **Section summary:** Errors that have been fully resolved and are unlikely to recur. Kept for reference.

### PostCard Crash on Missing Tags/Images

**Symptom:**
Uncaught TypeError: Cannot read properties of undefined (reading 'length') — occurs when navigating to pages that render PostCard components. Specifically on `post.tags.length` and `post.images.length` accesses.

**Root Cause:**
API responses may omit `tags` or `images` fields, or return `null` instead of `[]`. TypeScript's type system (`string[]`) does not provide runtime protection, and the data flows through JSON.parse without Zod schema validation on the feed endpoint.

**Fix Applied:**
Added local constants with `?? []` fallback:
```tsx
const tags = post.tags ?? []
const images = post.images ?? []
```
All `.length` and `.map()` calls now reference the guarded constants.

**Prevention:**
Always access optional array fields with `?? []` fallback or optional chaining. Consider adding Zod validation to feed API responses.

**Files Affected:**
- `app/components/features/posts/PostCard.tsx`

**Date:** 2026-06-09
**Status:** Superseded — same pattern covered by "Feed Stream Crash on API Error Response" entry
