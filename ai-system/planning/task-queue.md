# Development Task Queue

> **Metadata**
> - last-updated-by: execute-feature 2026-10-16 (Sprint 65: post-card detail links + response-banner dismiss + vehicle contrast)
> - last-synced: 2026-10-16 (Sprint 65)
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

## Sprint 33 — Cloudinary orphan prevention on deletions (2026-10-10)

> **Section summary:** Post/draft/account deletions (and post edits) clean up their Cloudinary assets ACID-safely with zero orphan waste.

| Size | Task | Status |
|------|------|--------|
| [M] | `MEDIA_CLEANUP_CONFIG` registry (allowlist, per-flow toggles, account-retain policy, dry-run) + barrel + apiRegistry entries | [x] |
| [S] | `cloudinaryUrls` pure helpers (host check, public_id extract, allowlist filter, edit diff) | [x] |
| [M] | `mediaCleanupService` (post-commit best-effort destroy, never throws) + `POST /api/upload/cleanup` (draft-discard with live-post reference guard) | [x] |
| [M] | Wire delete paths: post DELETE + PATCH removed-diff, admin bulk DELETE, bug REMOVE_POST, account finalize legacy avatar, draft delete (publish skips) | [x] |
| [S] | Tests — NEW `mediaCleanup.test.ts` (5: config, host, extract, allowlist, diff) | [x] |

---

## Sprint 35 — Leaderboard cross-links + auth-link tightening (2026-10-11)

> **Section summary:** Every surface reaches the global leaderboard via one canonical config; connecting the second auth method persists and both account panels reflect the true connected state.

| Size | Task | Status |
|------|------|--------|
| [S] | `LEADERBOARD_LINKS_CONFIG` registry + barrel export (canonical route + footer/profile/invite entries) | [x] |
| [S] | Footer Leaderboard link (Features column) + 3 locale keys with en/pcm parity | [x] |
| [M] | `PROFILE_QUICK_LINKS_CONFIG` registry; own-profile quick links render from config (incl. Leaderboard, admin-gated) | [x] |
| [S] | Invite page "View full leaderboard" CTA (config href + i18n label) | [x] |
| [M] | `link/status` re-reads auth methods from DB (booleans only, hash never leaks); profile toasts link results once + cleans URL | [x] |
| [S] | `AUTH_LINK_STATUS_CONFIG` (+ resolver/copy) consumed by Connected Accounts + Email & Security (connected-methods line, per-state hints) | [x] |
| [S] | Tests — NEW `leaderboardAuthLink.test.ts` (5: footer/profile/invite links, state resolution, per-state copy) | [x] |

---

## Sprint 36 — Response-linkage persistence + composer false-validation fix (2026-10-11)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; all additions optional/additive with safe fallbacks). QA: no node_modules in runner — executed the shipped `validateRouteComposer` in node (dest-skip valid, non-dest range still flagged, dest location still required); full jest/tsc/build deferred to CI/Vercel.

| Size | Task | Status |
|------|------|--------|
| [M] | Response linkage through edit — `EditPost` carries `type/quotedPostId/quotedPost`, edit-of-response shows banner, PATCH still strips (linkage preserved server-side), callers forward | [x] |
| [S] | Draft-from-edit linkage — drafts panel + Save Draft available in edit mode, `buildDraftInput` falls back to edit target's linkage | [x] |
| [M] | False "highlighted fields" fix — `validateRouteComposer` skips hidden destination fare/vehicle (`destinationSkipsFare/Vehicle`), prefill/restore seed no destination `_fareRaw` | [x] |
| [S] | `GET /api/posts` includes `quotedPost` (profile tabs render Responding-to; P2022 fallback drops it) + `FeedPost` client type | [x] |
| [S] | Tests — `routeValidation.test.ts` +2 (destination skip, destination location still required), `routeDrafts.test.ts` +1 (response round-trip incl. update-in-place) | [x] |

---

## Sprint 38 — Profile post parity + corroboration tightening (2026-10-11)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; all additions optional/additive with safe fallbacks). QA: tsc zero errors + jest 443/446 (3 pre-existing failures verified identical at HEAD) + lint pre-existing-only; build deferred to Vercel.

| Size | Task | Status |
|------|------|--------|
| [S] | Profile parity — `PostItem` (own + `[username]`) forwards `validityBreakdown/quotedPostId/quotedPost/responsesCount`; tabs render Responding-to marker + live compact badge as in feed | [x] |
| [M] | Corroboration evidence blend — `CORROBORATION_CONFIG` + pure engine scorers (tag Jaccard, geo corridor, route content with destination exclusion, endorsement, coverage-scaled blend); service single + batched paths share one pool; create path reuses helper (no optimistic flash) | [x] |
| [S] | Clarity — `TRUST_BREAKDOWN_DESCRIPTIONS` registry rendered as tooltip help on every TrustBadge row | [x] |
| [S] | Other trust factors audited, unchanged (all real signals; dynamic legs additive/capped) | [x] |
| [S] | Tests — NEW `services/corroboration.test.ts` (8: normalization, tag, geo, destination-exclusion, pair, endorsement, blend/coverage/cap/clamp) | [x] |

---

## Sprint 39 — Comment tightening + feed modal parity + explore search expansion + test close-out (2026-10-11)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; all additions optional/additive with safe fallbacks). QA: tsc zero errors + jest 461/461 (54/54 suites, incl. 3 formerly pre-existing now fixed) + lint pre-existing-only + `npm run build` clean.

| Size | Task | Status |
|------|------|--------|
| [S] | Caret + avatars — explicit `COMMENTS_CONFIG.caretColor` (overlay trick kept); `AppAvatar` in composer/list/mentions/search rows; detail passes real `userName` | [x] |
| [M] | Shared `PostCommentsModal` — feed opens modal (count increments, no nav) instead of full-page reload; profile refactored onto it; search + detail wired; hook fallback soft-navigates | [x] |
| [M] | Explore search expansion — NEW `ExploreSearchInput` (unified suggestions: routes/requests + people + tags; recents; full-search footer) over untouched client filter; pick centres/opens pin | [x] |
| [S] | Failing tests — all 3 pre-existing fixed (prose-assertion reword + cache deep-equality + empty fast path); NEW `commentTightening` (10) + `exploreSearchExpansion` (6) suites | [x] |

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
- [x] Sprint 32 (2026-10-10) — trust breakdown consistency (canonical trustBreakdownService single+batched, trustDisplay compact/full config, TrustBadge variant + live-score tier, PostCard compact, all read APIs + worker on the same live object) (trustBreakdownConsistency 5 + TrustBadge +2 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 33 (2026-10-10) — Cloudinary orphan prevention on deletions (MEDIA_CLEANUP_CONFIG + cloudinaryUrls + mediaCleanupService + upload/cleanup, all delete paths wired ACID-safely) (mediaCleanup 5 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 35 (2026-10-11) — Leaderboard cross-links + auth-link tightening (LEADERBOARD_LINKS_CONFIG + PROFILE_QUICK_LINKS_CONFIG + AUTH_LINK_STATUS_CONFIG, link/status DB re-read, profile link-result toasts, invite CTA) (leaderboardAuthLink 5 suites; full gate deferred to CI — no node_modules in runner)
- [x] Sprint 39 (2026-10-11) — Comment tightening + feed modal parity + explore search expansion + failing-test close-out (COMMENTS_CONFIG + EXPLORE_SEARCH_CONFIG + PostCommentsModal + ExploreSearchInput; AppAvatar in comments; 3 pre-existing red suites fixed) (commentTightening 10 + exploreSearchExpansion 6 suites; full gate green in-runner: tsc 0, jest 461/461, build clean)
- [x] Sprint 40 (2026-10-11) — Trust detail-42 fix (DETAIL_SCORING_CONFIG + computePostDetailScore/detailContextFromPost; service single+batched + create + worker reuse) + error-boundary bug-report CTA (prefill builder + URL, toast action-slot CTA + inline link, report-bug query prefill, EMPTY_STATES.error honest copy) + search discoverability (NAV_REGISTRY + sidebar user-row icon + footer + profile quick-links + footer.search en/pcm) (detailScoring 8 + errorReportPrefill 6 + searchLinks 3 suites; full gate green in-runner: tsc 0, jest 478/478, lint clean)
- [x] Sprint 42 (2026-10-11) — Dislike parity + comment-avatar consistency (`_isDisliked` viewer flag E2E on detail/list/feed paths + feedStream mutual-exclusion cache; PostCard seed/sync + config-driven dislike fill; post-detail handleDislike + counts + rollback; feed toggle-payload corrections; avatarConfig on auth user + all comment viewers) (dislikeSync 15 + profilePosts +1 suites; tsc zero new-errors + 30/30 assertions grep-verified in-runner, jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 46 (2026-10-12) — Push firing + global PWA install/push notices (VAPID fallback parity, FOLLOW fan-out mirror, registrar dev-guard, PWA_INSTALL_CONFIG + InstallPrompt + PushManager floating + PwaNotices hub + appleWebApp meta, FAQ copy+pcm, pwa.test +3; node --check/JSON/balance green in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 45 (2026-10-12) — Chart hover tooltips platform-wide + admin analytics page/API + sidebar scrollability + platform-consistent admin avatar (charts + ChartTooltip + AdminAnalyticsShell suites; node strip-types 6/6 in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 43 (2026-10-11) — Admin destructive user deletion (grace request kept + per-request Reverse/Delete-now in deletions queue + per-user Request/Reverse/Delete-now in users table, same anonymize pipeline, confirm + undo where reversible, irreversibility warning + backup-recovery note where not, all audited) + dashboard period toggle (7/30/90 wired end-to-end to KPIs + signups chart) (admin +3 suites; node strip-types 9/9 in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 47 (2026-10-12) — PWA notice icon/theme compliance + deleted/archived-user visibility + avatar consistency (PWA_FAQ_LINKS + userVisibility registry + FaqClient ?q=/#hash deep-links; InstallPrompt/PushManager/OfflineBanner lucide icons + --color-* token styling + FAQ help links; NavigationGuide Check icon + token step pills; suggestions/search/follow/followers/following/users search visibility filters + follow 410 + live counts; SuggestionsPanel/Rail + UserList AppAvatar + client filters + FollowButton unavailable state; admin stats/users/analytics avatar+avatarConfig+verified selects + AppAvatar/AppUserLabel pages; sprint47 9 suites; tsc --strict zero-dep + node execution green in-runner, full gate deferred to CI — no node_modules in runner)
| [S] | Desktop open-requests scrollable endless tape (SuggestionsPanel 1 static / 2+ EndlessCarousel via SUGGESTIONS_PANEL_CONFIG, count+hint) | [x] |
- [x] Sprint 48 (2026-10-12) — Profile tightening: dead phone field, name whitespace, AvatarSize 20 (profileValidation registry + ConfigDrivenForm trim + PATCH/register normalization + AppAvatar 20; profileTightening 14 suites; full local gate green: tsc 0, jest 66/559, lint 0 new)
- [x] Sprint 49 (2026-10-12) — Installed-PWA update lifecycle (PWA_UPDATE_CONFIG + PWA_SW_MESSAGES + v4→v5 cache rollover; sw.js no-auto-skipWaiting + ready/activated/version broadcasts; registrar hourly/visible/focus/online polling + updatefound + guarded single-reload; ServiceWorkerUpdatePrompt in PwaNotices hub + pwa.update* en/pcm + FAQ app-updates +pcm; pwa.test +2, locales.test +4 keys; node --check/JSON/parity green in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 50 (2026-10-13) — Reports + pagination + geo + floating + README tightening (REPORT_ATTACHMENTS_CONFIG + upload folder= policies + along/reports cleanup source + ReportImageUpload + ReportDialog/report-bug wiring + /api/reports + /api/bug-reports metadata.images + admin shot thumbnails; PAGINATION_UI_CONFIG + ViewMoreButton + PageNavigator + notifications/search/comments/reviews view-more + leaderboard/blog navigators; openmeteo merge/dedupe/near-rank + ?lat=&lng= + geoBias granted-only helper + RouteStepInput/ShareRouteModal bias + searchService routes-JSON stop recall; FLOATING_UI_CONFIG lanes + left-dock rounds + above-navbar banners + transient lane; README service attributions) (sprint50 10 suites; node --check + strip-types pure-logic green in-runner, tsc/jest/build deferred to CI — no node_modules in runner)
- [x] Sprint 51 (2026-10-13) — Notification deep-routing + bug-report ACID + admin pagination/sort + validity top correctness + bug email lifecycle (resolver + highlight/scroll + push parity; Json fix + dedup/idempotency + atomic assign; bugReportReceived/StatusUpdate templates + PATCH fan-out; sort meta + cursor hook + 4 APIs/pages; screenshot viewer; top-posts filter/order) (structural review in-runner, full gate deferred to CI — no node_modules in runner)
- [x] Session 2026-10-13 — Right-dock rounds + upload-before-submit + landmark geocode (FLOATING_UI_CONFIG.mobileDockSide right; ConfigDrivenForm.beforeSubmit + report-bug wiring; overpass provider + LANDMARK_GEOCODE_CONFIG + photon street labels + nominatim addressdetails/dedupe) (sessionTightening 7 suites; strip-types --check green in-runner, full gate deferred to CI — no node_modules in runner)
- [x] Session 2026-10-13 — Location suggestions + Email Studio availability (rateLimit per-bucket isolation; geoBias peek/quick + 429/offline-safe clients; RequestRouteModal From/To autocomplete; Studio defaults-merge with raw-based writes; mergeEmailTemplatesWithDefaults shared helper) (locationSuggestions 7 suites; structural review in-runner, full gate deferred to CI — no node_modules in runner)
---
- [x] Session 2026-10-13 — Broad location suggestions (LOCATION_SUGGESTIONS_CONFIG + parse/reorder/URL helpers; parallel fast fan-out + coordinate fast-path + empty-only overpass/reorder batch + upstream bias params + short empty TTL; route + 3 clients on shared min2/debounce/limit) (locationSuggestBroad 13 suites; node pure-logic green in-runner, full gate deferred to CI — no node_modules in runner)

- [x] Session 2026-10-13 — Blog share + dynamic SEO + defaults rollback + variables + bug action modal (BLOG_SHARE_CONFIG + blogShareService + BlogShareButtons on detail; buildMetadata ogType/publishedTime/authorName + resolveOgImage per-post; DEFAULT_BLOG_POSTS + mergeBlogPostsWithDefaults + GET defaults + PUT restoreSlug + Studio rollback panel; BLOG_VARIABLE_CATALOG + blogVariables guest fallbacks + BlogVariableInsert; BUG_REPORT_ACTION_MODAL + PATCH statusNote override + admin action modal with screenshots) (blogShareVariables suites; structural review in-runner, full gate deferred to CI — no node_modules in runner)

## Sprint 52 — Audit Trail (Reports + Blogs) + Enriched Defaults + Featured Carousel + Studio Parsing (2026-10-13, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; stored-wins merges keep existing admin edits; audit writes fire-and-forget). QA in-runner: node strip-types executed 20+ assertions green (featured pick/href, audit labels, defaults count/emdash/vars, builder round-trips incl. pre-existing emailStudio contract cases); full tsc/jest/build deferred to CI — no node_modules in runner.

| Size | Task | Done |
|------|------|------|
| [S] | Audit config — `report` entity + report.create/moderate/status + blog.upsert/delete/restore-default/bulk action labels (specific prefixes ordered before generic) | [x] |
| [M] | Audit hooks — `POST /api/reports` + `POST /api/bug-reports` log report.create; admin bugs PATCH logs report.status (triage) + report.moderate (DISMISS/ARCHIVE_POST/REMOVE_POST); blog hooks pre-existing verified | [x] |
| [M] | Defaults enriched 2 → 6 posts (tips/updates/community/routes; STE100 short sentences; emdash-free; every `{{var}}` carries `\|\|fallback`) | [x] |
| [M] | Studio parsing hardened — bare inter-tag text, section/article/figure/h4-h6/br containers, block-child recursion, empty-link-remnant drop; plain-text paragraph contract kept (existing suites green) | [x] |
| [L] | Featured blogs — `FEATURED_BLOGS_CONFIG` + `pickFeaturedBlogs`/`featuredBlogHref` + `FeaturedBlogsSection` (EndlessCarousel reuse, per-card Read CTA + View-all CTA, tf() fallbacks, no new locale keys); landing (server-fed) + about (after reviews) + invite (after leaderboard) | [x] |
| [S] | Tests — NEW `featuredBlogs.test.ts` (config/CTA/emdash, pick/cap/href, defaults coverage/vars, audit labels, parsing no-loss) | [x] |

## Session 2026-10-13 — Blog carousel overflow + featured flag + Studio templates (execute-feature)

> **Section summary:** Directive close-out, non-breaking (additive optional `featured`, no migration/deps/API removals; tape falls back to newest-first; templates prefill-only). QA in-runner: real-module strip-types green (featured-first order, legacy fallback, hrefs); balance identical to HEAD on 13 files; full tsc/jest/build deferred to CI — no node_modules in runner.

| Size | Task | Done |
|------|------|------|
| [S] | Carousel overflow — about flex-column guards + viewport width constraint + FeaturedBlogsSection/invite/landing caps (page no longer scrolls horizontally) | [x] |
| [M] | Admin featured flag — type + store + `/api/blog` field + upsert/metadata + `preferFeatured` ordering + /blog hero preference + Studio checkbox/star + tape pill | [x] |
| [S] | Studio templates — shipped defaults openable/editable without DB save (prefill incl. blocks, save creates row; empty-DB empty-editor fixed) | [x] |
| [S] | Tests — extended `featuredBlogs.test.ts` (featured-first ordering, missing-field fallback) | [x] |

## Session 2026-10-13 — Blog design compliance + reading-time studio input (execute-feature)

> **Section summary:** Directive close-out, non-breaking (config additions only; no migration/deps/API removals; stored-wins + word-count fallback preserved). QA in-runner: node logic green (normalize/estimate), zero `prose-p:text-text-secondary` left in app code, shared-class consumption + Studio wiring grep-verified; full tsc/jest/build deferred to CI — no node_modules in runner.

| Size | Task | Done |
|------|------|------|
| [S] | Design compliance — `BLOG_CONTENT_PROSE_CLASSES` single source (body/li/strong/headings = text-primary); public `[slug]` page + Studio preview consume it; terms/privacy same-pattern sweep (p/li → primary) | [x] |
| [S] | Reading-time studio input — bounds/meta/normalize/estimate in `blogManagement`; Studio number input wired through load/new/template/save (PUT sends readingTime); `blogStore` delegates clamp/estimate to helpers | [x] |
| [S] | Tests — NEW `blogCompliance.test.ts` (prose tokens, bounds/meta, normalize clamp/reject, estimate fallback) | [x] |

## Session 2026-10-13 — Universal post cards + avatar menu + reviews tape (execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration/deps/API removals; additive enrichment + components; stored shapes superset). QA in-runner: no node_modules — tsc shows only missing-module noise (pre-existing, all files); targeted re-reads + grep checks (no PostCard direct use outside feed/detail, menu on every card, locale keys present); full tsc/jest/build deferred to CI.

| Size | Task | Done |
|------|------|------|
| [M] | Universal card everywhere — bookmarks page rewritten on ProfilePostCard (menu + like/dislike/bookmark/share/comment all fire); search results switched PostCard → ProfilePostCard; feed/detail untouched | [x] |
| [S] | Interaction parity — /api/bookmarks += _isLiked/_isDisliked + bookmarkedAt; searchService += viewerId enrichment (fresh + cached rows, guests false); /api/search threads viewer; profile liked-tab filter + isBookmarked alias + liked-row attribution fixed | [x] |
| [M] | Profile edit in place — ProfilePostCard += onEdit → ShareRouteModal/RequestRouteModal edit mode (nature preserved), PATCH + feedStream.updatePost + local override + toast | [x] |
| [S] | Tab search boxes — bookmarks page + own/other profile tabs get client filter (title/desc/tags/author) with no-match empty state | [x] |
| [M] | Avatar menu — NEW AvatarMenu + AvatarCameraBadge + AVATAR_MENU_CONFIG; camera badge + full-avatar click open menu (desktop + mobile); EditProfileModal += avatar row trigger (submit flow untouched) | [x] |
| [M] | Reviews tape — NEW ReviewsCarouselSection (EndlessCarousel reuse, CTA cadence, null when empty); landing (below blogs) + invite (below blogs, compact); footer += Leave a Review → /profile#reviews; en/pcm locale keys | [x] |
| [S] | FAQs — NEW post-menu-options + avatar-management + avatar-not-showing (+pcm); where-reviews-appear updated (landing/invite); new Profile & Avatar category | [x] |

## Session 2026-10-13 — QA hardening: 5 failing suites resolved (execute-feature)

> **Section summary:** Directive close-out ("assure quality by resolving the failing suites/tests"). Non-breaking (2 minimal code-alignment fixes, 3 test-only env/expectation fixes; no migration, no new deps, no removed APIs). QA gate fully green with node_modules installed: `npx tsc --noEmit` 0 errors, `npx jest` 74/74 suites 630/630 tests (up from 612/615 — the 2 unloadable suites now contribute their tests), `next lint` clean on touched files.

| Size | Task | Done |
|------|------|------|
| [S] | `buildGeocodeUrl` limit clamp — invalid/zero/NaN → configured default, oversized → 10 (was folded to 1) | [x] |
| [S] | `resolveNotificationRoute` REVIEW → `/about` (doc comment + push mirror already said so; push/in-app agree) | [x] |
| [S] | dislikeSync search assertion — stale inline `avatarConfig:` expectation updated for the universal-card refactor (SearchPage renders ProfilePostCard, which forwards the viewer avatarConfig internally) | [x] |
| [S] | locationSuggestions suite — `@jest-environment node` (jsdom has no `Request` for the `next/server` chain) | [x] |
| [S] | blogShareVariables suite — hoisted redis no-op stub (uncrypto ESM; same pattern as emailStudio) | [x] |

## Session 2026-10-13 — Boat vehicle option (execute-feature)

> **Section summary:** Directive close-out ("water vessels" transport mode end to end, boat + boat icon). Non-breaking additive (union member + registry entry only; no migration — vehicle stored as free string in routes JSON and `z.string().max(30)` already accepts it; no new deps; no removed APIs). Surfaces derive from VEHICLE_REGISTRY dynamically, so composer chips, PostCard, NavigationGuide, and post detail pick up boat with zero per-surface changes. QA in-runner: no node_modules — routeValidation smoke executed via node strip-types (boat valid, spaceship rejected, PASS) + 11-point static parity grep all PASS; full tsc/jest/build deferred to CI/Vercel.

| Size | Task | Done |
|------|------|------|
| [S] | `VehicleType` += `"boat"`; `VEHICLE_REGISTRY.boat` (label Boat, Lucide `Ship`, cyan `#0E7490` / `bg-cyan-50` / `text-cyan-800`, token dark classes) | [x] |
| [S] | `routeValidation` KNOWN_VEHICLES += `"boat"` (zero-dep mirror kept in sync) | [x] |
| [S] | Landing `VEHICLE_CHIPS` += `BOAT` (`#ECFEFF`/`#155E75`); explore += `Boat` filter chip + `activeVehicleFilters` allowlist entry (chip rendered but never filtered without it) | [x] |
| [S] | `VehicleChip` null-guard for unknown/legacy strings (renders nothing instead of crashing on `config.icon`) | [x] |
| [S] | DESIGN.md — Boat vehicle-color row + `Ship` icon-map row | [x] |
| [S] | Tests — NEW `app/__tests__/config/vehicles.test.ts` (8 keys, boat label/icon/color/classes, per-entry UI-safety, boat accepted / spaceship rejected) | [x] |

## Session 2026-10-13 — Blog article-body deep compliance (execute-feature)

> **Section summary:** Directive close-out ("text in blogs + Blog Studio preview not design-system compliant — deeper than classes"). Non-breaking (2 additive exports + render-path swaps only; no migration/deps/API removals; Email Studio untouched; stored-wins + restore-default contracts preserved). QA in-runner: real-module strip-types green (23 checks: semantic renderer, style-strip, escaping, pipeline no-leak, email path unchanged, round-trip re-render stable); wiring grep-verified; full tsc/jest/build deferred to CI — no node_modules in runner.

| Size | Task | Done |
|------|------|------|
| [S] | Article renderer — NEW `blocksToBlogHtml` (semantic h1/p/ul/li/a/img/hr, no color/font-size inline styles, escaped text, {{vars}} verbatim; button CTAs degrade to prose links) | [x] |
| [S] | Article sanitizer — NEW `sanitizeBlogHtml` (allowlist + strips all `style=` incl. unquoted; scripts/handlers gone; {{vars}} survive) | [x] |
| [S] | Store — `blogStore.sanitizePost` content via `sanitizeBlogHtml` (cleans on write + defensive re-sanitize on read; legacy email-styled rows heal) | [x] |
| [S] | Public `[slug]` page — defensive `sanitizeBlogHtml` at render before interpolation (covers legacy rows; terms/privacy pattern) | [x] |
| [S] | Studio — save sends `blocksToBlogHtml`; live preview mirrors public render exactly (article HTML + style-strip + interpolation, no raw tokens) | [x] |
| [S] | Tests — extended `blogCompliance.test.ts` (renderer semantics/no-styles, escaping, sanitizer strip/keep, pipeline no-leak) | [x] |

## Session 2026-10-13 — Train vehicle option (execute-feature)

> **Section summary:** Directive close-out ("vehicle option for trains, train icon in the UI, end to end"). Non-breaking additive mirroring the boat session (union member + registry entry only; no migration — vehicle stored as free string in routes JSON; no new deps; no removed APIs). Surfaces derive from VEHICLE_REGISTRY dynamically, so composer chips, PostCard, NavigationGuide, and post detail pick up train with zero per-surface changes. QA in-runner: no node_modules — 10-point static parity grep all PASS; full tsc/jest/build deferred to CI/Vercel.

| Size | Task | Done |
|------|------|------|
| [S] | `VehicleType` += `"train"`; `VEHICLE_REGISTRY.train` (label Train, Lucide `Train` — already imported in `mapIntegrations.ts`, proven present in installed lucide-react — violet `#6D28D9` / `bg-violet-50` / `text-violet-800`, token dark classes; distinct from bus blue / car indigo / boat cyan) | [x] |
| [S] | `routeValidation` KNOWN_VEHICLES += `"train"` (zero-dep mirror kept in sync) | [x] |
| [S] | Landing `VEHICLE_CHIPS` += `TRAIN` (`#EDE9FE`/`#5B21B6`); explore += `Train` filter chip + `activeVehicleFilters` allowlist entry (chip rendered but never filtered without it) | [x] |
| [S] | DESIGN.md — Train vehicle-color row + `Train` icon-map row | [x] |
| [S] | Tests — extended `app/__tests__/config/vehicles.test.ts` (9 keys, train label/icon/color/classes, train accepted alongside boat, spaceship still rejected) | [x] |

## Session 2026-10-14 — Avatar consistency + profile avg + feed prompt (execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; all additions additive with safe fallbacks). QA in-runner: no node_modules — tsc shows only missing-module noise; real-module strip-types green for avatar/feedAlgorithm (sizes, asAvatarConfig, prompt 45s/labels); full tsc/jest/build deferred to CI/Vercel.

| Size | Task | Done |
|------|------|------|
| [M] | Avatar consistency — `AVATAR_DISPLAY_CONFIG` + `asAvatarConfig`; `/api/leaderboard` + `/api/invite?section=leaderboard` select `avatarConfig`; notifications/leaderboard/invite rows render shared `AppAvatar` | [x] |
| [M] | Other-profile avg — `by-username` returns `avgValidityScore` aggregate (best-effort); client prefers server value (fallback 0, never rewardPoints/postCount total); stats bar Fragment+divider parity with own profile | [x] |
| [M] | Feed optimistic + pill — `feedStream.prependPost` (dedupe/top/persist); `submitPost` pins created row + scrolls top; `FEED_NEW_POSTS_PROMPT_CONFIG` (45s auto-dismiss, 45s throttle, thresholds, label); pill click clears+scrolls+refreshes; auto-dismiss timer | [x] |
| [S] | Tests — NEW `feedTightening.test.ts` (avatar sizes/forward/narrow, avg source-of-truth/fallback, prompt band/label, dedupe invariant) | [x] |

## Sprint 54 — Blog Studio Image Uploads + Faithful Preview (2026-10-14, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs). QA full in-runner: tsc 0 errors, jest 77/77 suites 656/656 tests, lint clean on touched files, `npm run build` clean.

| Size | Task | Done |
|------|------|------|
| [M] | `BLOG_IMAGE_CONFIG` registry (along/blog, 5MB, ≤10 inline, types, copy, barrel export) + pure `blogImages.ts` (resolve/extract/collect/diff, never-throw) | [x] |
| [M] | `/api/upload` blog policy (admin-gated) + cleanup blog sources + SiteConfig reference guard + allowlist | [x] |
| [M] | Reusable `BlogImageUpload` (cover/inline, eager upload, swap-now/purge-after-save) + shared `BlogPostArticle` (public + preview parity) | [x] |
| [M] | Studio: cover/inline uploads, alt text, cap, baseline/pending tracking, save/delete purges, `BlogPostArticle` live preview | [x] |
| [S] | Public pages: covers on detail/list/featured/tape; `sanitizeBlogPost` cover resolution; admin DELETE background purge | [x] |
| [S] | Tests — NEW `blogImages.test.ts` (7: config, allowlist, resolve, custom, extract, collect, diff) | [x] |

## Sprint 55 — Trust Tooltip Portal + Admin Collapse + Scrollbars + Feed Diversity + Loose Search (2026-10-14, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same component props + API envelopes). QA full in-runner: tsc 0 errors, jest 78/78 suites 679/679 tests, next lint clean on touched files, `next build` clean.

| Size | Task | Done |
|------|------|------|
| [M] | Trust tooltip portal — `TRUST_DISPLAY_CONFIG` tooltip knobs (width/margin/maxHeight/hoverCloseDelayMs); `TrustBadge` renders via `createPortal` on document.body (escapes PostCard hover-lift transform that re-anchored `fixed` off-screen on desktop), edge-aware anchoring (right-third right-aligns), flip + height cap + internal scroll, hover-bridge close delay, outside-pointerdown + Escape dismiss | [x] |
| [S] | Admin collapse — `NavLink` conditional rail spacing (`mx-2 px-2` collapsed vs `mx-3 px-4`), shrink-0 icon wrapper + collapsed aria-label (72px rail no longer clips icons); links region uses `scroll-thin` | [x] |
| [S] | Scrollbars — token-driven global styles in `globals.css` (auto dark-mode via `.dark` overrides) + `.scroll-thin` / `.scroll-stable` utilities + `SCROLLBAR_CONFIG` registry (barrel-exported) | [x] |
| [M] | Feed diversity — `FEED_DIVERSITY_CONFIG` + pure `applyFeedDiversity` (jitter near-ties + lookahead anti-cluster swap, never drops rows, injectable rand) wired post-sort/pre-slice in `feedService` with SiteConfig `feedDiversity` shallow-merge (validated, never-throw) | [x] |
| [L] | Loose search — `SEARCH_CONFIG` (stopwords/minTerm/typo-prefix/candidateCap/fuzzy/rankWeights) + pure `tokenizeSearchQuery`/`levenshteinDistance`/`termCoverage`/`scoreTextRelevance`; `searchService` two-phase recall (exact phrase+terms, then head-prefix typo top-up, token-combined stop-name prefetch) + deterministic in-memory relevance rank + index-based cursor (unknown cursor ends list); tokenized user recall + rank; same `SearchResult` envelope | [x] |
| [S] | Tests — NEW `feedSearchTightening.test.ts` (19: diversity defaults/separation/degradation/jitter/never-throw, tokenize/stopwords/phrase-fallback/prefix/levenshtein/coverage/ranking/reversed/typo, scrollbar + tooltip registries); `searchService.test.ts` updated to ranked semantics (honest-DB notIn mock, cursor continuation, order-free + typo cases); `api/search.test.ts` notIn-aware mock | [x] |

## Sprint 56 — Studio tightening: Blog reorder + CTA buttons + generous sticky previews + feedDiversity card + zero-result analytics (2026-10-14, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same component props + API envelopes, additive fields only). QA full in-runner: tsc 0 errors, jest 79/79 suites 684/684 tests, next lint clean on touched files (one pre-existing error in accountDeletionService untouched), `npm run build` clean.

| Size | Task | Done |
|------|------|------|
| [S] | Studio layout registry — NEW `STUDIO_LAYOUT_CONFIG` (`studioLayout.ts`, barrel-exported): generous viewport-capped preview heights (78vh, capped 860/880/900px, 360px min), sticky wrappers (`lg:sticky top-4 self-start` + `items-start` grids), avatar grid height + sticky preview; `studioPreviewStyle`/`avatarGridStyle` builders (never-throw) | [x] |
| [M] | Blog Studio parity — `moveBlock` + Grip/ChevronUp/ChevronDown UI (mirrors Email Studio, same guards/aria-labels); preview section sticky + generous height via studio config | [x] |
| [M] | Blog CTA buttons — `blocksToBlogHtml` button blocks render centered CTA (`blog-cta-wrap`/`blog-cta`, token-styled via globals.css, no inline styles, dark-mode safe); `link` blocks stay prose inline links; `emailSanitize` class allowlist (`BLOG_CTA_CLASS_ALLOWLIST`, exact-token only) + `class` on div/a/p/span; `htmlToBlocks` detects `blog-cta` class back to button blocks; `blogCompliance.test.ts` updated to CTA contract | [x] |
| [S] | Preview/avatar scrollability — Email right column sticky + generous height; Blog preview sticky + generous height; AvatarEditor style grid viewport height + sticky preview column on desktop | [x] |
| [M] | feedDiversity Studio card — `FEED_DIVERSITY_CONFIG_KEY`/`_META` + `normalizeFeedDiversityConfig`/`validateFeedDiversityConfigValue` (shared by resolver + card); `feedService.resolveFeedDiversity` delegates to normalizer (same behaviour); `/api/admin/config` PUT validates `feedDiversity` (400 on bad shape); `SITE_CONFIG_EDITORS` entry; admin Config page card (3 numeric inputs from META, dirty-gated save, reset-to-defaults, server-error surfacing) | [x] |
| [M] | Zero-result query analytics — `SEARCH_ANALYTICS_CONFIG` (event name, caps, top-N, copy) + `normalizeAnalyticsQuery`/`buildZeroResultPayload` pure helpers; `searchService` fire-and-forget `AnalyticsEvent` log on empty first-page results (never breaks search; cached-empty fast path not double-counted); `/api/admin/analytics` aggregates top zero-result queries (additive `zeroResultQueries` field); analytics page section card with terms + counts + tuning hint | [x] |
| [S] | Tests — NEW `studioTightening.test.ts` (4: layout generosity/sticky, diversity normalize/validate, analytics helpers, CTA round-trip); `blogCompliance.test.ts` CTA assertions + class-allowlist suite | [x] |

## Sprint 57 — Media cross-post guard + share platform icons + feed first-load (2026-10-14, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same props + API envelopes, additive fields only). QA full in-runner: tsc 0 errors, jest 81/81 suites 697/697 tests, next lint clean on touched files, `npm run build` clean.

| Size | Task | Done |
|------|------|------|
| [BUG] | Media cross-post guard — `MEDIA_CLEANUP_CONFIG.guardLivePostReferences` (env `MEDIA_CLEANUP_GUARD_REFS`, default true); `filterUnreferencedUrls` in `mediaCleanupService` (injectable deps, fail-OPEN, never throws) re-checks live `Post.images` + managed-blog refs just before destroy (closes TOCTOU for edit/delete/admin-bulk/moderation paths); `upload/cleanup` delegates to the shared helper (response shape unchanged); `+skippedReferenced` in result | [x] |
| [S] | Share platform icons — `BLOG_SHARE_CONFIG.networks` gain serializable `icon` keys (`BlogShareNetworkIcon`); NEW `ShareNetworkIcon` (lucide `Facebook`, inline X/WhatsApp brand SVGs, `Link2` fallback); `BlogShareButtons` desktop row renders per-platform glyphs | [x] |
| [M] | Feed first-load — `FEED_FIRST_LOAD_CONFIG` (geoWaitMs 1500, skeletonCount 3) + pure `seededRand`/`hashSeedString`; `feedService` diversity jitter seeded per viewer + UTC day (cached/fresh/geo orders agree); home page `isReady` gate (single geo-aware fetch, pre-ready stream emissions held, skeleton until settled, geo double-fetch removed) | [x] |
| [S] | Tests — `mediaCleanup.test.ts` +4 (guard default, shared-URL kept, DB-hiccup fail-open, blog-ref kept); NEW `tighteningMediaShareFeed.test.ts` (9) + `ShareNetworkIcon.test.tsx` (2) | [x] |

## Sprint 58 — Push-banner opacity + keyless traffic overlay (2026-10-14, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same props + API envelopes, additive optional fields only). QA full in-runner: tsc 0 errors, jest 82/82 suites 709/709 tests, next lint clean on touched files (4 pre-existing RouteMap rules-of-hooks errors fixed by reorder), `npm run build` clean with `/api/maps/traffic` route.

| Size | Task | Done |
|------|------|------|
| [S] | Push banner opacity — `PUSH_PROMPT_CONFIG.surface` (opaque `--color-bg-card` + info border + primary text + info-text icon); PushManager inline/floating/pill restyled (tokens only, no hex) | [x] |
| [L] | Traffic stack — `config/traffic.ts` (mapbox→tomtom→heuristic order, yellow #EAB308 moderate / red #DC2626 heavy, thresholds, WAT rush heuristic, duration blend) + `trafficService` (Redis 300s, never-throw) + `POST /api/maps/traffic` (maps bucket, guest-open, sanitized) + registry/barrel | [x] |
| [M] | Traffic UI — `useRouteTraffic` hook + RouteMap chunk overlays + `TrafficLegend` (i icon, hover/click, Escape, token-styled) + NavigationGuide/LiveNavigationModal traffic-aware durations + post-detail single-hook wiring; feed mini-maps opt out (fan-out guard) | [x] |
| [S] | Docs — FAQ 2 traffic items + tracings refresh (+FAQ_PCM pidgin), README Maps & traffic section, `.env.example` TOMTOM_TRAFFIC_KEY | [x] |
| [S] | Tests — NEW `traffic.test.ts` (12: surface tokens, order/colors, thresholds, heuristic determinism/bounds/rush-vs-calm, duration blend, chunking, registry, FAQ) | [x] |

## Sprint 59 — Feed Inclusion + PostCard Follow + Request Labels/FAQ + Traffic Tightening (2026-10-15, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same props + API envelopes, additive optional fields/params only). QA full in-runner: `npm install` ok, tsc 0 errors, jest 83/83 suites 723/723 tests, next lint clean on touched files, `npm run build` clean.

| Size | Task | Done |
|------|------|------|
| [M] | Feed inclusion — explicit own-posts pool in `feedService.getFeed` scored at new `FeedAlgorithmConfig.ownPostsWeight` (default = followingWeight 0.7; stored SiteConfig merges by spread so legacy rows keep working; non-finite guard falls back to followingWeight, never zero); non-followed posts unchanged via trending/tag/recent pools (no must-follow filter anywhere) | [x] |
| [M] | PostCard follow — NEW `POST_FOLLOW_CONFIG` (UserPlus/UserCheck icons, Follow/Following labels, hideWhenFollowing + hideOnOwnPost, responsive classes, statusPath, 120s cache TTL) + barrel; NEW `GET /api/users/[id]/follow` status (guest-safe `{following:false}`, self-flag; registry usersFollow += GET); NEW `useFollowStatus` hook (memory-cache read-through + in-flight dedup, AbortController, never throws); FollowButton `variant` (text legacy / icon / responsive) + `initialFollowing` + `hideWhenFollowing`; NEW `PostCardFollow` beside author identity in PostCard header | [x] |
| [S] | Request labels — `REQUEST_ROUTE_TRIGGER_CONFIG` += label/shortLabel + responsive button/label classes; `RequestRouteTrigger` renders icon + visible text inside the button (below on mobile, beside on desktop); home composer Request button same treatment (was icon-only on mobile via `hidden sm:inline`) | [x] |
| [S] | Route-request FAQ + locales — NEW `route-requests` category (5 items: request/respond/tracking/request-vs-route/who-sees) + FAQ_PCM pidgin for all 5; `requestRoute.label`/`shortLabel` in en+pcm (270/270 parity, REQUIRED_KEYS += 2) | [x] |
| [M] | Traffic tightening — `hasTomtomKey`/`hasMapboxKey`/`viaMapbox`/`viaTomtom` trim pasted env values; NEW `stripNullIsland` (legacy (0,0) placeholders dropped, real stops kept) + `validCoords` rejects null-island; TomTom chunk `indexOf` → explicit indices + speed sanity; per-provider try/catch so a throwing provider falls through to heuristic; legacy guarantee documented (traffic computed live per view, nothing stored → pre-traffic posts never excluded, base line always renders) | [x] |
| [S] | Tests — NEW `sprint59.test.ts` (14: own-weight, follow config/responsive/registry, trigger labels/layout, FAQ en+pcm, key trim, null-island strip, degenerate graceful shapes, keyless heuristic); `locales.test.ts` REQUIRED_KEYS += 2 | [x] |

## Sprint 60 — Feed out-of-network discovery guarantee (2026-10-15, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same props + API envelopes, additive optional config keys only). QA full in-runner: `npm install` ok, tsc 0 errors, jest 84/84 suites 728/728 tests, lint clean on touched files.

| Size | Task | Done |
|------|------|------|
| [M] | Feed discovery — two explicit out-of-network pools in `feedService.getFeed` (open `ROUTE_REQUEST`s from non-followed authors, no age window, recency-ordered for suggestions-carousel parity; general recent posts from anyone not followed, engagement/tag-agnostic) scored at new `FeedAlgorithmConfig.discoveryWeight` (0.5) + `openRequestWeight` (0.6) with recency bonus 0.05; below followingWeight (affinity preserved), above trendingWeight (discovery surfaces); spread-merge safe + non-finite guard to defaults (never zero); cursor/exclude/archived/backfill honored in both pools | [x] |
| [S] | Tests — NEW `feedDiscovery.test.ts` (5: finite positive weights, follow-dominant/trending-beating ordering, request ≥ discovery priority, legacy-row fallback never zero, admin-tuned values honored) | [x] |

## Sprint 61 — Design-system visibility + Config Studio parity (2026-10-15, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same props + API envelopes, additive optional fields only). QA full in-runner: `npm ci` ok, tsc 0 errors, jest 85/85 suites 736/736 tests, next lint clean on touched files (3 pre-existing errors in untouched files left alone), build deferred to CI/Vercel (no DB URL in runner).

| Size | Task | Done |
|------|------|------|
| [M] | Vehicle flags — `VEHICLE_REGISTRY` light wash `-50` → `-100` + new `borderClass` (light `-300` / dark `-800`) per type; `VehicleType` += optional `borderClass`; `VehicleChip` renders `border` + semibold + label title/aria (post cards + post details) | [x] |
| [S] | TrustBadge tokens — hardcoded hex → `bg-trust-*-bg` / `text-trust-*-text` / `border-trust-*-border` token classes + border (identical light values, dark unchanged) | [x] |
| [M] | Tier shields — NEW `REWARD_TIER_DISPLAY` (per-tier pill classes with dark variants) + `rewardTierPillClass` (neutral fallback); `RewardsPanel` pill drops raw-metallic inline style; `AppUserLabel` tier icons use darkened display shades; `AuthLinkPanel` Linked/Enabled `bg-success text-white` → token pairing; same invisible-pattern fix in admin email auto/manual badges, admin users verify actions/pills/buttons, notifications unread count | [x] |
| [L] | Config Studio parity — `ADMIN_CONFIG_DEFAULTS` (8 shipped defaults) + `mergeAdminConfigsWithDefaults` (stored-wins + backfill + source) + `validateAdminConfigValue` (central gate, delegates earlyAdopter/feedDiversity) + `ADMIN_SIMPLE_CONFIG_CARDS` (6 no-code cards) + `ADMIN_DEDICATED_CONFIG_KEYS`; API GET merged + virtual default rows + `defaults` catalog, PUT `restore` branch + central validation + audit (`config.upsert`/`config.restore-default`), DELETE idempotent; page renders defaults with source badges, no-code cards, restore buttons, raw list limited to ad-hoc keys | [x] |
| [S] | Tests — NEW `designCompliance.test.ts` (7: defaults catalog + card coverage + merge semantics + central validation + tier display + fallback); `vehicles.test.ts` +1 (saturated wash + border contract, boat/train `-100` updates) | [x] |

## Sprint 62 — Community route-request fan-out + location-only draft restore (2026-10-15, execute-feature)

> **Section summary:** Directive close-out, non-breaking (no migration, no new deps, no removed APIs; same props + API envelopes, additive optional config/service only). QA full in-runner: `npm install` ok, tsc 0 errors, jest 86/86 suites 742/742 tests, next lint clean on touched files.

| Size | Task | Done |
|------|------|------|
| [M] | Route-request audience — NEW `config/routeRequestAudience.ts` (community default, maxRecipients 500 cap 1–5000, excludeDeleted, SiteConfig key + normalize/validate + admin meta) + barrel; `notificationService.getRouteRequestAudienceIds` (followers-first, then recent non-deleted members up to cap, self excluded, never throws, followers-only legacy mode); POST `/api/posts` ROUTE_REQUEST branch fans out to the community audience with followers fallback; admin registration (SITE_CONFIG_EDITORS + ADMIN_CONFIG_DEFAULTS + central validation branch + no-code SimpleConfigCard) | [x] |
| [S] | Draft restore — `ShareRouteModal.applyDraft` restores 1-step location-only drafts as Origin + empty Destination (coords preserved, title resets unconditionally so empty titles clear stale input, Share stays disabled until the second location is filled); `routeDraftsService.legacyToDraft` hasContent now matches hasUsableContent (description/tags count) | [x] |
| [S] | Copy — FAQ `who-sees-request` (en + pidgin) now states every member is notified, no follow needed | [x] |
| [S] | Tests — NEW `routeRequestAudience.test.ts` (4: defaults, normalize caps/fallbacks, validation, admin registration); `routeDrafts.test.ts` +2 (location-only round-trip with coords, description/tags-only legacy migration); `posts.test.ts` ROUTE_REQUEST case asserts community audience recipients | [x] |

## Sprint 63 — Optimistic location-aware route-request fan-out + notification preferences (2026-10-15, execute-feature)

> **Section summary:** Directive close-out, non-breaking (one additive table + additive optional config/API/UI fields only; same props + API envelopes; missing prefs row/NULL = current behaviour). QA full in-runner: `npm install` ok, tsc 0 errors, jest 87/87 suites 750/750 tests, next lint clean on touched files, next build clean.

| Size | Task | Done |
|------|------|------|
| [M] | Location-aware audience — `routeRequestAudience` += optional `location { enabled (default true), radiusKm (default 50, 1–500), minNearby (default 3, 1–100) }` (normalize fills legacy rows, validate extended, admin meta +3 fields, central admin validation delegates); `getRouteRequestAudienceIds(actorId, { requestLat, requestLng }?)` computes an ephemeral within-radius subset server-side from stored `lastKnownLat/Lng` (never persisted/logged/exposed, null-island rejected) and returns nearby-only when `nearby >= minNearby`, else falls back to the full community audience; POST `/api/posts` passes `requestLat/requestLng ?? startLat/startLng` (schema += optional passthrough, never written to Post) | [x] |
| [M] | Preferences — NEW `config/notificationPreferences.ts` (13 keys, all-true defaults = current behaviour, normalize null-safe, validate, TYPE→key map, META sections/labels/hints) + barrel; NEW `NotificationPreference` model + migration `20261015000000_notification_preferences` (userId unique, nullable Json, missing row = defaults, no backfill); NEW `notificationPreferenceService` (single/many/filter, never-throw, fail-open); `createNotification` filters recipients centrally (all types); NEW `GET/PUT /api/notifications/preferences` (GET never 404s, PUT partial upsert with 400/503 honesty); RequestRouteModal attaches cached-only bias fix (never prompts); home payload type += ephemeral fields | [x] |
| [M] | UI — Notifications header += settings gear button + NEW `NotificationPreferencesModal` (metadata-driven switches, load/save/reset, offline honesty, stable onClose, design-token classes, lucide icons only) | [x] |
| [S] | Copy — FAQ `who-sees-request` updated (location-aware + preferences) + NEW `request-location-filtering` (privacy-safe verdict: corrects "we don't store location" — nullable consented lastKnown IS stored for feed boost, cleared on deletion; ephemeral request fix, PWA background limits, optimistic-not-guaranteed) + NEW `notification-preferences` (en + pcm); push FAQ notes per-type settings | [x] |
| [S] | Tests — NEW `notificationPreferences.test.ts` (5: defaults, null/partial normalize, validation, type map, meta coverage); `routeRequestAudience.test.ts` +3 (location defaults, legacy normalize, location validation); `posts.test.ts` audience assertion updated for ephemeral-fix arg | [x] |

## Sprint 64 — Offline coverage for landing/profile/notifications + authenticated-offline guest-banner fix (2026-10-15, execute-feature) [recorded post-hoc]

> **Section summary:** Executed in a prior session — full detail lives in `checkpoints/session-log.md`, `summaries/dev-history.md`, and `memory/lessons-learned.md` (Sprint 64 entries). No task rows were reconstructed here (append-only honesty: rows are not invented after the fact). Known drift: `checkpoints/in-progress.md` still names Sprint 63 as last-closed.

| Size | Task | Done |
|------|------|------|
| [M] | Offline coverage + auth snapshot — see session-log Sprint 64 entry (`config/authOffline.ts`, pwa v6, GuestBanner suppression, LandingOfflineNotice, CachedDataNotice, offline.html + FAQ updates; QA green 88/88 suites 757/757) | [x] |

## Sprint 65 — Post-card detail links + response-banner dismiss + vehicle contrast deepening (2026-10-16, execute-feature)

> **Section summary:** Directive close-out, non-breaking (additive optional config fields + additive optional `onClearResponse` prop only; same props + API envelopes; no migration, no new deps). QA full in-runner: `npm ci` ok, tsc 0 errors, jest 89/89 suites 761/761 tests, next lint exit 0 (1 pre-existing `prefer-const` error in untouched `accountDeletionService.ts` + pre-existing warnings), full `next build` clean.

| Size | Task | Done |
|------|------|------|
| [S] | Detail navigation — `POST_ACTIONS_CONFIG` += `detailTextLinksEnabled` + `detailDescriptionClass` + `detailRouteStepClass`; `PostCard` description + route-step location/description render as detail `Link`s (encoded `postPath`, stopPropagation, aria-labels); tags + maps untouched (own actions); title migrates to the same encoded path | [x] |
| [S] | Response dismiss — `SHARE_ROUTE_MODAL_CONFIG` += `responseBannerDismissLabel/Title`; `ShareRouteModal` += optional `onClearResponse` + `dismissResponse` (clears restored linkage + parent callback, never closes modal, input preserved, hidden while editing); home stable `clearRespondTo`; post-detail `respondUnlinked` gate (reset on open/close/submit) | [x] |
| [S] | Vehicle contrast — `VEHICLE_REGISTRY` light text `-800` → `-900` all 9 types (dark variants unchanged; stray-space fix on taxi); contract comment updated | [x] |
| [S] | Tests — NEW `postCardDetailLinks.test.ts` (4: nav flag + encoded path, link token classes, dismiss copy, `-900` grade); `vehicles.test.ts` updated (boat/train `-900`, contract regex `-(800\|900)`) | [x] |

## Sprint 66 — Config studio links + vehicle badge readability (2026-10-16, execute-feature)

> **Section summary:** Directive close-out, non-breaking (additive config metadata + additive UI only; same props + API envelopes; no migration, no new deps; sender editing relocated, not removed). QA static in-runner (no node_modules; full tsc/jest/build deferred to CI — expected jest 89 suites / 762 tests, +1 studio-links test).

| Size | Task | Done |
|------|------|------|
| [S] | Studio links — `admin.ts` += `ADMIN_STUDIO_MANAGED_KEYS` (blogPosts/emailConfig/emailTemplates/emailTemplateToggles) + `ADMIN_STUDIO_LINKS` (Email/Blog Studio href/CTA/description) + barrel; Config page renders metadata-driven link cards (Customized badge on DB overrides), raw list hides studio keys via extended `ADMIN_DEDICATED_CONFIG_KEYS`; `emailConfig` removed from `ADMIN_SIMPLE_CONFIG_CARDS` (defaults/validator/API/service reads kept) | [x] |
| [S] | Sender relocation — Email Studio += collapsible Sender identity card (fromName/fromEmail/replyTo via generic config API, shipped-default backfill, inline validation) so the removed Config-page card loses no capability | [x] |
| [S] | Vehicle readability — `VEHICLE_REGISTRY` light wash `-100`→`-200` / border `-300`→`-400` ×9 (trekking gray-300; dark unchanged); `VehicleChip` += `shadow-xs` + icon `strokeWidth={2.5}` (route-request-flag structure); PostCard + post detail pick it up with zero per-surface changes | [x] |
| [S] | Tests — `vehicles.test.ts` contract → `-200`/`-400` (+`-100` rejection); `designCompliance.test.ts` += studio-links test + no-code-card test counts studio links | [x] |
