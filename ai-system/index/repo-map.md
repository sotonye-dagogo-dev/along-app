# Repository Map

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-17 (Sprint 72: +mapView.ts, +mapPicker.ts, +3 test suites; config count re-verified 2026-10-17; structure otherwise unchanged)
> - last-verified-against-code: 2026-10-17 (Sprint 72 in-runner QA: tsc 0, jest 98/98 suites 865/865, build clean; config count 85 re-verified)
> - staleness-policy: auto-regenerable — can be derived from `Get-ChildItem -Recurse` or `tree` command. Manual content only where intent cannot be derived from structure.

> **Overview:** Complete folder structure of the Along monorepo with purpose descriptions for each directory. This file is **auto-regenerable** — use tool-based discovery (filesystem MCP, git ls-tree) for ground truth, and treat manual entries here as supplementary context, not primary navigation.

---

## Folder Structure

```
along-app/
│
├── ai-system/              → AI development orchestration system
│   ├── agents/              → Role-based agent instruction files
│   ├── checkpoints/         → Session log and in-progress marker
│   ├── commands/            → Executable AI commands
│   ├── designs/             → HTML design files (17 pages)
│   ├── docs/                → PRD, design brief, prompts, roadmap
│   ├── index/               → Repo map and dependency graph
│   ├── memory/              → Decisions, lessons, architecture history
│   ├── operations/          → Operations guide
│   ├── planning/            → Project plan and task queue
│   ├── protocols/           → Entry, tiering, quality gate, escalation, verification
│   ├── standards/           → Engineering principles
│   ├── summaries/           → Development history
│   └── testing/             → Test plan and results
│
├── .github/                 → GitHub configuration
│   ├── workflows/           → CI pipeline (build, type-check, test, lint)
│   └── summaries/           → Previous development phase summaries
│
├── prisma/                  → Database layer
│   ├── schema.prisma        → 18 models (+AccountDeletionRequest), 10 enums (+AccountDeletionStatus; NotificationType +ACCOUNT_DELETION_*)
│   ├── migrations/          → 9 migrations (incl. 20261009000000_account_deletion: User deletion columns + AccountDeletionRequest + ACCOUNT_DELETION_* notifications)
│   └── seed.ts              → Development seed data (idempotent, upsert by title)
│
├── public/                  → Static assets
│   ├── sw.js                → Custom service worker (PWA)
│   ├── offline.html         → Offline fallback page
│   ├── manifest.json        → PWA manifest
│   ├── icons/               → App icons (192x192, 512x512)
│   └── images/              → OG image, favicon, logos
│
├── app/                     → Application root (Next.js App Router)
│   ├── layout.tsx           → Root layout with 6 context providers
│   ├── globals.css          → Global styles with Tailwind v4
│   ├── robots.ts            → Robots.txt config
│   ├── sitemap.ts           → Sitemap generation
│   ├── hooks/               → App-level custom hooks (useAuth, useFeedInteractions, useRequireAuth)
│   ├── generated/           → Code-generated files
│   ├── (auth)/              → Auth pages (login, register, OTP)
│   ├── (dashboard)/         → Main app (feed, explore, search, profile, leaderboard, marketplace, etc.)
│   ├── admin/               → Admin dashboard (period toggle 7/30/90 wired to stats KPIs + chart [Sprint 43]; hover tooltips on all charts via shared ChartTooltip + charts.ts registry [Sprint 45]; dedicated /admin/analytics page + GET /api/admin/analytics — KPIs, growth/engagement/validity/audience, top posts/contributors [Sprint 45]; scrollable links region + platform-consistent profile-linked AppUserLabel/AppAvatar identity [Sprint 45]; posts incl. Edit modal [Sprint 37]; users table with Active/Pending/Deleted filters + deleted view-only gating + row-actions dropdown [Sprint 44]; deletions queue with per-row Reverse/Delete-now dropdown [Sprint 44]; audit trail table [Sprint 37])
│   ├── (public)/            → Landing, about, contact, legal, faq, blog
│   │   ├── faq/             → FAQ page with categorized Q&A
│   │   ├── blog/            → Blog listing page
│   │   │   ├── posts/       → MDX blog post files
│   │   │   └── [slug]/      → Blog post detail page
│   ├── api/                 → REST API routes
│   │   ├── upload/          → Image upload (Cloudinary multipart) + cleanup/ (POST orphan purge: allowlisted along/* only, skips post-referenced URLs [Sprint 33])
│   │   ├── search/          → GET unified search (posts + users + tags; q/type/region/postType/cursor, search-bucket rate limit, Redis cache)
│   │   ├── maps/            → Keyless map proxy (Sprint 19): route/ (POST OSRM-first trace) + geocode/ (GET merged Nominatim+Photon+Open-Meteo, optional ?lat=&lng= near-rank) [Sprint 50] + reverse/ (GET label), maps-bucket rate limit, Redis read-through, sanitized errors
│   │   ├── routes/trace/    → POST route trace (delegates to mapProxyService; contract unchanged)
│   │   ├── suggestions/     → GET ordered suggestions (route requests → routes → accounts, 1800s cache)
│   │   ├── bookmarks/       → GET/POST bookmark list + toggle (per-tab profile filtering)
│   │   ├── reviews/         → GET approved platform reviews (mine/authorId/cursor, edge-cached, SW cacheable) + POST upsert own review (PENDING, ACID, reviews-bucket rate limit, thank-you notify) [Sprint 25]
│   │   ├── push/            → Push notification API
   │   │   │   ├── subscribe/   → POST: subscribe to push
   │   │   │   ├── unsubscribe/ → POST: unsubscribe from push
   │   │   │   ├── send/        → POST: QStash-triggered push delivery
   │   │   │   └── vapid-public-key/ → GET: VAPID public key
   │   │   ├── users/
   │   │   │   ├── [id]/
   │   │   │   │   ├── route.ts        → GET (profile + earlyAdopter badge), PATCH (edit)
   │   │   │   │   ├── early-adopter/ → GET per-user badge status (rank from createdAt)
   │   │   │   │   ├── avatar/        → PATCH avatar config
   │   │   │   │   ├── follow/        → POST/DELETE follow/unfollow
   │   │   │   │   ├── followers/     → GET followers list
   │   │   │   │   └── following/     → GET following list
   │   │   │   ├── early-adopters/  → GET badge config + earliest-joined users (filtering/rewards tooling)
   │   │   │   └── by-username/[username]/
   │   │   │       └── route.ts       → GET user by username + isFollowing + earlyAdopter badge
│   │   ├── workers/         → QStash background worker endpoints
│   │   │   ├── feed-invalidate/
│   │   │   ├── rewards/
│   │   │   └── validity-recompute/
│   ├── components/          → React components
│   │   ├── ui/              → 43 App* universal component wrappers + SuggestionsPanel (live) — incl. NEW AppTableRowActions (metadata-driven row-actions dropdown, className-preserving) + AppDropdown className/disabled/title passthrough [Sprint 44]
│   │   └── features/        → Domain-specific components (comments [CommentInput caret-explicit + AppAvatar, CommentList AppAvatar rows, PostCommentsModal shared feed/profile/search/detail (Sprint 39)], posts incl. LiveNavigationModal floating map+guide overlay [Sprint 28], RequestRouteModal/RequestRouteTrigger/RouteDraftsPanel (restore/update/delete)/ShareRouteModal edit mode + draft update-vs-new prompt, MapPins [MapRoutePin/MapUserDot anchor-stable], moderation [PostMenu owner-only Edit/Archive/Delete (Sprint 37), ReportDialog + ReportImageUpload screenshots (metadata.images, no migration) (Sprint 50)], profile [RewardsPanel, EarlyAdopterBadge, AuthLinkPanel, EmailSecurityPanel (verify/change-email/change-password, gated)], reviews [ReviewsPanel form+list+FAQ (own + read-only author-scoped)] [Sprint 25], explore [ExploreSearchInput unified suggestions + recents (Sprint 39)], suggestions [EndlessCarousel, SuggestionsRail, FollowButton (text/icon/responsive variants [Sprint 59])], posts [PostCardFollow inline header follow (responsive, hide-when-following [Sprint 59])], events [frozen])
│   ├── lib/                 → Shared code
│   │   ├── services/        → 27 service modules (post detail richness scorer + context derivation [Sprint 40], errorReport prefill builder + bug-report URL [Sprint 40], corroboration evidence blend single+batched + create-path reuse [Sprint 38], mediaCleanup ACID-safe Cloudinary orphan purge [Sprint 33], trustBreakdown canonical single+batched live breakdowns [Sprint 32], postShare universal Web-Share→clipboard→legacy [Sprint 31], mapProxy keyless trace/merged-geocode (openmeteo + dedupe + near-rank [Sprint 50])/reverse, earlyAdopter rank/status/list, errorReport sanitized bug filing, feed, search, routeDrafts, postModeration, mention, referral, notification, push sub, QStash, rewards, email, OTP/reset-token stores, etc.)
│   │   ├── cache/           → Client memoryCache (TTL Map, prefix invalidation, never-throw)
│   │   ├── hooks/           → useCachedFetch (read-through + SWR + in-flight dedup), useRequireAuth, usePostShare (shared post-share + config toasts [Sprint 31]), useUserLocation (passive GPS fix + movement watch [Sprint 23]), useRouteTrace (shared road-snapped trace: estimate + debounced proxy + cache + silent fallback [Sprint 28]), useOtpResend (server-adopted OTP cooldown timer + send/verify normalisation [Sprint 27]), useFollowStatus (cached follow-status read-through + in-flight dedup [Sprint 59])
│   │   ├── config/          → 85 config files incl. index.ts (count verified 2026-10-17) (Sprint 72 += mapView.ts deferred-recenter config (MAP_VIEW_CONFIG + shouldDeferFit) + mapPicker.ts tap-assign/focus config (MAP_PICKER_CONFIG) + locationSuggestions extractPlusCodeToken/plusCodeLocalityFallback + mapStack routingBases/routingProfiles/profile-slug helpers + faq 4 maps items en+pcm; Sprint 68 += mapTooltips.ts detailed/mini tooltip registry + pure tap/segment helpers → RouteMap; Sprint 63 += notificationPreferences.ts 13-key defaults/normalize/validate/TYPE-map/META + barrel; Sprint 62 += routeRequestAudience.ts audience mode/cap/SiteConfig-key/normalize/validate/meta + admin.ts audience editors/defaults/validation/card; Sprint 61 += admin.ts ADMIN_CONFIG_DEFAULTS/merge/validate/SIMPLE_CARDS/dedicated-keys + vehicles borderClass + rewards REWARD_TIER_DISPLAY; Sprint 59 += postFollow.ts follow registry + routeRequest label/shortLabel/responsive classes + feedAlgorithm ownPostsWeight + faq route-requests category; Sprint 58 += traffic.ts levels/thresholds/rush/legend + pure helpers; Sprint 56 += studioLayout.ts preview heights/sticky builders + feedAlgorithm diversity KEY/META/normalize/validate + search SEARCH_ANALYTICS_CONFIG/helpers + charts zero-results copy; Sprint 55 += search.ts loose-search registry + scrollbar.ts SCROLLBAR_CONFIG + feedAlgorithm FEED_DIVERSITY_CONFIG/applyFeedDiversity + trustDisplay tooltip knobs; Sprint 52 += featuredBlogs section/CTA/maxItems + pick/featuredBlogHref; audit report/blog action entries) (broad suggestions += locationSuggestions min2/debounce/limit/timeout/coordinate (paren-aware)/reorder/URL/OLC-plus-code/strip-house-number helpers) (Sprint 51 += notificationRoutes, bugReports, ADMIN_TABLE_SORT_META/ADMIN_PAGINATION_META in admin.ts) (profileValidation display-name normalize/validate [Sprint 48], validityConfig DETAIL_SCORING_CONFIG richness bonuses [Sprint 40], errorReporting bugReportPath/toast-CTA/prefill scaffolding [Sprint 40], navigation Search entry + footer Search link + profileQuickLinks Search route [Sprint 40], trustDisplay TRUST_BREAKDOWN_DESCRIPTIONS tooltip help + validityConfig CORROBORATION_CONFIG evidence blend [Sprint 38], audit trail display labels/variants/sanitizers [Sprint 37], leaderboardLinks canonical /leaderboard cross-links [Sprint 34], profileQuickLinks accountTab/scroll/route quick-links [Sprint 34], authLink connected-state copy/resolver [Sprint 34], mediaCleanup allowlist/toggles/account-retention/guardLivePostReferences [Sprint 33; Sprint 57 guard], trustDisplay compact/full keys + tier derivation [Sprint 32], validityConfig reputation/engagement/report weights + VALIDITY_SIGNAL_BOUNDS + postActions shareLabel/shareTitleDefault/postPath [Sprint 31], like/dislike active + icon classes [Sprint 42], routeValidation composer/fare/sanitize validators [fix-build 2026-10-09; Sprint 36 destination-skip], routePins canonical origin+intermediates+destination builder + ROUTE_PINS_CONFIG + navigation LIVE_NAVIGATION_CONFIG [Sprint 28], authVerification OTP TTL/cooldown/attempts/copy/maskEmail + pushPrompt storage/dismiss/outcome-copy/iOS-detect + opaque surface tokens [Sprint 27; Sprint 58], reviews registry REVIEWS_CONFIG/CTA-cadence/author-name [Sprint 25], footer i18nKey + faq FAQ_PCM + rateLimits reviews bucket [Sprint 25], pwa v4 locales-precache/config-cache/banner-copy/REVIEW-mirror [Sprint 25], routeSteps destination no-fare/no-vehicle rule + normalize [Sprint 23], env effective-env PROJECT_ENV-wins [Sprint 22], email wrapper/icons/default-vars + EMAIL_BUILDER_CONFIG blocks/catalog [Sprint 22], mapPins anchor-stable pins/user-dot [Sprint 20], mapStack keyless tiles/routing/geocode/TTLs/attributions [Sprint 19; Sprint 50 += openmeteo provider/upstream/order], reportAttachments 3/2MB/folder/sanitize [Sprint 50], paginationUi view-more/navigator copy [Sprint 50], floatingUi lanes/dock/laneBottom [Sprint 50], earlyAdopter badge key/defaults/validation/labels, reviews/SITE_REVIEWS, carousel, shareRoute, routeDrafts, routeRequest, toast, postActions, postSubmit, moderation incl. immutablePostFields, notifications incl. DISLIKE/NEW_ROUTE, inviteConfig points-cap policy, navigation incl. isAdminRole, errorReporting category/endpoint/caps/copy, footer layout)
│   │   ├── db/              → Database layer (prisma.ts, redis.ts)
│   │   ├── hooks/           → Server-compatible custom React hooks
│   │   ├── schemas/         → Zod validation schemas
│   │   ├── streams/         → Reactive streams
│   │   ├── types/           → TypeScript type definitions
│   │   ├── integrations/    → External service clients (transact, tega)
│   │   └── utils/           → 12 utility modules (blog, blogImages resolve/extract/collect/diff [Sprint 54], pushClient [Sprint 27: env guards + in-gesture permission + detailed reasons], siteConfig, etc.) + emailSanitize (allowlist/escape) + emailBuilder (blocks↔HTML↔text lossless) + emailTemplates (escaped interpolation, shared defaults) [Sprint 22]
│   └── providers/           → 6 context providers (Auth, OnlineStatus, Push, GlobalModal, GlobalToast, CookieConsent) + I18n (bundled-EN seed, last-good cache, cookie sync, tf() fallback [Sprint 25])
│
├── node_modules/            → Installed dependencies
│
├── scripts/                 → DB maintenance scripts
│   ├── backup-seed-data.ts  → Dumps seed-marked rows to backups/seed-backup-<ts>.json
│   ├── clear-seed-data.ts   → Deletes seed markers only (manual, backup-first)
│   ├── restore-seed-backup.ts → Restores a seed backup
│   └── reset-prod-db.ts     → Full prod reset (manual-only since 2026-10-08 — UNHOOKED from vercel-build after clean-DB build)
│
├── instrumentation.ts       → Sentry runtime hooks
├── instrumentation-client.ts → Sentry client entry (Turbopack; re-exports sentry.client.config)
├── next.config.mjs          → Next.js config (Sentry, PWA headers, images)
├── tailwind.config.ts       → Tailwind theme (colors, shadows, radii)
├── postcss.config.mjs       → PostCSS with @tailwindcss/postcss
├── tsconfig.json            → TypeScript config with path aliases
├── jest.config.js           → Jest config with coverage thresholds
├── jest.setup.js            → Jest global mocks
├── .eslintrc.json           → ESLint config
├── .env                     → Environment variables (populated)
├── .env.example             → Environment variable template
├── package.json             → Project manifest and scripts
└── README.md                → Project overview
```

---

## Directory Descriptions

| Directory       | Purpose                                                                        | Key Files                                                                          |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `ai-system/`    | AI development orchestration — agent instructions, plans, protocols, designs   | `protocols/entry-protocol.md`, `planning/task-queue.md`, `designs/*.html`          |
| `.github/`      | GitHub CI and project documentation                                            | `workflows/ci.yml`, `plan.md`, `project-context.md`                                |
| `prisma/`       | Database schema, migrations, and seed data                                     | `schema.prisma` (17 models, 9 enums incl. PostType + extended NotificationType), `seed.ts` (idempotent), `migrations/` (8) |
| `scripts/`      | Seed backup/clear/restore tooling (manual-only, seed-markers only) + full prod reset script (manual-only, unhooked from builds) | `backup-seed-data.ts`, `clear-seed-data.ts`, `restore-seed-backup.ts`, `reset-prod-db.ts`          |
| `public/`       | Static assets served at root path                                              | `sw.js` (service worker), `manifest.json`, `offline.html`                          |
| `app/lib/config/pwa.ts` | PWA policy registry (caches, precache, push mirror, heartbeat, install registry) | versioned cache names, predicates, PWA_PUSH_MIRROR, toast copy, PWA_INSTALL_CONFIG, isStandaloneDisplay |
| `app/components/pwa/` | Offline/push/install/update UI (banner, cached notice, push opt-in inline+floating, install prompt, SW update prompt, notices hub, SW registrar) | OfflineBanner, CachedDataNotice, PushManager, InstallPrompt, ServiceWorkerUpdatePrompt, PwaNotices, ServiceWorkerRegistrar |
| `app/lib/services/pushSender.ts` | Web Push fan-out mirrored from in-app notifications | fanOutPush (VAPID direct, 410 prune, never throws) |
| `app/lib/utils/offlineGuard.ts` | Offline gating + sanitized network-error copy | requireOnline, isOfflineError, offlineFriendlyError |
| `app/`          | Next.js App Router pages, API routes, components, providers, config registries | `layout.tsx`, `globals.css`, `providers/`, `api/`, `components/ui/`, `lib/config/` |
| `node_modules/` | NPM dependencies                                                               | —                                                                                  |

---

## Entry Points

| Purpose                | File                                    |
| ---------------------- | --------------------------------------- |
| Application root       | `app/layout.tsx`                        |
| Global styles          | `app/globals.css`                       |
| Next.js configuration  | `next.config.mjs`                       |
| Database schema        | `prisma/schema.prisma`                  |
| Server instrumentation | `instrumentation.ts`                    |
| Environment validation | `.env` / `.env.example`                 |
| CI pipeline            | `.github/workflows/ci.yml`              |
| AI agent instructions  | `ai-system/protocols/entry-protocol.md` |
