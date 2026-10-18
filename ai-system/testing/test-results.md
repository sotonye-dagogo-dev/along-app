# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-18 (Sprint 78: SEO title suffix + feed page size + pagination compliance)
> - last-verified-against-code: 2026-10-18
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1119 tests currently exist across 108 suites (verified by a real `npx jest --silent` run in this session 2026-10-18).

---

## Last Run (Build)

**Date:** 2026-10-18
**Run by:** AI agent (opencode — execute-feature Sprint 78)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session, after `npm install`)
- `npx jest --ci` — 1119/1119 passing (108 suites, real run this session: +1 NEW suite `paginationCompliance` (40 tests: clamp sources, id tiebreakers, notifications cache keys, admin meta, clamp matrix, feed-20 + hasMore regression); `metadata.test.ts` rewritten for the single-source title suffix)
- `npm run build` — ✓ compiled successfully (real run this session; lint skipped by next.config as configured)
- `npx next lint` — ✓ clean on every Sprint-78-touched file (fixed 5 pre-existing `no-explicit-any` in `app/api/posts/feed/route.ts` via `unknown[]` typed casts + 1 pre-existing rules-of-hooks flag in `app/admin/bugs/page.tsx` via module-scope alias; only remaining lint errors are 5 pre-existing `any`-casts in untouched `app/api/suggestions/route.ts`)
- Zero test failures

---

## Historical Runs

### Sprint 72 (2026-10-17) — map tightening
- tsc 0; jest 865/865 (98 suites: +mapVehicleProfiles/mapView/mapPicker; locationIntent 22→28); build clean; lint 0 findings in touched files (11 pre-existing errors in untouched files at that time)

### Sprint 75 (2026-10-18) — notice tightening
- tsc 0; jest 1042/1042 (105 suites); build clean; config count 89 verified

### Sprint 77 (2026-10-18) — DB pooler + style proxy
- tsc 0; jest 1071/1071 (107 suites: +dbPool 15, +mapStyleSanitize 7, mapStack +4); build clean
