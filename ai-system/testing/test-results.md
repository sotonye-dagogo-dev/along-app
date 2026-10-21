# Test Results

> **Metadata**
> - last-updated-by: update-ai-system 2026-10-21 (Sprint 89: hero tour CTA + unconditional tour escape)
> - last-verified-against-code: 2026-10-21 (Sprint 89)
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1261 tests currently exist across 118 suites (verified by a real `npx jest --ci --maxWorkers=2 --silent` run in this session 2026-10-21).

---

## Last Run (Build)

**Date:** 2026-10-21
**Run by:** AI agent (opencode — execute-feature Sprint 89)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --ci --maxWorkers=2 --silent` — 1261/1261 passing (118 suites, real run this session; `platformTour` covers `allowEnd`/navigation awareness-only/post timing + unconditional X/Escape + landing/banner source contracts, `guestTourNotice` covers landing hero/CTA/banner growth, `locales` covers en/pcm parity)
- `npm run lint` — ✓ no new findings in Sprint-89-touched files (pre-existing `editPost` exhaustive-deps warning in ShareRouteModal; unrelated legacy errors remain: `app/api/suggestions` `any`s, `metadata.test.ts` require imports, etc.; CI lint is non-blocking)
- `npm ci` — ✓ 1518 packages (postinstall `prisma generate` needs a datasource URL)
- `DIRECT_LOCAL_DB=... npm run build` — ✓ compiled successfully (real run this session; 107 static pages, no schema change)
- Zero test failures
