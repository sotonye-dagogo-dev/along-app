# Lessons Learned

> **Metadata**
> - last-updated-by: update-ai-system
> - last-verified-against-code: 2026-07-08
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
