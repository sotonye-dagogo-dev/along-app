# System Architecture

> **Metadata**
> - last-updated-by: execute-command 2026-10-10 (Sprint 31 universal share + dynamic trust)
> - last-verified-against-code: 2026-10-09 (static re-reads incl. routeValidation/config-barrel/modal/submits/APIs; no node_modules in runner — full tsc/jest/build deferred to CI/Vercel)
> - staleness-policy: re-verify before trusting if any architecture-affecting commits have been made since last-verified-against-code

> **Overview:** Along is a single Next.js 15 application serving both frontend and API routes. The architecture follows a layered pattern: Next.js App Router (pages + layouts) on top of API routes, which delegate to an OOP service layer using the repository pattern, backed by PostgreSQL via Prisma and Redis for caching. The frontend uses a universal component library (App* wrappers around Ant Design) with context-driven state management. The application is PWA-enabled with offline support and push notifications.

---

## Architecture Diagram

```
Client (Browser / PWA)
         ↓
    Next.js 15 App Router
    ┌──────────────────────────────┐
    │   Pages & Layouts            │
    │  (auth, dashboard, admin,    │
    │   public: faq, blog, etc.)   │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   UI Components              │
    │  (42 App* files ← Tailwind +   │
    │   Lucide; antd dep unused)     │
    │  (AppLogo, GuestBanner,      │
    │   OfflineIndicator, etc.)    │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   Context Providers          │
    │  (Auth, OnlineStatus, Push,  │
    │   GlobalModal, GlobalToast,  │
    │   CookieConsent)             │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   API Routes (REST)          │
    │  Zod validation, JWT auth    │
    │  /api/push/* (subscriptions) │
    │  /api/workers/* (QStash)     │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
     │   Service Layer              │
     │  18 services including:        │
    │  pushSubscriptionService     │
    │  qstashService               │
    │  offlineQueue (client-side)  │
    │  undoService, toastService   │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │   Data Layer                 │
    │  Prisma ORM / Redis          │
    │  (siteConfig read-through)   │
    └──────────┬───────────────────┘
               ↓
    PostgreSQL  /  Upstash Redis  /  External APIs
    (primary)      (cache/queue)   (Cloudinary, Resend, web-push,
                                    MapLibre tiles, QStash workers)
```

---

## Module Breakdown

| Module | Responsibility | Key Files | Dependencies |
|--------|----------------|-----------|--------------|
| Auth | JWT-based authentication, registration, login, OTP, rate limiting, edge JWT verification via jose; referrals honored on email register (`?ref=` + body fallback) and Google OAuth (`state=ref:`, new + first-time-OAuth signups) via shared `referralService` (unlimited linking, send-credit cap); register isolates referral resolution + reward fan-out so a bad/stale `?ref=` can never fail signup (P2003 FK race retries once without the link); `/api/invite` backfills missing `inviteCode` for legacy rows so links never render `?ref=null`; welcome email fires on ALL signups (email register unconditional + Google callback fire-and-forget, toggle-respecting); `POST+PUT /api/auth/verify-email` (trigger gated on unverified → OTP+link via verifyEmail template; per-email 60s cooldown shared with otp/resend, honest sent/expiresIn payloads, PUT rate-limited + 5-attempt revoke; confirm flips verified + VERIFIED notification), `POST+PUT /api/auth/change-email` (authed, uniqueness-checked, per-user 60s cooldown + PUT rate-limit + 5-attempt revoke, OTP binds `newEmail::otp` in otpStore + `EmailOtpToken` mirror, flips email+verified), `POST /api/auth/change-password` (hasPassword-only; Google-only first credential stays in link/password add-flow; changes send a security notice); OTP register/resend/verify share `otp:{email}` with sidecar cooldown/attempt keys (`AUTH_VERIFICATION_CONFIG`: 900s TTL, 60s cooldown, 5 attempts, masked-email + newest-only copy; `useOtpResend` hook owns the server-adopted client timer) + durable `EmailOtpToken` Postgres mirror (single-active per email+purpose; issuance writes best-effort in parallel, verification falls back to DB on Redis miss so fresh codes never read as expired); public `app/(public)/verify-email/page.tsx` serves every emailed verify link (`?email=` prefill, `?otp/?code/?token` box prefill, PUT verify without login) | `app/(auth)/`, `app/(public)/verify-email/`, `app/lib/services/auth*`, `app/lib/services/emailOtpStore.ts`, `referralService`, `middleware.ts`, `app/lib/utils/rateLimit.ts`, `app/lib/config/authVerification.ts`, `app/lib/hooks/useOtpResend.ts`, `app/api/auth/{verify-email,change-email,change-password,otp*}` | Prisma, jsonwebtoken, jose (edge), bcrypt, Redis, in-memory rate limit Map |
| Feed | Social feed with posts, comments, likes, bookmarks. Sprint 30: `GET /api/posts` enriches `_isLiked`/`_isBookmarked` viewer-scoped (batch Like/Bookmark, never-throw) so profile tabs match the feed; profile mutations mirror into `feedStream.applyInteraction` (feed↔profile parity); PostCard re-syncs icons from fresh props | `app/(dashboard)/`, `app/lib/services/feed*` | Prisma, Redis (cache) |
| Maps | Keyless-first visualization: MapLibre GL renderer (OpenFreeMap vector primary, keyless raster step-down via shared `MAP_STACK_CONFIG` style stack, onError fallback walk; dark keeps light visual params verbatim — `darkCanvasFilter: "none"`, dark raster mirrors light); anchor-stable numbered pins via shared `MAP_PINS_CONFIG` + `MapRoutePin`/`MapUserDot` (center anchor, zero offset, 1-based stop numbers, info-blue user dot with glory ring + radar ping, token classes only); routing OSRM-first via cached server proxy (`mapProxyService`: OSRM → env-gated ORS/Mapbox → straight-line guarantee); geocoding ONLY via `/api/maps/*` proxy (Nominatim server-side + Photon fallback) — browser-direct upstream calls banned; `routeTracingService` is a thin validating delegate over the proxy; explore share uses Web Share → clipboard → execCommand fallback with toasts (mobile button tracks sheet height); user dot is passive mount-time + watchPosition (no view jump, movement-tracked, soft-fail denials). Sprint 23 hardening: `maplibre-gl.css` imported by RouteMap + explore (missing CSS unseats markers); origin/destination dots snap to road-traced polyline endpoints (`MAP_PINS_CONFIG.snapEndpointsToPolyline`, intermediates stay exact); stable module-level mapLib promise (fresh `import()` per render re-inits the map mid-interaction); content-keyed memoized pins/coords/bounds so the fit effect never yanks the camera on re-render; shared `useUserLocation` hook (config-driven timeouts) feeds explore (manual Near-me override kept) + post-detail passive dot (live-nav fix takes precedence); explore map is controlled (`onMove` tracks drag, `onMoveEnd` persists URL). Sprint 28 route-accuracy: POST `/api/posts` persists `waypoints` (previously dropped — the start→destination skip); canonical `buildRoutePinsFromPost` (origin + intermediates + destination, `lib/config/routePins.ts`) consumed by PostCard + post detail; post detail fetches a road-snapped trace via shared `useRouteTrace` (preview pipeline) with bounded geocode backfill for legacy waypoint-less rows; live navigation is a floating overlay (`LiveNavigationModal`: 92dvh panel, map + guide together, `LIVE_NAVIGATION_CONFIG`) instead of an inline guide; RouteMap `height` accepts CSS strings | `app/components/features/map*` (RouteMap, MapPins, RouteStepInput, ShareRouteModal, NavigationGuide), `app/(dashboard)/explore/page.tsx`, `app/(dashboard)/posts/[id]/page.tsx`, `app/lib/hooks/useUserLocation.ts`, `app/api/maps/{route,geocode,reverse}`, `app/api/routes/trace` (delegate), `app/lib/services/mapProxyService.ts`, `app/lib/config/{mapStack,mapPins}.ts` | MapLibre GL, supercluster, polyline, Redis (proxy caches) |
| Notifications | LIKE/DISLIKE/COMMENT (author), MENTION (@usernames in comments, create + edit-diff), FOLLOW, WELCOME (allowSelf), ROUTE_REQUEST/NEW_ROUTE fan-out to followers, ROUTE_RESPONSE to request author, REFERRAL conversion to inviter (`@user signed up through your referral`), REWARD points + BADGE tier-up to earner (via rewards worker); nav badges via `useUnreadNotifications` (60s poll, `NOTIFICATION_BADGE_CONFIG`, mobile tab + desktop sidebar); real-time + push via Web Push API | `app/lib/services/notificationService.ts`, `mentionService.ts`, `app/lib/hooks/useUnreadNotifications.ts` | Prisma, web-push, QStash |
| Admin | Dashboard, user management, site config, bug reports; stats API returns `recentUsers` preview in the same batched read (dashboard page null-tolerates older payloads); admin entry points (desktop sidebar section, profile Quick Links) gated by canonical `isAdminRole()` (case-insensitive — DB enum is `USER`/`ADMIN`); users PATCH supports `verify`/`unverify`/`resend-verification` actions (user notified, undo snapshot, honest emailed/errors) with Email-status column + row/bulk actions in the UI | `app/(admin)/`, `app/api/admin/stats`, `app/api/admin/users` (PATCH actions), `app/admin/users/page.tsx`, `app/components/ui/DashboardNav.tsx`, `app/(dashboard)/profile/page.tsx`, `app/lib/config/navigation.ts` | Prisma, Sentry |
| Search | Unified posts + users + tags search: `GET /api/search` (q/type/region/postType/cursor), `searchService.ts`, guest-accessible `/search` page (fixes SuggestionsPanel dead links) | `app/api/search/`, `app/lib/services/searchService.ts`, `app/(dashboard)/search/` | Prisma (contains/insensitive, P2022 fallback), Redis (unified cache 120s), rate-limit `search` bucket |
| Profile | User profiles, follower/following system, per-tab filtering (posts/routes/requests/liked/bookmarks/archived-owner-only), rewards, early-adopter badge ("First N Users #n" via `EarlyAdopterBadgeFromStatus`, backed by `earlyAdopterService` rank from `User.createdAt`); secondary account tab group (Connected/Points/Email & Security/Danger zone, same tab pattern) with quick-links grid bridging both tab sections; `EmailSecurityPanel` (verify resend+confirm gated on unverified, change-email always, change-password hasPassword-only; Sprint 23 removed the empty dead `if` that tripped TS's no-overlap comparison and failed the Vercel type gate) | `app/(dashboard)/profile/*`, `app/api/users/[id]/follow*`, `app/api/users/[id]/followers`, `app/api/users/[id]/following`, `app/api/users/[id]/early-adopter`, `app/api/users/early-adopters`, `app/api/bookmarks/`, `app/components/features/profile/{UserList,EarlyAdopterBadge,EmailSecurityPanel}.tsx` | Prisma (Follow, Bookmark models), Cloudinary |
| Email | Config-driven transactional + custom sends: shared wrapper (`composeEmailDocument/Text` — logo via absolute `logoUrl` default var, header/body/CTA/footer; EVERY default template heads with `<img src="{{logoUrl}}" alt="{{appName}}">`, no legacy SVG motif), `EMAIL_ICONS` inline SVG (emoji only as last-resort fallback map), `EMAIL_BUILDER_CONFIG` (8 blocks, presets, 25-var catalog, visual/html/text modes), `emailBuilder.ts` lossless blocks↔HTML↔text (`htmlToBlocks` strips inline tags → plain-text paragraphs, handles div/td wrappers, image blocks carry src+alt with `{{appName}}` default), `emailSanitize.ts` allowlist + escaping + `parseVarToken` fallback syntax; interpolation escapes HTML values, supports `{{name||fallback}}` (quoted or bare), missing vars → "" (never literal `{{ident}}`), shared defaults injected; `ensureEmailDocument` auto-wraps builder fragments so saved customs keep card styling in preview + sends (full docs pass through); `sanitizeStoredBody` protects `{{vars}}` incl. fallbacks with `#`-fragment tokens so var-bearing href/src survive the URL allowlist; text twin regenerates from NEW html on save (no stale bodyText); every send toggle-respecting + sanitized + audited in EmailLog; Studio page (blocks editor w/ image thumbnails, in-place text, raw HTML, debounced LIVE unsaved preview w/ saved/live badge + server-parity renderer, per-var composer, select-search recipients via `/api/admin/users?q=`); preview API: GET stored render (samples via `getAppUrl`, never localhost) + POST draft render; all link builders (`google/*`, `forgot-password`, `verify-email`, `change-email`, deletion service, `buildWelcomeVars`) resolve origins via `getAppUrl()` (prod → https://www.alongng.com); wired-in: otp/welcome(all auth)/passwordReset/verifyEmail/changeEmail/changePassword/contact/bug/deletion-lifecycle | `app/lib/config/{email,emailManagement}.ts`, `app/lib/utils/{emailTemplates,emailSanitize,emailBuilder}.ts`, `app/lib/services/emailService.ts`, `app/api/admin/email/*`, `app/api/email/preview/`, `app/admin/email/` | Prisma (SiteConfig, EmailLog), Resend, Redis (siteConfig cache) |
| Env | Single source of truth `lib/config/env.ts`: effective env = PROJECT_ENV when set else NODE_ENV; `isProduction()` gates cookies/dev-logs/strict secrets/DB precedence; `getAppUrl()` never empty; prisma layer + email service consume it | `app/lib/config/env.ts`, `app/lib/db/prisma.ts`, `app/lib/services/emailService.ts` | None |
| Rewards | Gamification: tiers, badges, points | `app/lib/services/rewards*` | Prisma |
| ValidityEngine | Dynamic route verification and trust scoring: `evaluate` takes votes + canonical `computeRouteDetailScore` + `computeSimilarityRatio` + author reputation (log-scale followers, verified, account age) + engagement depth (comments/bookmarks/views/shares) + open-report pressure (additive bonus/penalty weights in `DEFAULT_VALIDITY_CONFIG` + `VALIDITY_SIGNAL_BOUNDS`; legacy 4-signal scores unchanged when new inputs are absent); POST /api/posts scores synchronously at insert (no optimistic flash); `validity-recompute` worker reloads full signals via the canonical `trustBreakdownService`; recompute re-queued (fire-and-forget, bounded) on like/bookmark/comment/edit/report/follow-unfollow; EVERY read surface (list/feed/guest-feed/search/suggestions/bookmarks/detail) ships the SAME live `validityBreakdown` from `trustBreakdownService` (single + batched paths, identical inputs/engine) with live score/tier overwriting the stored row, so feed card == detail on every shared row; `TrustBadge` `variant?` compact (feed: 4 rows) vs full (detail: 6 rows) from `TRUST_DISPLAY_CONFIG`, badge number + tier re-derived from `breakdown.score`, legacy placeholder fallback only | `app/lib/services/ValidityEngine.ts`, `app/lib/services/trustBreakdownService.ts`, `app/lib/config/validityConfig.ts`, `app/lib/config/trustDisplay.ts`, `app/api/posts/`, `app/api/posts/feed/`, `app/api/posts/[id]/`, `app/api/bookmarks/`, `app/api/suggestions/`, `app/lib/services/feedService.ts`, `app/lib/services/searchService.ts`, `app/api/workers/validity-recompute/`, `app/components/ui/TrustBadge.tsx`, `app/components/features/posts/PostCard.tsx` | Prisma, Redis |
| DraftingCoach | AI-assisted post composition guidance | `app/lib/services/drafting*` | N/A (rule-based) |
| PWA | Offline-first v4 SW (navigation preload, network-first pages + cached-destinations fallback, SWR API/image/keyless-tile runtime caches with LRU bounds, never-cache auth/push/admin, bg-sync handshake, push actions + focus-or-open; v4 adds `/locales/` cache-first branch + precached dictionaries + `/api/{config,reviews}` cacheability), hardened manifest (id/scope/launch_handler, any+maskable icons), token-styled offline page, heartbeat offline detection + offline/online toasts + collapsible banner (persisted, i18n copy)/registrar, `/api/health`, policy in `app/lib/config/pwa.ts` | `public/sw.js`, `public/manifest.json`, `public/offline.html`, `app/lib/config/pwa.ts`, `app/components/pwa/*` | Web Push API, Cache API |
| Push Notifications | Browser push subscription and delivery, now fan-out mirrored from every in-app notification (VAPID direct, 410 prune, never throws, unknown-type fallback) + event-handled opt-in UI: `pushClient` env guards + in-gesture permission request + detailed reasons (boolean wrapper kept), `PushManager` local enabled/dismissed flags (7-day TTL) + per-outcome guidance incl. iOS, `PushProvider` granted-only auto-subscribe, `PUSH_PROMPT_CONFIG` registry | `app/api/push/*`, `app/lib/services/pushSubscriptionService.ts`, `app/lib/services/pushSender.ts`, `app/providers/PushProvider.tsx`, `app/components/pwa/PushManager.tsx`, `app/lib/utils/pushClient.ts`, `app/lib/config/pushPrompt.ts` | Prisma, web-push, QStash |
| QStash Workers | Background job processing (feed, rewards, validity) | `app/api/workers/*`, `app/lib/services/qstashService.ts` | QStash SDK, Prisma, Redis |
| Offline Queue | Client-side mutation queue with auto-flush + offline gating (`requireOnline`) and sanitized offline copy; session-preserving auth (only double-401 clears) | `app/lib/services/offlineQueue.ts`, `app/lib/utils/offlineGuard.ts`, `app/providers/OnlineStatusProvider.tsx`, `app/providers/AuthProvider.tsx` | localStorage, fetch |
| Blog | Public blog with MDX posts, categories, featured posts | `app/(public)/blog/*`, `app/lib/utils/blog.ts`, `app/lib/config/blog.ts` | fs (build-time), MDX, remark |
| Transact | [FROZEN] External marketplace integration — code preserved, nav removed | `app/lib/integrations/transact.ts`, `app/api/integrations/transact/`, `app/api/webhooks/transact/`, `app/(dashboard)/marketplace/` | Prisma, QStash (webhook) |
| Tega | [FROZEN] External events integration — code preserved, removed from sidebar | `app/lib/integrations/tega.ts`, `app/api/integrations/tega/`, `app/api/webhooks/tega/`, `app/components/features/events/` | Prisma, QStash (webhook) |
| FAQ | Public FAQ page with categorized searchable Q&A (incl. Routes & Posts: share gating/validation + draft-on-failure; Maps & Navigation: tracings/pins + mobile zoom/move; report flow via in-post Report dialog; Offline & App: offline scope, cached-page fallback, install, push mirroring, session preservation; Reviews: how to leave/what happens next/where to read) + pidgin overrides in `FAQ_PCM` applied when locale is pcm | `app/(public)/faq/*`, `app/lib/config/faq.ts` | None (config-driven) |
| i18n | Dictionary i18n (en/pcm, 235 keys, parity-tested incl. interpolation): `I18nProvider` seeds from bundled EN + localStorage last-good + network revalidation, syncs `along-locale` cookie for middleware SSR agreement, `t()` + `tf(key, fallback)` (config literals as fallback, never raw keys); toggle via `LocaleSwitcher` (footer); wired through post actions, menus, footer (`i18nKey`), landing islands, About/FAQ/leaderboard/invite/feed | `app/lib/config/i18n.ts`, `public/locales/{en,pcm}.json`, `app/providers/I18nProvider.tsx`, `app/components/ui/{LocaleSwitcher,AppFooter,LandingCtas}`, `app/(public)/LandingCopy.tsx` | localStorage, SW precache |
| Platform Reviews | User-facing ratings: `GET/POST /api/reviews` on `UserReview` self-pair marker (one-per-user ACID upsert, PENDING moderation, `mine`/`authorId`/cursor, edge-cached, `reviews` rate-limit bucket); `ReviewsPanel` (form + guest gate + FAQ + list) on own (`reviews` tab + `#reviews` deep link) and other (read-only, author-scoped) profiles; About real-reviews tape + CTA cadence; `notifyReviewThanks` (REWARD+allowSelf, no email, REVIEW push mirror); archiving anonymizes (null-safe `reviewAuthorName`, admin never crashes) | `app/api/reviews/`, `app/components/features/reviews/`, `app/lib/config/reviews.ts`, `app/(public)/about/AboutPageClient.tsx`, `app/(dashboard)/profile/` | Prisma (UserReview), notificationService |
| Config | Centralized config registries for all domains (51 files incl. index.ts: authVerification (OTP TTL/cooldown/attempts/copy/maskEmail [Sprint 27]) + pushPrompt (storage keys/dismiss TTL/outcome copy/iOS detect [Sprint 27]), routeSteps destination no-fare/no-vehicle rule + normalize [Sprint 23], routeValidation composer/fare/sanitize validators [fix-build 2026-10-09], mapPins (anchor-stable numbered pins + user dot, token-only; Sprint 23 endpoint-snap + tracking timeouts) + reviews registry (`REVIEWS_CONFIG`, `insertReviewCtaPanels`, `reviewAuthorName` [Sprint 25]; SITE_REVIEWS retained, retired from About display), carousel, shareRoute, postSubmit, routeDrafts (Sprint 20 update-in-place labels/prompt), routeRequest, toast, postActions, moderation incl. `immutablePostFields`, notifications incl. DISLIKE/NEW_ROUTE, earlyAdopter badge (`EARLY_ADOPTER_CONFIG_KEY`, label template, validation), navigation incl. `isAdminRole`, errorReporting (category/endpoint/caps/copy/sanitize patterns), footer (layout + optional `i18nKey` [Sprint 25]), faq (`FAQ_PCM` pidgin map [Sprint 25]), rateLimits (`reviews` bucket [Sprint 25]) + profilePosts (avatar/interaction fields, token pill classes, cache keys [Sprint 30])) | `app/lib/config/*` | None |
| Early Adopters | Config-driven "First N Users #n" badge: `earlyAdopterConfig` SiteConfig row (enabled/limit/badgeLabelTemplate, seeded, admin-editable with validation + cache invalidation) → `earlyAdopterService` (join rank by `User.createdAt` asc + id tie-break, Redis-cached; `listEarlyAdopters` for filtering/rewards tooling) → badge on own + other profiles (`earlyAdopter` embedded in user APIs), public per-user + list endpoints, `?earlyAdopter=true` admin user filter | `app/lib/config/earlyAdopter.ts`, `app/lib/services/earlyAdopterService.ts`, `app/api/users/[id]/early-adopter/`, `app/api/users/early-adopters/`, `app/api/admin/{config,users}`, `app/admin/config/page.tsx` (badge card), `app/components/features/profile/EarlyAdopterBadge.tsx` | Prisma (User.createdAt, SiteConfig), Redis (rank + config cache) |
| Route Requests | Request/response post lifecycle: PostType enum (ROUTE/ROUTE_REQUEST/ROUTE_RESPONSE), quotedPost self-relation, fan-out notifications, Respond CTA; ShareRouteModal starts with preview + quality score collapsed and actions in a footer below them (`SHARE_ROUTE_MODAL_CONFIG`); query-style RequestRouteTrigger icon ("Request?" tooltip) opens the request flow; savable multi-draft library (`ROUTE_DRAFTS_CONFIG`, `routeDraftsService` with legacy migration + `updateDraft` in-place update, `RouteDraftsPanel` restore/continue/update/delete, update-vs-new prompt bar, home resume chip); response composer has a generic description input (feeds the quality-score checkpoint), inherits request tags, and drafts persist the response linkage (`responseTo` ref + badge); submit is double-click-safe (`isSubmitting` disabled buttons + spinner, per-session `clientMutationId` → `X-Idempotency-Key` replay-or-409 via `idempotencyService`, atomic single-statement create — `POST_SUBMIT_CONFIG`) | `app/components/features/posts/RequestRouteModal.tsx`, `RequestRouteTrigger.tsx`, `RouteDraftsPanel.tsx`, `ShareRouteModal.tsx` (response mode), `PostCard.tsx` (badge/quote block), `app/api/suggestions/`, `app/api/posts/` | Prisma, Redis (suggestions 1800s), QStash |
| Post Actions | Shared overflow menu (copy-link, report, edit, archive/unarchive, delete) on feed cards AND individual post views; universal post share — `postShareService` (buildPostUrl/sharePostLink: Web Share → clipboard → legacy textarea, never throws) + `usePostShare` hook (config-driven toasts) consumed by feed, search, post detail (top bar + engagement bar), profile tabs (via deduplicated `ProfilePostCard`), bookmarks, and as the `PostCard` fallback when `onShare` is omitted (override prop kept); share URL shape + copy in `POST_ACTIONS_CONFIG` (shareLabel/shareTitleDefault/postPath); owner edit via ShareRouteModal edit mode (PATCH strips `type`/`quotedPostId` so nature is immutable); destructive actions via global confirm modal + global undo toast with snapshot-restore replay (`postModerationService`, `PostMenu`, `ReportDialog`); report reasons/labels in `POST_ACTIONS_CONFIG`; route requests never render map/navigation/trust (`MODERATION_CONFIG.routeRequestHides`); destination-step rule — the final route step IS the destination, so fare/vehicle are hidden there in composer + PostCard + post detail + NavigationGuide (metadata-driven `ROUTE_STEPS_CONFIG` + `isDestinationStep`/`showStepFare`/`showStepVehicle`) and stripped from payloads client-side (composer submit) and server-side (`normalizeRouteSteps` in POST + PATCH backstop for old clients/legacy rows); validation is config-driven (`ROUTE_VALIDATION_CONFIG` + `validateRouteComposer`/`parseFareInput`: every visible step requires a location, fare ranges rejected with guidance, inline `border-error-border` boundaries + form banner, Share disabled until valid, drafts never cleared on failure, sanitized `firstRouteServerMessage` toasts on all submit/edit paths); composers only succeed on explicit `true` (void/no-op handlers keep the modal open with input + draft preserved — guards the sidebar vanish class); every ShareRouteModal mount POSTs (`home` submitPost + `DashboardNav` sidebar submit with idempotency header + feed refresh); server friendly `message` alongside `details` with warn logging | `app/components/features/moderation/`, `PostCard.tsx`, `ShareRouteModal.tsx` (edit mode), `app/api/reports/`, `app/api/posts/` (list multi-type + archived-owner filter, archive/admin/responses), `home/page.tsx` (`submitPost`), `app/components/ui/DashboardNav.tsx` (sidebar submit), `posts/[id]/page.tsx` (menu/responses/tombstone) | Prisma, clipboard |
| Moderation | End-to-end report lifecycle: dedicated `POST /api/reports` (transactional dedup → 409, receipt notification to reporter + triage notification to admins); admin Dismiss/Hide/Remove in one transaction with outcome notification; anonymity kept both ways (author never learns reporter, admin identity never exposed); archived posts excluded from feed/search/suggestions/sitemap with P2022-tolerant fallbacks; migration `20261008000000_post_moderation` adds `Post.isArchived/archivedAt` + `NotificationType` REPORT/MODERATION | `app/api/reports/`, `app/api/admin/bugs/` (action), `app/api/admin/posts/` (archive + delete-with-snapshot), `app/admin/bugs/` (Reports filter + triage), `app/admin/posts/` (hide/restore + undo), `feedService`/`searchService` safe-wrappers | Prisma, notificationService |
| Error Reporting | Error boundaries file real `BugReport` rows (category OTHER) with a sanitized capture (message/stack/route/digest — emails, tokens, passwords redacted, path-only, caps enforced) via `errorReportService` (never throws, `{ reported }` result); boundaries render honest copy from `ERROR_REPORTING_CONFIG.copy` (pending/reported/unreported) so "team notified" is only claimed after a 2xx persist | `app/global-error.tsx`, `app/error.tsx`, `app/lib/config/errorReporting.ts`, `app/lib/services/errorReportService.ts`, `app/api/bug-reports/` | fetch, Prisma (via bug-reports API) |
| Toasts | Single-timer toasts: GlobalUndoToast owns auto-close + progress bar from one duration (`TOAST_CONFIG`); provider remounts per toast so the bar fully elapses; like/dislike are undo-toast-free by design (success note on like only), undo stays for bookmark/delete-class actions | `app/providers/GlobalToastProvider.tsx`, `app/components/ui/GlobalUndoToast.tsx`, `app/lib/services/toastService.ts` | None |
| Suggestions | Ordered discovery: route requests → routes → accounts; live desktop panel + mobile rail (above the home feed, below the share/request trigger div) + endless carousel (scroll-based rAF `scrollLeft` autoplay in its own overflow-hidden wrapper — free scrub both directions, resumes from landed position, mouse-only hover pause, item-set `repeat` capped by `ENDLESS_CAROUSEL_CONFIG.maxRepeat` so the tape overflows with few cards; `ENDLESS_CAROUSEL_CONFIG`); About reviews reuse the same wrapper with real moderated platform reviews (`GET /api/reviews`) + interleaved `ReviewCtaPanel` (end / midpoint / every-10 cadence) [Sprint 25] | `app/components/ui/SuggestionsPanel.tsx`, `app/components/features/suggestions/{EndlessCarousel,SuggestionsRail,FollowButton}.tsx`, `app/(public)/about/AboutPageClient.tsx`, `app/api/suggestions/`, `app/api/reviews/` | Prisma, Redis |
| Client Cache | In-app read-through cache + SWR + in-flight dedup; hydrates feedStream without skeleton flash | `app/lib/cache/memoryCache.ts`, `app/lib/hooks/useCachedFetch.ts`, `app/lib/streams/feedStream.ts` | None (in-memory; mirrors redis.ts never-throw semantics) |
| Seed Tooling | Manual-only seed backup/clear/restore scoped to seed markers; full prod reset script (`scripts/reset-prod-db.ts`, `db:reset-prod`) RETAINED for manual use but UNHOOKED from `vercel-build` (2026-10-08, after the clean-DB build confirmed — builds no longer wipe the DB) | `scripts/{backup-seed-data,clear-seed-data,restore-seed-backup,reset-prod-db}.ts`, `db:seed`/`db:backup`/`db:clear-seed`/`db:restore-seed`/`db:reset-prod` | Prisma, tsx |

---

## Data Flow

### Standard Request Flow
```
Browser → Next.js Route Handler (page.tsx)
  → Client component mounts → calls API route (fetch/axios)
    → API route (route.ts) validates with Zod
      → Service method (business logic)
        → Repository/Prisma query
          → PostgreSQL response
        → Redis cache check/set
      → JSON response
    → Client component renders with data
```

### Authentication Flow (Server-Side)
```
Login → POST /api/auth/login
  → Rate limit check (in-memory Map, 10 req/15min per IP)
  → Validate credentials with Zod
  → Verify password with bcrypt
  → Generate JWT token (jsonwebtoken)
  → Set httpOnly cookie
  → Return user profile
  → Client stores session via AuthProvider context
  → Subsequent protected page loads: middleware.ts verifies JWT via jose (edge-compatible)
  → Expired token → /api/auth/refresh → new access token
```

### Data Persistence Flow
```
Write operation → API route
  → Zod validation (input sanitization)
  → Service method (business rules)
  → Prisma transaction (ACID)
  → Invalidate related cache keys in Redis
  → Return created/updated entity
  → On failure: rollback transaction, log to Sentry
```

---

## Configuration Points

| Config Key | Purpose | Location | Default |
|------------|---------|----------|---------|
| DATABASE_URL | PostgreSQL connection | .env | — |
| JWT_SECRET | JWT signing key | .env | — |
| JWT_EXPIRES_IN | Token expiration | .env | 7d |
| PROJECT_ENV | Deployment stage — **wins when set** (`lib/config/env.ts` `getEffectiveEnv`) | `app/lib/config/env.ts` | `development` |
| NODE_ENV | Node runtime env (Next.js sets) — fallback when PROJECT_ENV unset; never consulted directly for env decisions (use `isProduction()`/`getEffectiveEnv()`) | `app/lib/config/env.ts` | `development` |
| UPSTASH_REDIS_REST_URL (alias REDIS_URL) | Upstash Redis connection — lazy singleton with 1.2s timeout, fallback to memory/DB | .env | — |
| CLOUDINARY_URL | Cloudinary image upload | .env | — |
| RESEND_API_KEY | Email service | .env | — |
| SENTRY_DSN | Error tracking | .env | — |
| VAPID_PUBLIC_KEY | Web Push public key | .env | — |
| VAPID_PRIVATE_KEY | Web Push private key | .env | — |
| QSTASH_TOKEN | QStash worker token | .env | — |
| NEXT_PUBLIC_MAPBOX_TOKEN | Map routing override (OPTIONAL — keyless OSRM/straight-line is the default; only consulted server-side when set) | .env | — |
| NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN | Mapbox alias (same optional-override purpose) | .env | — |
| NEXT_PUBLIC_MAPTILER_API_KEY / NEXT_PUBLIC_MAPTILER_STYLE_URL | MapTiler tiles/style (OPTIONAL override only — keyless OpenFreeMap is the default) | .env | — |
| NEXT_PUBLIC_CARTO_API_KEY (alias NEXT_PUBLIC_CARTO_KEY) | Carto basemap key (OPTIONAL — plain keyless Carto is the default; no `?apiKey=` is ever sent) | .env | — |
| RATE_LIMIT_WINDOW | API rate limit window (ms) | `app/lib/config/rateLimits` | 60000 |
| RATE_LIMIT_MAX | Max requests per window | `app/lib/config/rateLimits` | 100 |
| RATE_LIMITS.maps | Map proxy bucket (60 req/min per IP; covers /api/maps/*) | `app/lib/config/rateLimits` | 60/min |
| CACHE_TTL | Default Redis TTL (s) | `app/lib/config/cache` | 300 |
| ENABLE_DESIGN_VIEWER | Mounts the dev-only design-asset viewer at `/__design/*`; must be false in production builds | .env | false |

All config points listed here should follow the fallback discipline from `standards/engineering-principles.md` §1 and §3 — every config-driven value must have a documented, safe fallback so the system degrades gracefully if the value is missing or malformed.

---

## Verification CLI (agent-verifiable behavior)

If the project exposes a CLI for observing/verifying application behavior end-to-end (engineering principle §24), list its commands here so agents know it exists before reaching for a manual check:

| Command | What it proves | When to use |
|---------|---------------|-------------|
| [none currently] | — | — |

The project currently has no agent-extensible verification CLI. `npm run build` / `npx tsc --noEmit` / `npm test` / `npx next lint` are the available ground-truth checks; a dedicated verification CLI is a candidate per §24 if new verification needs recur.

---

## Rollback & Undo (deployment level)

This is the "undo" instinct applied one layer up from data (§22 covers user-facing undo; this covers deployments). Document the project's actual rollback mechanism here so `commands/fix-build.md` knows it exists as an escalation option, not just "fix forward":

- **Previous-build promotion** — Vercel preview/production re-deploy of the last known-good build.
- **DB migration reversibility** — Prisma migrations are down-migratable; `prisma migrate down`/reset recover prior schema state.
- **Feature-flag kill switch** — no explicit flag system yet; rollback is by redeploying the previous build.

If the project has no documented rollback mechanism, say so explicitly here — that is itself a known constraint.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.3.5 |
| UI Library | React | 19.1.0 |
| Language | TypeScript | 5.x |
| UI Components | Ant Design | 5.23.3 |
| Styling | Tailwind CSS | 4.1.7 |
| ORM | Prisma | 7.2.0 |
| Database | PostgreSQL | — |
| Cache | Upstash Redis | 1.35.8 |
| Auth | JWT (jsonwebtoken + jose + bcrypt) | 9.0.3 / 6.0.1 / 6.0.0 |
| Validation | Zod | 4.2.1 |
| Maps | MapLibre GL + react-map-gl | 4.7.1 / 7.1.9 |
| Error Tracking | Sentry | 10.51.0 |
| Images | Cloudinary | — |
| Email | Resend | 3.2.0 |
| Push | Web Push API + web-push | 3.6.7 |
| Workers | QStash | 2.7.9 |
| Icons | Lucide React | 0.469.0 |

---

## Known Constraints & Technical Debt

- Prisma schema is PostgreSQL-specific — not portable to SQLite or MySQL
- Tailwind CSS v4 uses the new `@tailwindcss/postcss` plugin — v3-style `@tailwind` directives will not work
- Dual PostCSS config files exist (`postcss.config.js` CJS + `postcss.config.mjs` ESM) — may cause confusion
- Sentry DSN and all secrets are populated in `.env` — must not commit or expose
- 282 Jest tests across 32 suites incl. mutation E2E + posts API (multi-type/archived/nature) + search API/service + mention/referral/leaderboard + uxTightening config + routeDrafts config/service + postSubmit config/idempotency + mapStack config/proxy + mapTightening pins/dark/drafts/faq (per 2026-10-09 Sprint 20; full gate green in-runner) + 17 new emailStudio suites cases (interpolation/sanitize/builder/wrapper/env — Sprint 22, CI to confirm green) + Sprint 23: routeSteps destination-rule suite (5), mapTightening snap/tracking assertions (2), emailStudio fully green in-runner (20/20 incl. sanitize href-var preservation) + Sprint 27: `authVerificationPush.test.ts` (6: registry/keys/mask/copy/pushPrompt/iOS — CI to confirm green, runner has no node_modules)
- `tsconfig.json` no longer sets `downlevelIteration` (removed 2026-10-08: option deleted in current TS; ES2015 target handles iteration natively)
- Password reset uses durable `PasswordResetToken` DB rows (not Redis OTP) — survives cache loss; fixed Sept 29 "link expired/invalid" false negatives
- Forgot-password email is double-guarded: non-blocking `waitUntil` + Resend send-result check (fixed Sept 16 false-positive "mail sent" with no delivery)
- Coverage thresholds configured: branches 70%, functions 70%, lines 80%, statements 80%
- Prior codebase with Phases 1-7 was removed as part of a planned clean rebuild
- Two `useRequireAuth` hooks exist: one in `app/hooks/` (router-based redirect) and one in `app/lib/hooks/` (permission check) — potential confusion
- Blog posts are read from the filesystem at request time (no CMS integration yet)
- `app/lib/streams/feedStream.ts` now implements RxJS reactive feed with 30s polling
- Image upload is now Cloudinary-backed via `app/api/upload` (multipart, 5MB/file, 10 files max) — requires CLOUDINARY_* env vars; `next.config.mjs` now allowlists only known image hosts (was wildcard `**`)
- QStash workers now use cloned request body to avoid double-consume `request.text()` / `request.json()` race (fixed 500 on every worker invocation)
- Redis layer is now timeout-hardened: `app/lib/db/redis.ts` lazy singleton + `withTimeout(1200ms)`, `otpStore.ts` 800ms fallback to in-memory (cut from 1500ms 2026-10-09 verify-email 504 fix); auth code-send routes (verify-email, otp/resend, register) issue Redis writes in parallel and declare explicit `maxDuration` (30s sends / 15s verifies) instead of the Vercel 10s default; forgot-password email is non-blocking via `waitUntil`

---

## Architecture History

See `memory/architecture-history.md` for full chronology.
