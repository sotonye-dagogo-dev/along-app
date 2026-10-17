# In Progress — Sprint 74: Admin-config E2E wiring + hydration/console-noise tightening

> **Metadata**
>
> - started: 2026-10-17 (execute-feature)
> - directive: wire admin config (maintenance mode) end-to-end + handle post-Supabase console errors cleanly/non-breaking
> - status: in-progress
> - risk: medium (middleware enforcement + auth `/me` contract touch) — all fail-open, non-breaking, tested

## Plan

### A. Admin config actually functional (maintenance + announcement)

1. `app/lib/config/siteNotice.ts` (new) — registry + pure helpers:
   - `SITE_NOTICE_CONFIG`: site-config keys, `/api/site-config` endpoint, refresh triggers (mount/online/focus + interval), banner copy + token classes, announcement cap/dismissal, enforcement (blocked methods, exempt prefixes, memo TTL, 503 shape, fail-open).
   - `normalizeMaintenanceFlag`, `normalizeAnnouncementText` (trim/strip/cap 500), `shouldBlockMutation(method, pathname)`, `isMaintenanceExempt(pathname)`.
2. `GET /api/site-config` (new, public) — returns `{ maintenanceMode, announcementBanner }` via `getSiteConfig` (never throws, `Cache-Control: no-store`); registry entry; already declared cacheable by PWA sw registry.
3. `app/components/ui/SiteNotices.tsx` (new client island) — fetches endpoint (mount + online + focus + interval), renders:
   - maintenance strip (warning tokens, `role="status"`, admin note for `role === "ADMIN"`),
   - announcement strip (info tokens, session-dismissible).
   - i18n `tf()` with config fallbacks; en+pcm keys.
   - Mounted in root layout beside `<OfflineBanner />` (inside providers).
4. Enforcement (soft): `middleware.ts` blocks mutating `/api/*` requests while maintenance is ON — Redis-only flag read (edge-safe, never Prisma) with module memo; JWT `role === "ADMIN"` exempt; `/api/admin` + auth session endpoints exempt (admin can always log in + manage); fail-open on any error/absence. GETs and pages unaffected (notice only).
5. `PUT /api/admin/config` primes the maintenance Redis flag after write (toggle applies within memo TTL even before any banner fetch); restore/delete of the key re-primes `false`.
6. Tests: new `siteNotice.test.ts` (normalize/enforce/banner copy/503 shape) + locales parity keys.

### B. Hydration #418 (text) + structural mismatch

7. `InstallPrompt` — iOS UA read moved to effect-owned state (`isIos`), help line no longer diverges in render (root cause of `args[]=text` on iOS).
8. `PushManager` — same `isIos` state pattern for its help line.
9. `FeaturedBlogsSection.formatDate` — `timeZone: "UTC"` so server (UTC) and every client locale agree.
10. `AppFooter` — year text wrapped with `suppressHydrationWarning` (React-sanctioned for timestamps).
11. `AuthProvider` — offline snapshot applied in `useIsoLayoutEffect` (post-hydration, pre-paint): zero guest-banner flash preserved, structural `args[]=HTML` mismatch eliminated. `readAuthSnapshot` unchanged (display-only contract kept).

### C. Auth console noise

12. `GET /api/auth/me` with NO token → `200 { user: null }` (guest) instead of 401; invalid/unknown token still 401 + cookie clear. Client `AuthProvider` parses `"user" in data ? data.user : data`, never calls `/auth/refresh` on the guest 200. Result: zero console 401s for guests, one fewer request, no refresh rate-limit burn.

### D. Sentry / PWA / preload noise

13. Sentry client: `replaysSessionSampleRate` 0.1 → 0.02 (envelope-volume lever for ingest 429s); behavior otherwise unchanged.
14. `InstallPrompt` `preventDefault()` only when the card will actually render (installed/dismissed refs) — Chrome "banner not shown" warning reduced to the unavoidable ignore-case.
15. `globals.css` body font → `var(--font-inter, "Inter"), system-ui, …` — next/font preloads the mangled family; the bare `"Inter"` never matched, so the preload was unused (console warning) AND Inter never rendered. Non-breaking visual correction.
16. Root layout resource hints: drop dead `fonts.googleapis/gstatic` preconnects (next/font self-hosts; nothing loads Google Fonts at runtime).
17. `$RS … parentNode null` — verified navigations are network-first in `sw.js` (no stale-HTML path online) + no app code removes React-managed nodes; classified as DOM-mutation-before-bootstrap (extensions), non-fatal (React regenerates). Documented in repair-system; no code change.

### E. QA + docs

18. Gate: `npx tsc --noEmit` + `npx next lint` + `npx jest` + `npm run build`.
19. Docs: task-queue Sprint 74, session-log, dev-history, repair-system entries, project-decisions (auth/me contract + middleware fail-open policy), sync-context + update-ai-system deep sync, clear this checkpoint.

## Self-check (Step 2)

- Scope: within project-context (platform readiness, config-driven architecture). No architecture change beyond one new public GET endpoint + middleware enforcement branch (documented).
- Decisions log: no conflicting `project-decisions.md` entries found for AuthProvider snapshot timing, `/api/auth/me` status contract, or maintenance wiring (grep-verified).
