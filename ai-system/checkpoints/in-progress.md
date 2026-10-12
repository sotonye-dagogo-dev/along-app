# In progress — none

No active work. Last session (2026-10-11, execute-feature Sprint 44:
deleted-account view-only gating + Active filter + row-actions dropdown) is
closed: `ADMIN_USER_FILTERS` + `ADMIN_USER_ROW_ACTIONS` +
`allowedUserRowActions`/`canShowUserRowAction` + `ADMIN_TABLE_ACTIONS_META`
(config, barrel-exported); `GET /api/admin/users?deletion=active` +
PATCH live/deleted partition with `skippedDeleted` honesty; `AppDropdown`
className/disabled/title passthrough + NEW `AppTableRowActions`
(metadata-driven, color-preserving); users/posts/deletions tables on the
dropdown; bulk actions skip deleted with honest toasts;
`config/admin.test.ts` +2 suites. QA: static review clean; tsc/jest/build
deferred to CI (no node_modules in runner). update-ai-system terminal sync
done; session-log, dev-history, lessons-learned, repo-map,
dependency-graph, system-architecture, project-plan, task-queue synced.
