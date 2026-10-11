# In progress — none

No active work. Last session (2026-10-11, execute-feature comment tightening +
feed modal parity + explore search expansion + failing-test close-out) is
closed:
NEW COMMENTS_CONFIG (explicit caret color, avatar sizes, modal copy) +
EXPLORE_SEARCH_CONFIG (caps, recents key, labels, post-type badges); caret fix
(`caretColor` inline, `caret-current` removed); AppAvatar in CommentInput /
CommentList / mentions / search rows; detail passes real userName; NEW shared
PostCommentsModal used by feed (modal + count increment, no nav), profile
(refactored), search, detail; hook fallback soft-navigates via router; NEW
ExploreSearchInput (unified suggestions + recents + full-search footer) wired
into explore desktop/mobile with pin-centre pick; 3 pre-existing red suites
fixed (prose-assertion reword, cache deep-equality + empty fast path); NEW
commentTightening (10) + exploreSearchExpansion (6) suites. QA: tsc zero
errors, jest 54/54 + 461/461, lint pre-existing-only, `npm run build` clean.
update-ai-system terminal sync done; task-queue, session-log, dev-history,
project-decisions, lessons-learned, repo-map, dependency-graph,
system-architecture, project-plan synced.
