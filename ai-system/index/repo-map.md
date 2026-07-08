# Repository Map

> **Metadata**
>
> - last-updated-by: update-ai-system
> - last-verified-against-code: 2026-07-08 (session 4)
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
│   ├── schema.prisma        → 14 models, 8 enums, indexes
│   ├── migrations/          → 3 applied migrations
│   └── seed.ts              → Development seed data
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
│   ├── (dashboard)/         → Main app (feed, explore, profile, leaderboard, marketplace, etc.)
│   ├── (admin)/             → Admin dashboard
│   ├── (public)/            → Landing, about, contact, legal, faq, blog
│   │   ├── faq/             → FAQ page with categorized Q&A
│   │   ├── blog/            → Blog listing page
│   │   │   ├── posts/       → MDX blog post files
│   │   │   └── [slug]/      → Blog post detail page
│   ├── api/                 → REST API routes
│   │   ├── push/            → Push notification API
│   │   │   ├── subscribe/   → POST: subscribe to push
│   │   │   ├── unsubscribe/ → POST: unsubscribe from push
│   │   │   ├── send/        → POST: QStash-triggered push delivery
│   │   │   └── vapid-public-key/ → GET: VAPID public key
│   │   ├── workers/         → QStash background worker endpoints
│   │   │   ├── feed-invalidate/
│   │   │   ├── rewards/
│   │   │   └── validity-recompute/
│   ├── components/          → React components
│   │   ├── ui/              → 34 App* universal component wrappers
│   │   └── features/        → Domain-specific components (comments, posts, profile, explore, events)
│   ├── lib/                 → Shared code
│   │   ├── services/        → 11 OOP services (feed, push sub, QStash, rewards, etc.)
│   │   ├── config/          → 25 config registry files
│   │   ├── db/              → Database layer (prisma.ts, redis.ts)
│   │   ├── hooks/           → Server-compatible custom React hooks
│   │   ├── schemas/         → Zod validation schemas
│   │   ├── streams/         → Reactive streams
│   │   ├── types/           → TypeScript type definitions
│   │   ├── integrations/    → External service clients (transact, tega)
│   │   └── utils/           → 11 utility modules (blog, pushClient, siteConfig, etc.)
│   └── providers/           → 6 context providers (Auth, OnlineStatus, Push, GlobalModal, GlobalToast, CookieConsent)
│
├── node_modules/            → Installed dependencies
│
├── instrumentation.ts       → Sentry runtime hooks
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
| `prisma/`       | Database schema, migrations, and seed data                                     | `schema.prisma` (14 models), `seed.ts`, `migrations/`                              |
| `public/`       | Static assets served at root path                                              | `sw.js` (service worker), `manifest.json`, `offline.html`                          |
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
