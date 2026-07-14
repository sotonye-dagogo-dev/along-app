# Along - Social Route Sharing Platform

<div align="center">

![Along Logo](public/assets/icons/icon-192x192.png)

**Discover, share, and explore travel routes with the Along community**

[![Next.js](https://img.shields.io/badge/Next.js-15.3-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.23-blue)](https://ant.design/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8)](https://tailwindcss.com/)

</div>

## 📖 Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## 🎯 About

**Along** is a social platform where travelers can share multi-stop route posts, discover new destinations, and connect with fellow travelers. Whether you're planning a cross-country road trip or a daily commute, Along helps you share your journey and learn from others.

### Why Along?

- 📍 **Multi-Stop Routes**: Share complete journeys with multiple destinations
- 🚌 **Transportation Details**: Include vehicle types, fares, and tips
- 🌐 **Community Driven**: Like, comment, bookmark, and share routes
- 📱 **Progressive Web App**: Install on any device, works offline
- 🌙 **Dark Mode**: Comfortable viewing in any lighting
- 🔔 **Push Notifications**: Stay updated with new routes and interactions

## ✨ Features

### Core Features

- ✅ **Route Sharing**: Create posts with multiple connected stops
- ✅ **Rich Content**: Text, images, links, and formatting
- ✅ **Social Interaction**: Like, dislike, comment, and share
- ✅ **Bookmarking**: Save favorite routes for later
- ✅ **User Profiles**: View and edit profiles
- ✅ **Search & Discovery**: Find routes by location, tags, or content
- ✅ **Intelligent Suggestions**: Location and activity-based recommendations
- ✅ **Notifications**: Real-time updates for interactions

### PWA Features

- ✅ **Offline Support**: Access content without internet
- ✅ **Installable**: Add to home screen like a native app
- ✅ **Push Notifications**: Get updates even when app is closed
- ✅ **Fast Loading**: Optimized caching strategies

### UX Features

- ✅ **Dark Mode**: System-aware theme switching
- ✅ **Responsive Design**: Mobile-first, works on all devices
- ✅ **Loading States**: Skeletons and progress indicators
- ✅ **Smooth Animations**: Polished user experience
- ✅ **Accessibility**: WCAG 2.1 Level AA compliant

## 🛠 Tech Stack

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

## 🚀 Getting Started

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
npm run dev:all      # Run dev server with mock backend (if using json-server)
```

## 📚 Documentation

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

## 📁 Project Structure

```
along-app/
├── app/                        # Next.js App Router
│   ├── (auth)/                # Authentication routes
│   ├── (dashboard)/           # Dashboard routes
│   ├── (admin)/               # Admin routes
│   ├── (public)/              # Public marketing/legal routes
│   ├── api/                   # API routes
│   ├── components/            # React components
│   │   ├── features/          # Feature-specific components
│   │   └── ui/                # Reusable UI components
│   ├── providers/             # Context providers
│   └── lib/                   # Utilities and types
├── public/                     # Static assets
│   ├── assets/                # Images and icons
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker
├── .github/                   # GitHub configuration
└── Configuration files
```

## 🤝 Contributing

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

## 📊 Project Status

### Current Phase

- Compliance audit and remediation (design tokens, universal components, PWA prompt behavior)

## 🔒 Security

- XSS protection
- CSRF protection
- Secure cookie settings
- Input sanitization
- JWT token management

## 🌐 Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## 📱 PWA Support

Along is a Progressive Web App that can be installed on:

- ✅ Android devices (Chrome, Edge)
- ✅ iOS devices (Safari 16+)
- ✅ Windows (Chrome, Edge)
- ✅ macOS (Chrome, Safari, Edge)
- ✅ Linux (Chrome, Firefox, Edge)

## 🎨 Design System

- **Primary Color**: var(--color-primary) (Along Green)
- **Typography**: System font stack defined in globals.css
- **Spacing**: 4px base unit (Tailwind defaults)
- **Components**: App\* wrappers over Ant Design + Tailwind tokens

## 📈 Performance

- **Lighthouse Score**: 90+ across all metrics
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Bundle Size**: < 200KB (initial load)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Ant Design](https://ant.design/) - UI Component Library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Vercel](https://vercel.com/) - Deployment Platform

## 📧 Contact

- **GitHub**: [@Sotonye0808](https://github.com/Sotonye0808)
- **Project**: [Along App](https://github.com/Sotonye0808/along-app)
- **Issues**: [Report a bug](https://github.com/Sotonye0808/along-app/issues)

## 📄 License

This project is proprietary and confidential.

---

<div align="center">

**Made with ❤️ by the Along Team**

[Documentation](SETUP.md) • [API Reference](API.md) • [Contributing](CONTRIBUTING.md)

</div>
