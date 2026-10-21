# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-21 (Sprint 84: tour viewport safety + drafts footer + journey-time accuracy)
> - last-verified-against-code: 2026-10-21
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1231 tests currently exist across 116 suites (verified by a real `npx jest --runInBand` run in this session 2026-10-21).

---

## Last Run (Build)

**Date:** 2026-10-21
**Run by:** AI agent (opencode — execute-feature Sprint 84)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --runInBand` — 1231/1231 passing (116 suites, real run this session; `journeyTime.test.ts` +5 tests for calibration/overhead/caps/immune modes/distance estimates; `platformTour.test.ts` +5 tests for width stability, flip, viewport clamping, centering/tiny viewports, normalize/validate of the new display knobs)
- `npm run lint` — ✓ no new findings in Sprint-84-touched files (pre-existing unrelated errors remain: `app/api/suggestions` `any`s, `metadata.test.ts` require imports, etc.; CI lint is non-blocking)
- `npm install` — ✓ 1518 packages (postinstall `prisma generate` needs a datasource URL)
- `DIRECT_LOCAL_DB=... npx prisma generate` + `npm run build` — ✓ compiled successfully (real run this session; 107 static pages)
- Zero test failures
