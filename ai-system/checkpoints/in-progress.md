# In Progress

**Session:** idle — fix-build 2026-10-08 closed: duplicate `bugId` in `app/api/admin/bugs/route.ts` renamed to `targetBugId` (repair-system + test-results + session-log updated; lightweight sync-context done inline, no drift)
**Status:** No active sprint. Next work: pick the next backlog item from `planning/task-queue.md` Backlog (live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration), then open a new sprint via `plan-feature.md` / `execute-feature.md`.

## Last completed work (archived summary)

Execute-feature 2026-10-08 — Sprint 17: fixed admin-dashboard crash (stats API now returns batched `recentUsers`; page null-tolerates older payloads + safe initials); fixed invisible admin entry points (canonical case-insensitive `isAdminRole()`, uppercase registry roles; AdminShell guard + desktop sidebar section + new profile Quick Links admin entry); hardened referral signup (isolated resolution, randomUUID fallback, P2003 retry-once, guarded fan-out; invite backfills null inviteCodes); actualised error reporting (sanitized BugReport filing via `errorReportService` + honest pending/reported/unreported copy in `global-error`/`error`); 10 new tests across 2 suites. Deep sync: repo-map, dependency-graph, system-architecture (Admin/Auth/Error Reporting/Config rows), dev-history, lessons-learned (2 entries), project-decisions, session-log. Full detail in `summaries/dev-history.md` (Sprint 17 entry) and `checkpoints/session-log.md` (2026-10-08 Sprint 17 entry).
