# Development Task Queue

> **Metadata**
> - last-updated-by: execute-feature 2026-10-08 (Sprint 16 early-adopter badge + reset unhook)
> - last-verified-against-code: 2026-10-08 (Sprint 16 rows verified present in code; QA to static-review level — no node_modules in runner)
> - last-synced: 2026-10-08 (Sprint 16 early-adopter badge + vercel-build reset removal — execute-feature close-out)
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

## Sprint 19 (Planned) — Keyless Map Stack: OpenFreeMap + OSRM + Proxied Geocoding (plan-feature 2026-10-08)

> **Section summary:** PLAN ONLY — no code written. Directive: long-term keyless map service/tools/renderers (pins + polylines, scalable, no API-key failures). Recommendation: keep MapLibre GL renderer; tiles → OpenFreeMap keyless vector styles (verified 2026-10-08: free, no limits, no registration/keys, MapLibre-native `tiles.openfreemap.org/styles/{liberty,bright,positron}`, self-host path); routing → OSRM demo via server proxy + Redis cache + straight-line fallback (demo policy 1 req/s, no SLA — never call browser-direct); geocoding → `/api/maps/*` proxy (Nominatim server-side + Photon fallback, fixes browser-direct policy violation). Mapbox/ORS/MapTiler/Stadia/Geoapify demoted to optional keyed overrides; Carto `?apiKey=` dependency removed.

| Size | Task | Status |
|------|------|--------|
| [M] | MAP_STACK_CONFIG — `app/lib/config/mapStack.ts`: tile style URLs (primary OpenFreeMap liberty/bright/positron + dark mapping), raster fallback chain (Carto keyless → OSM → Esri), routing provider order (osrm → ors → mapbox → straight), geocode order (nominatim → photon), TTLs, attribution strings, dark-mode mapping; barrel export | [ ] |
| [M] | Server proxy — `/api/maps/route`, `/api/maps/geocode`, `/api/maps/reverse` + `mapProxyService` (Redis read-through on traceSignature/query, per-IP rate limit, server User-Agent/Referer, keyed providers only when env present, straight-line final fallback, sanitized errors) | [ ] |
| [M] | Renderer cutover — shared map-style builder; RouteMap.tsx + explore/page.tsx consume it (drop `mapbox://` branch + `cartoParam` apiKey logic, vector primary + raster fallback + onError provider step-down); remove `api.mapbox.com` preconnect hints if Mapbox fully optional | [ ] |
| [S] | Geocode client cutover — RouteStepInput, ShareRouteModal, `geo.ts reverseGeocode` call internal `/api/maps/*` (keep debounce/abort); Nominatim URLs removed from client | [ ] |
| [M] | routeTracingService chain reorder — OSRM-first via internal proxy shape (GeoJSON → polyline5), keep ORS/Mapbox as env-gated overrides, straight-line fallback preserved; `/api/routes/trace` delegates to mapProxyService | [ ] |
| [S] | Env/config hygiene — `.env.example` marks CARTO/MAPBOX/MAPTILER/ORS keys optional-override; system-architecture config table updated; rateLimits `maps` bucket entry | [ ] |
| [M] | Tests — mapStack config (fallback order, dark mapping, attribution), proxy cache/fallback unit, trace reorder (keyless-first, no-key no-call) | [ ] |
| [S] | QA gate — tsc + jest + build + lint; verify pins render + polyline draws with ALL map keys unset (the keyless proof) | [ ] |

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
