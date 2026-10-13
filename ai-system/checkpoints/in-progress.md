# In progress — none

No active work. Last session (2026-10-13, feed de-glitch + profile tabQuery
build fix) is closed: duplicate `tabQuery` identifiers renamed
(`tabFilter`/`tabPostsQuery`) in both profile pages; feed stabilized via
`excludeIds` pagination + deterministic tie-break + `dedupePosts` invariant +
poll-cursor preservation + `FEED_STREAM_CONFIG`; home single-subscription +
single refresh; new `feedDedup` test. QA to runner extent (grep + diff
review green; full tsc/jest/build deferred to CI — no node_modules). Docs
closed out (session-log, dev-history, task-queue, dependency-graph,
in-progress).
