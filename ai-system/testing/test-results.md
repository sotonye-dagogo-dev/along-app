# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-20 (Sprint 82: platform tour + review notice)
> - last-verified-against-code: 2026-10-20
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1216 tests currently exist across 116 suites (verified by a real `npm test` run in this session 2026-10-20).

---

## Last Run (Build)

**Date:** 2026-10-20
**Run by:** AI agent (opencode — execute-feature Sprint 82)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npm test` — 1216/1216 passing (116 suites, real run this session: +3 suites +33 tests — `platformTour` (18: config integrity/routes/selectors/placements, coerce/state shaping, normalize+clamp, admin card/validator/merge, offline registration + sw.js sync, replay quick link, FAQ en+pcm), `reviewNotice` (16: gate matrix incl. TTL edge + fail-safe probe, storage sanitization, flag/age helpers, lane ordering, FAQ en+pcm); `locales.test.ts` REQUIRED_KEYS extended for the 27 new `tour.*`/`reviewNotice.*` keys)
- `npx next lint` — ✓ clean on every Sprint-82-touched file (3 hook-dep/a11y/unused warnings found and fixed in-session; remaining project findings are pre-existing only — CI lint runs `continue-on-error: true`)
- `npx next build` — ✓ compiled successfully (real run this session; `/api/tour` present in the route output; only pre-existing Sentry deprecation warning)
- Zero test failures

---
