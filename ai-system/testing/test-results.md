# Test Results

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: overwritten on every test run — always current

> **Overview:** Latest test run results for Along. Updated by agents after running the test suite. Gives a quick snapshot of current project health. 91 tests currently exist across 9 suites.

---

## Last Run

**Date:** 2026-06-13
**Run by:** AI agent (opencode)

**Results:**
| Suite | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| Unit (services) | 27 | 0 | 0 |
| Unit (config) | 11 | 0 | 0 |
| Unit (utils) | 7 | 0 | 0 |
| Component | 25 | 0 | 0 |
| Integration | 0 | 0 | 0 |
| E2E | 0 | 0 | 0 |
| **Total** | **91** | **0** | **0** |

**Overall Status:** Passing

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

---

## Active Failures

| Test | Error | Status | Assigned To |
|------|-------|--------|------------|
| — | — | — | — |

---

## History

| Date | Passed | Failed | Notes |
|------|--------|--------|-------|
| 2026-06-13 | 91 | 0 | Dashboard navigation, seed fixes, Prisma type fix |
| 2026-06-10 | 91 | 0 | Auth UX: toast, redirect, auth-aware nav |
| 2026-06-09 | 91 | 0 | Sprint 5: feed crash, guest auth, styling, login fixes |
| 2026-06-09 | 91 | 0 | Sprint 4: Production audit fixes |
| 2026-06-03 | 91 | 0 | OC-8: Production readiness audit |
