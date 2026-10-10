# Development Task Queue

> **Metadata**
> - last-updated-by: execute-command 2026-10-10 (Sprint 31 universal share + dynamic trust)
> - last-verified-against-code: 2026-10-10 (static re-reads; no node_modules in runner — tsc/jest/build deferred to CI/Vercel)
> - last-synced: 2026-10-10 (Sprint 31 — execute-command close-out)
> - staleness-policy: re-verify before each session

> **Overview:** Sprint-level task queue for the Along application rebuild. Agents execute tasks top to bottom within the current sprint.

---

## Complexity Tags

Tags help agents self-select whether a task needs the full `execute-feature.md` pipeline or a lighter `dev-cycle.md`:

| Tag | Meaning | Recommended Command |
|-----|---------|-------------------|
| `[XS]` | Trivial — single file, known pattern | dev-cycle.md |
| `[S]` | Small — 1-3 files, well-understood | dev-cycle.md |
| `[M]` | Medium — 3-8 files, some planning needed | dev-cycle.md with plan-feature pre-read |
| `[L]` | Large — feature spanning modules | execute-feature.md |
| `[XL]` | Very large — architecture-affecting | execute-feature.md, requires architect role |
| `[BUG]` | Bug fix | fix-build.md |

---

## Current Sprint — Phase 6: Public Pages & SEO (Complete)

> **Section summary:** All Phase 6 tasks complete. Quality gate passed: `npm run build` + `npx tsc --noEmit` + `npx next lint` — zero errors.

| Size | Task | Status |
|------|------|--------|
| [L] | Landing Page — Hero, feature grid, social proof, PostCard previews, CTA | [x] |
| [M] | About Page — hero, feature highlights, team grid, reviews carousel | [x] |
| [S] | Contact Page — ConfigDrivenForm with CONTACT_FIELDS | [x] |
| [S] | Privacy & Terms — react-markdown + remark-gfm | [x] |
| [M] | Report Bug — ConfigDrivenForm with BUG_REPORT_FIELDS | [x] |
| [XL] | SEO Infrastructure — metadata utils, StructuredData, sitemap, robots, per-page metadata | [x] |
| [S] | Footer — AppFooter config-driven, wired into layouts | [x] |
| [M] | Middleware — route protection for public/auth/protected routes | [x] |

---

## OC-8: Production Readiness Audit

> **Section summary:** All OC-8 tasks complete. Quality gate passed: `npm run build` (54 static pages) + `npx tsc --noEmit` (zero errors) + `npm test` (91/91) + `npx next lint` (pre-existing warnings only).

| Size | Task | Status |
|------|------|--------|
| [M] | Emoji audit — Fixed 8 violations across 4 files | [x] |
| [M] | Component compliance — Zero raw antd imports in pages/features | [x] |
| [L] | Subtle links — Fixed 19 violations across 8 files | [x] |
| [M] | N+1 query — Admin stats 7-day query: 7→1 (7x reduction) | [x] |
| [L] | Cursor pagination — comments, notifications, admin/bugs, admin/reviews | [x] |
| [S] | Dynamic imports — AvatarEditor, ShareRouteModal (ssr:false) | [x] |
| [M] | PWA — manifest verified, icons verified, OnlineStatusProvider + OfflineIndicator created | [x] |
| [L] | Test suite — 91 tests across 9 suites | [x] |
| [L] | QStash workers — feed-invalidate, validity-recompute, rewards (3 workers) | [x] |
| [M] | Redis feed caching — feedService.ts 5min TTL | [x] |
| [S] | API handlers — contact, bug-reports (Phase 6 gaps) | [x] |
| [L] | RxJS reactive feed (feedPoller$, interactionCache$) | [x] |
| [L] | i18n foundation (English + Pidgin) | [x] |
| [L] | Lighthouse audit — loading/error/not-found pages, security headers, resource hints, asset caching | [x] |

---

## Sprint 5: RxJS Feed, i18n, Lighthouse Audit

> **Section summary:** All three backlog items complete. Quality gate passed: `npx tsc --noEmit` (zero errors) + `npm run build` (65 pages) + `npm test` (91/91).

| Size | Task | Status |
|------|------|--------|
| [L] | Create FeedStream class with feedState$, interactionCache$, 30s polling | [x] |
| [M] | Wire feedStream into home page — loadInitial, loadMore, applyInteraction | [x] |
| [S] | Create i18n config — Locale types, LOCALES config, StorageKey | [x] |
| [M] | Create en.json + pcm.json — ~90 translation keys | [x] |
| [M] | Create I18nProvider — Context with t() interpolation, auto-detect | [x] |
| [S] | Create LocaleSwitcher — en/pcm toggle | [x] |
| [S] | Wire I18nProvider into root layout | [x] |
| [M] | Add locale cookie detection + Accept-Language in middleware | [x] |
| [S] | Create loading.tsx, error.tsx, not-found.tsx | [x] |
| [M] | Add security headers + asset caching to next.config.mjs | [x] |
| [S] | Add resource hints (preconnect/dns-prefetch) to root layout | [x] |

---

## Sprint 3: Brand, SEO, Guest Access & Public Pages

> **Directives:** Logo usage across all public surfaces, SEO/metadata improvements, guest functionality with auth-required toasts, public pages styling (beyond About), missing pages (FAQ, Blog), admin-editable config items consistent with no-hardcoding policy.

| Size | Task | Status |
|------|------|--------|
| [S] | Create LOGO_CONFIG — sizes, brand colors, wordmark, SVG icon path | [x] |
| [S] | Create AppLogo — Inline SVG component with size/showText/linkTo props | [x] |
| [S] | Wire AppLogo into public layout header, public layout nav | [x] |
| [M] | Set metadataBase from NEXT_PUBLIC_APP_URL | [x] |
| [M] | Create getSiteConfig(key, defaultValue) with Redis caching + DB fallback | [x] |
| [S] | Enhance buildMetadata() with metadataBase, buildPublicMetadata() helper | [x] |
| [S] | Add FAQPage, BlogPosting, and BreadcrumbList schemas | [x] |
| [L] | Update middleware — guest-allowed routes, protected routes, auth redirects | [x] |
| [M] | Handle guest state in AuthProvider — isGuest, requireAuth(action) toast | [x] |
| [M] | Guard interactive components — PostCard wired with requireAuth | [x] |
| [M] | Render guest UI — GuestBanner, useRequireAuth hook returns isGuest | [x] |
| [S] | Create public layout header with AppLogo + nav + Auth CTAs | [x] |
| [M] | Create FAQ page — accordion layout with search, FAQPage JSON-LD | [x] |
| [L] | Create Blog — MDX posts, listing page, post detail page | [x] |
| [M] | Create push subscription service + API routes (subscribe, unsubscribe, send, vapid-public-key) | [x] |
| [M] | Create PushProvider — auto-subscribes on auth, wired into root layout | [x] |

---

## Sprint 4: Production Audit Fixes — Runtime Errors, Dead Links, Branding, Theme Toggle

| Size | Task | Status |
|------|------|--------|
| [BUG] | Fix JS Runtime Error — post.tags.length and post.images.length crash when undefined | [x] |
| [BUG] | Fix OAuth Google buttons — add onClick to login + register pages | [x] |
| [BUG] | Fix double navbar — remove redundant inline nav from landing page | [x] |
| [BUG] | Fix dead links — /dashboard->/home, create /forgot-password, /share->/home, /settings->/profile | [x] |
| [M] | Implement dark mode theme toggle — ThemeProvider + ThemeToggle | [x] |
| [S] | Add guest CTAs to landing page, login, register pages | [x] |
| [M] | Update logo config + AppLogo with brand asset files | [x] |
| [S] | Replace inline SVGs in auth layout and AdminShell with AppLogo | [x] |
| [S] | Create Sentry global-error.tsx with error boundary | [x] |
| [S] | Add Sentry.captureException() to auth API routes | [x] |
| [S] | Wire OG image, Twitter card, apple-touch-icon in root layout | [x] |

---

## Sprint Remediation 2026-07-08 — Auth, Error Handling & Code Quality

> **Section summary:** Comprehensive codebase audit remediation across 4 sprints. All Sprint A-D items complete except JWT middleware and explore page decomposition.

| Size | Task | Status |
|------|------|--------|
| [S] | Forgot-password API + reset-password API + UI page | [x] |
| [S] | Guard OTP console.log in register route | [x] |
| [S] | Bookmarks page: fetch real data | [x] |
| [M] | Profile/[username]: fetch real user + posts | [x] |
| [S] | Create /api/users/by-username/[username] | [x] |
| [S] | Create shared rateLimit.ts utility | [x] |
| [M] | Wire rate limiting into login, register, otp, refresh | [x] |
| [S] | AbortController + res.ok to notifications, post detail, profile, bookmarks | [x] |
| [S] | AbortController to admin/users search | [x] |
| [M] | Replace empty catch blocks in 6 admin pages | [x] |
| [L] | PostCard useReducer refactor | [x] |
| [L] | Export standardization: 17 UI components → named exports | [x] |
| [S] | Add aria-labels to explore + home | [x] |
| [S] | Add img width/height to PostCard + post detail | [x] |
| [S] | Remove currentUserId prop from PostCard/home | [x] |
| [S] | Remove unnecessary fragment wrappers (PushProvider, forgot-password layout) | [x] |
| [S] | Guard email service console.logs | [x] |
| [S] | JWT verification in middleware (jose) | [x] |
| [M] | Decompose explore page into sub-components | [x] |

---

## Sprint 6 — Leaderboards

> **Section summary:** Global leaderboard showing top contributors by reward points.

| Size | Task | Status |
|------|------|--------|
| [M] | Leaderboard API route, page, layout, nav config, middleware | [x] |

---

## Sprint 7 — Route Requests E2E, Live Preview, Caching & Data Hygiene

> **Section summary:** execute-feature directive 2026-10-07. Architecture impact: Prisma migration (Post.type/description/quotedPostId, NotificationType extension), new /api/suggestions, new cache services, EndlessCarousel + RequestRouteModal. Plan detail in `checkpoints/in-progress.md`.

| Size | Task | Status |
|------|------|--------|
| [M] | A1. Seed backup + clear scripts (`scripts/backup-seed-data.ts`, `scripts/clear-seed-data.ts`), package.json `db:seed`/`db:backup`/`db:clear-seed` | [x] |
| [S] | A2. Remove dead mock-api/dev:all scripts + json-server dep + README refs; make seed idempotent | [x] |
| [M] | A3. Replace hardcoded mock data — SuggestionsPanel live, landing preview real posts, About reviews to config | [x] |
| [S] | B1. Prisma migration — Post.type/description/quotedPostId + NotificationType(WELCOME/ROUTE_REQUEST/ROUTE_RESPONSE/REWARD/BADGE/VERIFIED) | [x] |
| [S] | B2. Welcome notification on signup + notifications UI types/deep-links + rewards filter fix | [x] |
| [M] | C1. Collapsible route preview panel (DraftingCoach pattern) + live debounced route trace (polyline/distance/duration) | [x] |
| [S] | C2. Location autofill — "use my current location" geolocation + reverse geocode in location inputs | [x] |
| [L] | D1. Client memoryCache + useCachedFetch; wire home/notifications/analytics/post/profile/explore; feedStream hydrate + hidden-tab pause; server CACHE_KEYS slots with invalidation | [x] |
| [XL] | E1. Route requests E2E — schema+Zod, fan-out notifications, /api/suggestions, RequestRouteModal, PostCard Respond CTA + quote block, response-mode ShareRouteModal | [x] |
| [M] | E2. EndlessCarousel (endless tape, smooth, interactive, reduced-motion) + mobile suggestions rail below feed (xl:hidden) + live desktop SuggestionsPanel | [x] |
| [S] | F1. Scroll-aware floating "new posts" prompt with scroll-depth/time throttling | [x] |
| [M] | G1. Analytics overview tiles responsive grid (2/3/4 cols) + text wrap; quick-stats + skeleton responsive | [x] |
| [M] | G2. Project-wide responsive sweep — footer grid, register inputs, admin widths, header wrapping, truncate/fixed-width offenders | [x] |
| [M] | H1. Posting E2E verification (create → feed display) | [x] |
| [L] | H2. Profile tab filtering — posts/liked/bookmarks/routes fetch filtered per tab (+ any missing endpoints) | [x] |
| [M] | H3. State-strategy review: redux-observables/subscriptions vs memoryCache/useCachedFetch/feedStream; decision documented | [x] |
| [L] | H4. Mutation E2E tests (post/like/comment/bookmark/follow) + error handling, undefined edge cases, error-boundary hardening | [x] |
| [L] | QA — tsc + lint + jest + build gate; docs close-out (session-log, dev-history, decisions, sync-context, update-ai-system) | [x] |

---

## Sprint 8 — Search E2E (2026-10-08, execute-feature)

> **Section summary:** Unified search implemented end-to-end, non-breaking (no schema change, no new deps). QA gate green with real runs: tsc 0, jest 139/139 (13 suites), lint zero-new-errors, build clean with `/search` route.

| Size | Task | Status |
|------|------|--------|
| [M] | SearchService — unified posts+users+tags, Redis read-through, P2022 fallback (`app/lib/services/searchService.ts`) | [x] |
| [M] | GET /api/search — q/type/region/postType/cursor, search-bucket rate limit, sanitized errors, guest-accessible | [x] |
| [M] | /search page — debounced input, All/Routes/People tabs, PostCard + FollowButton reuse, AppEmptyState search preset (fixes SuggestionsPanel dead `/search?q=` links) | [x] |
| [S] | Wiring — apiRegistry `search` entry, middleware `/search` guest route | [x] |
| [M] | Tests — `search.test.ts` (9 API-boundary) + `searchService.test.ts` (8 service) | [x] |

---

## Sprint 9 — Carousel, Share-Modal, Request Icon, Footer (2026-10-08, execute-feature)

> **Section summary:** UX tightening per directive, non-breaking (no migration, no new deps). QA partial: runner has no node_modules — tsc shows only the missing-deps cascade (zero errors attributable to touched files); jest/lint/build deferred to CI.

| Size | Task | Status |
|------|------|--------|
| [M] | Carousel — own overflow container + scroll-based autoplay with free scrub + resume-from-position (`ENDLESS_CAROUSEL_CONFIG`, EndlessCarousel rewrite, rail container, home column layout) | [x] |
| [M] | Share modal — preview + score collapsed by default, collapsible route form, actions footer below preview+score (`SHARE_ROUTE_MODAL_CONFIG`, DraftingCoach `defaultOpen`) | [x] |
| [S] | Request trigger — query-style icon with "Request?" tooltip/tagline (`REQUEST_ROUTE_TRIGGER_CONFIG`, `RequestRouteTrigger`, home composer wiring) | [x] |
| [S] | Footer — 3-col link grid on mobile and up (`FOOTER_CONFIG.layout`, AppFooter consumes config) | [x] |
| [S] | Tests — `__tests__/config/uxTightening.test.ts` (4 config suites) | [x] |

---

## Sprint 10 — Carousel Ordering + Route-Drafts Library (2026-10-08, execute-feature)

> **Section summary:** Directive items, non-breaking (no migration, no new deps). QA partial: runner has no node_modules — tsc shows only the missing-deps cascade (zero errors attributable to touched files); jest/lint/build deferred to CI.

| Size | Task | Status |
|------|------|--------|
| [S] | Carousel ordering — SuggestionsRail above feed, below share/request trigger div (own overflow container unchanged) | [x] |
| [M] | Route-drafts library — ROUTE_DRAFTS_CONFIG + routeDraftsService (multi-draft, legacy migration, never-throw) + RouteDraftsPanel + ShareRouteModal integration + home resume chip | [x] |
| [S] | Tests — `__tests__/config/routeDrafts.test.ts` (4 suites: config, save/restore/delete, corrupt-safety, legacy migration) | [x] |

---

## Sprint 11 — Posting Fix + Response/Draft Linkage + Toast/Report/Carousel (2026-10-08, execute-feature)

> **Section summary:** Directive items, non-breaking (no migration, no new deps). QA full: runner installed node_modules — tsc 0 errors, jest 15 suites / 149 tests pass, next build clean, lint clean for touched files.

| Size | Task | Status |
|------|------|--------|
| [M] | Posting "Validation failed" root-cause fix — generic description input, omit-blank submit, empty-tolerant schema, first-field message + server warn log | [x] |
| [S] | Response linkage — request tag inheritance + drafts persist/restore `responseTo` (badge in panel) | [x] |
| [S] | Undo-toast single timer (`TOAST_CONFIG`, duration pass-through, per-toast remount) | [x] |
| [S] | Post actions — working Copy link + Report dialog (`POST_ACTIONS_CONFIG`, linked bug-reports) | [x] |
| [S] | About reviews on shared `EndlessCarousel` (same wrapper/animation as home) | [x] |

---

## Sprint 12 — Posting Hardening + Viewer/Carousel Fixes (2026-10-08, execute-feature)

> **Section summary:** Directive iron-out items, non-breaking (no migration, no new deps). QA full in-runner: tsc 0 errors, jest 16 suites / 154 tests pass, next build clean, lint clean for touched files (2 pre-existing warnings in untouched code paths).

| Size | Task | Status |
|------|------|--------|
| [M] | Share-route submit guard — `isSubmitting` state, disabled Share/Save buttons, spinner feedback, re-entry guard (config labels in `POST_SUBMIT_CONFIG`); RequestRouteModal spinner icon | [x] |
| [M] | Posting ACID/idempotency E2E — per-session `clientMutationId`, in-flight dedup in `submitPost`, `X-Idempotency-Key` header, atomic single-statement create (validity precomputed), server replay-or-409 via TTL `idempotencyService` | [x] |
| [S] | Like/dislike undo-toast removal — post detail `handleLike` no longer registers undo (bookmark undo kept) | [x] |
| [S] | ImageLightbox rewrite — state-owned index (no DOM src mutation), ArrowLeft/Right keys, accurate `n / total` counter, re-sync on thumbnail change | [x] |
| [S] | EndlessCarousel autoplay fix — mouse-only hover pause (touch taps no longer stall), item-set `repeat` (cap `maxRepeat`) so the tape overflows with few cards | [x] |
| [S] | Tests — `__tests__/config/postSubmit.test.ts` (5 suites: config, claim/replay, release, blank keys, carousel repeat) | [x] |

---

## Sprint 13 — Post/Comment Moderation + Report Lifecycle + Request Display Rules (2026-10-08, execute-feature)

> **Section summary:** Directive close-out, non-breaking (additive migration with P2022-tolerant reads, no removed APIs). QA full in-runner: tsc 0 errors, jest 17 suites / 160 tests pass, next build clean, lint clean for touched files.

| Size | Task | Status |
|------|------|--------|
| [L] | Post/comment management — owner edit (ShareRouteModal edit mode → PATCH), delete + archive/unarchive via global confirm modal + global undo toast (`postModerationService`, snapshot-restore replay); admin delete/archive on any post or comment (identity never revealed) | [x] |
| [L] | Report E2E — dedicated `POST /api/reports` (ACID dedup transaction, 409 on duplicate), receipt notification to reporter + triage notification to admins (REPORT), admin Dismiss/Hide/Remove actions in one transaction with outcome notification (MODERATION); anonymity kept both ways; Bugs/Reports filter tab in admin | [x] |
| [M] | Shared `PostMenu` + `ReportDialog` (moderation/) on feed cards AND individual post views (copy link, report, edit, archive, delete) | [x] |
| [M] | Route-request display rules — no map, no navigation guide, no trust score (`MODERATION_CONFIG.routeRequestHides`); responses listed comment-style with links on expanded request view; API returns `responses`/`responsesCount` | [x] |
| [S] | TrustBadge viewport fix — fixed-position tooltip, clamped horizontally, flips below when no room above, click toggle + Escape | [x] |
| [S] | Archive filtering — `isArchived` excluded from feed/guest/search/suggestions/sitemap (P2022-tolerant fallbacks); owner-profile self view + direct link (owner/admin) still resolve | [x] |
| [S] | Tests — `__tests__/post-moderation.test.ts` (config registry, admin roles, hide rules, notification types); `posts.test.ts` guest expectation updated to archived-exclusion | [x] |

---

## Sprint 14 — Notification/Referral/Profile Tightening (2026-10-08, execute-feature)

> **Section summary:** Directive close-out, non-breaking (additive migration with enum guards; service never throws so pre-migration writes fail safe). QA full in-runner: tsc 0 errors, jest 21 suites / 188 tests pass, next build clean, lint zero new errors (11 pre-existing).

| Size | Task | Status |
|------|------|--------|
| [M] | Post-nature preservation — PATCH strips `type`/`quotedPostId` via `MODERATION_CONFIG.immutablePostFields` (edits + admin corrections can never morph a post; archive path content-neutral) | [x] |
| [M] | Profile tabs — own profile posts/routes/requests/liked/bookmarks/archived, other-user posts/routes/requests/liked; Routes = ROUTE+ROUTE_RESPONSE (actual routes, requests excluded); `?archived=true` owner-only library; type/archived pills on cards | [x] |
| [S] | `GET /api/posts` — comma-separated `type` filter + `archived=true` (owner-only; non-owners silently get unarchived) | [x] |
| [L] | Notification coverage — MENTION on comment create + edit-diff (`mentionService`), DISLIKE + NEW_ROUTE enum/migration/registry/UI/fan-out, LIKE/COMMENT re-routed through `createNotification` (cache invalidation), WELCOME `allowSelf` fix, follower fan-out on ROUTE/RESPONSE uploads | [x] |
| [L] | Referrals auth-agnostic — shared `referralService` (unlimited linking, send-credit cap), `?ref=` forwarded by register page, Google OAuth `state=ref:` → callback links new + first-time-OAuth signups, welcome notification on Google signup | [x] |
| [S] | Invite policy — maxInvites caps send-credit points only (config docs + server cap + invite page "Bonus Invites Left" copy); leaderboard verified zero-point-inclusive | [x] |
| [S] | Route-request flag contrast — `bg-warning text-warning-text border-warning-border` pairing on PostCard, detail view, RequestRouteModal, drafts panel, ShareRouteModal banner, admin pills, invite ranks | [x] |
| [M] | Tests — `post-nature.test.ts` (4), `mentionService.test.ts` (8), `referralService.test.ts` (6), `leaderboard.test.ts` (2), posts/mutations extensions (like/dislike/mention/multi-type/archived) | [x] |

---

## Sprint 15 — Notification Nav/Badges, Referral+Points Coverage, Username Edit, Landing Guest-Link, One-Time Prod Reset (2026-10-08, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no removed APIs; all notification writes never-throw/void). QA full in-runner: tsc 0 errors, jest 22 suites / 198 tests pass, next build clean, lint 1 pre-existing warning / 0 new.

| Size | Task | Status |
|------|------|--------|
| [M] | Nav badges — MOBILE_TABS Bookmarks→Notifications; `NOTIFICATION_BADGE_CONFIG` + `BADGED_NAV_HREFS`; `useUnreadNotifications` (60s poll of cached endpoint, guest-safe, AbortController); badge on desktop sidebar + mobile tab (99+ cap, `role=status`) | [x] |
| [M] | Referral+points notification coverage — `NOTIFICATION_MESSAGES` templates; `notifyReferralConversion` (inviter: `@user signed up through your referral…`) wired in register + Google callback (new + first-time-OAuth); `notifyPointsAwarded` (REWARD points + BADGE tier-up `moved from X to Y…`) in rewards worker | [x] |
| [M] | Username edit — `userName` first in EDIT_PROFILE_FIELDS + `USERNAME_RULE`; PATCH allowlist + shape validation + uniqueness check (409, P2002 race guard, self-keep allowed); profile page initialValues + server-error toast (no false success on 409) | [x] |
| [S] | Landing guest-link — `GuestContinueLink` (same `isAuthenticated` gate as HeroCtas/BottomCta, null while loading/authed); replaces static always-on link in `page.tsx` | [x] |
| [S] | One-time prod reset — `scripts/reset-prod-db.ts` (TRUNCATE CASCADE all app tables, SiteConfig preserved, never fails build) + `db:reset-prod` + prepended to `vercel-build` — ✅ UNHOOKED 2026-10-08 (Sprint 16, clean-DB build confirmed; script retained manual-only) | [x] |
| [S] | Tests — `__tests__/sprint15/tightening.test.ts` (10: badge config/cap/format, message copy, username field+rule) | [x] |

---

## Sprint 16 — Vercel-Build Reset Removal + Early-Adopter "First N Users" Badge (2026-10-08, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no removed APIs; badge derives rank from existing `User.createdAt`, all badge writes are reads, admin validation rejects bad shapes with 400). QA to static-review level in this runner (no node_modules: tsc/jest/lint not runnable; new files parse clean — zero non-environment diagnostics; package.json valid; full gate to run where deps exist).

| Size | Task | Status |
|------|------|--------|
| [XS] | Vercel-build reset removal — drop `npm run db:reset-prod` from `vercel-build` (clean-DB build confirmed; `db:reset-prod` script + `scripts/reset-prod-db.ts` retained manual-only) | [x] |
| [M] | Early-adopter config — `app/lib/config/earlyAdopter.ts` (`EARLY_ADOPTER_CONFIG_KEY`, `DEFAULT_EARLY_ADOPTER_CONFIG` enabled/limit 100/`First {N} Users #{rank}` template, normalize/validate/label+tooltip builders, admin card meta, badge display meta) + barrel export + seed row | [x] |
| [M] | Early-adopter service — `earlyAdopterService.ts` (config via `getSiteConfig`, deterministic rank by `createdAt` asc + id tie-break, Redis-cached rank 600s, `getEarlyAdopterStatus`, `listEarlyAdopters` for filtering/rewards tooling) | [x] |
| [M] | Badge APIs — `GET /api/users/early-adopters` (config + earliest users), `GET /api/users/[id]/early-adopter` (per-user status, 404 unknown), `earlyAdopter` embedded best-effort in `/api/users/[id]` + `/by-username/[username]`, registry entries | [x] |
| [M] | Admin management — `/api/admin/config` validates `earlyAdopterConfig` (400 on bad shape) + invalidates `siteConfig` Redis on PUT/DELETE; Config page dedicated badge card (toggle + N + label template, dirty-gated save, server-error surfacing); `/api/admin/users?earlyAdopter=true` earliest-first filter with rank + label (rewards/audience tooling) | [x] |
| [S] | Profile badge UI — `EarlyAdopterBadge` + `EarlyAdopterBadgeFromStatus` (tooltip, null-safe) rendered next to the name on own + other profiles (wrap-safe) | [x] |
| [S] | Tests — `earlyAdopter.test.ts` (key/defaults, label/tooltip builders, normalize, validation) + `EarlyAdopterBadge.test.tsx` (label, a11y tooltip, qualified/disabled/unqualified/null) | [x] |

---

## Sprint 19 — Keyless Map Stack: OpenFreeMap + OSRM + Proxied Geocoding (execute-feature 2026-10-09)

> **Section summary:** PLAN + IMPLEMENTATION complete. Directive executed end-to-end, non-breaking (no migration, no removed APIs, no new deps). QA gate green with real runs: tsc 0 errors, jest 234/234 (27 suites, incl. 10 new mapStack suites), lint zero-new-errors (pre-existing `any` errors + RouteMap exhaustive-deps warning unchanged), build clean (84 static pages, `/api/maps/{route,geocode,reverse}` + `/api/routes/trace` delegate present). Keyless proof: pins render + polyline traces with ALL map keys unset (straight-line/OSRM path; keyed ORS/Mapbox skipped without env).

| Size | Task | Status |
|------|------|--------|
| [M] | MAP_STACK_CONFIG — `app/lib/config/mapStack.ts`: tile style URLs (primary OpenFreeMap liberty/bright/positron + dark mapping), raster fallback chain (Carto keyless → OSM → Esri), routing provider order (osrm → ors → mapbox → straight), geocode order (nominatim → photon), TTLs, attribution strings, dark-mode mapping; barrel export | [x] |
| [M] | Server proxy — `/api/maps/route`, `/api/maps/geocode`, `/api/maps/reverse` + `mapProxyService` (Redis read-through on traceSignature/query, per-IP rate limit, server User-Agent/Referer, keyed providers only when env present, straight-line final fallback, sanitized errors) | [x] |
| [M] | Renderer cutover — shared map-style builder; RouteMap.tsx + explore/page.tsx consume it (drop `mapbox://` branch + `cartoParam` apiKey logic, vector primary + raster fallback + onError provider step-down); remove `api.mapbox.com` preconnect hints if Mapbox fully optional | [x] |
| [S] | Geocode client cutover — RouteStepInput, ShareRouteModal, `geo.ts reverseGeocode` call internal `/api/maps/*` (keep debounce/abort); Nominatim URLs removed from client | [x] |
| [M] | routeTracingService chain reorder — OSRM-first via internal proxy shape (GeoJSON → polyline5), keep ORS/Mapbox as env-gated overrides, straight-line fallback preserved; `/api/routes/trace` delegates to mapProxyService | [x] |
| [S] | Env/config hygiene — `.env.example` marks CARTO/MAPBOX/MAPTILER/ORS keys optional-override; system-architecture config table updated; rateLimits `maps` bucket entry | [x] |
| [M] | Tests — mapStack config (fallback order, dark mapping, attribution), proxy cache/fallback unit, trace reorder (keyless-first, no-key no-call) | [x] |
| [S] | QA gate — tsc + jest + build + lint; verify pins render + polyline draws with ALL map keys unset (the keyless proof) | [x] |

---

## Sprint 20 — Map Pins, Draft Update-in-Place, FAQ Accuracy (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking (no migration, no removed APIs, no new deps). QA gate green with real runs: tsc 0 errors, jest 241/241 (28 suites, incl. 7 new mapTightening suites), lint zero issues on touched files, build clean.

| Size | Task | Status |
|------|------|--------|
| [M] | Anchor-stable pins — `MAP_PINS_CONFIG` (center anchor, zero offset) + shared `MapRoutePin`/`MapUserDot` (numbered 1-based dots, info-blue user dot with glory ring + radar ping, token classes only); RouteMap stale-closure + waypoint-numbering fix, stable marker keys; explore cutover (anchor + shared pins, click-a11y button) | [x] |
| [S] | Dark light-parity — `darkCanvasFilter: "none"`, dark raster mirrors light, renderers skip filter injection + drop explore dark-filter CSS | [x] |
| [M] | Drafts update-in-place — `routeDraftsService.updateDraft` (same id, savedAt refresh, move-to-top) + `ROUTE_DRAFTS_CONFIG` update labels/prompt + ShareRouteModal update-vs-new prompt bar + per-draft Update in RouteDraftsPanel | [x] |
| [S] | FAQ accuracy — report answer via in-post Report dialog (anonymity + admin triage), new Maps & Navigation category (tracings/pins + mobile zoom/move), edit/delete via post menu, share-route mentions drafts | [x] |
| [S] | Tests — `mapTightening.test.ts` (7: anchor/offset, labels, token-only visuals, dark parity, updateDraft, report + map FAQs) + mapStack dark-parity expectation updates | [x] |

---

## Sprint 21 — Safe Account Deletion + Email Studio + Admin/Profile Grids (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking additive (new Prisma model/enum/columns + idempotent migration, no removed APIs, no new deps). QA static-only in-runner (no node_modules — tsc/jest/build must confirm green in CI/Vercel, which runs `prisma generate` + `migrate deploy` first).

| Size | Task | Status |
|------|------|--------|
| [XL] | Safe deletion lifecycle — request (archive + schedule + user/admin email + in-app fan-out) → 7-day reversible grace → finalize (anonymize, wipe likes/bookmarks/follows/push, recompute counters, final email); `AccountDeletionRequest` + service + cron + admin queue | [x] |
| [L] | Generic deleted profile — by-username anon payload, banner + no-follow UI, posts visible incl. archived, likedBy/bookmarkedBy empty | [x] |
| [M] | Profile UX — sign-out button, quick-links 2-col mobile / 3-col larger grid, `AccountDeletionPanel` danger zone + pending banner | [x] |
| [M] | Admin users — `?deletion=` filter + badges, first-N-by-signup quick presets (`?order=oldest` + `selectIds`), bulk Delete (safe) via grace pipeline | [x] |
| [S] | Admin dashboard — KPI grid `grid-cols-2 lg:grid-cols-4`; AdminShell Deletions/Email nav | [x] |
| [XL] | Email Studio — visual/HTML builder, enable toggles (audited transitions), custom create/delete (system protected), preview, composer with dynamic recipients (admins/all/role/firstN/search/manual, capped), `sendTemplatedEmail` + `resolveEmailRecipients` | [x] |
| [S] | Tests — `accountDeletion.test.ts` (9: grace/retention, scheduling, anon identity, overdue, system templates, recipient modes, manual parse, bulk signup-order) | [x] |

---

## Sprint 22 — Email Studio Tightening + Auth-Email Wiring + Profile Tabs + Explore Share/Location + Env Centralization (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking additive (no migration — verify/change-email reuse otpStore; no new deps; no removed APIs). QA static+execution in-runner (no node_modules — tsc --noResolve zero attributable errors; node strip-types proved builder round-trips/sanitizer/env; jest 17 new + lint + build deferred to CI/Vercel).

| Size | Task | Status |
|------|------|--------|
| [M] | Env centralization — `lib/config/env.ts` (PROJECT_ENV-wins) + prisma.ts cutover + README table + .env.example docs + barrel exports | [x] |
| [M] | Sanitization all round — `lib/utils/emailSanitize.ts` (allowlist/escape/extract) + admin templates PUT + all send paths + recipient guard | [x] |
| [M] | Interpolation fix — missing vars → "" (never literal {{ident}}), HTML-escaped values, shared defaults incl. absolute logoUrl, preview readable samples | [x] |
| [M] | Shared wrapper + icons — composeEmailDocument/Text, EMAIL_DEFAULT_VARIABLES, EMAIL_ICONS SVG (welcome emojis replaced), 3 new system templates | [x] |
| [XL] | Studio rebuild — blocks editor + variable catalog/custom + in-place text + raw HTML + lossless switching + per-var composer + select-search recipients | [x] |
| [L] | Auth-email wiring — welcome on Google signup + unconditional on register; verify-email/change-email/change-password APIs + link/password notice | [x] |
| [M] | Profile — EmailSecurityPanel (gated) + account tab group + quick-links grid between tab sections | [x] |
| [M] | Explore — functional share (sheet→clipboard→fallback + toasts) + persistent watched user dot + locating states + sheet-tracking share position | [x] |
| [S] | README logo → public/logo.svg + Email Studio/env sections; tests `emailStudio.test.ts` (17) | [x] |

## Sprint 23 — Destination Fare/Vehicle Rule + Map-Pin Accuracy + Deploy Type Fix (execute-feature 2026-10-09)

| Size | Task | Done |
|------|------|------|
| [S] | `ROUTE_STEPS_CONFIG` — destination hides fare/vehicle + `isDestinationStep`/`showStepFare`/`showStepVehicle`/`normalizeRouteSteps` helpers + barrel exports | [x] |
| [M] | ShareRouteModal — hide fare/vehicle inputs on destination (hint instead), strip on create+edit submit, totals exclude destination | [x] |
| [M] | Post views — PostCard (fare badge + vehicle extraction), post detail, NavigationGuide (live + list) hide destination fare/vehicle (legacy rows covered) | [x] |
| [S] | API backstop — POST + PATCH `normalizeRouteSteps` so stored rows never imply a leg past the destination | [x] |
| [M] | RouteMap accuracy — `maplibre-gl.css` import, origin/destination snap to traced endpoints, stable mapLib promise, content-keyed memoized pins/coords/bounds (fit effect never fights pan/zoom) | [x] |
| [M] | User-location everywhere — shared `useUserLocation` hook (config tracking timeouts); explore uses it (Near-me override kept, controlled `onMove`, accuracy halo) + post-detail passive dot (live-nav fix wins) | [x] |
| [S] | Deploy type fix — EmailSecurityPanel dead `if` (`verified !== false` no-overlap) removed; emailStudio tsc blockers fixed (dotAll flag → `[\s\S]`, readonly NODE_ENV writes) | [x] |
| [S] | Latent test repairs — emailStudio suite loads in-runner (redis ESM stub mock), `sanitizeStoredBody` `#`-fragment tokens preserve `{{var}}` hrefs; 2 pre-existing prefer-const lint errors fixed | [x] |
| [S] | Tests — `routeSteps.test.ts` (5) + mapTightening snap/tracking (2); full gate in-runner: tsc clean, 32/32 suites 282/282 tests, 0 lint errors in touched files | [x] |

---

## Sprint 25 — PWA Tightening + Pidgin Depth + Platform Reviews Access (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking (no migration, no removed APIs/shapes; review storage reuses UserReview self-pair; notifications reuse REWARD+allowSelf; footer config gains optional i18nKey only). QA full in-runner: tsc 0 errors, jest 36/36 suites 309/309 tests, next build clean, lint 0 new (1 pre-existing warning in untouched import).

| Size | Task | Done |
|------|------|------|
| [M] | Config-registry caching — pwa.ts v4: `/locales/*.json` precached, `/api/config` + `/api/reviews` cacheable; sw.js mirror v4 + `/locales/` cache-first branch (stale-while-revalidate); I18nProvider bundled-EN fallback + localStorage last-good + `along-locale` cookie sync (middleware SSR/client agree, no raw keys offline) | [x] |
| [S] | Collapsible offline toast — OfflineBanner collapse/expand pill + full bar, persisted (`along-offline-banner-collapsed`), reset-per-episode, config copy + `pwa.collapse/expand/collapsedLabel` keys, i18n-aware via t() with config fallback | [x] |
| [M] | Pidgin depth — +74 keys (about/faq/feed/landing/leaderboard/invite/reviews/footer/empty/common), 235/235 en/pcm parity, interpolation preserved; FAQ_PCM per-item map (24 entries incl. 3 new Reviews FAQs) + Reviews FAQ category in faq.ts | [x] |
| [M] | Toggle that translates — `tf(key, fallback)` helper; wired PostCard aria-labels, PostMenu (config-fallback labels), AppFooter (optional i18nKey), LandingCtas + LandingCopy islands, About headings, FaqClient chrome+items, leaderboard/invite/feed-empty | [x] |
| [M] | Reviews API — `GET/POST /api/reviews` (self-pair platform marker, APPROVED public + own PENDING via mine=1, authorId scope, cursor pagination, edge cache, rateLimits `reviews` bucket, sanitized/offline-aware errors, ACID upsert) | [x] |
| [M] | Reviews UI — ReviewsPanel (star form, update-in-place, pending note, guest gate, FAQ blurb, community list); own profile `reviews` tab + `#reviews` deep link; other-profile read-only `reviews` tab (authorId scope) | [x] |
| [M] | About real reviews — SITE_REVIEWS retired from display; SW-cached fetch + skeletons + empty state; ReviewCtaPanel interleaved via `insertReviewCtaPanels` (≤10 end, 11–19 midpoint, ≥20 every 10); authed→/profile#reviews, guests→/register | [x] |
| [S] | Thank-you + archiving — `notifyReviewThanks` (REWARD+allowSelf, in-app + REVIEW push mirror, no email); finalize/request document reviews-preserved-anonymized; admin page null-safe (Deleted User, no dead profile links) | [x] |
| [S] | Tests — `reviews.test.ts` (8: CTA cadence incl. 11→5/14→7/25→10+21, empty CTA-only, anonymized names); pwa.test +4 (locales precache, config/reviews cacheable, banner copy, REVIEW mirror); locales REQUIRED_KEYS +32 | [x] |

---

## Sprint 26 — Email Studio Tightening: live preview, logo universality, parsing, save-styling, vars/fallbacks, origins (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking additive (no migration, no new deps, no removed APIs; GET preview shape unchanged). QA static-review in-runner (no node_modules — tsc/jest/build must confirm green in CI/Vercel).

| Size | Task | Done |
|------|------|------|
| [M] | Live unsaved preview — Studio debounced client render (canonical draft → wrap → samples + composer overrides) + Live/Saved badge + baseline dirty tracking; `POST /api/email/preview` draft endpoint | [x] |
| [M] | Logo universality — all 11 defaults head with logo img (`alt={{appName}}`) + shared wrapper/footer; legacy header SVG removed; image blocks email-safe + Studio thumbnails | [x] |
| [M] | Builder parsing — `htmlToBlocks` strips inline tags (no raw HTML in paragraphs), div/td wrappers, CTA/nested-list splits, dedupe; `\5`→`\4` backreference fix | [x] |
| [S] | Save styling — `ensureEmailDocument` fragment auto-wrap at render (preview + sends); PUT regenerates text twin from new html | [x] |
| [M] | Vars/fallbacks/origins — `{{name||fallback}}` in render/extract/sanitize; catalog 12→25; all link builders via `getAppUrl()` (google, forgot-password, verify/change-email, deletion, welcome, preview) | [x] |
| [S] | Tests — emailStudio +13 (fallbacks, wrap, parsing, image, logo universality) | [x] |

---

## Sprint 27 — Admin Verify Actions + Push-Prompt Handling + OTP Feedback (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking additive (no migration — cooldown/attempts reuse otpStore Redis+memory pattern; no new deps; no removed APIs — `subscribeToPush()` boolean kept as wrapper). QA static-level in-runner (no node_modules — tsc/jest/build must confirm green in CI/Vercel).

| Size | Task | Done |
|------|------|------|
| [M] | Auth-verification registry — `config/authVerification.ts` (TTL/cooldown/attempts/keys/copy/maskEmail) + barrel | [x] |
| [M] | otpStore cooldown + attempts helpers (additive, same timeout+memory discipline) | [x] |
| [M] | OTP/verify-email APIs — per-email cooldown 429s, honest sent/expiresIn payloads, attempt-cap revoke, PUT rate limit | [x] |
| [M] | OTP clients — `useOtpResend` hook, OTP screen rewrite (masked email, server timer, 429/delivery feedback), register cooldown forward, EmailSecurityPanel cooldown | [x] |
| [M] | Push prompt — `config/pushPrompt.ts`, `pushClient` env guards + permission-in-gesture + detailed reasons, PushManager local flags + per-outcome guidance, PushProvider granted-only auto-subscribe | [x] |
| [M] | Admin verify — PATCH `verify`/`unverify`/`resend-verification` (+user notifications, undo snapshots) + users page status column + row/bulk actions | [x] |
| [S] | Locales +15 en/pcm (250/250 parity) + `authVerificationPush.test.ts` (6) | [x] |

---

## Sprint 28 — Route Accuracy (preview = post view) + Live-Navigation Overlay + Admin Users Type Fix (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking additive (no migration — `waypoints` column already exists; no new deps; no removed APIs — NavigationGuide API unchanged). QA gate fully green in-runner with node_modules installed.

| Size | Task | Done |
|------|------|------|
| [BUG] | Admin users Vercel type error — `actorId: user.id` (`unknown`) → `user.id as string` (2 sites, same file) | [x] |
| [M] | Waypoints persistence — POST `/api/posts` accepts + stores `waypoints` (previously destructured away); PATCH already passed them through | [x] |
| [M] | Canonical pins — NEW `config/routePins.ts` (`buildRoutePinsFromPost` origin + intermediates + destination in step order, (0,0) filtered; `buildTraceInputFromPins`; `ROUTE_PINS_CONFIG`) + barrel; PostCard + post detail consume it | [x] |
| [M] | Post-detail live trace — NEW `useRouteTrace` hook (estimate + debounced `/api/routes/trace` + memory cache + silent fallback, same pipeline as composer preview); legacy rows backfilled by bounded geocode of missing stops | [x] |
| [M] | Live-navigation overlay — NEW `LiveNavigationModal` (near-fullscreen floating modal, map + guide hand-in-hand, mobile stack / desktop side panel via `LIVE_NAVIGATION_CONFIG`, Escape/backdrop/body-lock) wired into post detail; inline map no longer follows user | [x] |
| [S] | RouteMap `height` accepts CSS strings (`"100%"`) for flex parents; posts barrel exports modal | [x] |
| [S] | Tests — NEW `routePins.test.ts` (5: order, legacy fallback, (0,0) filter, trace input, config) | [x] |

---

## Sprint 29 — Tightening-Up: Auth Edge Case + Email Studio + Blog Admin + Audit Trail + Leaderboard (execute-feature 2026-10-09)

> **Section summary:** Directive close-out. One idempotent migration (`AuditLog` table); no new deps; no removed APIs. QA: no node_modules in runner — targeted re-reads + updated/new tests; full gate deferred to CI/Vercel build.

| Size | Task | Done |
|------|------|------|
| [M] | Auth unverified edge case — login allows unverified + `needsVerification` flag + deduped VERIFIED prompt notification (CTA → /profile?tab=security); login page routes there; notifications VERIFIED deep-link; profile unverified pill CTA + ?tab=security deep link | [x] |
| [M] | Email icons — SVG tags/attrs allowlisted (viewBox case preserved, numeric attrs) so icons render in preview + sent mail | [x] |
| [M] | Email recipients — unverified filtered by default + includeUnverified opt-in + admin note; per-recipient var resolution (`resolveVarsForRecipient`: platform/user/generated auto, manual only for gaps); composer var source badges | [x] |
| [S] | Email restore-to-default — PUT {restore} drops DB override (hardcoded never auto-overwrites) + UI button + audit log | [x] |
| [L] | Blog admin — SiteConfig-backed store merged over MDX seeds; /api/admin/blog CRUD + bulk status; /api/blog public feed; /admin/blog Studio (visual blocks); public pages merged + category filter + pagination; sanitized like email configs | [x] |
| [M] | Audit trail — AuditLog model + migration + never-throw service + /api/admin/audit + /admin/audit page + nav; hooks in users/email/blog mutations | [x] |
| [M] | Leaderboard — API page/limit/me + totalPages/total; own-rank card + Jump-to-my-rank + pagination; test updated (take 500, no points floor, me payload) | [x] |
| [S] | Tests — NEW `tightening.test.ts` (SVG sanitize, var sources, blog sanitize/status); leaderboard test updated | [x] |

---

## Sprint 30 — Profile Consistency + Audit Build Fix (execute-feature 2026-10-09)

> **Section summary:** Directive close-out, non-breaking additive (no migration, no new deps, no removed APIs). QA static-level in-runner (no node_modules — tsc/jest/build deferred to CI/Vercel).

| Size | Task | Done |
|------|------|------|
| [BUG] | Audit page Vercel type error — `unknown` metadata guard (`hasRenderableMetadata` + `formatMetadata`, never-throws) | [x] |
| [S] | `PROFILE_POSTS_CONFIG` registry — avatar/interaction fields, token pill classes, cache keys + barrel export | [x] |
| [M] | `GET /api/posts` viewer-scoped `_isLiked`/`_isBookmarked` enrichment (batch Like/Bookmark, never-throw) so profile tabs match feed | [x] |
| [M] | Profile pages (own + [username]) forward avatar/avatarConfig + interaction flags (header fallback, bookmarks `isBookmarked` alias) | [x] |
| [S] | PostCard `useEffect` SET_FROM_PROPS sync — fresh props update icons | [x] |
| [S] | ProfilePostCard `feedStream.applyInteraction` mirror + interaction-cache seed (feed↔profile parity) | [x] |
| [S] | EmailSecurityPanel Verified pill → `bg-success text-success-text border-success-border` tokens | [x] |
| [S] | Bookmarks API also returns `_isBookmarked` (canonical key; `isBookmarked` kept) | [x] |
| [S] | Tests — NEW `profilePosts.test.ts` (5: avatar fields, interaction fields, token pills, cache keys) | [x] |

---

## Sprint 31 — Universal post share + dynamic trust engine (2026-10-10)

> **Section summary:** Share works on every post surface; trust scores recompute on every community signal with a live breakdown.

| Size | Task | Status |
|------|------|--------|
| [M] | Shared share service + hook (`postShareService`, `usePostShare`, `POST_ACTIONS_CONFIG` share fields) | [x] |
| [M] | Wire share into feed, search, post detail (both bars), bookmarks; PostCard fallback; ProfilePostCard dedup | [x] |
| [L] | ValidityEngine v2 (reputation/engagement/report signals, canonical scorers, legacy parity) | [x] |
| [M] | Recompute triggers (like/bookmark/comment/edit/report/follow) + live breakdown on GET detail + TrustBadge live rows | [x] |
| [S] | Tests (postShareService 8, ValidityEngine +9, TrustBadge +2) | [x] |

---

## Backlog

> **Section summary:** Known work that needs to be done but hasn't been scheduled yet.

| Size | Task |
|------|------|
| [XL] | Transact Marketplace integration | [x] — frozen (code preserved, nav removed) |
| [XL] | Tega Events integration | [x] — frozen (code preserved, sidebar removed) |
| [M] | Follower/following system (wire follow button, list pages) | [x] |

---

## Completed

> **Section summary:** All finished work across all phases.

| Task | Completed |
|------|-----------|
| Phase 0: Ground Zero — deps, config registry, Prisma, universal components, services, SEO, repository layer | [x] |
| Phase 1: Auth & Identity — auth routes, pages, middleware, context, profile API routes, profile pages, AvatarEditor, RewardsPanel | [x] |
| Phase 2: Posts & Feed — post schemas, services, API routes, PostCard, ShareRouteModal, drafting coach, comments, feed, bookmarks, notifications | [x] |
| Phase 3: Maps & Discovery — RouteMap (MapLibre GL), route tracing, RouteStepInput, Explore page (full-viewport map, glass overlays, side panel, bottom sheet, pin popup, URL sync) | [x] |
| Phase 4: Rewards Engine — rewardsService, wire into like/bookmark/post/register, RewardsPanel enhancement | [x] |
| Phase 4: Invite System — /api/invite, invite page, leaderboard | [x] |
| Phase 4: Analytics — /api/analytics/user, analytics page with SVG charts | [x] |
| Phase 5: Admin — 6 admin API routes, admin layout with sidebar, dashboard, users, posts, config, bugs, reviews pages | [x] |
| Phase 6: Landing Page — green gradient hero, features, social proof, feed preview PostCards, CTA | [x] |
| Phase 6: About Page — hero, feature highlights, team grid, reviews carousel | [x] |
| Phase 6: Contact Page — ConfigDrivenForm, success state | [x] |
| Phase 6: Privacy & Terms — react-markdown with clean typography | [x] |
| Phase 6: Report Bug — ConfigDrivenForm BUG_REPORT_FIELDS | [x] |
| Phase 6: SEO — metadata utils, StructuredData helpers, sitemap, robots, per-page metadata, noIndex | [x] |
| Phase 6: Footer — AppFooter config-driven, wired into public + dashboard layouts | [x] |
| Phase 6: Middleware — fixed route protection for public/auth/protected routes | [x] |

---

## Notes

The entire `app/` directory has been generated from Phase 0-6. The architecture follows:
- `app/lib/config/` — 22 config files
- `app/lib/services/` — 9 services (modal, toast, undo, offline, feed, ValidityEngine, DraftingCoach, routeTracing, rewards)
- `app/lib/utils/` — metadata.ts, structuredData.ts, auth, cn, commentParser, cookies, security
- `app/lib/types/` — shared TypeScript interfaces
- `app/components/ui/` — 30+ universal components (3 fixed for label/icon prop types)
- `app/components/features/` — posts (PostCard, ShareRouteModal, DraftingCoach, RouteMap, RouteStepInput), comments (CommentInput, CommentList), profile (RewardsPanel, EditProfileModal, AvatarEditor)
- `app/api/` — 26 route files covering auth, posts, profiles, notifications, route tracing, rewards, invite, analytics, admin
- `app/admin/` — admin layout + AdminShell, dashboard, users, posts, config, bugs, reviews
- `app/(public)/` — landing, about, contact, privacy, terms, report-bug
- `app/(dashboard)/` — home, explore, profile, profile/[username], posts/[id], bookmarks, notifications, analytics, invite
- `app/(auth)/` — login, register, otp
- 65 static pages generated at build time (up from 49)
- 0 lint errors, 0 TypeScript errors
- All quality gates pass: npm run build + npx tsc --noEmit + npm test + npx next lint
