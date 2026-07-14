# Project Context

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: re-verify if >10 sessions old or after major scope changes

> **Overview:** Along is a social travel-intelligence platform built for urban commuters in Nigeria and West Africa. It solves the problem of unreliable public transit information by letting users share, verify, and discover transport routes in real time — combining the social dynamics of Twitter with the utility of Google Maps. The platform targets the 80%+ of urban commuters who rely on informal transit (buses, danfos, keke, okada) with no reliable real-time information.

---

## Project Purpose

Along empowers urban commuters to share and verify transport route information in real time. Users post route updates (delays, fares, accidents, police checks), follow trusted reporters, earn trust badges through verification, and discover optimal routes through community-sourced intelligence. The platform operates offline-first with PWA support and push notifications for critical route alerts.

---

## Target Users

| User Type | Needs | Key Interactions |
|-----------|-------|-----------------|
| Daily Commuter | Real-time route info, fare updates, delay alerts | Browse feed, search routes, follow reporters, receive push notifications |
| Route Reporter | Share route observations, build trust score | Post route updates, verify others' reports, earn rewards/badges |
| Verified Reporter | High-credibility route intelligence | TrustBadge visible on profile, posts prioritized in feed |
| Admin | Platform moderation, analytics, user management | Moderate content, view analytics, manage site config, handle bug reports |
| Visitor | Browse public content before signing up | View landing page, public feed, about/contact pages |

---

## Business Constraints

- Must work reliably on low-end mobile devices and slow 3G/4G connections (PWA-first)
- Offline capability required — cached feed and map data must be available without connectivity
- Must support push notifications for route alerts even when the app is closed
- Nigerian/West African market focus — content moderation must support local languages and contexts
- Trust and verification are critical — fake route information can cause real harm
- Must comply with Nigerian data protection regulations (NDPR)
- No real-time WebSocket requirement — polling + push notifications suffice for the MVP

---

## Current Project Phase

Phase: Active Development (Application Complete)

The full application codebase has been generated through Phases 0-6: 25 config registries, 34+ universal UI components (App* wrappers), 6 context providers, 12 OOP services, 40 API route files, and complete page structure for auth, dashboard, admin, and public sections. Push notification system with QStash background workers, blog with MDX content, FAQ page, RxJS reactive feed, i18n (English + Pidgin), dark mode, PWA offline support, and 91 Jest tests across 9 suites are all in place. Build produces 65 static pages with zero TypeScript and zero lint errors.

Active sprint focus: Production readiness — remaining integration tests, component tests, and backlog items (marketplace integration, events integration).

---

## Tech Decisions Already Made

| Decision | Reason |
|----------|--------|
| Next.js App Router over Pages Router | Modern React patterns, server components, streaming SSR, improved DX |
| Prisma over Drizzle/TypeORM | Mature ORM with excellent migration tooling, type safety, and Postgres support |
| Ant Design 5 over shadcn/ui/MUI | Comprehensive component library suitable for data-heavy dashboards; already widely used |
| Tailwind CSS v4 over styled-components/CSS modules | Utility-first approach with CSS custom property theming, smaller bundle via JIT |
| MapLibre GL over Google Maps/Mapbox | Open-source, no API key costs for self-hosted tiles, full control over styling |
| JWT with httpOnly cookies over NextAuth.js/sessions | Simpler auth model for API routes, no additional dependency, secure against XSS |
| Config-driven architecture | All hardcoded values centralized in config registries for maintainability and auditability |
| OOP Service Layer with BaseRepository | Consistent data access patterns, easy to test, clear separation of concerns |
| Zero emoji policy | Faster rendering, consistent appearance across devices, accessible |
| Lucide React over Ant Design Icons | Smaller bundle (tree-shakeable), consistent icon style, no emoji confusion |

---

## Out of Scope

- Native mobile app (iOS/Android) — PWA covers mobile use cases for MVP
- Real-time WebSocket-based messaging or chat
- Ride-hailing or booking integration — information sharing only, not transactions
- In-app payments or fare collection
- International expansion beyond West Africa in the initial release

---

## External Integrations

| Service | Purpose | Auth Method |
|---------|---------|------------|
| PostgreSQL (via Prisma) | Primary data store | Connection string (DATABASE_URL) |
| Upstash Redis | Caching, rate limiting, session store | REST API token |
| Cloudinary | Image upload and optimization | API key + secret |
| Resend | Transactional emails (verification, notifications) | API key |
| Sentry | Error tracking and performance monitoring | DSN |
| MapLibre GL (tiles) | Map rendering and route visualization | (self-hosted or free tile provider) |
| QStash | Background job queue (push notifications, cleanup) | API token |
| Web Push API | Browser push notifications | VAPID keys |
