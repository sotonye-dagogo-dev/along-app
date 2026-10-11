# In progress — none

No active work. Last session (2026-10-11, execute-feature Sprint 35 leaderboard links + auth-link tightening) is closed:
footer/profile/invite all link to /leaderboard via LEADERBOARD_LINKS_CONFIG +
PROFILE_QUICK_LINKS_CONFIG (config-driven, non-breaking); link/status re-reads
googleId+password from DB so hasPassword persists across reloads (hash never
leaves server); EmailSecurityPanel + AuthLinkPanel consume AUTH_LINK_STATUS_CONFIG
copy with connected-methods reflection; profile surfaces ?success=google_linked /
?error=google_already_linked via toast + URL cleanup; `leaderboardAuthLink.test.ts`
added (5 cases). QA: no node_modules in runner — targeted static verification
only (re-reads, locale JSON validity, config-shape review); full jest/tsc/build
deferred to CI/Vercel. update-ai-system terminal sync done; task-queue,
session-log, dev-history, repo-map, dependency-graph synced.
