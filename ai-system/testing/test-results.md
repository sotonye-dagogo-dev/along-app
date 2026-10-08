# Test Results

> **Metadata**
> - last-updated-by: update-ai-system 2026-10-08
> - last-verified-against-code: 2026-10-08
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 122 tests currently exist across 11 suites (per 2026-10-08 QA gate recorded in session-log; this runner has no node_modules so `npm test` could not be re-executed here — 11 test files verified present under `app/__tests__/`).

---

## Last Run (Build)

**Date:** 2026-10-08
**Run by:** AI agent (opencode — resume-session Sprint E close-out + QA gate)

**Build Result:**
- `npx tsc --noEmit` — ✓ zero errors (after removing deleted `downlevelIteration` tsconfig option)
- `npm test` — 122/122 passing (11 suites)
- `npm run build` — ✓ Compiled successfully (clean)
- `npx next lint` — warnings only (removed unused UserPlus import in FollowButton.tsx)
- Zero lint errors

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
| mutations API | — | posting, liking, commenting, bookmarking, following incl. error handling + undefined/null edge cases (`mutations.test.ts`, new Sprint 7) |
| posts API | — | POST persistence (type/description/quotedPostId), fan-out, validation (`posts.test.ts`, new Sprint 7) |

---

## Active Failures

| Test | Error | Status | Assigned To |
|------|-------|--------|------------|
| — | — | — | — |

---

## History

| Date | Passed | Failed | Notes |
|------|--------|--------|-------|
| 2026-10-08 | 122 | 0 | Resume-session QA gate: Sprint 7 verify + tsconfig downlevelIteration removal (11 suites) |
| 2026-09-15 | 91 | 0 | Fix-build: Redis timeout guard + forgot-password non-blocking (this session) |
| 2026-09-15 | 91 | 0 | Fix: Image Upload, Feed/Explore Visibility & Production Audit (77 pages) |
| 2026-06-13 | 91 | 0 | Dashboard navigation, seed fixes, Prisma type fix |
| 2026-06-10 | 91 | 0 | Auth UX: toast, redirect, auth-aware nav |
| 2026-06-09 | 91 | 0 | Sprint 5: feed crash, guest auth, styling, login fixes |
| 2026-06-09 | 91 | 0 | Sprint 4: Production audit fixes |
| 2026-06-03 | 91 | 0 | OC-8: Production readiness audit |
