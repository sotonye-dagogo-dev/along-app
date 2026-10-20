# In Progress — Idle

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-20
> - status: idle

## Active Work

None. Last closed: Sprint 81 (feed first-load hydration — the home init effect now releases the per-viewer one-shot guard when a started `feedStream.loadInitial` is cancelled by the passive geo-fix transition, so the feed no longer stays on its skeleton until a remount). Prior: Sprint 80 (duplicate-proof bug assignment via per-reporter advisory-lock transactions + `bugReportDedupService`, admin notification deep links via `Notification.metadata` → `/admin/bugs?highlight=<id>` (in-app, push, email CTA), auth session persistence via `authSession.ts` config, refresh `rm` claim, `authRefresh` bucket, middleware refresh-grace with downstream cookie forwarding, Google `prompt=select_account` + remember-me handshake, AuthProvider 429 exponential backoff). See `checkpoints/session-log.md` and `planning/task-queue.md` for the closed state. Residual: Email Studio re-save / `db:seed` on the live DB to publish the new `bugReportNotification` CTA row.
