# Lessons Learned

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
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

## Offline Queue + OnlineStatusProvider Pattern for Resilience

**Context:**
When the user goes offline, mutations are queued in `localStorage` via `offlineQueue`. On reconnect, `OnlineStatusProvider` fires `online` event → `offlineQueue.flush()` replays all queued requests.

**What We Learned:**
This simple pattern provides meaningful offline resilience without a complex sync engine. The queue is persisted across page refreshes (localStorage) and flushed FIFO on reconnect.

**Apply When:**
Any feature that needs to work offline and replay mutations when connectivity returns — use `offlineQueue.enqueue()` for writes and trust `OnlineStatusProvider` to auto-flush.

**Supersedes:** None
**Superseded by:** None
