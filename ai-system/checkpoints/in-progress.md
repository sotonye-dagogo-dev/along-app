# In progress — none

No active work. Last session (2026-10-11, fix-build explore type + leaderboard accuracy) is closed:
explore `avatarConfig` typed via shared `ExploreCardUser` (matches
`ExplorePinCardUser` on both card call sites); leaderboard competition
ranking (ties share rank, ranks recomputed per read, true total via count,
out-of-slice viewer rank via count-ahead), cache invalidation on
`awardPoints`, dead period selector removed; `leaderboard.test.ts` extended
(+1 tie-rank case). Repair-system (+1 entry), test-results, session-log
synced; sync-context light touch (no drift — no new files, no arch claims
affected, task-queue untouched); full jest/tsc/build deferred to CI/Vercel
(no node_modules in runner).
