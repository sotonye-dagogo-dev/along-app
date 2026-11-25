# Test Results

> **Metadata**
> - last-updated-by: update-ai-system 2026-11-25 (Sprint 92: Vercel Fluid Active CPU guardrails)
> - last-verified-against-code: 2026-11-25 (Sprint 92)
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1298 tests currently exist across 121 suites (verified by a real `npx jest --ci --maxWorkers=2 --silent` run in this session 2026-11-25).

---

## Last Run (Build)

**Date:** 2026-11-25
**Run by:** AI agent (opencode — execute-feature Sprint 92)

**Build Result:**
- `npx prisma generate` — ✓ succeeds with `DATABASE_URL`/`DIRECT_URL` set (output `app/generated/prisma`); postinstall needs a datasource URL
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --ci --maxWorkers=2 --silent` — 1298/1298 passing (121 suites, real run this session; NEW `performance` covers polling policy, the visibility hook contract, poller wiring, next.config catch-all removal, feed cache-hit short-circuit, site-config CDN opt-in and guest-feed cache key/TTL; all prior tour/share/navigation/locales/map coverage remains)
- `npx next lint --max-warnings 0` — ✓ no new findings in Sprint-92-touched files (pre-existing `editPost` exhaustive-deps warning, unused `Settings` import, `app/api/suggestions` `any`s and metadata-test `require` unchanged; CI lint is non-blocking)
- `npm ci` — ✓ 1513 packages
- `npm run build` — ✓ compiled successfully (real run this session; most dashboard routes build as `○ Static`, confirming the removed header no longer forces dynamic work)
- Zero test failures
