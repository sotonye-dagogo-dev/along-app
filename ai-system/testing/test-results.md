# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-21 (Sprint 86: guest tour prompt + tour hand-off/scroll)
> - last-verified-against-code: 2026-10-21 (Sprint 86)
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1257 tests currently exist across 118 suites (verified by a real `npx jest --ci --maxWorkers=2` run in this session 2026-10-21).

---

## Last Run (Build)

**Date:** 2026-10-21
**Run by:** AI agent (opencode — execute-feature Sprint 86)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --runInBand` — 1257/1257 passing (118 suites, real run this session; NEW `guestTourNotice.test.ts` covers the ordered gate matrix/dismiss TTL/install+cookie parsing/source wiring; platformTour/shareRouteTabs/locales contracts extended)
- `npm run lint` — ✓ no new findings in Sprint-86-touched files (pre-existing `editPost` exhaustive-deps warning in ShareRouteModal; unrelated legacy errors remain: `app/api/suggestions` `any`s, `metadata.test.ts` require imports, etc.; CI lint is non-blocking)
- `npm install` — ✓ 1518 packages (postinstall `prisma generate` needs a datasource URL)
- `DIRECT_LOCAL_DB=... npx prisma generate` + `npx next build` — ✓ compiled successfully (real run this session; 107 static pages, no schema change)
- Zero test failures
