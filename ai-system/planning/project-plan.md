# Project Plan

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: re-verify if project scope or phase changes

> **Overview:** High-level feature checklist for Along — a social travel-intelligence platform for West African urban commuters. Phases follow the Roadmap (docs/ROADMAP.md). Agents update checkboxes as work is completed.

---

## Phase 0 — Ground Zero (Infrastructure)

> **Section summary:** Core infrastructure already in place. Verified during bootstrap.

- [x] Project scaffolded (Next.js 15, TypeScript, Tailwind 4, PostCSS)
- [x] Prisma schema with 14 models and 8 enums created
- [x] Prisma migrations applied (3 migrations)
- [x] Seed script written for development data
- [x] Sentry integration (client, server, edge)
- [x] Jest + RTL testing infrastructure configured
- [x] CI pipeline (build, type-check, test, lint)
- [x] PWA service worker and manifest in place
- [x] Design system (17 HTML design files) complete
- [x] Environment variables and configuration files populated

---

## Phase 1 — Config Registry & Universal Components

> **Section summary:** Foundation layer that all other code depends on. Generate first.

- [x] Config registry files created (25 files in `app/lib/config/`)
- [x] BaseRepository class implemented
- [x] Universal App* component library built (34 components, including AppLogo, GuestBanner, OfflineIndicator)
- [x] Context providers wired (Auth, OnlineStatus, Push, GlobalModal, GlobalToast, CookieConsent)
- [x] Root layout with 6 providers, SEO metadata, Inter font, PWA meta tags
- [x] Global styles (globals.css) with Tailwind v4 theme tokens

---

## Phase 2 — Auth & User Management (Partial)

> **Section summary:** User registration, login, profile management, and JWT auth flow.

- [x] Auth API routes (register, login, logout, refresh, OTP, google, me) in `app/api/auth/`
- [ ] Auth middleware for protected routes and API endpoints
- [x] Auth pages (Login, Register, OTP verification) in `app/(auth)/`
- [x] User profile pages and edit functionality in `app/(dashboard)/profile/`
- [x] Avatar upload config (`app/lib/config/avatar.ts`)
- [ ] Follower/following system

---

## Phase 3 — Core Social Features (Feed & Posts) (Partial)

> **Section summary:** The primary user-facing features — posting routes, feed, interactions.

- [x] Post creation API (`app/api/posts/route.ts`)
- [x] Feed with pagination (`app/api/posts/feed/`, `app/lib/services/feedService.ts`)
- [ ] Like/unlike posts
- [x] Comment system (`app/components/features/comments/`)
- [x] Bookmark/save posts (`app/(dashboard)/bookmarks/`)
- [x] Post detail page (`app/(dashboard)/posts/[id]/`)
- [x] Explore page (`app/(dashboard)/explore/`)
- [ ] Explore page with map view

---

## Phase 4 — Route Intelligence & Verification (Partial)

> **Section summary:** Trust and verification systems that differentiate the platform.

- [x] ValidityEngine for route verification scoring (`app/lib/services/ValidityEngine.ts`)
- [x] DraftingCoach for post quality guidance (`app/lib/services/DraftingCoachService.ts`)
- [x] TrustBadge component for verified reporters (`app/components/ui/TrustBadge.tsx`)
- [ ] Search with full-text Postgres indexes
- [ ] Map integration with route polyline rendering
- [ ] Clustering for dense map markers

---

## Phase 5 — Notifications & PWA (Partial)

> **Section summary:** Real-time engagement and offline capability.

- [x] In-app notification feed (`app/(dashboard)/notifications/`, `app/api/notifications/`)
- [x] Push notification subscription and sending (Web Push API) via `app/api/push/*`, PushProvider, pushSubscriptionService
- [x] QStash background jobs (`app/lib/services/qstashService.ts`, `app/api/workers/*`)
- [x] Offline page and caching strategies (`public/offline.html`, `public/sw.js`)
- [x] Service worker update flow (`public/sw.js`)

---

## Phase 6 — Admin Dashboard & Analytics (Partial)

> **Section summary:** Platform management and business intelligence.

- [x] Admin dashboard with metrics and charts (`app/admin/`, `AdminShell.tsx`)
- [x] User management (`app/admin/users/`, `app/api/admin/users/`)
- [x] Bug report management (`app/admin/bugs/`, `app/api/bug-reports/`)
- [x] User review management (`app/admin/reviews/`)
- [x] Site configuration editor (`app/admin/config/`)
- [ ] Analytics (route activity, user growth, engagement) — dashboard `/analytics` exists but needs content

---

## Phase 7 — Rewards & Gamification (Partial)

> **Section summary:** Incentive system for active contributors.

- [x] Reward tiers and badge system (`app/lib/config/rewards.ts`, `app/lib/services/rewardsService.ts`)
- [x] Points accumulation via `app/api/rewards/`
- [ ] Leaderboards
- [x] Profile trust scoring (integrated with ValidityEngine)

---

## Phase 8 — Quality, Testing & Launch (Partial)

> **Section summary:** Reliability, performance, and production readiness.

- [x] Unit tests for services and utilities (91 tests across 9 suites)
- [ ] Component tests for App* components
- [ ] Integration tests for API routes
- [ ] Performance audit (Lighthouse, bundle analysis)
- [ ] Accessibility audit (WCAG AA)
- [ ] Error states and loading states for all pages
- [ ] Production environment configuration
- [ ] Security audit (auth, input validation, secrets management)
- [ ] Documentation complete
- [ ] Deployment pipeline configured and tested

---

## Completed

> **Section summary:** Features fully shipped. Archived here for reference.

- [x] Infrastructure setup (Phase 0 — Ground Zero)
- [x] Config registry & universal components (Phase 1 — Foundation Layer)
