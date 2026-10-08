# In Progress

**Session:** execute-feature — "Clear up mock/seed data, welcome notification, live collapsible route preview, in-app caching, location autofill, route requests E2E, scroll-aware feed prompt, analytics/responsive grids"
**Started:** 2026-10-07
**Status:** Sprints A–D COMPLETE. E1 COMPLETE (schema type/quotedPostId, POST fan-out, quotedPost includes, /api/suggestions cached, RequestRouteModal, ShareRouteModal response mode + boolean-fail contract, PostCard badge/Respond/quote block/map guard, home composer request button + respond wiring + shared submitPost). E2 COMPLETE (EndlessCarousel endless-tape with drag/pause/reduced-motion, mobile SuggestionsRail xl:hidden below feed, live desktop SuggestionsPanel: who-to-follow w/ FollowButton, open requests, real trending tags — mock EVENTS removed). A3 COMPLETE (landing preview = 2 latest real posts via prisma w/ fallback CTA, About reviews moved to config SITE_REVIEWS). F1 COMPLETE (scroll-aware floating new-posts prompt: scroll-depth + time throttled, auto-dismiss, tab-bar clearance). G1/G2 COMPLETE (analytics responsive grids, project-wide sweep). H1 COMPLETE (posting E2E verified: POST persists type/description/quotedPostId, fan-out non-blocking, feed refresh + cold-start reload). H2 COMPLETE (per-tab profile filtering + /api/bookmarks). H3 COMPLETE (decision: keep memoryCache/useCachedFetch/feedStream, no redux). H4 COMPLETE (mutations + posts API tests, 122 passing). QA GATE PASSED 2026-10-08 (tsc 0 errors, lint warnings-only, jest 122/122, next build clean). Drift check 2026-10-08 (3rd resume): MINOR drift only — in-progress NEXT pointer was stale (F1/G/H already in code); task-queue already marked E2/F1/G1/G2/H2/H3 done; reconciled H1/H4/QA to done after verification run.

## Addendum (resume-session directive 2026-10-07 — additive, does not invalidate plan)

- **H1. Posting E2E verification** — confirm post creation → feed display works end-to-end.
- **H2. Profile tab filtering** — posts / liked / bookmarks / routes tabs must fetch-filtered data per tab (currently own profile renders one unfiltered `/api/posts?limit=20` list for every tab; `activeTab` drives no data).
- **H3. State-strategy review** — evaluate redux-observables + subscriptions vs current `memoryCache`/`useCachedFetch`/`feedStream` RxJS setup for UX + maintainability; adopt only if clearly better; document decision (project-decisions). Must not invalidate completed work.
- **H4. Mutation E2E tests + error hardening** — jest coverage for posting, liking, commenting, bookmarking, following incl. error handling and undefined/null edge cases; verify `app/error.tsx` (+ add `global-error.tsx` if missing) keeps runtime errors graceful (no dead-ends/crashes).

## Architecture impact (why plan-feature ran)

- Prisma schema migration: `Post.type` (new `PostType` enum), `Post.description`, `Post.quotedPostId` self-relation; `NotificationType` enum extended (`WELCOME`, `ROUTE_REQUEST`, `ROUTE_RESPONSE`, `REWARD`, `BADGE`, `VERIFIED` — the last three also fix the currently-crashing `?filter=rewards` query).
- New API routes: `GET /api/suggestions`.
- New services/utilities: client `memoryCache` (TTL Map), `useCachedFetch` hook, `postModal`/response-mode wiring, seed backup/clear scripts under `scripts/`.
- New UI: `EndlessCarousel`, `RequestRouteModal`, quote block in `PostCard`, collapsible route-preview panel, mobile suggestions rail.

## Plan (task order)

### Sprint A — Mock & seed data hygiene
1. `scripts/backup-seed-data.ts` — dumps ONLY seed-marked rows to `backups/seed-backup-<ts>.json` before any deletion.
2. `scripts/clear-seed-data.ts` — targets seed markers only (10 `*@example.com` users + userNames, their posts by title, their comments/likes/bookmarks/follows). Never touches user-created data; always backs up first.
3. package.json: `db:seed`, `db:backup`, `db:clear-seed` (tsx). Remove dead `mock-api`/`dev:all` scripts + `json-server` dep + README refs.
4. Make `prisma/seed.ts` idempotent (posts/comments upsert by title).
5. Replace hardcoded mock data: `SuggestionsPanel` → real `/api/suggestions`; landing preview cards → real posts (config fallback); About `REVIEWS` → config registry.

### Sprint B — Welcome notification
6. Migration (all enum/column changes in one).
7. Register route: create `WELCOME` notification for the new user (non-blocking).
8. Notifications UI: new type icons + registry; deep-link rows to `/posts/[id]`.

### Sprint C — Route preview live + collapsible + location autofill
9. Preview panel collapsible via DraftingCoach pattern (summary chips when collapsed).
10. Live trace: debounced `/api/routes/trace` as steps change → real polyline/distance/duration in preview (estimate fallback).
11. Location inputs: "Use my current location" on focus (geolocation + Nominatim reverse) alongside existing manual entry/autocomplete.

### Sprint D — In-app memory & caching
12. `app/lib/cache/memoryCache.ts` (TTL Map, prefix invalidation, never-throw — mirrors redis.ts semantics).
13. `useCachedFetch` (read-through + stale-while-revalidate + in-flight dedup).
14. Wire: home feed (feedStream hydrates from cache — no skeleton flash; pause poll when tab hidden), notifications, analytics, post detail, profile, explore.
15. Server: claim reserved `CACHE_KEYS` slots (notifications 60s, post 600s, analytics 3600s, leaderboard 600s, suggestions 1800s) with write invalidation.

### Sprint E — Route requests end-to-end
16. CREATE_POST_SCHEMA accepts `type`, persists `description`, accepts `quotedPostId`.
17. Fan-out: `ROUTE_REQUEST` post → notify followers; `ROUTE_RESPONSE` post → notify requester.
18. `GET /api/suggestions` — ordered: route requests → routes → accounts to follow (cache 1800s).
19. `RequestRouteModal` + composer action ("Request a route").
20. `PostCard`: request badge + **Respond** CTA → opens ShareRouteModal in response mode; response posts render quote block of the request.
21. `EndlessCarousel` — endless tape (track duplication), smooth CSS transform animation, pause on hover/touch, drag interaction, `prefers-reduced-motion` support, responsive card widths.
22. Mobile suggestions rail mounted **below the feed** (`xl:hidden`, room above for future ad banners); desktop `SuggestionsPanel` switched to same live API.

### Sprint F — Scroll-aware new-posts prompt
23. Keep sticky pill; add floating fixed prompt throttled by scroll depth + time; auto-dismiss; respects tab bar clearance.

### Sprint G — Analytics + project-wide responsive fixes
24. KPI tiles: `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`, text wraps (`min-w-0 break-words`), skeleton matches; quick-stats responsive; `px-4 sm:px-6`; top-post title `flex-1 min-w-0` (drop `w-[130px]`).
25. Sweep top offenders: AppFooter 3-col grid, register name inputs, admin users `w-64`, header wrapping, other non-responsive grids/truncations.

### QA gate + close
26. `npx tsc --noEmit` + `npx next lint` + `npm test` + `npm run build`; fix failures.
27. Docs: session-log, dev-history, task-queue, project-decisions (assumptions), repair-system (if bugs), sync-context + update-ai-system deep sync (architecture impact), clear this file.

## Key assumptions (pending sign-off)

- "Post modal" for the respond CTA = the route-posting modal (`ShareRouteModal`) in response mode with the request quoted; carousel route items link to `/posts/[id]`.
- Seed clear script never runs automatically — package.json script only, backup always first, scoped to seed markers only.
- `SiteConfig` seeded keys are treated as live config, NOT cleared.
