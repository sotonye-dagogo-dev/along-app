# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-20 (Sprint 83: platform tour enhancements)
> - last-verified-against-code: 2026-10-20
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1221 tests currently exist across 116 suites (verified by a real `npm test` run in this session 2026-10-20).

---

## Last Run (Build)

**Date:** 2026-10-20
**Run by:** AI agent (opencode — execute-feature Sprint 83)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --runInBand` — 1221/1221 passing (116 suites, real run this session: +5 tests in `platformTour.test.ts` for audience filtering, stepId resume, auto-start routes/timeout clamps, guest/resume defaults + selector contract, and anchor/mount/trigger source assertions; `locales.test.ts` REQUIRED_KEYS extended for the new `tour.*` keys)
- `npx next lint` — ✓ clean on every Sprint-83-touched file (removed one unused type import; the only remaining warning is the pre-existing `ShareRouteModal` `editPost` exhaustive-deps finding — CI lint runs `continue-on-error: true`)
- `npx prisma generate` + `npx next build` — ✓ compiled successfully (real run this session; 107 static pages, `/api/tour` present)
- Zero test failures
