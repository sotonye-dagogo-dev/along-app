# Project AI Context

> **Metadata**
>
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: re-verify before trusting if project structure has changed

> **Overview:** Along is a social travel-intelligence platform — "Twitter x Google Maps" — for sharing, verifying, and discovering transport routes. It targets Nigerian/West African urban commuters, providing real-time route info, user-generated route reports, and community-driven transit intelligence. Built with Next.js 15 (App Router), TypeScript, Ant Design 5, and Tailwind CSS 4, backed by PostgreSQL via Prisma 7, Upstash Redis, and MapLibre GL.

---

## Quick Reference

| Field            | Value                                      |
| ---------------- | ------------------------------------------ |
| Project Name     | Along                                      |
| Type             | Web App (PWA)                              |
| Primary Language | TypeScript                                 |
| Frontend         | Next.js 15.3.5 (App Router) + React 19.1.0 |
| Backend          | Next.js API Routes (Node.js runtime)       |
| Database         | PostgreSQL via Prisma ORM 7.2.0            |
| Cache            | Upstash Redis                              |
| Styling          | Tailwind CSS 4.1.7 + Ant Design 5.23.3     |
| Maps             | MapLibre GL + react-map-gl                 |
| Auth             | JWT (httpOnly cookies) + bcrypt            |
| Error Tracking   | Sentry 10.51.0                             |
| Images           | Cloudinary                                 |
| Deployment       | (not yet configured)                       |

---

## Key Modules

| Module             | Location                   | Purpose                               |
| ------------------ | -------------------------- | ------------------------------------- |
| App Pages          | `app/`                     | Next.js App Router pages and layouts  |
| API Routes         | `app/api/`                 | RESTful API endpoints                 |
| UI Components      | `app/components/ui/`       | Universal App\* component wrappers    |
| Feature Components | `app/components/features/` | Domain-specific components            |
| Services           | `app/lib/services/`        | OOP service layer with BaseRepository |
| Config             | `app/lib/config/`          | Config-driven registries              |
| Database           | `prisma/`                  | Prisma schema, migrations, seed       |
| Static Assets      | `public/`                  | Icons, manifests, service worker      |
| AI System          | `ai-system/`               | AI development orchestration          |
| CI                 | `.github/`                 | GitHub Actions workflows              |

---

## Entry Point

The AI system documentation lives in `ai-system/`.

Start with: `ai-system/protocols/entry-protocol.md`

---

## Active Development Focus

Application codebase fully generated through Phases 0-6 (auth, dashboard, admin, public pages, push notifications, QStash workers, blog, FAQ, RxJS feed, i18n). 65 static pages, 40 API routes, 91 tests. Current focus: production hardening, integration tests, and backlog features.
