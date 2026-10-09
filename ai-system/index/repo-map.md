# Repository Map

> **Metadata**
>
> - last-updated-by: execute-feature 2026-10-09 (Sprint 28 route accuracy + live-navigation overlay)
> - last-verified-against-code: 2026-10-09 (41 config files incl. accountDeletion/emailManagement; account/cron/deletion/email APIs, deletions+email admin pages, AccountDeletionPanel verified in code; QA static-only, no node_modules)
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
│   ├── (admin)/             → Admin dashboard
│   ├── (public)/            → Landing, about, contact, legal, faq, blog
│   │   ├── faq/             → FAQ page with categorized Q&A
│   │   ├── blog/            → Blog listing page
│   │   │   ├── posts/       → MDX blog post files
│   │   │   └── [slug]/      → Blog post detail page
│   ├── api/                 → REST API routes
│   │   ├── upload/          → Image upload (Cloudinary multipart)
│   │   ├── search/          → GET unified search (posts + users + tags; q/type/region/postType/cursor, search-bucket rate limit, Redis cache)
│   │   ├── maps/            → Keyless map proxy (Sprint 19): route/ (POST OSRM-first trace) + geocode/ (GET Nominatim→Photon) + reverse/ (GET label), maps-bucket rate limit, Redis read-through, sanitized errors
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
│   │   ├── ui/              → 42 App* universal component wrappers + SuggestionsPanel (live)
│   │   └── features/        → Domain-specific components (comments, posts incl. LiveNavigationModal floating map+guide overlay [Sprint 28], RequestRouteModal/RequestRouteTrigger/RouteDraftsPanel (restore/update/delete)/ShareRouteModal edit mode + draft update-vs-new prompt, MapPins [MapRoutePin/MapUserDot anchor-stable], moderation [PostMenu, ReportDialog], profile [RewardsPanel, EarlyAdopterBadge, AuthLinkPanel, EmailSecurityPanel (verify/change-email/change-password, gated)], reviews [ReviewsPanel form+list+FAQ (own + read-only author-scoped)] [Sprint 25], explore, suggestions [EndlessCarousel, SuggestionsRail, FollowButton], events [frozen])
│   ├── lib/                 → Shared code
│   │   ├── services/        → 24 service modules (mapProxy keyless trace/geocode/reverse, earlyAdopter rank/status/list, errorReport sanitized bug filing, feed, search, routeDrafts, postModeration, mention, referral, notification, push sub, QStash, rewards, email, OTP/reset-token stores, etc.)
│   │   ├── cache/           → Client memoryCache (TTL Map, prefix invalidation, never-throw)
│   │   ├── hooks/           → useCachedFetch (read-through + SWR + in-flight dedup), useRequireAuth, useUserLocation (passive GPS fix + movement watch [Sprint 23]), useRouteTrace (shared road-snapped trace: estimate + debounced proxy + cache + silent fallback [Sprint 28]), useOtpResend (server-adopted OTP cooldown timer + send/verify normalisation [Sprint 27])
│   │   ├── config/          → 43 config files incl. index.ts (routePins canonical origin+intermediates+destination builder + ROUTE_PINS_CONFIG + navigation LIVE_NAVIGATION_CONFIG [Sprint 28], authVerification OTP TTL/cooldown/attempts/copy/maskEmail + pushPrompt storage/dismiss/outcome-copy/iOS-detect [Sprint 27], reviews registry REVIEWS_CONFIG/CTA-cadence/author-name [Sprint 25], footer i18nKey + faq FAQ_PCM + rateLimits reviews bucket [Sprint 25], pwa v4 locales-precache/config-cache/banner-copy/REVIEW-mirror [Sprint 25], routeSteps destination no-fare/no-vehicle rule + normalize [Sprint 23], env effective-env PROJECT_ENV-wins [Sprint 22], email wrapper/icons/default-vars + EMAIL_BUILDER_CONFIG blocks/catalog [Sprint 22], mapPins anchor-stable pins/user-dot [Sprint 20], mapStack keyless tiles/routing/geocode/TTLs/attributions [Sprint 19], earlyAdopter badge key/defaults/validation/labels, reviews/SITE_REVIEWS, carousel, shareRoute, routeDrafts, routeRequest, toast, postActions, postSubmit, moderation incl. immutablePostFields, notifications incl. DISLIKE/NEW_ROUTE, inviteConfig points-cap policy, navigation incl. isAdminRole, errorReporting category/endpoint/caps/copy, footer layout)
│   │   ├── db/              → Database layer (prisma.ts, redis.ts)
│   │   ├── hooks/           → Server-compatible custom React hooks
│   │   ├── schemas/         → Zod validation schemas
│   │   ├── streams/         → Reactive streams
│   │   ├── types/           → TypeScript type definitions
│   │   ├── integrations/    → External service clients (transact, tega)
│   │   └── utils/           → 11 utility modules (blog, pushClient [Sprint 27: env guards + in-gesture permission + detailed reasons], siteConfig, etc.) + emailSanitize (allowlist/escape) + emailBuilder (blocks↔HTML↔text lossless) + emailTemplates (escaped interpolation, shared defaults) [Sprint 22]
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
| `app/lib/config/pwa.ts` | PWA policy registry (caches, precache, push mirror, heartbeat) | versioned cache names, predicates, PWA_PUSH_MIRROR, toast copy |
| `app/components/pwa/` | Offline/push UI (banner, cached notice, push opt-in, SW registrar) | OfflineBanner, CachedDataNotice, PushManager, ServiceWorkerRegistrar |
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
