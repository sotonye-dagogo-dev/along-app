# Lessons Learned

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-21 (Sprint 86: serialize notices, metadata step actions)
> - last-verified-against-code: 2026-10-21 (Sprint 86 in-runner QA: tsc 0, jest 118/118 suites 1257/1257, build clean)
> - staleness-policy: each entry has its own staleness — check supersedes links

> **Overview:** Practical knowledge accumulated during Along development — things that worked well, things that didn't, and patterns worth repeating. Different from repair-system.md (which tracks errors); this file tracks development process insights and architectural wisdom. Uses supersedes/superseded-by links for evolving practices.

---

## Entry Format

```
## [Lesson Title]

**Context:**
[What situation this came from]

**What We Learned:**
[The insight or pattern discovered]

**Apply When:**
[When future agents/developers should use this knowledge]

**Supersedes:** [link to any prior lesson this replaces, or None]
**Superseded by:** [link to any newer lesson that replaces this, or None]
```

---

## Lessons

## Serialize Global Notices in a Pure Gate, Not With CSS

**Context:** Sprint 86. The guest tour nudge would have been the fourth bottom-of-screen notice (after the cookie bar and PWA install card, plus the guest banner). Layout-only fixes (different `bottom` lanes) prevent overlap but still present several cards at once.

**What We Learned:** Put the policy in a pure ordered gate: feature enabled → audience → feature availability → terminal/in-progress → auto-start route → existing notice pending → dismissal TTL. Components become dumb renderers and listeners; coordination happens through small named CustomEvents (`along:cookie-consent-changed`, `along:pwa-install-changed`). This makes the "one notice at a time" contract testable without a DOM, and every unknown/garbage input safely hides the prompt.

**Apply When:** Any new global banner/prompt/toast lane that shares the bottom or top stack with existing notices. Decide the queue order in config, not in z-index.

**Supersedes:** None
**Superseded by:** None

## Tour Steps Should Express Actions as Metadata, Not Component Branches

**Context:** Sprint 86. Pressing Next on the share-route tour stop without tapping the highlighted trigger left the next composer steps looking for targets inside a closed modal; switching to Score required knowing the composer’s tab API from inside PlatformTour.

**What We Learned:** Give steps optional `activateEvent` / `advanceEvent` metadata (`along:*` + flat string details). The tour dispatches them at lifecycle points (step active / Next past it) and the owning surface listens (`home` opens the composer, `ShareRouteModal` selects a tab). This keeps the tour content-driven, prevents platform-specific imports, and lets validation reject arbitrary events from stored admin rows.

**Apply When:** A guided walkthrough needs to change state on a page it does not own (open a modal, select a tab, expand a panel).

**Supersedes:** None
**Superseded by:** None

## Never Position Overlay Cards From Estimates Alone — Measure and Fit

**Context:** Sprint 84. The tour tooltip used `maxWidth` plus hand-computed `top/left`; long copy and targets near the viewport bottom pushed the Next/Finish row off-screen, and short copy let the card shrink unpredictably.

**What We Learned:** Overlay cards need (1) an explicit width (capped by the viewport) so content length cannot change the footprint, (2) the rendered height measured after paint (ResizeObserver + viewport/orientation changes), and (3) a pure layout helper that tries the requested placement, flips/clamps inside a safe margin, and only then allows internal scrolling. Centered/end cards need the same measurement, not a hardcoded `top: 34%`.

**Apply When:** Any floating tooltip, tour card, popover or anchored overlay that contains actions users must reach on small viewports. Keep the math in a pure helper so it is testable without a DOM.

**Supersedes:** None
**Superseded by:** None

## Provider ETAs Are Free-Flow Inputs, Not Display Truth — Calibrate Once

**Context:** Sprint 84. OSRM/ORS/Mapbox durations omitted boarding, pick-up/drop-off dwell and Nigerian toll/agbero time, so route estimates were consistently too short; adding padding at each call site risked double-counting (the distance fallback already includes overhead).

**What We Learned:** Keep raw provider minutes as an input. Apply local calibration + overhead in one resolver with an explicit contract: provider path gets overhead exactly once, distance-derived fallback is already complete. Store the resolved value only; keep traffic as a separate live overlay. Hard-cap the overhead so corrupt stop counts cannot explode an ETA.

**Apply When:** Any ETA/duration feature combining third-party routing with local conditions, especially when some modes are re-derived from distance. Add tests for overhead-once, caps, immune modes and fallback passthrough.

**Supersedes:** None
**Superseded by:** None

## Centralize Cross-Cutting Query Defaults in Config; Never Trust a Failed Fetch as End-of-List

**Context:** Sprint 78 (issue #25): every list route carried its own `Math.min(Number(limit) || 10, 50)`-style default (feed drifted to 10 while the client wanted 20), the badge poller (`/api/notifications?limit=1`) shared a first-page Redis key with the page's 20-row cache, and `feedStream.fetchFeed` mapped any transient 500 onto `hasMore: false` — one blip permanently stranded infinite scroll until reload. SEO titles had the same class of bug: the root layout `title.template` AND every page manually appended ` | Along`, producing ` | Along | Along`.

**What We Learned:** (1) Cross-cutting request defaults (page sizes, limits) belong in one config module (`app/lib/config/pagination.ts` `PAGINATION_CONFIG` + `clampPageLimit`) consumed by both server routes and client callers — grep-able, testable via source scans, and drift-proof. (2) Cache keys must include every axis that changes the payload shape (limit is part of the shape). (3) A failed fetch is *unknown*, not *empty*: map it to a sentinel (e.g. `null`), keep the cursor/`hasMore`, and retry with config-driven exponential backoff. (4) When a framework already owns a suffix/template (Next `title.template`), sub-systems must NOT re-apply it manually — compose once where the framework does not template (OG/Twitter) and nowhere else.

**Apply When:** Adding any paginated list surface, any shared cache key, any streaming/infinite-scroll fetch, or any metadata title composition — start from the central config/helper, never inline a literal.

**Supersedes:** None
**Superseded by:** None

## Preserve PostgreSQL Temporal Text During Cross-Database Transfers

**Context:** JavaScript PostgreSQL parsers can interpret `timestamp`, `date`, and
related values in the runner's local timezone, silently shifting data during a
JSON round trip.

**What We Learned:** Install raw-text parsers for temporal OIDs and encode typed
values before writing checksummed JSONL. Verify per-table canonical content
hashes after restore, not only row counts.

**Apply When:** Moving PostgreSQL data between providers or running a backup
tool outside the database's timezone.

**Supersedes:** None
**Superseded by:** None

## Windows npm Scripts Must Use Portable Command Chaining

**Context:** `prisma generate; next build` passed `generate;` as part of the
Prisma command under the Windows npm shell, so the build never started.

**What We Learned:** Use `&&` for sequential npm scripts and validate the exact
command on the target operating system.

**Apply When:** Editing package scripts that chain generators, migrations, or
build commands.

**Supersedes:** None
**Superseded by:** None

## Inline `import()` Promises and Fresh Object Identities Re-init Maps and Yank Cameras

**Context:**
RouteMap passed `mapLib={import('maplibre-gl')}` inline (fresh promise per render) and computed pins/bounds as fresh objects per render, so the fit effect re-fired every render.

**What We Learned:**
Stabilize the mapLib promise in a ref, and memoize pins/coords/bounds on content keys so camera effects only fire when geography actually changes. Missing `maplibre-gl.css` imports also unseat markers — every MapLibre renderer must import it.

**Apply When:**
Any react-map-gl renderer work: stable mapLib + memoized derived geo + CSS import are the checklist.

## ESM-Only Deps Break Jest Suites — Stub at the Seam, Test Pure Helpers

**Context:**
`emailStudio.test.ts` could never load in-runner: `@upstash/redis → uncrypto` ships ESM that the jest transform won't parse (fails identically on clean main).

**What We Learned:**
A hoisted `jest.mock` of the repo-owned seam (`@/app/lib/db/redis`) mirroring its no-op-when-unconfigured behaviour lets pure-helper suites run without touching production code. Always verify pre-existing failure with `git stash` before claiming a fix.

**Apply When:**
Any suite importing (transitively) ESM-only node_modules that jest can't parse; prefer seam-stubbing over transform config changes.

## Duplicate Hook Files Cause Confusion

**Context:**
`useRequireAuth` was created in both `app/hooks/useRequireAuth.ts` (router-based redirect) and `app/lib/hooks/useRequireAuth.ts` (permission-check variant). This creates ambiguity about which is the canonical version.

**What We Learned:**
Hooks should live in a single location. The `app/hooks/` directory is the correct place for client-side app hooks; `app/lib/hooks/` should be reserved for server-compatible or library-level hooks.

**Apply When:**
Creating new hooks in the future — put client-only hooks in `app/hooks/`, shared hooks in `app/lib/hooks/`, and document the distinction.

**Supersedes:** None
**Superseded by:** None

---

## Config-Driven Architecture Reduces Code Duplication

**Context:**
All hardcoded values (vehicle types, route statuses, form fields, notification types, SEO metadata, FAQ items, blog config) are centralized in `app/lib/config/` as typed registries. Components and pages import from these registries rather than defining inline constants.

**What We Learned:**
This approach makes it trivial to add new options (e.g., a new vehicle type requires one file change) and keeps UI components pure. The config `index.ts` barrel file provides a clean single-import API.

**Apply When:**
Any time a new domain module is created — define a config registry first, then build the UI/service layer on top.

**Supersedes:** None
**Superseded by:** None

---

## Client-Side Service Workers Require Careful Registration Timing

**Context:**
PushProvider attempts to subscribe to push notifications on mount. If the service worker hasn't been registered yet, `pushManager.subscribe()` fails silently. The `registerServiceWorker` in `pushClient` handles this by registering the worker before subscribing.

**What We Learned:**
Always ensure `navigator.serviceWorker.register()` completes before calling `pushManager.subscribe()`. The promise chain in `subscribeToPush` handles this correctly.

**Apply When:**
Any feature that depends on the service worker being active (push notifications, background sync, cache management).

**Supersedes:** None
**Superseded by:** None

---

## Textarea Overlay Pattern for Inline Highlighting

**Context:**
CommentInput needed to show @mentions highlighted in primary color as the user types. Textareas cannot render styled inline content natively.

**What We Learned:**
A transparent textarea positioned absolutely over a sibling div with `dangerouslySetInnerHTML` provides rich inline highlighting while preserving native textarea behavior (cursor, selection, keyboard events). The overlay div must match the textarea's font, size, padding, and border exactly to avoid alignment drift.

**Apply When:**
Any rich text input that needs inline styling but cannot use a full editor library — comments, bio editors, post body composition.

**Supersedes:** None
**Superseded by:** None

---

## Offline Queue + OnlineStatusProvider Pattern for Resilience

**Context:**
When the user goes offline, mutations are queued in `localStorage` via `offlineQueue`. On reconnect, `OnlineStatusProvider` fires `online` event → `offlineQueue.flush()` replays all queued requests.

**What We Learned:**
This simple pattern provides meaningful offline resilience without a complex sync engine. The queue is persisted across page refreshes (localStorage) and flushed FIFO on reconnect.

**Apply When:**
Any feature that needs to work offline and replay mutations when connectivity returns — use `offlineQueue.enqueue()` for writes and trust `OnlineStatusProvider` to auto-flush.

**Supersedes:** None
**Superseded by:** None

---

## Named Exports Prevent Import Confusion After Default→Named Migration

**Context:**
During Sprint C remediation, 17 UI component files were changed from `export default function X` to `export function X` to standardise on named exports. This broke test files and direct imports that used `import X from "./X"` syntax. Each broken import had to be manually found and fixed.

**What We Learned:**
Named exports prevent ambiguity between barrel re-exports and direct file imports. When all components use named exports, the barrel (`index.ts`) can consistently use `export { X }` and consumers consistently use `import { X }`. However, this migration requires updating every import site simultaneously — a breaking change.

**Apply When:**

- Setting up new component libraries: use named exports from the start
- Refactoring existing libraries: batch all import fixes together (or use codemods)
- Barrel files: always re-export named exports for consistency

**Supersedes:** None
**Superseded by:** None

---

## AbortController Pattern for useEffect Cleanup Prevents Memory Leaks

**Context:**
During Sprint B remediation, AbortController was added to 4+ useEffects across the app (notifications, post detail, profile, bookmarks, admin/users). Previously, rapid unmount/remount or stale responses could trigger setState on unmounted components.

**What We Learned:**
Every async `useEffect` that performs data fetching should follow this pattern:

```typescript
useEffect(() => {
  const ac = new AbortController();
  async function load() {
    setLoading(true);
    try {
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error("Fetch failed");
      setData(await res.json());
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  load();
  return () => ac.abort();
}, [url]);
```

**Apply When:**
Any new `useEffect` that makes async calls (fetch, timers, subscriptions). Always pass the signal to fetch and guard against AbortError. The cleanup function must abort on unmount.

**Supersedes:** None
**Superseded by:** None

---

## Freeze-Without-Delete Pattern for Unready External Integrations

**Context:**
Transact Marketplace and Tega Events were implemented with full infrastructure (proxy APIs, webhooks, UI pages, sidebar widgets) but the external platforms aren't ready yet. Rather than reverting the code, we removed only the access points (nav item, sidebar widget import) while keeping all files intact.

**What We Learned:**
When an external dependency isn't ready but the integration code is correct:

1. **Remove user-facing access points only** (nav, sidebar, routing links)
2. **Keep all infrastructure** (API routes, webhooks, components, pages)
3. **Document the frozen state** in system-architecture.md with `[FROZEN]` tag
4. **No code deletion** — the code is compiled but unreachable via normal UX
5. **To re-activate**: re-add the nav/sidebar entries (one-line changes)

This avoids the cost of deletion-plus-reimplementation while preventing user confusion from dead UI.

**Apply When:**
Any feature gated on an external platform that isn't available yet. Remove surface area, keep depth, tag as frozen.

**Supersedes:** None
**Superseded by:** None

---

## QStash Request Body Double-Consume Breaks Every Worker

**Context:**
`qstashService.verifySignature` called `await request.text()` to verify the HMAC, then workers called `await request.json()` — but the body stream is single-use. Every worker invocation 500'd with "body already used" because the second read throws.

**What We Learned:**
Always `request.clone()` before consuming for signature verification, and pass the already-read `bodyText` to the handler so it parses via `JSON.parse(bodyText)` instead of re-reading. Return `{ valid, bodyText }` from the verifier to make the pattern explicit.

**Apply When:**
Any webhook/worker that verifies a signature from the raw body before parsing JSON — QStash, Stripe, Svix, etc. Clone first, parse from the cloned text.

**Supersedes:** None
**Superseded by:** None

---

## Feed Cold-Start Invisibility Due To Personalised-Only Ranking

**Context:**
Feed algorithm merged only `followingPosts` (0 if no follows), `trendingPosts` (likes-desc over 7d), and `tagPosts` (0 if no activity). A new user with 0 follows + 0 activity saw only trending, where a fresh post with 0 likes ranked beyond the top 10 and was invisible — including the author's own new post since `followersOfUserId` invalidation excluded the author.

**What We Learned:**
Always include a `recentPosts` stream (recency-ordered) as a fallback/weighted input to personalized ranking, give it recency-biased scoring, and ensure cache invalidation includes the author's own `feed:${authorId}:start` key (optimistic Redis del on create). Also parallelize the independent queries to cut feed latency.

**Apply When:**
Any personalized feed that could otherwise return zero or hide fresh content for new/cold-start users.

**Supersedes:** None
**Superseded by:** None

---

## Decorative Upload Zone Masquerades As Functional Feature

**Context:**
`ShareRouteModal` rendered a dashed upload zone with "Drag & drop" text but had no `<input type=file>`, no handlers, no /api/upload endpoint, and always submitted `images: []`. Testers thought upload failed due to network; it was never implemented. `next-cloudinary` and `cloudinary` were installed but unused.

**What We Learned:**
Installed deps + polished UI do not imply wiring. Every file-input UI must have: hidden `<input type=file>` + `onChange`, `onDrop` + `onDragOver` for DnD, client upload to an API that does `cloudinary.uploader.upload` + returns URLs, preview grid with remove, and `images` persisted in the draft/submit payload. Validate size/type client-side and server-side.

**Apply When:**
Building any file/media upload — verify end-to-end (input → FormData → API → Cloudinary/storage → URL → persisted record) rather than trusting UI copy.

**Supersedes:** None
**Superseded by:** None

---

## Redis Timeout Must Not Block User-Facing Requests

**Context:**
`POST /api/auth/forgot-password` hung for 10s and returned 504 because `otpStore.setResetToken` awaited `redis.set()` to a deprovisioned Upstash host (`willing-gazelle-101748.upstash.io` DNS ENOTFOUND, 6s fetch timeout) and then awaited `sendPasswordResetEmail` sequentially. The same blocking pattern existed in `feedService`, `posts/route`, and QStash workers which used `new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: ...! })` with no timeout.

**What We Learned:**

1. Wrap every Redis operation in `Promise.race` with <1.5s timeout and fallback to in-memory or DB — cache must be non-critical.
2. Use a lazy singleton (`app/lib/db/redis.ts`) that resolves `UPSTASH_REDIS_REST_URL || REDIS_URL` and never `new Redis` at import time; guard `replace_me` and non-https values.
3. Gate-critical email (OTP/verification) must be AWAITED inside bounded timeouts with an honest `sent` flag — fire-and-forget (`void` / `globalThis.waitUntil`, which does not exist on the Vercel/Next runtime) lets serverless freeze the function on response and silently drops the mail (Oct 2026 register fix: `REGISTER_EMAIL_DISPATCH_CONFIG` 6s per-mail race + `Promise.allSettled`, same pattern as forgot-password). Non-critical notices (change-password notice, Google welcome before the fix) may stay background, but never OTP gates.

**Apply When:**
Any route that touches Redis or Resend on the request hot path — always timeout-guard; cache side effects may be background, but verification/OTP delivery must be awaited and honestly reported.

**Supersedes:** None
**Superseded by:** None

---

## Security Tokens Must Be Durable, Not Cache-Resident

**Context:**
Password-reset links reported "expired or invalid" within seconds. Tokens lived in the Redis/in-memory OTP store, which by policy degrades to memory on timeout and loses data across instances/restarts (Sept 29 fix: durable `PasswordResetToken` DB model).

**What We Learned:**
Cache is best-effort by design (timeout + fallback + eviction). Anything correctness-critical — auth tokens, reset links, OTPs that gate access — belongs in the database with explicit expiry. Cache may mirror such data for speed, but the database is the source of truth and the fallback on cache miss must be a DB read, not a failure.

**Apply When:**
Storing any token, code, or link whose loss reads as a security failure to the user (reset links, invite tokens, one-time codes).

**Supersedes:** None
**Superseded by:** None

---

## Background Email Must Verify the Provider Result

**Context:**
Forgot-password returned success while Resend never delivered — no mail, no error, only a Redis-timeout warning in logs (Sept 16 fix). The send was fire-and-forget with no result check.

**What We Learned:**
A false "mail sent" success is worse than an error: the user waits for mail that never arrives and blames their inbox. Every background email must check the provider send result and degrade honestly (log + surfaced error) when delivery fails.

**Apply When:**
Any flow that sends transactional email (verification, reset, notifications) — gate-critical sends must be awaited with timeout + honest `sent`/`reason` (register/otp-resend/verify-email/forgot-password pattern); only non-critical notices may be fire-and-forget, and then only via Next `after()` (never `globalThis.waitUntil`, which does not exist on this runtime).

**Supersedes:** None
**Superseded by:** None

---

## Seed Data Needs Backup-First, Markers-Only Tooling

**Context:**
Production glide-path required removing dev seed rows without touching user data (Sprint 7: `scripts/backup-seed-data.ts`, `clear-seed-data.ts`, `restore-seed-backup.ts`).

**What We Learned:**
Seed cleanup scripts must: (1) always back up before deleting, (2) target seed markers only (`*@example.com` users, seeded titles — never heuristics like "old rows"), (3) never run automatically (package.json script only), (4) treat seeded live config (`SiteConfig` keys) as untouchable. Idempotent seeds (upsert by title) prevent duplicate-seed drift.

**Apply When:**
Any environment that mixes seed data with real user data and needs a safe path to production-clean state.

**Supersedes:** None
**Superseded by:** None

---

## Self-Relation Quoting Beats Duplication for Response Posts

**Context:**
Route responses needed to reference the original request (Sprint 7: `Post.quotedPostId` self-relation + quote block in `PostCard`).

**What We Learned:**
A nullable self-FK (`quotedPostId`) with an included quote block keeps one source of truth: the request stays deep-linkable, edits propagate, and no content is duplicated. The same pattern serves reposts/quotes anywhere.

**Apply When:**
Any "respond to / share with context" feature — prefer a self-relation + rendered quote over copying content.

**Supersedes:** None
**Superseded by:** None

---

## Docs Must Be Verified Against Code, Not Trusted From Prior Runs

**Context:**
The 2026-10-08 update-ai-system deep sync honestly flagged design-system.md (2026-07-08) and testing/test-plan.md (2026-07-01) as stale instead of bumping their dates, and this execute-feature session remediated them: design tokens were blue (#1677ff) in docs vs green (#00623B) in `globals.css`, Ant Design was described as the component foundation while code has zero `antd` imports, mobile tabs listed Notifications instead of the Share FAB, and test counts were 91/9 vs actual 122/11.

**What We Learned:**
Staleness flags are load-bearing — carrying a stale date forward silently converts drift into false claims. When a doc can't be verified in a run, leave the old date with an explicit note (as was done) rather than refreshing metadata. Remediation then means grepping the code (`antd` imports, `@theme` tokens, `MOBILE_TABS`, test-file counts) and correcting each claim with its verification source in the freshness line.

**Apply When:**
Any sprint-end sync where a file can't be compared — flag it stale honestly; schedule the verification pass as its own execute-feature with a QA gate.

**Supersedes:** None
**Superseded by:** None

---

## Prefer Zero-Migration Search First; Prove Lint Baselines With Stash

**Context:**
Sprint 8 (2026-10-08) implemented unified search with Prisma `contains`/`mode: insensitive` instead of Postgres full-text/GIN indexes — no migration, no new deps, non-breaking. The same session's lint run showed 7 errors; `git stash -u` + re-lint proved all 7 pre-exist on HEAD, so only the 2 new `no-require-imports` in the new test file were fixed.

**What We Learned:**
Full-text indexes are an optimization, not a prerequisite — `contains`/`insensitive` plus the existing Redis search-cache slot ships discovery now and leaves GIN/trigram as a measured follow-up. For lint, never assume pre-existing dirt: a stash-baseline check distinguishes "already broken" (leave per non-breaking rule) from "introduced here" (must fix) in one cheap step.

**Apply When:**
Any feature where the indexed/optimized path needs a migration — ship the zero-migration query first behind the existing cache/rate-limit slots. Any QA gate with lint errors — run the stash baseline before touching anything.

**Supersedes:** None
**Superseded by:** None

---

## Scrub-able Tapes Need Scroll Position, Not CSS Animations

**Context:**
Sprint 9 (2026-10-08) — the suggestions carousel used a CSS `translateX(0 → -50%)` loop with a drag layer that reset its offset on release: users could pause it but never truly scrub forward/backward and resume. Rewriting autoplay as `requestAnimationFrame` increments of the viewport's native `scrollLeft` (modulo half the duplicated track) made user scroll/drag and autoplay share one position value — interaction just moves the same number the animation continues from.

**What We Learned:**
If the requirement includes "scroll to any point and continue from there", the scroll offset must be the animation state — CSS keyframe progress is opaque to pointer input and always fights it. Native `overflow-x-auto` + rAF gives free scrubbing, touch support, and keyboard scroll for free; pause-on-hover/focus/hidden-tab plus a resume delay preserves the ambient-tape feel.

**Apply When:**
Any auto-advancing rail/tape where users may grab, wheel, or keyboard-scroll — start with scrollLeft-driven motion, not keyframes.

**Supersedes:** None
**Superseded by:** None

---

## Optional Zod Strings Reject Empty Input — Normalize "" to undefined

**Context:**
Sprint 11 (2026-10-08) — every route share failed with "Validation failed" and no console/server trace. Root cause: the composer held an uneditable `description` state stuck at `""` and submitted it; `z.string().min(10).optional()` accepts `undefined` but rejects `""`, so the optional field failed on every payload. The quality-score hint ("add description") had no corresponding input, confirming the client/server mismatch.

**What We Learned:**
`optional()` is not empty-tolerant — any text input wired to an optional zod string must either be omitted when blank on the client or normalized server-side with `z.preprocess(v => v === "" ? undefined : v, ...)`. Do both (defense in depth): client omits, server tolerates. Also: when an API returns only a generic message ("Validation failed"), always log structured details server-side and surface the first field error client-side, otherwise real payload bugs are invisible.

**Apply When:**
Any optional free-text field validated with `.min(n).optional()` — search for the pattern `z.string().min(` + `.optional()` and check what the client sends for untouched inputs.

**Supersedes:** None
**Superseded by:** None

## Additive Schema Changes Need P2022-Tolerant Reads Until the Migration Lands

**Context:**
Sprint 13 (2026-10-08) — added `Post.isArchived/archivedAt` + two `NotificationType` values. Production previously 500'd with P2022 "column does not exist" when code referenced columns the deployed DB lacked (see issue history: feed + google-callback outages). `vercel-build` runs `prisma migrate deploy || true`, but there is still a window (and local/CI DBs) where the column is absent.

**What We Learned:**
Every query touching a new column must degrade: inject the filter/select, catch P2022/P2010, strip the additive piece, and retry once. Centralize in the safe-wrapper (`safeFindManyPosts`, `safePostFindMany`) rather than at each call site. Also: after editing a Prisma enum, regenerate the client (`prisma generate`) or `tsc` fails on the new values even though the schema is correct — the generated `enums.ts` is the type source, not the schema file. Write the migration idempotently (`IF NOT EXISTS` / `DO ... EXCEPTION WHEN duplicate_object`) following the `20260912000000_fix_missing_columns` precedent.

**Apply When:**
Any migration adding columns, indexes, or enum values — search for all `findMany`/`findUnique`/`update` touching the model and route them through (or add) a P2022-tolerant wrapper.

**Supersedes:** None
**Superseded by:** None

---

## Destructive Actions Share One Confirm + Undo Path — Never Inline Modals

**Context:**
Sprint 13 (2026-10-08) — `modalService.confirm` existed with zero call sites while the admin posts page carried its own local confirm modal and comment deletes had no confirm at all. Three different delete UXs for the same logical action.

**What We Learned:**
Put the whole destructive flow (confirm copy from config → API call → undo registration with snapshot replay → parent cache update) in one service (`postModerationService`) plus one shared menu component (`PostMenu`), and call it from every surface (feed card, detail view, admin table). Local one-off modals drift; the shared path keeps variant/copy/undo-duration consistent and makes the next destructive action a three-line call.

**Apply When:**
Any user- or admin-initiated delete/archive/remove/hide — no new `useState` confirm booleans, no direct `fetch(DELETE)` in components.

**Supersedes:** None
**Superseded by:** None

---

## Server Must Enforce What the Client Merely Omits (Immutable Fields)

**Context:**
Sprint 14 (2026-10-08) — the edit modal never sent `type`, yet PATCH accepted it, so any direct API call could morph a route request into a route. The client was "correct" and the bug still existed.

**What We Learned:**
Client omission is not a guarantee. Any field that must never change after creation (`type`, `quotedPostId`) gets a config-listed immutable set (`MODERATION_CONFIG.immutablePostFields`) stripped server-side on every update path, plus a test that POSTs the forbidden field and asserts it is ignored. Cheap to add, catches the whole class.

**Apply When:**
Any create-vs-edit schema split (`CREATE_X_SCHEMA` / `UPDATE_X_SCHEMA = CREATE.partial()`) — audit which fields survive into the partial and strip the identity-defining ones.

**Supersedes:** None
**Superseded by:** None

---

## Semantic Tokens Pair Up — Never Use a Token Halved

**Context:**
Sprint 14 (2026-10-08) — `text-warning` (pale yellow #FEF3C7, a _background_ token) used as text was invisible on light surfaces; the readable pairing is `bg-warning text-warning-text border-warning-border`, which the dark-mode overrides also honor.

**What We Learned:**
Design-system semantic colors come as bg/text/border triples. Using one leg alone (especially `text-<semantic>` for warning/error/info) breaks contrast in one mode or both. When touching badge/pill/icon tint classes, always use the full triple and check both `.dark` overrides in `globals.css`.

**Apply When:**
Any tinted badge, pill, banner, or icon circle using semantic tokens — grep for lone `text-warning|text-error|text-info|text-success` usages.

**Supersedes:** None
**Superseded by:** None

---

## Route New Notification Types Through the Central Service From Day One

**Context:**
Sprint 14 (2026-10-08) — LIKE/COMMENT wrote notifications via raw `prisma.notification.create` inside handlers, bypassing `createNotification`'s Redis invalidation, so notification badges went stale until TTL expiry. New types (DISLIKE, NEW_ROUTE, MENTION) were added straight onto the service and inherited invalidation for free.

**What We Learned:**
Every notification write goes through `createNotification` (now true for like/dislike/comment/comment-edit/post/reports/moderation-outcome paths; FOLLOW is the deliberate exception — its create+delete lives inside the follow/unfollow transactions with lifecycle-coupled cleanup the service has no API for). Central routing makes fan-out shape, self-filtering, and cache invalidation uniform; the tests mock one module.

**Apply When:**
Any new event that notifies a user — call `createNotification`, extend `NOTIFICATION_REGISTRY` + notifications page `TYPE_ICONS`, and add the enum value via an idempotent guarded migration.

**Supersedes:** None
**Superseded by:** None

## Rank Badges Should Derive From Existing Timestamps — Never New Columns

**Context:**
Sprint 16 (2026-10-08) — the "First N Users" badge needed join-order qualification without a migration (prod DB had just been cleaned; any schema change would reintroduce P2022-window risk and a vercel-build dependency).

**What We Learned:**
Rank via `COUNT(where createdAt < mine OR (createdAt == mine AND id < mine)) + 1` over the existing indexed `User.createdAt` gives a deterministic 1-based join rank with zero schema change. Keep the N/limit/label/enabled in a `SiteConfig` KV row (seeded default + admin validation + Redis invalidation) so the badge is toggleable without deploys, and expose both a per-user status endpoint and an ordered list endpoint — the list endpoint is what future rewards/filtering work will consume.

**Apply When:**
Any "earliest/top-N by join/creation" badge, cohort, or allowlist — prefer counting over `ORDER BY ... OFFSET` for single-user rank (O(1) round trip), and reserve full ordered takes for the admin/list view.

**Supersedes:** None
**Superseded by:** None

## One-Time Build Hooks Must Be Unhooked, Not Just Documented

**Context:**
Sprint 15 wired a one-time prod DB reset into `vercel-build` with a ⚠️ comment to remove it later; Sprint 16 confirmed the clean build and removed the invocation while keeping the script manual-only.

**What We Learned:**
A `|| true`-guarded destructive step in a build command is one forgotten deploy away from data loss — comments don't prevent execution. The safe pattern is: unhook immediately upon confirmation (same session if possible), keep the script file for manual runs, and record the unhook in `task-queue.md` (flip the ⚠️ to ✅ with date) plus `system-architecture.md` so no future agent re-adds it.

**Apply When:**
Any one-time migration/reset/backfill hooked into build/CI — treat "confirmed done" as a same-session removal task, not a backlog note.

**Supersedes:** None
**Superseded by:** None

---

## API/Page Contract Drift Crashes Pages, Not Just Types

**Context:**
Sprint 17: `GET /api/admin/stats` returned 6 fields while `app/admin/page.tsx` consumed 7 (`recentUsers`) — TypeScript couldn't catch it (both sides typed locally, no shared contract), so the dashboard crashed at runtime on every visit.

**What We Learned:**
When an API and its page are typed independently, adding a consumer field without updating the producer compiles clean and explodes in prod. The cheap guards are: (1) return the full shape the page needs in one batched read, (2) default missing collections to `[]` at the consumption site so older/cached payloads degrade to empty states instead of TypeErrors, (3) treat "page expects X, API returns Y" as a first-check item in any "page crashes" report.

**Apply When:**
Any "page errors on load" investigation — diff the page's data accesses against the API's actual JSON before looking anywhere else.

**Supersedes:** None
**Superseded by:** None

## Enum-Literal Case Drift Silently Disables Features

**Context:**
Sprint 17: Prisma `UserRole` is `USER | ADMIN`, but client code compared `role === "admin"` and registered nav roles as `["admin"]` — every admin entry point was dead code for real admins, with zero errors or warnings.

**What We Learned:**
String-literal role checks drift in case across layers (DB enum vs UI strings) and fail closed-silently. A single canonical predicate (`isAdminRole()`, case-insensitive) plus case-insensitive registry matching eliminates the class; widen the shared type so the compiler accepts the canonical literals.

**Apply When:**
Any role/permission/enum-string comparison — centralise in config, compare case-insensitively, and cover both cases in tests.

**Supersedes:** None
**Superseded by:** None

---

## Browser-Direct Third-Party Calls Are a Policy + Reliability Liability — Proxy Ownership

**Context:**
Sprint 19: location inputs called Nominatim browser-direct (usage-policy violation — Nominatim requires server-side identification), tiles depended on Carto `?apiKey=` params that broke when keys rotated, and routing preferred keyed Mapbox/ORS so maps degraded whenever keys were missing.

**What We Learned:**
Any third-party call the browser makes directly inherits that provider's browser policy (User-Agent bans, referrer rules, CORS, key exposure) and fails hard on key rotation. The durable shape is: a single server-owned proxy service per domain (`mapProxyService`: Redis read-through + per-IP bucket + server identity headers + ordered provider chain with a local-compute final fallback) and clients that only ever call the internal proxy. Keyed providers become env-gated overrides that are skipped — not failed — when unset, so the keyless path is continuously exercised and provable with all keys removed.

**Apply When:**
Any integration where the provider has a browser-use policy (geocoding, routing, tiles) or where key rotation has ever caused an outage — default the client to the internal proxy and keep the keyed path as an override, never the primary.

**Supersedes:** None
**Superseded by:** None

---

## Marker Drift Is an Anchoring + Identity Bug, Not a Tiles Bug — Share the Pin

**Context:**
Sprint 20: polylines tracked coordinates correctly through pan/zoom while pins drifted. The polyline is drawn in map space (always exact); pins are HTML elements positioned by the Marker layer, so any per-renderer divergence (missing `anchor="center"`, varying pixel sizes, keys containing lat/lng that remount on every move, stale-closure label logic) shows up as drift that looks like a tile/projection fault.

**What We Learned:**
Fix pins at the Marker layer, not the tile layer: one shared pin component with an explicit center anchor + zero offset, fixed visual size, stable React keys (index-based, never coordinate-based), and numbering derived from stop order (index + 1) rather than object identity. Keep all of it in a token-only config (`MAP_PINS_CONFIG`) so every renderer paints the identical marker. Same session: when users report one theme renders clearer, the cheapest correct fix is visual parity (same style/filter params in both themes), not a new dark style.

**Apply When:**
Any map marker looks "almost right" but won't hold its coordinate, or theme-specific map rendering diverges — centralize the marker + style params before touching providers or tiles.

**Supersedes:** None
**Superseded by:** None

---

## Deletion Safety Is a Lifecycle, Not a Row Delete — Archive First, Anonymize Later

**Context:**
Sprint 21: policy promised account deletion but no flow existed. Deleting a User row outright would cascade-delete posts (violating the "anonymised post data retained" clause), orphan counters, and leave no grace or recovery path.

**What We Learned:**
Model deletion as request → archived grace → finalize: archive posts immediately (feeds go quiet), snapshot the contact address on the request row (final email must survive PII wipe), capture interacted post ids before wiping likes/bookmarks (denormalized counters go stale otherwise), and anonymize the user row in place (stable id keeps posts linked). Guard the last admin, keep reversals in-app-only (no email abuse vector), and cap cron finalization per run. Off-platform backup recovery (30d) needs only a documented note, not platform code.

**Apply When:**
Any destructive user-data operation with retention grace, anonymization requirements, or denormalized counters — snapshot contacts first, capture affected ids before wiping, finalize idempotently.

**Supersedes:** None
**Superseded by:** None

## Sprint 22: literal-{{var}} sends + PROJECT_ENV split-brain

- **Symptom:** admin-composed mails arrived with raw `{{identifier}}` text (variable values never supplied or keys mismatched); `PROJECT_ENV=production` left insecure cookies + dev logs because only 2 prisma files honored it.
- **Root causes:** (1) interpolation only replaced supplied keys, leaving the rest verbatim, and preview deliberately filled gaps with the identifier; (2) env reads were scattered `process.env.NODE_ENV` with no central resolver.
- **Fix pattern (reuse):** interpolate against `{{(\w+)}}` globally with merged defaults and empty-string fallback + HTML-escape values; keep `{{...}}` intact through the sanitizer via placeholder-token protection; resolve env once in `lib/config/env.ts` (PROJECT_ENV wins) and consume `isProduction()/getEffectiveEnv()` everywhere. Verified: builder round-trips + sanitizer + env precedence executed under node strip-types.

## Sprint 25: fetch-or-empty providers leak raw keys — seed from bundle + cache

- **Symptom:** offline UI showed `guest.signIn`-style identifiers; locale fetch failure reset translations to `{}`.
- **Root causes:** (1) provider initialized empty and only filled on network success; (2) SW had no `/locales/` handling so the fetch failed offline with nothing to fall back to.
- **Fix pattern (reuse):** seed client providers from a bundled import, overlay last-good localStorage synchronously, then revalidate over network; add the fetched asset to SW precache + runtime handling in the same sprint. Applies to any fetch-driven provider (locales, site-config, feature flags).
- **Supersedes:** None
- **Superseded by:** None

## Sprint 25: reuse tables/types via marker rows instead of migrating

- **Symptom:** three "new" needs (platform reviews storage, thank-you notification type, FAQ pidgin) each suggested a migration or schema/config expansion.
- **Root causes:** defaulting to new-model thinking before checking whether an existing unique constraint or type already expresses the need.
- **Fix pattern (reuse):** self-pair `UserReview` (+@@unique = one-per-user + upsert), REWARD+allowSelf thank-you, FAQ_PCM beside source copy — zero migrations, zero new tables, admin surfaces keep working. Migrate only when the need genuinely exceeds the existing shape.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 24: PWA offline without session invalidation

- **Symptom:** offline/network blips cleared auth state (AuthProvider set null on any fetch failure); SW precached auth-gated routes (login-redirect caching); push only auto-subscribed with no user control or server fan-out.
- **Root causes:** (1) auth fetch treated network/5xx/non-JSON as unauthenticated; (2) SW had no never-cache list for /api/auth|push|admin; (3) notificationService wrote in-app rows but never fanned out to Web Push.
- **Fix pattern (reuse):** only double-401 clears session (transients keep last-known user); centralize PWA policy in `lib/config/pwa.ts` with predicate helpers and mirror in sw.js; fan out push from the single notification write-point (fire-and-forget, never throws, unknown-type fallback).

## Sprint 27: silent booleans + timer/throttle split-brain behind "nothing happens"

- **Symptom:** push Enable clicked with zero feedback and no subscription; OTP "invalid/expired immediately" plus re-sends that never arrived with no explanation.
- **Root causes:** (1) `subscribeToPush(): Promise<boolean>` collapsed denied/unsupported/offline/no-VAPID into one `false` with no permission request ever issued; (2) client resend timer (45s) disagreed with the server throttle (shared auth bucket 10/15min) and send failures returned success, so the UI promised mail the server never delivered; single shared OTP key meant resends invalidated the code the user was holding.
- **Fix pattern (reuse):** never return a bare success/failure for user-initiated device or delivery flows — return `{sent|ok, reason, retryAfter, expiresIn}` and let the UI adopt the SERVER timer; request permissions inside the click gesture; persist device state locally (flags + dismissal timestamps) so prompts behave offline; keep compat wrappers when widening return shapes. Applies to any future device-permission or email/SMS-code flow.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 28: server-dropped fields + dual readers behind "preview right, post wrong"

- **Symptom:** share-preview traced start → stop → destination perfectly, but the posted view rendered start → destination, skipping the stop.
- **Root causes:** (1) the API destructured a validated field (`waypoints`) out of the payload and never persisted it — schema acceptance is not storage; (2) TWO readers each wrong in a different state — post detail treated intermediates-only `waypoints` as the full route (origin/destination loss when present), and the start/end fallback skipped stops when absent. Preview-vs-read divergence always means: check what the write path actually stores first, then check every reader's shape assumption.
- **Fix pattern (reuse):** one canonical builder owned by config (`buildRoutePinsFromPost`) consumed by ALL readers + one shared trace hook (`useRouteTrace`) — preview and post views become structurally incapable of diverging. Writes must round-trip every schema-accepted field (or explicitly reject it); silent destructuring-drops are a defect class to grep for after any schema widening.
- **Supersedes:** None
- **Superseded by:** None

## Fix-build 2026-10-09: silent coercion + silent filtering behind "shared but never posted"

- **Symptom:** composer accepted an empty stop and a fare range, showed a saved-draft toast, closed as though published, but no post existed; only a bare "Validation failed" with no field highlight.
- **Root causes:** (1) `parseFloat`/`Number()` on free-text fares silently coerces ranges ("400-500" → 400) while the server rejects raw strings — client and server disagreed with no inline signal; (2) the composer `.filter()`ed empty-location steps before submit, so the payload no longer represented what the user saw; (3) submit failure paths returned silent `false` with no form banner, so a missed toast read as success.
- **Fix pattern (reuse):** strict whole-string fare parsing (`parseFareInput`) shared by composer + schema preprocess; validate every visible step (filtering is for previews, never for submit payloads); every submit path surfaces a sanitized first-field message inline + via toast and never clears drafts/closes on failure. Applies to any future free-text-numeric composer field.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 31: local-only handlers + write-once scores behind "works here, dead there" and "stuck at 10"

- **Symptom:** share icon worked on profile posts but did nothing on feed/search/detail/bookmarks; trust stayed 10 despite new followers and interactions.
- **Root causes:** (1) share logic lived in one leaf component while the shared card only delegated to an optional callback with no fallback — every new surface had to re-implement sharing and none did; detail's buttons were placeholder stubs; (2) the scorer's input shape excluded author/community growth AND the only recompute trigger was post-create, so stored scores could never move; create-time and worker-time scorers disagreed, masking the freeze behind a flash; (3) the breakdown tooltip rendered synthetic offsets, so no one could see the freeze from the UI.
- **Fix pattern (reuse):** lift leaf-only behaviour into a zero-dep service + hook the moment a second surface needs it, with a fallback inside the shared component (override prop kept for callers/tests); make scores a function of everything the product claims matters, recompute on every signal that feeds them (fire-and-forget, bounded fan-out), compute honestly at write time (no optimistic-then-overwrite), and render the REAL components in every breakdown UI so staleness is visible instead of hidden. Additive optional inputs preserve legacy scores exactly — prove with arithmetic before changing weights.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 33: derived public_ids + post-commit destroys behind "deleted but still billed"

- **Symptom:** post/draft/account deletes removed DB rows but Cloudinary bytes in `along/posts/*` lived forever — Post.images stores only secure_urls and no delete path ever called destroy.
- **Root causes:** (1) upload returns secure_url only with no public_id column, so cleanup felt "impossible without a migration" and was never built; (2) external side-effects were assumed to belong inside the DB transaction, so the ACID-safe ordering (commit first, best-effort destroy after, never throw) was never stated as policy.
- **Fix pattern (reuse):** derive public_id by parsing secure_url (`/upload/(vN/)?<id>.<ext>`) + enforce an `along/*` allowlist, and codify commit-first/best-effort-after as config (`MEDIA_CLEANUP_CONFIG`) with per-flow toggles + a live-post reference guard on the client-discard endpoint (publish-then-discard reuses URLs). Account finalize keeps anonymized post images per retention policy and purges only legacy avatar URLs. Applies to any future external-asset lifecycle (e.g. video, attachments).
- **Supersedes:** None
- **Superseded by:** None

## Sprint 34: dead config weights + raw-API error pages behind "sound but static" and "landed on an api route"

- **Symptom:** feed ranking ignored location despite a tuned `locationBonus`, ignored admin tuning despite a seeded SiteConfig key, and ignored trust despite computing it live; denied location toasted on two surfaces but only inlined on navigation; a minority of invitees saw an api route in the address bar.
- **Root causes:** (1) config values with zero code references (locationBonus) and documented-but-unread store keys (feedAlgorithm) look tunable but change nothing — audit must grep refs, not just read values; (2) error paths on browser-navigated OAuth routes returned JSON, so any refresh/copy during the transient /api window stranded users on a non-page; (3) leaf-duplicated copy strings drifted, hiding which surfaces had feedback and which didn't.
- **Fix pattern (reuse):** centralize user-facing copy in zero-dep configs consumed by every surface; make ranking additive-bonus-only for new signals (absent = exact-zero, ordering provably unchanged); resolve admin config with hardcoded fallback at call time; redirect (never JSON) on any GET route a browser can display, preserving referral context; add catch-all page redirects for legacy/hand-typed URL shapes. Applies to any future ranking signal or shareable-link flow.
- **Supersedes:** None
- **Superseded by:** None

## Fix-build 2026-10-11: hover-only controls + full-bleed dialogs behind "works but invisible" and "map ate the sidebar"

- **Symptom:** a working remove button nobody could see (especially on touch); an expanded map that painted over the adjacent suggestions rail.
- **Root causes:** (1) `opacity-0` + `group-hover:opacity-100` gates discovery on hover, which touch devices never fire — the control is hidden for a whole input modality; (2) `fixed inset-0` + `100vw/100vh` with no max-width cap or scrim is a layer, not a dialog — and `100vw` includes the scrollbar, so it also scrolls sideways.
- **Fix pattern (reuse):** removal/destructive actions are persistently visible (`opacity-100`); hover/focus only deepen, never reveal; touch-size targets (≥28px) with focus rings. Expansions render as centered dialogs (`inset-0` flex center + `w-full max-w-*` panel + scrim + Escape/backdrop close + resize/refit on open); never `100vw` — prefer `inset-0` wrappers with capped panels. Both behind zero-dep config so copy/classes stay tunable. Applies to any future thumbnail-grid action or fullscreen-capable viewer.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 35: session-helper selects are not status sources behind "linked but the UI forgot"

- **Symptom:** password-linking succeeded at the API (DB updated, success toast shown) but after reload the panel showed "Add a password" again and Email & Security never offered Change-password — linking looked non-persistent.
- **Root causes:** (1) `getUserFromRequest()` deliberately selects a safe subset (no `password` hash), but `GET /api/auth/link/status` cast the result to include `password` and derived `hasPassword` from a field that was always `undefined` — a type-cast lie the compiler could not catch because the helper returns `Record<string, unknown>`; (2) redirect result flags (`?success=`/`?error=`) had no renderer on the landing page, so link outcomes were silent.
- **Fix pattern (reuse):** status routes re-read the authoritative columns from the DB per call and return booleans only (hash never leaves the server); never derive status from a casted session object — if the helper doesn't select it, it isn't there. Any redirect-flag handoff (`?success=`/`?error=`) ships with a one-shot renderer (toast + `history.replaceState` cleanup) on the landing page in the same change. Applies to any future connected-state or verification-status surface.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 36: hidden inputs under validation + linkage-blind edit payloads behind "filled but flagged" and "edit cleared the tag"

- **Symptom:** Share stayed disabled with "fix the highlighted fields" while every visible field looked filled (after an edit→draft→repost-as-response flow); editing a ROUTE_RESPONSE dropped its "Responding to" tag in the UI even though the DB row kept it.
- **Root causes:** (1) destination fare/vehicle inputs are hidden by `ROUTE_STEPS_CONFIG`, but `validateRouteComposer` still validated them — legacy values carried by edit prefills/restored drafts flagged invisible errors; (2) `EditPost` had no linkage fields and `GET /api/posts` never included `quotedPost`, so the composer literally could not display the tag and drafts saved mid-edit were unlinkable (drafts UI was edit-gated); (3) prefill seeded `_fareRaw` even for the hidden destination step, manufacturing a raw value the user could never see or fix.
- **Fix pattern (reuse):** any input hidden by config must also be skipped by validation (mirror the hide rule as skip flags in the validator, zero-dep); edit payloads carry display-only linkage (`type/quotedPostId/quotedPost`) that the server continues to treat as immutable; prefill/restore never seed raw values for hidden inputs (submit still strips via normalize). Applies to any future conditionally-hidden composer field.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 37: service return types that lie + stash-verified pre-existing failures

- **Symptom:** `tsc` failed in `trustBreakdownConsistency.test.ts` (`validityBreakdown`/`validityScore`/`validityTier` "do not exist") even though the runtime attaches all three; plus 3 jest failures in `searchService`/`registerEmailDispatch` and lint errors in untouched files.
- **Root causes:** (1) `attachLiveBreakdownsToPosts` declared `Promise<T[]>` while spreading attached fields onto each row — the generic erased what the function guarantees; (2) unrelated suites assert on auth/search file contents untouched by this sprint.
- **Fix pattern (reuse):** widen the service return to `T & Partial<Attachment>` (additive, all call sites keep compiling, failures stay expressible via Partial); verify pre-existing status with `git stash -u` + re-run rather than assuming — stash must include untracked files or new-file errors pollute the baseline. Leave unrelated red suites to their owners; record as residual risk in the session log instead of scope-creeping into auth/search code.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 38: degraded-but-rendering UI hides data bugs + pure-scorer trust changes

- **Symptom:** profile posts "looked fine" but missed the response marker and showed legacy trust numbers — no error anywhere, because `PostCard`/`TrustBadge` degrade gracefully on absent props.
- **Root causes:** (1) page-level minimal projections stripped fields the shared card needs; graceful fallbacks made the loss invisible except by side-by-side comparison with feed; (2) corroboration's exact-tag ±7d count was near-degenerate on real data (case, tagless posts, short window).
- **Fix pattern (reuse):** when a shared component degrades gracefully, audit prop-forwarding at every call site (not the component); keep trust math in pure, unit-tested engine functions with config weights, and DB evidence in one best-effort service with per-leg fallbacks — scores stay explainable and reads never fail because of trust.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 39: transparent-overlay carets, initials-div avatars, and tests that assert on prose

- **Symptom:** comment box caret invisible (only textbox platform-wide); comment avatars differed from every other surface; feed comment icon reloaded the page while profile opened a modal; 3 red suites nobody owned.
- **Root causes:** (1) `caret-current` inside a `text-transparent` overlay inherits transparency — caret-color must be explicit whenever text is intentionally transparent; (2) comments hand-rolled initials divs instead of the shared `AppAvatar`, and one caller passed a display name as `userName`, breaking both avatar and profile link; (3) feed wired `onComment` to `window.location.href` while profile built an inline modal — no shared modal existed; (4) file-content tests matched history comments (`sendInBackground`/`globalThis`/`void send…` in prose) and asserted reference equality on a service that re-enriches cached rows (new object by design).
- **Fix pattern (reuse):** any transparent-text overlay sets `caretColor` explicitly from config; every user face renders through `AppAvatar` (fallback is its job, not callers'); one shared modal component per interaction, reused at every call site; file-content assertions must target code-only markers (or keep history prose free of asserted substrings), and cache tests assert deep equality when enrichment is intended. Pre-existing red suites get fixed when the directive owns them — recorded, not scope-crept.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 40: leg-only detail scorer behind "every post is 42%" + CTA-less boundaries + unreachable search

- **Symptom:** posts with 5 photos, 4 tags, long descriptions and full fares all showed detail 42%; error pages auto-logged but offered no report path; /search existed but had no nav/footer/profile entry.
- **Root causes:** (1) the detail scorer read only per-leg distance/steps/location/description while the composer never produces distance/steps — every leg collapsed to 15+15=30 → ×1.4 = 42, and the service/create paths never passed post-level richness at all; (2) boundaries filed reports but exposed no toast CTA, no prefill builder, and the report form read no query params — each half existed without the other; (3) search links were assumed present because explore has a search input, but the input filters the map while /search is a separate page nobody linked.
- **Fix pattern (reuse):** score what the product claims matters (photos/tags/description/vehicles/fares/stops) as additive capped bonuses over an untouched legacy base — no-context callers prove parity arithmetically; pair every auto-filed report with a sanitized prefill + URL builder + toast/inline CTAs that reuse existing slots (toast action, form initialValues) instead of new component APIs; verify page reachability by grepping registries (nav/footer/quick-links), not by assuming adjacent features link it.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 41: patient trigger vs racy signup — same template, different budgets

- **Symptom:** signup verify mails never arrived while the profile "resend" flow delivered every time; users blamed unverified-status blocking.
- **Root causes:** (1) register raced each mail against 6s outer / 5s inner timeouts while the profile trigger awaited one send with no outer race — cold starts timed out on signup, delivered on profile, same template both sides; (2) every failed send left the 60s issuance cooldown in place, so the retry for a mail that never left read as "wasn't sent any" (429); (3) the OTP-screen resend used the otp-only template while register/profile used verifyEmail (OTP + link) — three shapes for one purpose.
- **Fix pattern (reuse):** give every gate-critical send the same patient, config-driven budget on BOTH timeout layers (outer race + inner provider timeout must agree); on delivery failure lift the throttle but keep the code (retry-immediate, abuse still capped by the shared rate bucket, response cooldown 0 so client timers agree); one template per purpose across all entry points (flag-driven with fallback). Audit "X blocks its own delivery" hypotheses with a test, not an assumption.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 42: single-row votes need both flags on every read path

- **Symptom:** feed card correct, detail view wrong — dislike button dead, count stale, active fill missing; comment composer avatar differed from every other surface.
- **Root causes:** (1) one `Like` row encodes LIKE|DISLIKE but readers only derived `_isLiked` — the second state was unrepresentable downstream, so clients hardcoded `false`; (2) the detail engagement bar was built without wiring the second vote action at all (no `onClick`); (3) toggle endpoints punish wrong payloads silently — sending DISLIKE on unlike _adds_ a dislike instead of removing the like; (4) auth context type dropped a field the API already returned, starving all downstream avatar renders.
- **Fix pattern (reuse):** when one row encodes N states, every read path must derive all N viewer flags (batch, never-throw); every writer must honor toggle-off values and send the repeat-same-type payload; shared caches must mirror the reducer's mutual exclusion; context types must carry every field its API selects (audit type-vs-select drift when adding viewer-derived UI).
- **Supersedes:** None
- **Superseded by:** None

## Sprint 43: a request queue without per-item actions is a dead end + period deltas need equal windows

- **Symptom:** admins could see deletion requests but do nothing with them (only bulk "finalize due"); dashboard KPIs compared mismatched windows (today-vs-yesterday, total-vs-7-days-ago) so a quiet period could still render a trend.
- **Root causes:** (1) the finalize route exposed one bulk action while the queue UI exposed zero per-row actions — the pipeline existed but had no handles; (2) dashboard deltas were hardcoded to 7-day anchors with no period parameter, so any toggle would have compared apples to oranges.
- **Fix pattern (reuse):** expose one service function per user intent (request / cancel / finalize-one / delete-now), one API action each, one UI affordance each — all through the same transaction; never offer undo without a real reversal path (say what recovery actually is instead); compare every KPI window against its previous equal-length window and let zero-vs-zero read flat via the existing `pctChange`/`formatDelta` null/zero contract.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 44: view-only is a server rule, not a UI hide + one dropdown component beats N inline action rows

- **Symptom:** deleted (anonymized) accounts still offered verify / resend-code / make-admin actions that could never meaningfully succeed (recovery is off-platform from backups); tables with 5–8 inline row buttons elongated rows and invited mis-taps.
- **Root causes:** (1) the row-action allow-list lived implicitly in JSX conditionals with no server counterpart — the UI hid nothing for deleted rows and the API applied verify/role changes to any id; (2) every admin table hand-rolled its own inline button row, so colors, order, and gating diverged per page.
- **Fix pattern (reuse):** encode lifecycle visibility as config + pure predicates (`ADMIN_USER_FILTERS`, `allowedUserRowActions`/`canShowUserRowAction`) consumed by BOTH the UI (dropdown builder) and the API (target partition + honest skip counts); build one metadata-driven dropdown (`AppTableRowActions` over `AppDropdown` with `className` passthrough) so colors survive the move and every table shares the compact trigger. Filters that are complements of others (Active = NOT pending AND NOT deleted) combine with search via AND, never by replacing the search clause.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 45: tooltips need one shared host, and Number(null) is 0

- **Symptom:** charts had no hover detail (only native `<title>` on string-built SVG dots, nothing on bars); a live check showed `formatChartCount(null)` rendering `"0"` — a fake zero in a tooltip.
- **Root causes:** (1) every chart hand-rolled its own SVG strings, so there was no shared hover layer — tooltips were impossible without per-page rewrites; (2) `Number(null) === 0` / `Number("") === 0`, so naive `Number()` coercion turns missing data into a confident zero.
- **Fix pattern (reuse):** build one mouse-follow tooltip host (`SvgChartContainer` maps pointer-x → nearest column; `ChartTooltipWrapper` for HTML rows) fed by one colour/format registry, and keep native `<title>` as the no-JS fallback; in every formatter, reject `null`/`undefined`/`""` BEFORE numeric coercion and let genuine `0` pass through. Live-verify pure helpers with `node --experimental-strip-types` when jest can't run in the runner.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 46: prompts nobody can see + env-name split-brain behind silent push

- **Symptom:** offline worked, but push never fired and neither a push prompt nor an install notice was ever observed.
- **Root causes:** (1) opt-in UI mounted only on a rarely-visited page (PushManager solely on /notifications) and no install component existed — discovery was structurally impossible; (2) server/client read different env names (sender accepted VAPID_PUBLIC_KEY ?? NEXT_PUBLIC_VAPID_PUBLIC_KEY, client route only the former) so Enable collapsed to silent no-vapid in prod; (3) lifecycle-coupled writes that bypass the central service (FOLLOW transaction) silently dropped its side-effects (invalidation + fan-out); (4) conditional-hook call (usePathname only on one variant) would have tripped lint/rules-of-hooks.
- **Fix pattern (reuse):** mount discovery UI globally but non-interferingly (fixed, capped, collapsible-to-pill, z-ordered below the offline banner, page-aware suppression where the inline variant already covers it); keep env-name parity between every producer and consumer of the same secret; when a write must bypass the central service for transactional reasons, mirror its side-effects explicitly post-commit (fire-and-forget, never-throw); always call hooks unconditionally and branch on the result.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 47: inline-style CSS vars don't theme + visibility is a data rule, not a UI filter

- **Symptom:** PWA notices looked identical in dark mode (static light styling); deleted/archived accounts appeared in suggestions/carousels and could be followed; avatars rendered 4 different ways (raw img, initials spans, partial AppAvatar) across suggestions/admin/lists.
- **Root causes:** (1) PWA components styled via bespoke `var(--brand/--bg-base/--info-soft/--offline-bg…)` vars with light-only fallbacks — those vars never flip under `.dark`, unlike the canonical `--color-*` tokens; literal emoji/↓/✕/? glyphs instead of the lucide icon library; help affordances with no route to the FAQ they document. (2) visibility lived nowhere centrally — suggestions/search/follow/lists each had their own (absent) filtering, counts used raw `_count`, and the follow API had no gone-state. (3) avatar rendering was per-page hand-rolled because two admin APIs omitted `avatarConfig`/`verified`, so pages _couldn't_ use the canonical component.
- **Fix pattern (reuse):** style every inline-style surface on `--color-*` tokens (fallbacks = light values; `.dark` overrides do the flipping — for intentionally-dark chrome use the inverted text-primary/bg-base pair); encode account lifecycle once as config + pure predicates (`isDeletedUser`/`isArchivedUser`/`isVisibleUser`/`visibleUserWhere`/`filterVisibleUsers`) consumed by APIs (Prisma filters + 410 gone-state + live counts with `_count` fallback) AND clients (stale-cache defense + disabled affordances); make APIs select everything the canonical component needs (`avatarConfig`, `verified`) so no page has an excuse to hand-roll. Verify with token-var/emoji sweeps + `tsc --strict` on zero-dep configs + node execution of the pure helpers when jest can't run.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 49: auto-skipWaiting is a silent-stale trap — updates need a prompt, not a yank

- **Symptom:** PWA worked offline and push fired, but installed clients ran stale shells indefinitely: `sw.js` install called `skipWaiting()` unconditionally, the registrar never called `registration.update()`, and no UI ever told the user a new version existed — the project-plan even claimed "service worker update flow" done when only the silent path existed.
- **Root causes:** (1) auto-`skipWaiting()` + `clients.claim()` takes control without reloading, so the loaded page keeps running OLD hashed JS until the next navigation — the update is "applied" but invisible; (2) browsers only revalidate `/sw.js` on navigation, so day-long installed sessions never discover updates without explicit `registration.update()` polling (interval + visible/focus/online); (3) `controllerchange` reloads must be guarded (first install none→worker must NOT reload; one reload per episode via sessionStorage) or they loop.
- **Fix pattern (reuse):** SW installs WITHOUT skipWaiting and broadcasts readiness; the client detects `updatefound`→waiting (only when already controlled) and shows a collapsible, snoozable Update prompt; the user's tap posts SKIP_WAITING and `controllerchange` reloads exactly once; bump the mirrored CACHE_VERSION in both `pwa.ts` and `sw.js` on every SW change so old caches purge. Keep the whole vocabulary (`PWA_UPDATE_CONFIG` + `PWA_SW_MESSAGES`) in config so copy/timing/TTLs stay metadata-driven.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 50: metadata-JSON beats a migration for optional attachments; merge beats replace for recall

- **Symptom:** reports needed screenshots; suggestions buried in one geo source never surfaced; per-step stop names invisible to search; floating cards covered the mobile Profile tab.
- **Root causes:** (1) first instinct was a new `images` column — but every reader would need a P2022 window for zero query benefit (images are render-inline, never filtered); the existing `metadata` JSON was already the absent-tolerant channel. (2) first-provider-wins geocoding made recall = coverage of ONE source; each free source has different gaps, so any single pick (even a "better" one) keeps a miss class — only merging removes it. (3) floating surfaces each picked their own `bottom:` in isolation, so lanes collided by construction; the tab bar they had to clear lived in a different component with no shared contract.
- **Fix pattern (reuse):** optional, render-only attachments ride in existing JSON columns with a sanitizer (no migration when nothing is ever queried by the field); recall problems get merge+dedupe across all free sources with rank-only bias (never filter, never prompt); floating surfaces share one lane registry (`FLOATING_UI_CONFIG`) where every bottom offset is declared once with the navbar height it must clear. Verify with node --check + strip-types execution of pure helpers when jest can't run.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 51: one resolver for every notification click; append-only beats page numbers for bulk state

- **Symptom:** notifications mostly landed on profiles; push and in-app disagreed; admin "view more" was deferred over bulk-selection loss; bug duplicates appeared despite a single admin mail.
- **Root causes:** (1) routing lived inline in the click handler with a profile fallback, while push had a second independent table — two truths diverged; commentId was stored but never consumed. (2) page-number pagination replaces the row array, discarding the selection Set's context; cursor-append preserves it by construction. (3) at-most-once submit needs both a client key AND a server content-window — a boolean `sending` flag covers neither retries-after-timeout nor multi-tab.
- **Fix pattern (reuse):** single `resolveXRoute(input)` in config consumed by every surface (in-app + push + future); admin lists paginate cursor-append with id-dedupe and keep selection outside the list; mutating submits take `Idempotency-Key` (header or body) plus a short same-actor+content dedup window, stored in existing JSON columns when no migration is warranted.
- **Supersedes:** Sprint 50 follow-up "remaining admin tables deferred (bulk-select state risk)".
- **Superseded by:** None

## Session 2026-10-13: dock side as one value; slots beat reordering; last-resort providers stay gated

- **Symptom:** round buttons on the wrong side with no per-surface control; upload-after-submit baked by form ownership of its submit; landmark queries only as good as one index's coverage.
- **Root causes:** (1) dock side lived in one shared value consumed only by the buttons it should move — the fix was that value, not per-component classes. (2) the form owned its submit so page-level ordering was impossible without a slot between fields and submit. (3) label shaping dropped address parts before display, and the one cities-only provider could never answer landmarks — recall needed a last-resort OSM named-feature source, gated so short queries never trigger global scans.
- **Fix pattern (reuse):** shared placement = one config value consumed only by its surfaces; form-level ordering = optional `beforeSubmit` slot (absent = legacy); provider gaps = append a gated last-resort source with safe fallthrough for unknown future providers, and render every address part the upstream already returns.
- **Supersedes:** None
- **Superseded by:** None

## Session 2026-10-13: sequential fan-out is a correctness bug under a serverless budget, not just slowness

- **Symptom:** location suggestions fired only for near-exact address starts; every broad query (roads, towns, landmarks) returned blank despite healthy upstreams.
- **Root causes:** (1) four providers awaited sequentially at 8s each inside a 10s budget — the merge could never complete for uncached queries, so latency became emptiness; cached address queries masked it. (2) suggestion gates (min chars, debounce, limit) were hardcoded in four places, so "loosen the lookup" meant hunting call sites. (3) bias applied only after fetch, leaving upstream result windows full of far matches before the slice.
- **Fix pattern (reuse):** parallel bounded fan-out (`Promise.all` + per-leg timeout race) with slow legs as empty-only fallbacks in ONE extra batch; suggestion tuning (min/max/debounce/limit/timeout/fallbacks) in one config consumed by route + every client; bias at BOTH layers (upstream params rank-only + server re-rank, never filter); exact-intent inputs (coordinates) pinned ahead of ranking.

Sprint 71: Plus Codes (Open Location Code) looked like a "call another provider" problem; every free keyless geocoder either rejects them or says "handle client-side". The cheap correct fix is a ~150-line pure port of Google's Apache-2.0 OLC algorithm (classify → decode → recoverNearest against viewer bias) unit-tested against the official `test_data/*.csv` vectors — zero new upstreams, zero keys, works offline. Same lesson as traffic estimation: audit whether a keyless API actually exists before inventing a provider slot. When pasting-friendly input classes grow (parens, plus codes, house numbers), put each new parser next to the existing `parseCoordinateQuery` in one config module so the service only ever does intent-class → pin-build, and gate expensive rescues (address strip, Overpass addr scan) behind the existing "merge was empty" round-2 so the happy-path latency contract stays bit-identical.

- **Supersedes:** None
- **Superseded by:** None

## Sprint 52: unaudited lifecycles hide in plain sight; tests are the parser contract; one section serves three surfaces

- **Symptom:** admin audit trail showed user/email/blog/post rows but zero report rows despite a full report lifecycle; Studio reopened stored posts with missing intros and flattened headings; blog had no discovery surface outside /blog.
- **Root causes:** (1) audit hooks were added per-feature (users/email/blog/posts) with no checklist, so the newer report routes never got them — the trail looked complete but wasn't. (2) the block parser only matched its known tag set and consumed wrappers whole, so anything outside the set (bare text, section/figure/h4/br, nested blocks) silently vanished, including via the >300-char wrapper skip. (3) each public surface owned its own layout, so a new content section meant three implementations unless deliberately shared.
- **Fix pattern (reuse):** audit every mutating lifecycle at creation time (`void logAudit`, new entity/action vocabulary + display entries); grow parsers by capturing gaps (inter-tag text), widening accepted tags, and recursing into wrappers — while keeping the byte-level contract existing suites assert; build one client section with an optional `initialPosts` prop so server and client pages share it (server feeds, clients fetch the same paginated API).
- **Supersedes:** None
- **Superseded by:** None

## 2026-10-13: same-name state + derived value in one component scope breaks the build; score-ordered feeds need exclusion-based pagination

- **Symptom:** Vercel build failed with `Identifier 'tabQuery' has already been declared` in both profile pages; feed showed the same post twice across pages/poll cycles.
- **Root causes:** (1) a search-box `useState` and a derived query-string `const` were given the same name in the same function scope — legal while only one existed, fatal once the second was added. (2) the feed ranks by score but paginates on a createdAt cursor, so consecutive pages inherently overlap; client appends without dedup turned overlap into visible duplicates, and poll merges rewound the cursor.
- **Fix pattern (reuse):** name state and derived values in disjoint namespaces (`tabFilter` vs `tabPostsQuery`) with a collision note at the declaration; make id-dedup a single exported invariant every merge path funnels through; pass rendered ids as `exclude` for score-ordered pagination; never overwrite a pagination cursor with a page-one poll result.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 54: preview parity by shared component, not duplicated markup; swap-now/purge-after-commit for managed uploads

- **Symptom:** Studio preview (title + reading-time + body) drifted from the published post (which later gained a cover) because two markups described the same view; blog had no upload path, so covers were unvalidated text.
- **Root causes:** (1) preview and public page were written as separate JSX with a comment asking them to stay in sync — comments don't enforce. (2) image lifecycle (upload → reference → replace → purge) had no owner: the upload endpoint, the Studio, and the cleanup route each knew part of it.
- **Fix pattern (reuse):** extract the reading view into one server-compatible component both surfaces render (parity by construction); centralize URL logic in pure never-throw helpers + one config registry; uploads swap the preview immediately but destruction only ever runs post-commit best-effort (client after 2xx, server in background), with the cleanup route re-guarding live references so shared URLs survive.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 55: fixed overlays must portal out of transformed ancestors; recall broad then rank strict; mocks must honor exclusion filters

- **Symptom:** trust breakdown invisible on desktop cards (but fine on mobile/detail); search missed order-swapped and typo'd queries; two search suites failed after the recall rewrite despite correct production logic.
- **Root causes:** (1) `hover:-translate-y-0.5` on the card re-anchors every `fixed` descendant to the card — viewport math then lands off-screen; the failure only manifests on hover-capable devices, so mobile testing never catches it. (2) single-phrase DB recall conflates recall with ranking — anything the one clause misses is unrecoverable downstream. (3) mocks that echo fixture rows for every call silently break multi-phase recall (phase-2 `notIn` ignored → duplicates), making green tests lie about pagination.
- **Fix pattern (reuse):** portal every viewport-positioned overlay to document.body (with a hover-bridge delay when the trigger and panel are no longer DOM kin); separate recall (broad ORs + typo head-prefixes, capped) from ranking (deterministic in-memory relevance, exact-first) — DB order then only bounds truncation, never quality; test mocks must simulate the DB contract they stand in for (`notIn` filtering, staggered timestamps, matching content), and rankers must coerce invalid dates (NaN comparators silently scramble order).
- **Supersedes:** None
- **Superseded by:** None

## Sprint 56: CTA classes need an allowlist, sticky needs self-start

- **Root causes:** (1) the sanitizer allowed no `class` attribute, so any CTA-class markup would be silently stripped — fixed with an exact-token allowlist (`blog-cta-wrap`/`blog-cta` only) rather than opening `class` broadly; (2) `position: sticky` never engages inside stretching grid rows — the pane needs `self-start` on itself plus `items-start` on the grid parent; (3) a prior degrade-to-link test assertion encoded a decision the directive intentionally overrode — updated the test with the directive cited in-code rather than leaving a red suite.
- **Fix pattern (reuse):** sanitizer changes always pair markup emission + allowlist + round-trip parsing + a test asserting both preservation and evil-class stripping; sticky panes always ship as config-owned class + style pairs; overridden decisions get re-recorded in project-decisions the same session.

## Sprint 57: guards at the choke-point, keys not components, one settled paint

- **Symptom:** past post's Cloudinary images vanished after a new post / edit; share buttons all showed the same generic icon; feed visibly reorganized ~twice on first scroll.
- **Root causes:** (1) the live-reference guard existed only on the draft/composer endpoint while edit/delete/admin/moderation paths destroyed unconditionally — and eager uploads share verbatim URLs across posts, so per-post cleanup is inherently cross-post-unsafe without a just-before-destroy re-check. (2) icon choice was hardcoded in JSX with no config field, so platforms could never differentiate. (3) first paint committed every intermediate snapshot (stale cache, then fresh, then geo re-rank) and each fetch re-rolled `Math.random()` jitter, so identical data still reshuffled.
- **Fix pattern (reuse):** put safety invariants at the lowest choke-point (adjacent to the irreversible operation), express UI variance as serializable config keys mapped by one component (never component refs in config), and gate first paint on one settled snapshot while letting live updates flow after readiness. Tests assert the guard's fail-open behaviour (shared-URL kept, DB-down kept) — not just the happy path.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 58 (2026-10-14): keyless-traffic honesty, opaque notice surfaces, hook-order hygiene, jest ESM stub reuse

- **No keyless live-traffic API exists — model it honestly:** OSRM/ORS/Mapbox-routing/geocoders were audited; only keyed Mapbox congestion and keyed TomTom flow give real probes. The keyless path is a deterministic rush-pattern heuristic ALWAYS flagged `estimated` (API field + legend note + FAQ), so the UI can never imply live probes. Pattern: provider-order with the always-works fallback LAST + explicit estimated branding.
- **Notice banners must be opaque in both themes:** translucent semantic fills (dark `--color-info` at 15% alpha) wash out on dark/Android WebViews. Fix at the config layer (`surface` tokens: solid card + semantic border/text) so all variants inherit it.
- **Hooks after an early return are a latent lint break:** RouteMap's `mapError` return sat above 4 hooks since its introduction and only surfaced when the file was linted. Fix = move the return below the hooks (pure reorder, no behaviour change). When touching legacy components, lint the file even if you didn't add hooks.
- **Jest ESM stub for redis-importing services:** `@upstash/redis → uncrypto` breaks the jest transform; the hoisted `jest.mock("@/app/lib/db/redis")` stub (get → null, set → no-op) used by emailStudio/mapStack suites works for any service-level pure-helper test. Reuse verbatim.

## Sprint 59 (2026-10-15): ranking-vs-filter gaps, hide-when-following, env trim, index-free sampling

- **Symptom:** "my posts / strangers' posts never appear in my feed" — but no query filtered them out; request trigger had no visible label (only aria); TomTom key set on Vercel yet traffic stayed heuristic; legacy-route maps feared excluded.
- **Root causes:** (1) exclusion-by-ranking: own posts scored 0.15 vs followed 0.7, so they were present but buried — verified by reading all four feed pools before changing anything. (2) follow state lived only in component local-state with no read endpoint, so cards could never know to hide. (3) pasted env values carry whitespace that passes truthiness checks and then fails upstream. (4) `array.indexOf(ref)` on derived chunk arrays is fragile indirection for an index the loop already owns.
- **Fix pattern (reuse):** when users report missing rows, audit RANKING before FILTERING (log pool contributions); follow/status affordances need a cached GET + hook, not just POST/DELETE; trim every server-read env key at the check site (both the gate and the consumer); sample by explicit index, never by re-finding references; null-island (0,0) is a data smell — strip placeholders, keep real geometry. Tests assert the graceful shape (empty heuristic, no throw), not just the happy path.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 61 (2026-10-15): white-on-pastel pills, near-white flag washes, studio parity shape

- **Symptom:** "badges aren't visible in light theme" — vehicle flags washed into the white card; Linked/Enabled/tier shields unreadable; admin config board empty on a fresh DB with JSON-only editing.
- **Root causes:** (1) light washes (`-50`) with no border on white cards; `bg-success/error` (pastel bg token) paired with `text-white` instead of its `*-text` mate — the token names make the pairing self-evident (`bg-success` ↔ `text-success-text` ↔ `border-success-border`); raw metallic data hues reused as text. (2) config API returned DB rows only, so shipped defaults were invisible until saved.
- **Fix pattern (reuse):** flags/badges = saturated wash (`-100`) + dark-grade text + matching border, all with dark variants; NEVER `bg-<pastel> text-white`; NEVER raw data hues as text — add a display registry with darkened in-family shades + neutral fallback. Studios = shipped-defaults catalog + stored-wins read-time merge + central validator + explicit restore-by-delete + source badges, so fresh DBs render fully and hardcoded updates never clobber saved rows.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 62 (2026-10-15): follower-only fan-out reads as "no notification"; length-gated restore drops short drafts

- **Symptom:** "route-request notifications don't reach non-followers" — plus "my location-only draft lost its location on restore while fuller drafts kept theirs".
- **Root causes:** (1) fan-out read `getFollowerIds` only, and `createNotification` no-ops on `[]` — an empty follow graph meant silence by construction, not by failure. (2) `applyDraft` gated `setSteps` on `length >= 2` while the saver legitimately persists 1-step drafts — restore and save disagreed on the minimum, so the shortest (most common partial) input was the one that never came back; `if (draft.title)` additionally leaked stale titles into empty-title restores.
- **Fix pattern (reuse):** fan-out = followers-first union with the community to a capped audience (one notification row, never-throw, legacy mode flag); restore must accept every shape the saver can persist (pad, never skip) and reset every field unconditionally. When save and restore disagree on minimums, fix restore to match save — never tighten save to match restore (partial progress is the feature).
- **Supersedes:** None
- **Superseded by:** None

**Sprint 63:** ephemeral request fixes (cached-only client attach, server-validated, never persisted) give location-aware fan-out with zero new tracking — pair with a minNearby gate so sparse data fails open to the legacy audience; per-user Json prefs with config-driven normalize (NULL/partial → all-on) keep existing users untouched without backfills; legacy SiteConfig rows need normalize defaults for every added knob or old stored values break the new path.

## Sprint 64 (2026-10-15): offline reload reads as guest; trailing-slash prefix silently skips query-form URLs

- **Symptom:** "guest banner shows though I never signed out" — plus profile tabs never worked offline even though "/api/posts/" looked cached.
- **Root causes:** (1) auth state booted empty and learned the session over the network, so any offline reload was indistinguishable from signed-out — UI identity had no memory. (2) startsWith prefix "/api/posts/" never matches "/api/posts?…" — the slash that makes path-form URLs tidy is exactly what excludes query-form URLs, and the mismatch is silent (no error, just no cache).
- **Fix pattern (reuse):** persist the last server-confirmed session as a TTL-bounded display-only snapshot (hydrated synchronously, cleared only on genuine 401/logout, never used for authorization); for prefix registries always register the BARE path ("/api/posts" covers both "/api/posts?…" and "/api/posts/…") and add a regression test hitting the query form directly. Protected pages stay out of install precache (redirect poisoning) and are advertised as runtime-cached with honest copy.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 67 (2026-10-16): traffic indices belong to a geometry generation; car-trace durations lie for non-car modes

- **Symptom:** "traffic colors vanish after the map re-traces" — plus "my trek is timed like a taxi".
- **Root causes:** (1) traffic chunks are index ranges into the coord list the lookup ran on; when the tracer swaps a 2-point pins line for a 200-point road trace, stale indices collapse onto a head sliver and the overlay reads as gone. (2) OSRM/Mapbox durations assume cars, and the estimate helper had one speed for every mode — so slow/rail/water legs inherited driving times and road-traffic delays they never experience.
- **Fix pattern (reuse):** index-based overlays must REMAP fractionally onto new geometry lengths (share-of-route, not absolute indices) and the fetching hook must KEEP the last good result during refetch — persistence is a renderer contract, not a fetch-speed race. Mode-aware timing = one zero-dep registry (speed + traffic-sensitivity per vehicle, immune modes at 0) with pure helpers, destination legs excluded from the dominant-mode vote, unknown modes falling back to full road behaviour; slow/rail/water recompute from traced DISTANCE while road modes trust trace duration.
- **Supersedes:** None (extends Sprint 58 traffic entry: provider chain kept, duration math now mode-scaled).
- **Superseded by:** None
- **Symptom:** "route text doesn't open the post" — plus "I opened Respond by mistake and can't get back to a normal share without closing everything", plus vehicle flags still thin in light theme after the Sprint 61 wash/border fix.
- **Root causes:** (1) only the title carried a detail href — body text was inert by omission, not by design. (2) response linkage had entry points (Respond CTA, draft restore, edit fallback) but no exit — `responseTo` was parent-owned or post-derived with no clearing path. (3) `-800` labels were "dark" but one grade shy of max contrast on tinted washes; the test asserted the literal grade (`/-800/`), so the correct fix broke the suite.
- **Fix pattern (reuse):** card text navigation = wrap text nodes in the canonical encoded path with stopPropagation, never the whole card (nested-interactive rule); every modal mode needs a config-labeled exit that drops linkage but preserves input (parent-owned state clears via optional callback, derived state via a local gate — edit-immutable modes get no exit); contract tests should assert the GRADE CLASS (`/-(800|900)/`, "dark-grade label") not the literal token, so contrast deepening never fights the suite.
- **Supersedes:** None (extends Sprint 61 visibility entry: wash/border system kept, label grade deepened).
- **Superseded by:** None

## Sprint 68 (2026-10-16): a shared viewport must share the object, not re-derive it; modal stacking needs a z-contract

- **Symptom:** "nav map loses traffic/tracings the detail map has" — plus "expanded map vanishes from the guide", plus "no per-stretch info on taps".
- **Root causes:** (1) the nav map received the DERIVED duration (`trafficAdjustedMins`) but not the SOURCE result — with `trafficOverride` undefined it self-fetched, doubling cost and diverging mid-refetch. (2) the expand dialog (z-50) rendered behind the live modal (z-[60]) — invisible, not broken. (3) tracings had no hit interaction; the visible line (~3.5px) is untappable on mobile regardless.
- **Fix pattern (reuse):** when two surfaces show one route, pass the fetched OBJECT down (optional-override prop, legacy self-fetch when omitted) — never pass only its derivatives and let each surface refetch. Keep a documented z-contract for floating layers (page < expand dialog < live modal < expand dialog needs top: z-[70] here — record the ordering where the values live). Tap interaction on thin geometry = invisible wide hit line + interactive layer ids, resolving click → layer/nearest-chunk → anchored marker; tooltips grade by rate cost (full where data exists, link-out where fetching is banned) with pure never-throw helpers and stale-tip clearing on geometry swap.
- **Supersedes:** None
- **Superseded by:** None

## Sprint 69 (2026-10-16): chunk tooltips converge — resolve legs; zero is loading, not data

- **Symptom:** "same tooltip on every stretch of a 4-stretch post + have to hunt for the card" — plus "0 min with traffic (was 1h 6m)", plus detail bar missing fare.
- **Root causes:** (1) tooltips sliced the GEOMETRY (≤12 even traffic chunks), not the ROUTE (legs between stops) — equal slices yield equal shares, so every tap agreed. (2) cards anchored at chunk midpoints, potentially screens away from the finger. (3) traffic-adjusted rendered on naive `!==` — the loading state (`adjusted 0` vs base 66) passes it; the detail map never received a fare prop at all, and the share preview formatted `0` as `₦0`.
- **Fix pattern (reuse):** domain units over geometry units — resolve taps to legs via pin borders on the snapped trace (monotonic, ends pinned), worst-level for the leg, length-share (haversine, not point-count) for time/distance; anchor markers at `lngLat`. Treat `0`/`null`/`NaN` in summary bars as "not yet known" — centralise in one guard module (`shouldShowTrafficAdjusted` + per-chip `isValid*`) so every bar (detail, nav, preview, guide) hides the same way; single `totalFareForSteps` (destination excluded) for every total.
- **Supersedes:** Extends the Sprint 68 entry (chunk → leg, midpoint → tap anchor).
- **Superseded by:** None

## Independent rounding breaks total/stretch consistency

**Context:** Header showed one traffic-adjusted figure while each stretch tooltip rounded independently — sums drifted ±1 min per leg and exceeded the header.
**What We Learned:** Split displayed parts from the displayed total with largest-remainder apportionment (`splitMinsByWeights`) instead of rounding each part independently; render the total as the range the parts sum to (`formatDurationRange`).
**Apply When:** Any UI shows a total alongside per-part breakdowns (times, fares, distances).
**Supersedes:** None
**Superseded by:** None

## Memory-only caches lose overlays across remounts

**Context:** Traffic cached in memory keyed by sig+base+mode vanished when users exited and returned within seconds (base changed or state reset), while the base tracing rendered fine.
**What We Learned:** Persist overlay data to localStorage with the same TTL, key by geometry (not derived values like the base duration), re-derive display values locally on hit, and serve stale-while-revalidate with silent failure so the last good result outlives flaky networks.
**Apply When:** Caching any derived overlay whose inputs settle in stages (estimate → trace) or whose fetch can fail while the base layer succeeds.
**Supersedes:** None
**Superseded by:** None

## Camera effects must depend on intent, not volatile position identities — and defer behind interaction

**Context:** Post detail passed a `userLocation` that changes identity on every GPS watch fix into `RouteMap`'s fit-effect deps (while `followUser=false`), so each tick refit the whole route out from under an in-progress pan; separately, bounds/pins can change mid-pan (trace arrival, stop edits) and yanked the camera even when the deps were stable.
**What We Learned:** Derive a stable boolean (`followActive = followUser && !!userLocation`) and depend on THAT instead of volatile identities — the semantic guard is the dep. Then gate every _baseline_ camera move through an interaction-deferred queue: container pointer/wheel/key listeners + a window-level gesture-end, an idle window (`MAP_VIEW_CONFIG.recenterIdleDelayMs`), and a token-guarded watcher that runs exactly the latest pending move once. Explicit user requests (expand-refit, focus fly-to) bypass the queue by design — deferral is for background recentering, never for what the user just asked for. A pure `shouldDeferFit(...)` helper keeps the gate unit-testable without rendering the map.
**Apply When:** Any effect drives a camera/scroll/focus from external position data, or user interaction can overlap data arrival (maps, carousels, live dashboards, sticky headers).
**Supersedes:** None (extends the "fresh object identities re-init maps / re-fit the camera" mapLib lesson with the interaction dimension).
**Superseded by:** None

## Safe client clearing needs a protected-key whitelist, not a blocklist

**Context:** A post-maintenance "kindly refresh" notice had to reboot the client (stale caches + service worker) without destroying drafts, the offline auth session, or user preferences — and without ever touching cookies.
**What We Learned:** A blocklist ("don't clear these known keys") rots the moment new state is added and fails-open on the dangerous side; a WHITELIST of protected keys/prefixes (drafts, `along-auth-snapshot`, theme/locale, push/PWA/consent prefs, `along-locale-cache`) treats everything else as disposable cache, so future cache-y keys are covered automatically while positively protected state survives. Wrap every step (storage clear, Cache Storage wipe, SW unregister) in fail-open try/catch, never touch cookies, and cache-bust the reload (`?_fresh=<ts>`) or the stale worker still wins.
**Apply When:** Any admin-triggered or update-triggered client "reset" must keep user state alive.
**Supersedes:** None
**Superseded by:** None

## Opaque theme tokens beat translucent rgba washes for warning surfaces

**Context:** Dark-theme maintenance/offline strips used a translucent `--color-warning` (`rgba(…, 0.15)`) and blended into the page — the same wash-out class fixed earlier for push banners.
**What We Learned:** Define an OPAQUE `--color-warning-surface` token (light `#FEF3C7`, dark solid `#3B2F14`) and switch consumers to it — identical readable result across themes with zero per-theme alpha math; keep the hue token for borders/text accents only.
**Apply When:** Any notice/banner/alert background needs light+dark parity.
**Supersedes:** Extends the Sprint 18/58 opaque surface-token lesson (warning family now included).
**Superseded by:** None

## Divergent client limits for the same input = lift into one config module

**Context:** Share form capped 10 tags silently (`slice`, no feedback); request form capped 5 with Enter-only input; the server schema had a count cap but no per-tag length; placeholders said nothing about comma/Enter/limits.
**What We Learned:** When two surfaces police the same input, centralise limits + placeholder copy + toast copy + parse helper in one config module (`ROUTE_TAG_CONFIG`) consumed by both modals, the drafts sanitizer, and the Zod schema — then the server REJECTS over-limit (after trim/`#`-strip/empty-drop) rather than silently slicing, because client toasts already explained the rule and silent truncation desyncs user intent.
**Apply When:** Adding a limit that more than one form or layer enforces; splitting client vs server cap semantics (explain+reject client-side, reject server-side — never slice either side).
**Supersedes:** None
**Superseded by:** None

## A notice's "already acted" memory belongs inside the action, and must survive the action's own cleanup

**Context:**
Sprint 76's refresh-notice once-flag. `safeClientRefresh` wipes non-protected localStorage as part of its job; a flag written by the strip's onClick BEFORE calling it would be destroyed by the very action it records (and any flag a consumer writes must be checked against the cleaner's preserve whitelist). Moving the write INTO `safeClientRefresh` (at sequence start) makes completion part of the action's contract — any caller records it — and adding the key to `SAFE_REFRESH_CONFIG.preserveLocalStorageKeys` guarantees it survives the sweep. The same pairing rule applies to any future "do this once per browser" flag: (a) write it at the start of the operation that would clear it, (b) whitelist it through that operation's cleaner, (c) read it in a mount-only effect (never during SSR render), (d) fail-open visible on missing/garbage/expired values.
**Lesson:** When an action cleans up state, its own completion signal must be written before the cleanup and positively preserved through it — and the consumer should only ever read the flag, never own the write.

---

## Serverless runtimes must resolve the TRANSACTION-mode database pooler, never the session-mode one

**Context:**
Sprint 77's EMAXCONNSESSION outage: every DB-backed route 500'd (`DriverAdapterError: max clients reached in session mode - max clients are limited to pool_size: 15`) because `resolveDatabaseUrl()` preferred `DIRECT_URL` (session-mode pooler, port 5432, hard-capped ~15 clients) for the RUNTIME PrismaClient while `new PrismaPg({ connectionString })` used pg defaults (`max: 10` per warm lambda, no connect timeout). N instances × 10 ≫ 15. Supabase dashboards look healthy — the cap is pooler policy, not DB load. Two extra traps rode along: the `?pgbouncer=true` URL param is a classic-engine switch IGNORED by the pg driver (transaction mode needs an explicit `prepare: false`), and a PrismaClient NOT cached on `globalThis` in production opens a second pool per module copy (route-split chunks) — same failure class at smaller scale.
**Lesson:** Encode the two-pooler contract PER CONSUMER: runtime = DATABASE_URL-first (transaction mode, `prepare: false` detected from the URL, small per-instance pool via config), CLI/migrations = DIRECT-first (session continuity for DDL). Never let one global precedence serve both. Detect pooler mode from the URL (port 6543 / `pgbouncer=` flag), keep prepared statements for direct/session URLs, and log a one-time warn when production still resolves a session-mode URL so a mis-set env var is obvious in logs.
**Apply When:** Wiring any new DB client/worker/CLI path against Supabase (or any session/transaction-split pooler); debugging "max clients reached" or connection-exhaustion 500s; adding a new serverless data path that opens its own pool.
**Supersedes:** Extends the Sprint 73 Supabase two-pooler contract decision (the code had disagreed with the documented contract — docs won only after the outage).
**Superseded by:** None

## Client-generated idempotency keys must be content-derived, and location.reload needs an injectable seam

**Context:**
Sprint 79's duplicate-bug-report fix. Server-side dedup had a short same-identity window keyed on timestamps, so slow double-submits, offline-queue flushes, and route-change double mounts slipped through. The fix had to generate a stable client key, but the recovery path (`ChunkLoadError` → one `location.reload()`) couldn't be unit-tested because jsdom implements `window.location` as a non-configurable object.
**What We Learned:** Derive the idempotency key from pure content (double FNV-1a of `title|path|digest`, prefixed `eb:`, length-capped) — never from `Date.now()`/`Math.random()`, which defeat every dedup window the server can offer. Send it BOTH as an `x-idempotency-key` header and a body field, and have the server pre-read with an OR of (key OR stable identity OR exact description) scoped to the reporter so old rows still dedup. For location-dependent recovery logic, export `attemptChunkLoadRecovery(reloadImpl?)` with an injectable reload implementation so tests pass a spy instead of fighting jsdom; guard the once-per-session reload with a sessionStorage flag keyed from config, checked read-only in effects.
**Apply When:** Writing any "submit once" client flow; testing anything that calls `location.reload()`/`location.assign()` in jsdom; adding recovery shortcuts that must not loop.
**Supersedes:** Extends the Sprint 12/50 idempotency-key + short-dedup-window pattern (client-emitted keys are now mandatory for anonymous error reports, which have no user/session identity server-side).
**Superseded by:** None

## "ACID" in comments is not ACID — read-then-write needs a lock or a constraint, not prose

**Context:**
Sprint 80's duplicate bug reports / "assigned to multiple admins". The report routes did dedup-check (SELECT) and then INSERT with a comment claiming transactional safety, but the read and the write were not serialised — two concurrent submissions both missed the read, both inserted, and each row auto-assigned a different admin (the single `reviewerId` column meant the "multi-assignment" was really duplicate rows, each with its own assignee).
**What We Learned:** If correctness depends on "nobody inserted between my check and my write", the check and the write must be inside ONE transaction AND serialised against the competing writer — on Postgres, a per-entity `pg_advisory_xact_lock(hashtextextended(key, 0))` is the cheapest serialisation that needs no schema change (key it narrowly, e.g. per reporter, so unrelated writes never contend; best-effort, never throwing, so a lock failure degrades to the old behavior instead of failing the user's write). Resolve all inputs (here: the assignee) BEFORE opening the transaction so you never nest pool use. Prefer matching on stable identity fields (path + digest) rather than human titles, which vary across otherwise-identical reports.
**Apply When:** Any create-if-absent / create-if-unchanged path; "duplicate" symptoms reported against a table; comments that assert serialisation without code that provides it.
**Supersedes:** Supersedes the Sprint 79 residual note "Unique DB constraint … remains a future option" as the primary mechanism (constraint stays optional insurance; the advisory-lock transaction is now the shipped fix).
**Superseded by:** None

## Refresh traffic needs its own rate bucket, and 429 must be transient

**Context:**
Sprint 80's auth session expiry. `/api/auth/refresh` shared the general `auth` bucket with login/OTP, so a PWA resuming after backgrounding could consume the bucket, get 429'd, and — because the client treated any auth failure as "session dead" — bounce a perfectly valid session to /login. Refresh fires far more often than login, so it both starved and was starved by the bucket.
**What We Learned:** Give high-frequency, low-risk auth endpoints (refresh) their OWN config-driven bucket (`authRefresh` 45/15min) sized for their cadence, separate from credential endpoints. Client-side, classify 429 as TRANSIENT: keep the session, retry with exponential backoff from config (2^n, capped, honoring server `Retry-After`), and reset the backoff counter on any success; revalidate on `online`/visibility events but throttle it (min-interval ref) so a PWA resume storm can't re-trigger the bucket. Pair this with the server side: when middleware finds an expired access token + valid refresh token, mint the refresh downstream (forward the cookie ON the request via `NextResponse.next({ request: { headers } })` — `Set-Cookie` alone only reaches the browser after the response) instead of redirecting.
**Apply When:** Any client that auto-refreshes credentials; any endpoint with an asymmetric call cadence vs its siblings in a shared bucket; PWA/background-tab resume behavior; "users randomly logged out" reports.
**Supersedes:** None
**Superseded by:** None

## Regenerate the Prisma client after every schema edit — stale clients fail silently

**Context:**
Sprint 80 added `Notification.metadata Json?`; `npx prisma generate` failed without a datasource URL, the old client stayed in place, and TypeScript still compiled — Prisma's generated models accept unknown fields through spread assignments (`{ ...data }` bypasses excess-property checks).
**What We Learned:** Treat `npx prisma generate` (with a real or stub `DATABASE_URL`) as part of the schema-edit step, not an optional build step; run it before `tsc` or the type checker will happily validate against the OLD model. Verify with a direct property reference or `prisma validate`, not just "tsc passed". Same class as "generated code is a build artifact": migrations (`prisma migrate`) change the DB, `prisma generate` changes the types — both are required for a schema change to be real.
**Apply When:** Touching `prisma/schema.prisma`; adding columns/models the app reads or writes; CI setups where generate runs later than typecheck.
**Supersedes:** None
**Superseded by:** None

## Write the gate tests as a CONTRAST matrix against the exported pure helper — not against a restated rule

**Context:**
Sprint 82's review-notice gate: the first test draft restated the intended rules from memory (input shape, reason strings, evaluation ORDER) and mostly failed against the real implementation — the pure helper owns an exact order (done > dismissed > account-age > review-probe), numeric-only state shaping (`1.5` is accepted, words are not), and "" → empty-object (not null) garbage handling. Rewriting the tests as a direct characterization of `shouldShowReviewNotice`/`readReviewNoticeState` turned a suite into real regression armor in minutes.
**What We Learned:** When the deliverable is a decision matrix, the test is a CHARACTERIZATION of the exported pure helper (all inputs and actions, boundary stamps, failure paths), not a restatement of a rules paragraph — draft only after reading the implementation, or extract the decision into the pure helper FIRST so both component and test consume one truth. Same class as "config integrity tests": assert the exported config values, not your memory of them.
**Apply When:** Testing any gate/visibility matrix, validator, or precedence chain; fixing a flaky/leaky component-internal decision; reviewing a PR whose tests read like requirement prose instead of behavior probes.
**Supersedes:** None
**Superseded by:** None

## A full-screen overlay is a click shield unless it says otherwise

**Context:**
Sprint 83's platform tour: the spotlight wizard mounted a transparent `fixed inset-0 z-[60]` container so it could draw the scrim/dimming. The spotlighted page looked usable, but every click outside the tooltip (theme toggle, "Share a route" trigger, modal controls) hit the overlay instead of the app — reported as "pressing share route did nothing".
**What We Learned:** Any guided-overlay root must be `pointer-events-none`; only the interactive cards (tooltip, resume/offline/end prompt) should set `pointer-events-auto`. Drawing a scrim (box-shadow/backdrop) never requires the container to receive pointer events, and a click-through scrim is also what lets real page handlers fire during interactive steps. If an overlay must block the page, say so explicitly at the container and make the affordance visually obvious — never let transparency imply click-through.
**Apply When:** Adding spotlight tours, coach marks, modal backdrops, or any fixed full-viewport layer that is not meant to be the sole interaction target; debugging "clicks do nothing but only sometimes" reports.
**Supersedes:** None
**Superseded by:** None

## Index the user's PROGRESS by identity, not by position, when the list can change under it

**Context:**
Sprint 83's guest tour: the step list is audience-filtered, so a guest walking `welcome → auth-sign-in → auth-register → share-route` loses two steps the moment they finish registration (and the page reloads). A stored index would land on the wrong stop — or past the end — after the list shrank.
**What We Learned:** Persist a stable step `id` alongside the positional index, resolve the id first, and on a miss pick the first still-visible step at or after the stored config index (then clamp). The same rule applies to persisted cursors/tabs/onboarding checklists whenever visibility depends on permissions, feature flags, or account state. Leave the index in the blob for forward-compat/analytics, but never make it the sole resume key.
**Apply When:** Persisting progress through onboarding/wizards/multi-step forms where steps can be hidden per role/plan/audience; any saved cursor over a filtered list.
**Supersedes:** None
**Superseded by:** None

## Split a dense composer into peer tabs before shrinking typography or columns

**Context:**
Sprint 85's share-route composer: Details, Map, Score and Drafts were stacked as collapsible sections plus a narrow side column. On small screens the Drafts count/save strip overlapped the footer actions, section headers clipped, and the preview/score got squeezed instead of using the modal width.
**What We Learned:** When several independent, similarly-prioritised sections compete inside one modal, a peer tablist (one full-width panel at a time) is usually the right fix — not smaller text, narrower columns, or more nested accordions. Keep tab metadata config-driven (short label + icon key + optional count badge), resolve unknown ids through a pure fallback helper, and make cross-section references real tab switches rather than prose. Leave the footer for two primary actions only; everything else belongs in a tab. When tour/setup anchors target a now-conditional section, move the anchor to the always-visible tab button so it cannot disappear based on active state.
**Apply When:** Redesigning dense forms/modals with 3+ peer sections; fixing mobile overlap/clipping caused by stacked collapsibles; preserving guided-tour anchors through layout changes.
**Supersedes:** None
**Superseded by:** None
