# In Progress

**Session:** idle — execute-feature 2026-10-09 closed: auth hardening (normalize-then-validate, referral body fallback, case-insensitive email, field-specific errors) + single-admin assignment (load-balanced + randomized, wired into bug-reports/reports/account-deletion) + avatarConfig DbNull build fix + regenerated Prisma client (tsc 0 errors, jest 30 suites / 255 pass, lint zero new)
**Status:** No active sprint. Next work: prod-verify referral + normal registration, single-admin mail ownership, reviewerId on reports; then remaining backlog from `planning/task-queue.md` (live map tracking navigation, auth provider linking, supercluster clustering, rate-limiter Redis migration) via a new sprint.

## Last completed work (archived summary)

Execute-feature 2026-10-09 — Sprint 21: safe account deletion lifecycle end-to-end (schema + idempotent migration, ACID service, account/cron/admin APIs, panel + queues, generic deleted profile, counter recompute, last-admin guard) + Email Studio on SiteConfig (builder, toggles with audit, customs, dynamic capped recipients, 3 system templates) + admin users deletion filter + first-N-by-signup bulk + KPI/profile grid tightening + sign-out. Deep sync: repo-map, dependency-graph, system-architecture (Sprint 21 section), project-plan, task-queue (Sprint 21 rows), dev-history, lessons-learned (deletion-safety lesson), project-decisions (Sprint 21 decision), test-results (static-only note), session-log. Full detail in `summaries/dev-history.md` (Sprint 21 entry) and `checkpoints/session-log.md` (2026-10-09 Sprint 21 entry).
