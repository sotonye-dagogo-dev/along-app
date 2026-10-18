# In Progress — (closed)

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-18 (Sprint 77 closed)
> - status: closed

## Closed Sessions

- **Sprint 75 (2026-10-18)** — Notice tightening: opaque warning surfaces, `refreshNotice` + `safeClientRefresh` (default OFF, protected-key whitelist), rich `announcements` (CTA + multi + dismiss + admin list editor), unified `ROUTE_TAG_CONFIG` tag limits (10×30, toasts, server reject), scrollable picker card. FULL QA green: tsc 0, jest 105/105 suites 1042/1042, lint 0 new issues, build clean. Closed via execute-feature Step 5 + update-ai-system deep sync.
- **Sprint 76 (2026-10-18)** — Refresh-notice once-flag + catch-all note: `SITE_NOTICE_CONFIG.refresh` completedAtKey/7-day-TTL + `isSafeRefreshCompleted` helper + preserve-list entry + `safeClientRefresh` self-records completion + `SiteNotices` suppresses the strip within TTL and renders the "already refreshed? ignore" note; en+pcm `siteNotice.refreshNote`. FULL QA green: tsc 0, jest 105/105 suites 1047/1047 (+5 new), lint clean on touched files, build clean. Closed via execute-feature Step 5 + update-ai-system deep sync.
- **Sprint 77 (2026-10-18)** — Post-migration DB pool exhaustion + MapLibre null warnings: runtime Prisma now resolves the TRANSACTION-mode pooler first (prod `DATABASE_URL → DIRECT_URL → …`, dev `LOCAL_DB → DIRECT_LOCAL_DB → …`; CLI stays DIRECT-first) with config-driven pooler-aware adapter options (`dbPool.ts`: `DB_POOL_MAX` default 5, connect 5s, idle 10s, `prepare:false` iff transaction-mode), globalThis Prisma singleton in every env, one-time session-mode prod warn; plus same-origin sanitized vector-style proxy (`GET /api/maps/style?name=`, whitelisted, Redis read-through) + pure coalesce-wrap sanitizer silencing the MapLibre "Expected value to be of type number, but found null instead" class (maplibre-gl-js#7856). Fixed the EMAXCONNSESSION 500s that blanked feed/reviews/blogs/site-config/auth after the Supabase migration. FULL QA green: tsc 0, jest 107/107 suites 1071/1071 (+2 suites/+24 tests), lint clean on touched files, build clean (`/api/maps/style` live). Closed via execute-feature Step 5 + update-ai-system deep sync.

No sprint currently in progress. Next session should start fresh via `execute-feature` or `resume-session`.
