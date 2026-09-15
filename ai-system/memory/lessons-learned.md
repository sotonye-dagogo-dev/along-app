# Lessons Learned

> **Metadata**
> - last-updated-by: fix-build 2026-09-15
> - last-verified-against-code: 2026-09-15
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
  const ac = new AbortController()
  async function load() {
    setLoading(true)
    try {
      const res = await fetch(url, { signal: ac.signal })
      if (!res.ok) throw new Error("Fetch failed")
      setData(await res.json())
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  load()
  return () => ac.abort()
}, [url])
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
3. Never `await` email sending on the hot path — use `waitUntil` background pattern as in `register`.

**Apply When:**
Any route that touches Redis or Resend on the request hot path — always timeout-guard and make side effects (email, feed invalidation) background work.

**Supersedes:** None
**Superseded by:** None
