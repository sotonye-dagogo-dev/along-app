# In Progress

**Session:** idle — Sprint 12 posting hardening + viewer/carousel fixes closed out by `execute-feature.md` on 2026-10-08
**Status:** No active sprint. Next work: pick the next backlog item from `planning/task-queue.md` Backlog (live map tracking navigation, carto basemap key wiring, auth provider linking, supercluster clustering, rate-limiter Redis migration), then open a new sprint via `plan-feature.md` / `execute-feature.md`. Note: this runner now has node_modules (`npm ci` installed), so the full QA gate runs in-runner.

## Last completed work (archived summary)

Execute-feature 2026-10-08 — Sprint 12: double-click route duplicates eliminated at three layers (ShareRouteModal `isSubmitting` disabled buttons + spinner, `submitPost` in-flight dedup, server `X-Idempotency-Key` replay-or-409 with atomic single-statement create via `POST_SUBMIT_CONFIG` + `idempotencyService`); like/dislike undo toasts removed (bookmark undo kept); ImageLightbox rewritten around a state-owned index (arrows keyboard, accurate counter); EndlessCarousel autoplay restored (mouse-only hover pause, `repeat` until overflow, `maxRepeat` cap). 34 configs, 18 services, 16 test suites (154 tests). QA full in-runner: tsc 0 errors, jest 154/154 pass, next build clean, lint clean for touched files. Full detail in `summaries/dev-history.md` ("2026-10-08 — Execute-Feature: Posting Hardening + Viewer/Carousel Fixes (Sprint 12)" entry) and `checkpoints/session-log.md` (Sprint 12 entry).
