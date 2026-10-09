# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-09 (Sprint 21 static-only QA)
> - last-verified-against-code: 2026-10-09
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 241 tests currently exist across 28 suites (verified by a real `npx jest` run in this session 2026-10-09: 28 passed, 241 passed — Sprint 20 tightening session).

---

## Last Run (Build)

**Date:** 2026-10-09
**Run by:** AI agent (opencode — execute-feature Sprint 20 tightening)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session, after `npm install`)
- `npx jest` — 241/241 passing (28 suites, real run this session: +7 new mapTightening suites)
- `npm run build` — ✓ Compiled successfully, 84 static pages (real run this session; `/api/maps/{route,geocode,reverse}` + `/api/routes/trace` present)
- `npx next lint` — zero new issues (pre-existing `no-explicit-any` errors + RouteMap exhaustive-deps warning verified identical on stashed baseline via `git stash`)
- Zero test failures; keyless proof: straight-line/OSRM path resolves with all map keys unset

---

## Test Suites

| Suite | Tests | Description |
|-------|-------|-------------|
| ValidityEngine | 12 | evaluate() score ranges, tier boundaries, sub-computation comparisons, getTrustLevel() thresholds |
| DraftingCoachService | 9 | 6 checkpoint validations, empty/complete draft, nextSuggestion |
| navigation config | 6 | role filtering, section filtering, admin access |
| avatar config | 5 | URL construction, optional params, encoding |
| metadata utils | 7 | title, description, canonical, robots, OG, Twitter, custom ogImage |
| RewardsService | 6 | computeTier() boundary thresholds (BRONZE/SILVER/GOLD/PLATINUM) |
| AppEmptyState | 12 | all preset renders, custom content, variants |
| AppUserLabel | 7 | name, handle, linkToProfile, verified badge, sizes, vertical layout |
| TrustBadge | 6 | all 4 levels, tooltip hover, showTooltip=false, sm/default sizes |
| mutations API | 20 | posting, liking, commenting, bookmarking, following incl. error handling + undefined/null edge cases (`mutations.test.ts`, Sprint 7, Prisma mocked) |
| posts API | 11 | POST persistence (type/description/quotedPostId), fan-out, validation (`posts.test.ts`, Sprint 7, Prisma mocked) |
| search API | 9 | validation, type/region/postType filters, pagination, 503, 429 (`search.test.ts`, search session, Prisma mocked) |
| searchService | 8 | normalization, short-query guard, cache read-through, tag aggregation, cursor, P2022 retry (`searchService.test.ts`, search session, Prisma mocked) |
| mapStack config + proxy | 10 | keyless vector/raster URLs, fallback order, dark mapping, attribution, preconnect hosts, style-stack shape, cache-key determinism, straight-line proof, offline degradation, Nominatim-shape normalization (`mapStack.test.ts`, Sprint 19, redis mocked) |

---

## Active Failures

| Test | Error | Status | Assigned To |
|------|-------|--------|------------|
| — | — | — | — |

---

## History

| Date | Passed | Failed | Notes |
|------|--------|--------|-------|
| 2026-10-09 | 234 | 0 | Execute-feature Sprint 19 keyless map stack QA gate: real jest/tsc/build/lint runs (27 suites, +1 mapStack suite) |
| 2026-10-09 | — | — | Fix-build maplibre CSS: no node_modules in runner, full jest/tsc/build not runnable; verified via `node --check` (next.config.mjs OK) + alias-resolution simulation (old prefix-match → doubled dist path; new exact-match leaves CSS untouched, bare import still aliased) — Vercel build to confirm |
| 2026-10-08 | — | — | Fix-build Sentry hardening: no node_modules in runner, full jest/tsc/build not runnable; verified via `node --check` (next.config.mjs OK), JSON parse (package.json OK), grep (no `--no-engine` remains, all Sentry keys present) — Vercel build to confirm |
| 2026-10-08 | — | — | Fix-build `bugId` duplicate: no node_modules in runner, full jest/tsc/build not runnable; verified via grep (single `targetBugId` declaration, no redeclaration) — Vercel build to confirm |
| 2026-10-08 | 139 | 0 | Execute-feature search E2E QA gate: real jest/tsc/build/lint runs (13 suites, +2 search suites) |
| 2026-10-08 | 122 | 0 | Resume-session QA gate: Sprint 7 verify + tsconfig downlevelIteration removal (11 suites) |
| 2026-09-15 | 91 | 0 | Fix-build: Redis timeout guard + forgot-password non-blocking (this session) |
| 2026-09-15 | 91 | 0 | Fix: Image Upload, Feed/Explore Visibility & Production Audit (77 pages) |
| 2026-06-13 | 91 | 0 | Dashboard navigation, seed fixes, Prisma type fix |
| 2026-06-10 | 91 | 0 | Auth UX: toast, redirect, auth-aware nav |
| 2026-06-09 | 91 | 0 | Sprint 5: feed crash, guest auth, styling, login fixes |
| 2026-06-09 | 91 | 0 | Sprint 4: Production audit fixes |
| 2026-06-03 | 91 | 0 | OC-8: Production readiness audit |

## Run (Sprint 21 — static-only, 2026-10-09)

**Date:** 2026-10-09
**Run by:** AI agent (opencode — execute-feature Sprint 21)

- `npx tsc --noEmit` — NOT RUN (no node_modules in runner)
- `npx jest` — NOT RUN (no node_modules in runner); new suite `app/__tests__/config/accountDeletion.test.ts` (9 assertions) awaits CI
- `npm run build` — NOT RUN locally; Vercel runs `prisma generate` + `migrate deploy` before build so new models/enums resolve
- Static verification: import paths, ConfirmOptions excess-property fix, Json-null clear, cron guard, recipient caps manually reviewed
- Test figures from prior runs (241/241 Sprint 20) are historical, not re-verified this run
