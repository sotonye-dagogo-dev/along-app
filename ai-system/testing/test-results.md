# Test Results

> **Metadata**
> - last-updated-by: update-ai-system 2026-10-21 (Sprint 87: post/request/navigation tour + guest-banner tour CTA)
> - last-verified-against-code: 2026-10-21 (Sprint 87)
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 1259 tests currently exist across 118 suites (verified by a real `npx jest --runInBand --silent` run in this session 2026-10-21).

---

## Last Run (Build)

**Date:** 2026-10-21
**Run by:** AI agent (opencode — execute-feature Sprint 87)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest --runInBand --silent` — 1259/1259 passing (118 suites, real run this session; `shareRouteTabs` covers the map hint template/filler matrix, `platformTour` covers post/request/navigation step ids/anchors/events, `guestTourNotice` covers default-disabled/banner replacement, `locales` covers en/pcm parity)
- `npm run lint` — ✓ no new findings in Sprint-87-touched files (pre-existing `editPost` exhaustive-deps warning in ShareRouteModal; unrelated legacy errors remain: `app/api/suggestions` `any`s, `metadata.test.ts` require imports, etc.; CI lint is non-blocking)
- `npm install` — ✓ 1518 packages (postinstall `prisma generate` needs a datasource URL)
- `DIRECT_LOCAL_DB=... npx prisma generate` + `npx next build` — ✓ compiled successfully (real run this session; 107 static pages, no schema change)
- Zero test failures
