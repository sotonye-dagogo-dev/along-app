# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-21 (Sprint 85: tabbed share-route composer)
> - last-verified-against-code: 2026-10-21
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1246 tests currently exist across 117 suites (verified by a real `npx jest --ci --maxWorkers=2` run in this session 2026-10-21).

---

## Last Run (Build)

**Date:** 2026-10-21
**Run by:** AI agent (opencode — execute-feature Sprint 85)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --ci --maxWorkers=2` — 1246/1246 passing (117 suites, real run this session; NEW `shareRouteTabs.test.ts` covers tab metadata/order/short labels/icon keys/badge/default, `resolveShareRouteTabId` fallbacks, source wiring/footer contract and FAQ en+pcm parity)
- `npm run lint` — ✓ no new findings in Sprint-85-touched files (one pre-existing `editPost` exhaustive-deps warning in ShareRouteModal; unrelated legacy errors remain: `app/api/suggestions` `any`s, `metadata.test.ts` require imports, etc.; CI lint is non-blocking)
- `npm install` — ✓ 1518 packages (postinstall `prisma generate` needs a datasource URL)
- `DIRECT_LOCAL_DB=... npx prisma generate` + `npx next build` — ✓ compiled successfully (real run this session; 107 static pages)
- Zero test failures
