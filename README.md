# Along - Social Route Sharing Platform

<div align="center">

![Along Logo](public/logo.svg)

**Discover, share, and explore travel routes with the Along community**

[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.23-blue)](https://ant.design/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8)](https://tailwindcss.com/)

</div>

## ðŸ“– Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## ðŸŽ¯ About

**Along** is a social platform where travelers can share multi-stop route posts, discover new destinations, and connect with fellow travelers. Whether you're planning a cross-country road trip or a daily commute, Along helps you share your journey and learn from others.

### Why Along?

- ðŸ“ **Multi-Stop Routes**: Share complete journeys with multiple destinations
- ðŸšŒ **Transportation Details**: Include vehicle types, fares, and tips
- ðŸŒ **Community Driven**: Like, comment, bookmark, and share routes
- ðŸ“± **Progressive Web App**: Install on any device, works offline
- ðŸŒ™ **Dark Mode**: Comfortable viewing in any lighting
- ðŸ”” **Push Notifications**: Stay updated with new routes and interactions

## âœ¨ Features

### Core Features

- âœ… **Route Sharing**: Create posts with multiple connected stops
- âœ… **Rich Content**: Text, images, links, and formatting
- âœ… **Social Interaction**: Like, dislike, comment, and share
- âœ… **Bookmarking**: Save favorite routes for later
- âœ… **User Profiles**: View and edit profiles
- âœ… **Search & Discovery**: Find routes by location, tags, or content
- âœ… **Intelligent Suggestions**: Location and activity-based recommendations
- âœ… **Notifications**: Real-time updates for interactions

### PWA Features

- âœ… **Offline Support**: Access content without internet
- âœ… **Installable**: Add to home screen like a native app
- âœ… **Push Notifications**: Get updates even when app is closed
- âœ… **Fast Loading**: Optimized caching strategies

### UX Features

- âœ… **Dark Mode**: System-aware theme switching
- âœ… **Responsive Design**: Mobile-first, works on all devices
- âœ… **Loading States**: Skeletons and progress indicators
- âœ… **Smooth Animations**: Polished user experience
- âœ… **Accessibility**: WCAG 2.1 Level AA compliant

## ðŸ›  Tech Stack

### Frontend

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **UI Library**: [Ant Design 5](https://ant.design/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **State Management**: React Context API
- **HTTP Client**: Axios with interceptors

### Backend

- **API**: Next.js API Routes
- **Data**: Prisma ORM + PostgreSQL
- **Cache**: Upstash Redis
- **Auth**: JWT tokens with httpOnly cookies

### Development Tools

- **Version Control**: Git & GitHub
- **Code Quality**: ESLint, Prettier
- **Package Manager**: npm
- **Deployment**: Vercel (recommended)

## ðŸš€ Getting Started

### Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Git**: Latest version

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/Sotonye0808/along-app.git
cd along-app
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy the example env file and fill in values:

```bash
cp .env.example .env.local
```

Minimum required for local dev:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOCAL_DB=postgresql://USER:PASSWORD@HOST:5432/along
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
CLOUDINARY_CLOUD_NAME=replace_me
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me
UPSTASH_REDIS_REST_URL=replace_me
UPSTASH_REDIS_REST_TOKEN=replace_me
```

### Environment differentiation (PROJECT_ENV vs NODE_ENV)

`app/lib/config/env.ts` is the single source of truth:

| Variable | Purpose | Values |
|----------|---------|--------|
| `PROJECT_ENV` | Deployment stage — **wins when set** | `development` / `staging` / `production` |
| `NODE_ENV` | Node runtime env (set by Next.js) | `development` / `production` / `test` |

Effective env = `PROJECT_ENV` when set, else `NODE_ENV`. `isProduction()`
is true only for effective `production`, so `PROJECT_ENV=production` with
`NODE_ENV=development` still hardens cookies, silences dev-only logs
(OTP/reset codes, email bodies), and enforces strict secrets. DB URL
precedence follows the effective env (local vars in dev, `DIRECT_URL` /
`DATABASE_URL` in production). See `.env.example` (Core section).

### Email Studio

Admin → Email: visual block builder (paragraph, heading, CTA, image, list,
link, divider), variable catalog with custom entries, in-place plain-text
editing, raw HTML mode — switching modes never drops content. Every template
renders inside the shared wrapper (app logo from `logoUrl` default variable,
header, body, CTA, footer) with HTML-escaped interpolation (missing values
send as empty, never `{{name}}`). Recipient `search` mode is select-search
against `/api/admin/users?q=`. Wired-in mails: OTP, welcome (all auth
methods incl. Google OAuth), password reset, verify-email, change-email,
change-password, account-deletion lifecycle, bug/contact notifications —
each pausable via toggle.

4. **Run the development server**

```bash
npm run dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

### Additional Commands

```bash
npm run lint         # Run ESLint
```

## ðŸ“š Documentation

Comprehensive documentation is available:

- **[Setup Guide](SETUP.md)** - Detailed installation and configuration
- **[API Documentation](API.md)** - Complete API reference
- **[Components Documentation](app/components/COMPONENTS.md)** - Component usage guide
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute
- **[Project Context](ai-system/docs/PROJECT_CONTEXT.md)** - Product and architecture context
- **[Engineering Roadmap](ai-system/docs/Along_PRD_Engineering_Roadmap_v2.md)** - PRD and engineering plan
- **[Design Brief](ai-system/docs/Along_Stitch_Design_Brief.md)** - Design system source of truth
- **[Entry Protocol](ai-system/protocols/entry-protocol.md)** - AI agent session start procedure
- **[Repo Map](ai-system/index/repo-map.md)** - Codebase navigation map
- **[PWA Features](app/components/features/pwa/README.md)** - Progressive Web App guide

## ðŸ“ Project Structure

```
along-app/
â”œâ”€â”€ app/                        # Next.js App Router
â”‚   â”œâ”€â”€ (auth)/                # Authentication routes
â”‚   â”œâ”€â”€ (dashboard)/           # Dashboard routes
â”‚   â”œâ”€â”€ (admin)/               # Admin routes
â”‚   â”œâ”€â”€ (public)/              # Public marketing/legal routes
â”‚   â”œâ”€â”€ api/                   # API routes
â”‚   â”œâ”€â”€ components/            # React components
â”‚   â”‚   â”œâ”€â”€ features/          # Feature-specific components
â”‚   â”‚   â””â”€â”€ ui/                # Reusable UI components
â”‚   â”œâ”€â”€ providers/             # Context providers
â”‚   â””â”€â”€ lib/                   # Utilities and types
â”œâ”€â”€ public/                     # Static assets
â”‚   â”œâ”€â”€ assets/                # Images and icons
â”‚   â”œâ”€â”€ manifest.json          # PWA manifest
â”‚   â””â”€â”€ sw.js                  # Service worker
â”œâ”€â”€ .github/                   # GitHub configuration
â””â”€â”€ Configuration files
```

## ðŸ¤ Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Quick Start

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow

- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## ðŸ“Š Project Status

### Current Phase

- Compliance audit and remediation (design tokens, universal components, PWA prompt behavior)

## ðŸ”’ Security

- XSS protection
- CSRF protection
- Secure cookie settings
- Input sanitization
- JWT token management

## ðŸŒ Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## ðŸ“± PWA Support

Along is a Progressive Web App that can be installed on:

- âœ… Android devices (Chrome, Edge)
- âœ… iOS devices (Safari 16+)
- âœ… Windows (Chrome, Edge)
- âœ… macOS (Chrome, Safari, Edge)
- âœ… Linux (Chrome, Firefox, Edge)

## ðŸŽ¨ Design System

- **Primary Color**: var(--color-primary) (Along Green)
- **Typography**: System font stack defined in globals.css
- **Spacing**: 4px base unit (Tailwind defaults)
- **Components**: App\* wrappers over Ant Design + Tailwind tokens

## ðŸ“ˆ Performance

- **Lighthouse Score**: 90+ across all metrics
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Bundle Size**: < 200KB (initial load)

## ðŸ™ Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Ant Design](https://ant.design/) - UI Component Library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Vercel](https://vercel.com/) - Deployment Platform

## ðŸ“§ Contact

- **GitHub**: [@Sotonye0808](https://github.com/Sotonye0808)
- **Project**: [Along App](https://github.com/Sotonye0808/along-app)
- **Issues**: [Report a bug](https://github.com/Sotonye0808/along-app/issues)

## ðŸ“„ License

This project is proprietary and confidential.

---

<div align="center">

**Made with â¤ï¸ by the Along Team**

[Documentation](SETUP.md) â€¢ [API Reference](API.md) â€¢ [Contributing](CONTRIBUTING.md)

</div>
