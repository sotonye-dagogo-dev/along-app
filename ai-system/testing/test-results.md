# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-19 (Sprint 80: duplicate-proof bug assignment + notification deep links + auth session persistence)
> - last-verified-against-code: 2026-10-19
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1178 tests currently exist across 113 suites (verified by a real `npx jest --ci --forceExit` run in this session 2026-10-19).

---

## Last Run (Build)

**Date:** 2026-10-19
**Run by:** AI agent (opencode — execute-feature Sprint 80)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --ci --forceExit` — 1178/1178 passing (113 suites, real run this session: +3 NEW suites — `bugReportDedupService` (dedup identity/matcher/advisory-lock contract), `notificationRoutes` (REPORT/MODERATION bugId deep-link routing), `authSession` (rm claim round-trip, cookie maxAge mapping, grace/backoff knobs); 44 new tests total)
- `npx next build` — ✓ compiled successfully (real run this session; 107 static pages, Middleware 118 kB)
- `npx next lint` — ✓ clean on every Sprint-80-touched file (remaining findings are pre-existing only: unused `renderTemplateSubject` in `app/lib/services/emailService.ts:383`, `require()` errors in `app/__tests__/utils/metadata.test.ts`, `any`-casts in untouched suggestions routes — CI lint runs `continue-on-error: true`)
- `npx prisma validate` — ✓ OK (schema + `20261019000000_notification_metadata` migration; client regenerated after the schema edit)
- Zero test failures

---

## Historical Runs

### Sprint 72 (2026-10-17) — map tightening
- tsc 0; jest 865/865 (98 suites: +mapVehicleProfiles/mapView/mapPicker; locationIntent 22→28); build clean; lint 0 findings in touched files (11 pre-existing errors in untouched files at that time)

### Sprint 75 (2026-10-18) — notice tightening
- tsc 0; jest 1042/1042 (105 suites); build clean; config count 89 verified

### Sprint 77 (2026-10-18) — DB pooler + style proxy
- tsc 0; jest 1071/1071 (107 suites: +dbPool 15, +mapStyleSanitize 7, mapStack +4); build clean

### Sprint 78 (2026-10-18) — SEO title suffix + feed page size + pagination sweep
- tsc 0; jest 1119/1119 (108 suites: +paginationCompliance 40; metadata.test.ts rewritten); build clean; lint clean on touched files (5 pre-existing any-casts left in untouched suggestions routes)

### Sprint 79 (2026-10-18) — announcement deprecation + bug-report tightening
- tsc 0; jest 1134/1134 (110 suites: +chunkLoadRecovery 10, +bugReports 8, +idempotency test); build clean; lint clean on touched files
