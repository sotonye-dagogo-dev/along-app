# Test Results

> **Metadata**
> - last-updated-by: execute-feature 2026-10-08
> - last-verified-against-code: 2026-10-08
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 122 tests currently exist across 11 suites (verified by a real `npx jest` run in this session 2026-10-08: 11 passed, 122 passed — supersedes the prior file-presence-only note).

---

## Last Run (Build)

**Date:** 2026-10-08
**Run by:** AI agent (opencode — execute-feature doc-staleness remediation + QA gate)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (real run this session)
- `npx jest` — 122/122 passing (11 suites, real run this session after `npm install`)
- `npm run build` — ✓ Compiled successfully (real run this session, exit 0)
- `npx next lint` — exit 0; pre-existing `no-explicit-any` errors in `app/api/posts/feed/route.ts` + pre-existing warnings elsewhere (not introduced by this docs-only session; left untouched per non-breaking constraint)
- Zero test failures; no code fixes needed

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

---

## Active Failures

| Test | Error | Status | Assigned To |
|------|-------|--------|------------|
| — | — | — | — |

---

## History

| Date | Passed | Failed | Notes |
|------|--------|--------|-------|
| 2026-10-08 | 122 | 0 | Execute-feature doc remediation QA gate: real jest/tsc/build/lint runs (11 suites) |
| 2026-10-08 | 122 | 0 | Resume-session QA gate: Sprint 7 verify + tsconfig downlevelIteration removal (11 suites) |
| 2026-09-15 | 91 | 0 | Fix-build: Redis timeout guard + forgot-password non-blocking (this session) |
| 2026-09-15 | 91 | 0 | Fix: Image Upload, Feed/Explore Visibility & Production Audit (77 pages) |
| 2026-06-13 | 91 | 0 | Dashboard navigation, seed fixes, Prisma type fix |
| 2026-06-10 | 91 | 0 | Auth UX: toast, redirect, auth-aware nav |
| 2026-06-09 | 91 | 0 | Sprint 5: feed crash, guest auth, styling, login fixes |
| 2026-06-09 | 91 | 0 | Sprint 4: Production audit fixes |
| 2026-06-03 | 91 | 0 | OC-8: Production readiness audit |
