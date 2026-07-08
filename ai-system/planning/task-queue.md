# Development Task Queue

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
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

## Backlog

> **Section summary:** Known work that needs to be done but hasn't been scheduled yet.

| Size | Task |
|------|------|
| [XL] | Transact Marketplace integration (deferred) |
| [XL] | Tega Events integration (deferred) |

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
