# PROJECT_CONTEXT.md — Along App

> **Role**: Senior Lead Software Architect — Systems Design Reference  
> **Version**: 1.0 · Generated: 2026-04-22  
> **Purpose**: Master context document for Claude indexing, AI-assisted development, and architectural decision-making.  
> **Scope**: Metadata-Driven Architecture, OOP/Modularity, Design Tokens, Feature Specs, State & Integrations, Performance.
> **Additional Context (abstracly provided)**: Additional context: no role-specific pages or components, but rather role and context aware components with dynamic rendering. Inclusion in route suggestions (in addition to user made posts of course) of platform-generated suggestions intelligently drafted from user posts based on the routes searching user is trying to find/explore, considering fare ease of accessibility and other factors as well. Should be non-blocking as always. Instead of emojis in vehicle config (and anywhere else emojis are used) icons should be used too. There should also be config-driven powerful dynamic customizable user avatar setting using something like dice best and taking advantage of their wide range of options. Obviously the UI for that should be simple enough for the user to understand and play around with along with previews while behind the deck the operations are going on. Saves us the stress of having to save uploaded images as the avatar will just link to the dice bear api with customized query params and is loaded and cached on runtime with fallback image of course. All required UI/UX considerations should be handled, including but not limited to CRUD operations accessible for users with their scope, admin users should have access to the platform general user-specific resources and pages while still having access to the separate admin resources and pages, all destructive actions should have a global confirm modal, as well as non-destructive but somewhat sensitive actions. There should also be global undo functionality for applicable actions. Abstractly, the project is somewhat of a Twitter and google maps combo, even down to the UI concept (additionally if any free to use powerful google maps api or tools can be consumed and used to further drive the features of this application then there’s no issues with that, considering things like traffic, possible weather influence, transport services (both public and private like Bolt), etc), which is why asides from the expected PRD output, I’ll also need a prompt or md document to feed google stitch for the designs of the pages, with the MD file having our design system and all as well as intended components, page maps, glassmorphism and blurry glassy modern designs with Bento layouts where needed still maintaining simplicity and uniqueness. There should also be accomodation for me to include an image of the original UI/UX designs for the project, and a link to the Figma file but the prompt/md file for the google stitch op should still work even without those attachments. Additionally, the config driven app footer should also have dev credit (a line like “built by S.D” with link to dev portfolio (https://sotonye-dagogo.is-a.dev). Should also be a config driven page or portion in about page for the Along team (like other public pages, content should be admin editable) with image, name, role, little description, social and other links. There should be interfaces for users to submit bug reports with selectable cases, subject, description, optional image inclusion and email address (auto retrieved for authenticated users), also contact pages, review pages with the content of the reviews (likely the best ones) stylishly put in a component on a public facing page like about. As expected all image uploads should be properly handled with Cloudinary with proper folders and organizing and links stored in DB (goes without saying but have to be concise). PWA functionality should also be well done, non blocking without interfering with performance, having pages and functionality available offline is very important and some global non-blocking components and functionality for offline indication, online restoration indication, queue of network dependent actions for execution when network is restored as well as blocking and catching of network dependent actions or tasks with necessary relevant feedback to user as accordingly. Like other social platforms, user-based and platform based analytics should also be available with visualizations and customizations tracking engagements and other metrics, there should also be invite system where user can invite other users with their own links and get accumulated scores based on their invited user activity. Having all these data and other possible data tracked from now will make the intended incentives and rewards easier and possible

---

## TABLE OF CONTENTS

1. [Current State](#1-current-state)
2. [Metadata-Driven Logic](#2-metadata-driven-logic)
3. [OOP & Modularity](#3-oop--modularity)
4. [Design Tokens](#4-design-tokens)
5. [Feature Specs](#5-feature-specs)
6. [State & Integrations](#6-state--integrations)
7. [Performance](#7-performance)

---

## 1. CURRENT STATE

### 1.1 Technology Stack

| Layer      | Technology                               |
| ---------- | ---------------------------------------- |
| Framework  | Next.js 15+ (App Router, React 19)       |
| Language   | TypeScript 5 (strict mode)               |
| Styling    | Tailwind CSS 3 + Ant Design 5            |
| ORM        | Prisma 7 (PostgreSQL)                    |
| Cache      | Upstash Redis (mock-redis in dev)        |
| Auth       | JWT (jsonwebtoken) + js-cookie + bcrypt  |
| Validation | Zod 4                                    |
| Images     | Cloudinary (next-cloudinary)             |
| Testing    | Jest 30 + React Testing Library          |
| PWA        | Service Workers + Web Push Notifications |

### 1.2 Next.js App Router Path Map

```
app/
├── layout.tsx                          # Root layout (AntdProvider, AuthProvider, ThemeProvider)
├── page.tsx                            # Landing / redirect
├── not-found.tsx
├── robots.ts
├── sitemap.ts
├── globals.css
│
├── (auth)/                             # Unauthenticated group
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── otp/page.tsx
│
├── (dashboard)/                        # Authenticated group
│   ├── layout.tsx                      # DashboardNavbar, offline guard
│   ├── home/
│   │   ├── layout.tsx
│   │   └── page.tsx                    # Feed + SearchBar + SuggestionsPanel
│   ├── explore/page.tsx
│   ├── bookmarks/page.tsx
│   ├── marketplace/page.tsx            # Stub — future Transact integration
│   ├── notifications/page.tsx
│   ├── posts/[id]/page.tsx             # Single post detail
│   └── profile/
│       ├── layout.tsx
│       ├── page.tsx                    # Own profile
│       └── [username]/page.tsx         # Public profile
│
├── api/                                # Next.js API routes
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── logout/route.ts
│   │   ├── register/route.ts
│   │   ├── verify/route.ts
│   │   ├── verify-otp/route.ts
│   │   └── refresh/route.ts
│   ├── posts/
│   │   ├── route.ts                    # GET /posts, POST /posts
│   │   └── [id]/route.ts               # GET/PUT/DELETE /posts/:id
│   ├── users/
│   │   └── [id]/route.ts
│   └── notifications/route.ts
│
├── components/
│   ├── features/
│   │   ├── auth/                       # LoginForm, OtpForm, RegisterForm
│   │   ├── dashboard/                  # Feed, SearchBar, ShareRouteButton, SuggestionsPanel
│   │   ├── navigation/                 # DashboardNavbar, DesktopTopBar, MobileTopBar,
│   │   │                               #   NotificationsDropdown, ScrollToTop
│   │   ├── posts/                      # PostCard, CommentSection, ShareRouteModal
│   │   ├── profile/                    # UserProfile, EditProfileModal
│   │   └── pwa/                        # InstallPrompt, NotificationSettings,
│   │                                   #   OfflineGuard, OfflineIndicator
│   ├── ui/                             # (empty — future design-system primitives)
│   └── ErrorBoundary.tsx
│
├── lib/
│   ├── cache/
│   │   ├── redis.ts                    # Upstash Redis client + cache helpers
│   │   └── mock-redis.ts               # In-memory dev mock
│   ├── config/
│   │   └── cloudinary.ts
│   ├── constants/
│   │   └── index.ts                    # API_ENDPOINTS, APP_ROUTES, THEME_COLORS, VALIDATION
│   ├── data/
│   │   ├── mockData.ts                 # Seed data: mockUsers, mockPosts, mockComments, …
│   │   └── database.ts                 # InMemoryStore singleton (mock DB)
│   ├── db/
│   │   └── prisma.ts                   # Prisma singleton
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useComments.ts
│   │   ├── useFeedInteractions.ts      # Optimistic like/dislike/bookmark/follow
│   │   ├── useFeedPosts.ts
│   │   ├── useNewPostsNotification.ts
│   │   ├── useNotifications.ts
│   │   ├── useOnlineStatus.ts
│   │   └── useProfileInteractions.ts
│   ├── services/
│   │   ├── feedService.ts              # Personalized feed + trending algorithm
│   │   ├── searchService.ts
│   │   └── suggestionsService.ts
│   ├── types/
│   │   ├── interfaces.ts               # Global TS declarations (User, Post, Route, …)
│   │   └── types.ts                    # VehicleType union
│   └── utils/
│       ├── api.ts                      # Axios wrapper
│       ├── auth.ts                     # Cookie/localStorage token helpers
│       ├── auth-server.ts              # Server-side JWT verification
│       ├── cloudinary.ts               # Upload helpers
│       ├── feedHelpers.ts
│       ├── format.ts                   # formatDate, formatNumber
│       ├── geolocation.ts              # Browser geolocation + Nominatim reverse-geocoding
│       ├── push-notifications.ts
│       ├── rateLimiter.ts              # Redis sliding-window rate limiter
│       ├── security.ts
│       ├── structuredData.ts           # JSON-LD helpers
│       ├── sw-register.ts              # Service Worker registration
│       └── validation.ts              # Zod schemas (register, login, post, comment, …)
│
├── providers/
│   ├── AntdProvider.tsx
│   ├── AuthProvider.tsx                # Auth context (user, login, logout, checkAuth)
│   └── ThemeProvider.tsx
│
└── generated/
    └── prisma/                         # Prisma Client auto-generated output
```

### 1.3 Current Data Models (Global TypeScript Interfaces)

```typescript
// Declared in app/lib/types/interfaces.ts (global scope via tsconfig.json)

interface User {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  avatar?: string;
  bio?: string;
  followers?: number;
  following?: string[];
  likes?: string[];
  bookmarks?: string[];
  createdAt: string;
  verified?: boolean;
  location?: string;
}

interface Route {
  id: string;
  text: string;
  links: Link[];
  order: number;
  vehicles: VehicleType[];
  status: "verified" | "unverified" | "pending" | "rejected";
  fare?: number;
}

interface Post {
  id: string;
  userId: string;
  title: string;
  routes: Route[];
  images: string[];
  tags: string[];
  likes: number;
  dislikes: number;
  comments: number;
  bookmarks?: number;
  createdAt: string;
  updatedAt: string;
}

interface PostComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
  likes: number;
  dislikes: number;
}

interface Like {
  id: string;
  postId: string;
  userId: string;
  type: "like" | "dislike";
}
interface Bookmark {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}
interface AppNotification {
  id: string;
  userId: string;
  type: "like" | "comment" | "follow" | "mention";
  message: string;
  postId?: string;
  read: boolean;
  createdAt: string;
}

type VehicleType = "taxi" | "bike" | "keke" | "bus" | "trekking" | "car";
```

### 1.4 Prisma Schema (Production DB)

```prisma
// prisma/schema.prisma — PostgreSQL
// Models: User, Follow, Post, Comment, Like, Bookmark,
//         Notification, NotificationRecipient, UserActivity
// Enums: LikeType(LIKE|DISLIKE), NotificationType(LIKE|COMMENT|FOLLOW|MENTION),
//        ActivityType(VIEW|LIKE|COMMENT|BOOKMARK|SHARE)
// Key decisions:
//   - routes stored as Json column (flexible Route[] shape)
//   - images stored as String[] (Cloudinary URLs)
//   - Follow is explicit join table (not array FK) for efficient pagination
//   - UserActivity table drives feed personalization (tag scoring)
//   - NotificationRecipient decouples delivery from event source
```

### 1.5 Mock Data Layer (Phase 7)

- `app/lib/data/mockData.ts` — static seed arrays (4 users, 3 posts, 5 comments, etc.)
- `app/lib/data/database.ts` — `InMemoryStore` class, singleton via `getDatabase()` / `db`
  - Full CRUD for all entities; no persistence across restarts
  - Drop-in replacement contract for Prisma layer
- Transition trigger: Set `DATABASE_URL` + `UPSTASH_REDIS_REST_URL` env vars

---

## 2. METADATA-DRIVEN LOGIC

> **Principle**: Replace all hardcoded repetition with centralized configuration objects (schemas, registries, maps). UI components iterate over config arrays; API routes derive behavior from config keys.

### 2.1 Config-to-Code Patterns Identified

#### 2.1.1 Vehicle Type Registry

**Current** (`PostCard.tsx`, `ShareRouteModal.tsx`): duplicate `vehicleIcons` and `vehicleOptions` objects.  
**Target**: Single source of truth in `lib/config/vehicles.ts`.

```typescript
// lib/config/vehicles.ts
export interface VehicleConfig {
  value: VehicleType;
  label: string;
  emoji: string;
  color: string; // Tailwind bg class for badge
  maxPassengers?: number;
}

export const VEHICLE_REGISTRY: Record<VehicleType, VehicleConfig> = {
  taxi: { value: "taxi", label: "Taxi", emoji: "🚕", color: "bg-yellow-100" },
  bike: { value: "bike", label: "Bike", emoji: "🏍️", color: "bg-orange-100" },
  keke: { value: "keke", label: "Keke", emoji: "🛺", color: "bg-green-100" },
  bus: { value: "bus", label: "Bus", emoji: "🚌", color: "bg-blue-100" },
  trekking: {
    value: "trekking",
    label: "Trekking",
    emoji: "🚶",
    color: "bg-gray-100",
  },
  car: { value: "car", label: "Car", emoji: "🚗", color: "bg-indigo-100" },
};
```

#### 2.1.2 Route Status Registry

**Current** (`PostCard.tsx`): hardcoded `statusConfig` object inline.  
**Target**: `lib/config/routeStatus.ts` shared across PostCard, list views, and admin dashboard.

```typescript
// lib/config/routeStatus.ts
export interface RouteStatusConfig {
  label: string;
  icon: React.ComponentType; // Ant Design icon
  color: string; // Tailwind text class
  bgColor: string; // badge bg
  tooltip: string;
  trustScore: number; // 0–100, feeds Validity Engine
}

export const ROUTE_STATUS_REGISTRY: Record<Route["status"], RouteStatusConfig> =
  {
    verified: {
      label: "Verified",
      icon: CheckCircleOutlined,
      color: "text-green-500",
      bgColor: "bg-green-50",
      tooltip: "Community-verified route",
      trustScore: 100,
    },
    unverified: {
      label: "Unverified",
      icon: ExclamationCircleOutlined,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      tooltip: "Not yet verified",
      trustScore: 40,
    },
    pending: {
      label: "Pending",
      icon: ClockCircleOutlined,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50",
      tooltip: "Awaiting verification",
      trustScore: 60,
    },
    rejected: {
      label: "Rejected",
      icon: CloseCircleOutlined,
      color: "text-red-500",
      bgColor: "bg-red-50",
      tooltip: "Route rejected by mods",
      trustScore: 0,
    },
  };
```

#### 2.1.3 API Endpoint Registry

**Current** (`lib/constants/index.ts`): flat `API_ENDPOINTS` constant.  
**Target**: Extend with method metadata for auto-generated API clients.

```typescript
// lib/config/apiRegistry.ts
export interface EndpointConfig {
  path: string | ((...args: string[]) => string);
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  requiresAuth: boolean;
  rateLimit?: keyof typeof RATE_LIMITS;
  cache?: { ttl: number; key: (...args: string[]) => string };
}

export const API_REGISTRY = {
  posts: {
    list: {
      path: "/posts",
      method: "GET",
      requiresAuth: false,
      cache: { ttl: CACHE_TTL.feed, key: () => "posts:list" },
    },
    create: {
      path: "/posts",
      method: "POST",
      requiresAuth: true,
      rateLimit: "posts.create",
    },
    get: {
      path: (id: string) => `/posts/${id}`,
      method: "GET",
      requiresAuth: false,
      cache: { ttl: CACHE_TTL.post, key: (id: string) => CACHE_KEYS.post(id) },
    },
    like: {
      path: (id: string) => `/posts/${id}/like`,
      method: "POST",
      requiresAuth: true,
      rateLimit: "interactions.like",
    },
  },
  // …
} satisfies Record<string, Record<string, EndpointConfig>>;
```

#### 2.1.4 Navigation Registry

**Current**: nav links hardcoded in `DashboardNavbar.tsx` / `DesktopTopBar.tsx`.  
**Target**: `lib/config/navigation.ts` drives all nav rendering.

```typescript
// lib/config/navigation.ts
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType;
  activeIcon?: React.ComponentType;
  requiresAuth: boolean;
  badge?: "notifications" | "messages"; // dynamic badge source
  showInMobile: boolean;
  showInDesktop: boolean;
}

export const NAV_REGISTRY: NavItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/home",
    icon: HomeOutlined,
    requiresAuth: true,
    showInMobile: true,
    showInDesktop: true,
  },
  {
    key: "explore",
    label: "Explore",
    href: "/explore",
    icon: CompassOutlined,
    requiresAuth: false,
    showInMobile: true,
    showInDesktop: true,
  },
  {
    key: "bookmarks",
    label: "Bookmarks",
    href: "/bookmarks",
    icon: BookOutlined,
    requiresAuth: true,
    showInMobile: true,
    showInDesktop: true,
  },
  {
    key: "marketplace",
    label: "Marketplace",
    href: "/marketplace",
    icon: ShopOutlined,
    requiresAuth: true,
    showInMobile: true,
    showInDesktop: true,
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: BellOutlined,
    requiresAuth: true,
    showInMobile: false,
    showInDesktop: true,
    badge: "notifications",
  },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
    icon: UserOutlined,
    requiresAuth: true,
    showInMobile: true,
    showInDesktop: true,
  },
];
```

#### 2.1.5 Form Field Registry

**Current**: Auth forms (`LoginForm`, `RegisterForm`) hardcode Ant Design `Form.Item` trees.  
**Target**: Field definitions as config arrays consumed by a generic `<ConfigDrivenForm />`.

```typescript
// lib/config/forms.ts
export interface FieldConfig {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "password"
    | "textarea"
    | "select"
    | "multiselect"
    | "number"
    | "upload";
  placeholder?: string;
  rules: Rule[]; // Ant Design rule objects
  options?: { label: string; value: string }[]; // for select
  maxLength?: number;
  prefix?: React.ReactNode;
}

export const REGISTER_FIELDS: FieldConfig[] = [
  {
    name: "firstName",
    label: "First Name",
    type: "text",
    placeholder: "First name",
    rules: [{ required: true, min: 2 }],
  },
  {
    name: "lastName",
    label: "Last Name",
    type: "text",
    placeholder: "Last name",
    rules: [{ required: true, min: 2 }],
  },
  {
    name: "userName",
    label: "Username",
    type: "text",
    placeholder: "@username",
    rules: [{ required: true, min: 3, max: 30, pattern: /^[a-zA-Z0-9_]+$/ }],
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    placeholder: "Email",
    rules: [{ required: true, type: "email" }],
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    placeholder: "Password",
    rules: [{ required: true, min: 8 }],
  },
];

export const LOGIN_FIELDS: FieldConfig[] = [
  {
    name: "email",
    label: "Email",
    type: "email",
    rules: [{ required: true, type: "email" }],
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    rules: [{ required: true }],
  },
];
```

#### 2.1.6 Notification Type Registry

**Current**: `type: 'like' | 'comment' | 'follow' | 'mention'` used ad hoc.  
**Target**: Config object drives notification rendering (icon, copy, routing).

```typescript
// lib/config/notifications.ts
export interface NotificationTypeConfig {
  icon: React.ComponentType;
  color: string;
  template: (actor: string, meta?: string) => string;
  linkTo?: (postId?: string, userId?: string) => string;
}

export const NOTIFICATION_REGISTRY: Record<
  AppNotification["type"],
  NotificationTypeConfig
> = {
  like: {
    icon: LikeFilled,
    color: "text-green-500",
    template: (a) => `${a} liked your post`,
    linkTo: (postId) => `/posts/${postId}`,
  },
  comment: {
    icon: CommentFilled,
    color: "text-blue-500",
    template: (a) => `${a} commented on your post`,
    linkTo: (postId) => `/posts/${postId}`,
  },
  follow: {
    icon: UserAddFilled,
    color: "text-purple-500",
    template: (a) => `${a} followed you`,
    linkTo: (_, u) => `/profile/${u}`,
  },
  mention: {
    icon: AtFilled,
    color: "text-orange-500",
    template: (a, m) => `${a} mentioned you in "${m}"`,
    linkTo: (postId) => `/posts/${postId}`,
  },
};
```

#### 2.1.7 Rate Limit Registry (already config-driven, extend)

`lib/utils/rateLimiter.ts` → `RATE_LIMITS` constant already maps action keys to `{maxRequests, windowSeconds}`.  
**Enhancement**: Promote to `lib/config/rateLimits.ts` and reference from `API_REGISTRY`.

### 2.2 Hardcoded Logic → Config-Driven Migration Map

| Location                                 | Hardcoded Pattern                       | Config Target                                    |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| `PostCard.tsx` · `vehicleIcons`          | `Record<VehicleType, string>` emoji map | `VEHICLE_REGISTRY`                               |
| `PostCard.tsx` · `statusConfig`          | Inline status → icon/color/tooltip      | `ROUTE_STATUS_REGISTRY`                          |
| `ShareRouteModal.tsx` · `vehicleOptions` | Duplicate vehicle array                 | `VEHICLE_REGISTRY`                               |
| `DashboardNavbar.tsx`                    | Hardcoded link list                     | `NAV_REGISTRY`                                   |
| `LoginForm.tsx` / `RegisterForm.tsx`     | Manually repeated `<Form.Item>` trees   | `REGISTER_FIELDS` / `LOGIN_FIELDS`               |
| `Feed.tsx` · `handleDelete` countdown    | Magic number `10` seconds               | `APP_CONFIG.deleteUndoSeconds`                   |
| `feedService.ts` · scoring weights       | `70`, `20`, `10`, `15` inline           | `FEED_ALGORITHM_CONFIG`                          |
| `redis.ts` · `CACHE_TTL`                 | Numeric constants                       | `lib/config/cache.ts` (already partially config) |
| `rateLimiter.ts` · `RATE_LIMITS`         | Inline object                           | `lib/config/rateLimits.ts`                       |
| `validation.ts` · string lengths         | Magic numbers (min/max)                 | `lib/config/validationRules.ts`                  |

### 2.3 Admin-Managed DB Config with Local Fallbacks

For runtime-adjustable configuration (without deploys), introduce a `SiteConfig` Prisma model:

```typescript
// Pattern: fetch from DB → Redis cache → local fallback
export async function getSiteConfig<K extends keyof AppConfig>(
  key: K,
  fallback: AppConfig[K],
): Promise<AppConfig[K]> {
  const cached = await cache.get<AppConfig[K]>(`config:${key}`);
  if (cached !== null) return cached;

  const row = await prisma.siteConfig.findUnique({ where: { key } });
  const value = row ? (JSON.parse(row.value) as AppConfig[K]) : fallback;
  await cache.set(`config:${key}`, value, CACHE_TTL.config);
  return value;
}
```

**Config Keys to DB-ify**:
| Key | Type | Default | Purpose |
|---|---|---|---|
| `feedAlgorithm.weights` | `{follow:number,tag:number,trending:number,location:number}` | `{70,20,10,15}` | Feed ranking |
| `postLimits.maxRoutes` | `number` | `20` | UX cap |
| `postLimits.maxImages` | `number` | `10` | UX cap |
| `validityEngine.thresholds` | `{low:number,medium:number,high:number}` | `{30,60,80}` | Trust badge |
| `draftingCoach.checkpoints` | `QualityCheckpoint[]` | see §5.2 | Coach config |
| `rateLimits.*` | `RateLimitConfig` | see rateLimiter.ts | Dynamic throttle |

---

## 3. OOP & MODULARITY

### 3.1 Base Classes

#### 3.1.1 `BaseRepository<T>` (Abstract Data Access)

```typescript
// lib/db/BaseRepository.ts
abstract class BaseRepository<T extends { id: string }> {
  protected abstract modelName: string;

  // All concrete repos implement these; mock vs. Prisma swap here
  abstract findById(id: string): Promise<T | null>;
  abstract findMany(opts?: FindManyOptions): Promise<T[]>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T | null>;
  abstract delete(id: string): Promise<boolean>;

  // Shared helpers
  protected withCache<R>(key: string, ttl: number, fn: () => Promise<R>): Promise<R> { … }
  protected invalidateCache(pattern: string): Promise<void> { … }
}
```

Concrete implementations: `PostRepository`, `UserRepository`, `CommentRepository`, each holding Prisma calls and cache invalidation logic.

#### 3.1.2 `BaseApiHandler` (Route Middleware Chain)

```typescript
// lib/api/BaseApiHandler.ts
abstract class BaseApiHandler {
  protected abstract schema?: ZodSchema;
  protected abstract requiresAuth: boolean;
  protected abstract rateLimitConfig?: RateLimitConfig;

  async handle(req: NextRequest): Promise<NextResponse> {
    const authResult = this.requiresAuth ? await this.authenticate(req) : null;
    if (this.rateLimitConfig)
      await this.enforceRateLimit(req, authResult?.userId);
    const body = this.schema ? await this.validateBody(req) : undefined;
    return this.execute(req, authResult, body);
  }

  protected abstract execute(
    req: NextRequest,
    auth: AuthContext | null,
    body?: unknown,
  ): Promise<NextResponse>;
}
```

#### 3.1.3 `ConfigDrivenForm` (Generic Form Component)

```typescript
// components/ui/ConfigDrivenForm.tsx
interface ConfigDrivenFormProps<T> {
  fields: FieldConfig[];
  onSubmit: (values: T) => Promise<void>;
  submitLabel: string;
  initialValues?: Partial<T>;
  layout?: 'vertical' | 'horizontal';
}

export function ConfigDrivenForm<T>({ fields, onSubmit, submitLabel, initialValues }: ConfigDrivenFormProps<T>) {
  return (
    <Form initialValues={initialValues} onFinish={onSubmit} layout="vertical">
      {fields.map(field => (
        <Form.Item key={field.name} name={field.name} label={field.label} rules={field.rules}>
          {renderField(field)}
        </Form.Item>
      ))}
      <Button type="primary" htmlType="submit">{submitLabel}</Button>
    </Form>
  );
}
```

#### 3.1.4 `ConfigDrivenList` (Generic Feed/List Component)

```typescript
// components/ui/ConfigDrivenList.tsx
interface ConfigDrivenListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  pagination?: PaginationConfig;
}
```

#### 3.1.5 `ValidityEngine` (Post Scoring Service)

```typescript
// lib/services/ValidityEngine.ts
class ValidityEngine {
  constructor(private config: ValidityConfig) {}

  compute(post: Post, context: ValidityContext): ValidityScore { … }
  getBreakdown(post: Post, context: ValidityContext): ScoreBreakdown { … }
  getTrustLevel(score: number): 'low' | 'medium' | 'high' | 'trusted' { … }
}
```

#### 3.1.6 `DraftingCoach` (Real-Time Creation Feedback)

```typescript
// lib/services/DraftingCoach.ts
class DraftingCoach {
  constructor(private checkpoints: QualityCheckpoint[]) {}

  evaluate(draft: Partial<Post>): CoachFeedback[] { … }
  getScore(draft: Partial<Post>): number { … }
  getNextSuggestion(draft: Partial<Post>): QualityCheckpoint | null { … }
}
```

### 3.2 Interface Contracts

```typescript
// Core service interfaces (implement against both mock and Prisma)
interface IPostService {
  getFeed(userId: string, cursor?: string): Promise<PaginatedResponse<Post>>;
  getPost(id: string): Promise<Post | null>;
  createPost(userId: string, data: CreatePostInput): Promise<Post>;
  updatePost(id: string, data: UpdatePostInput): Promise<Post>;
  deletePost(id: string): Promise<void>;
  likePost(
    postId: string,
    userId: string,
    type: "like" | "dislike",
  ): Promise<void>;
  bookmarkPost(postId: string, userId: string): Promise<void>;
}

interface IUserService {
  getUser(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  updateUser(id: string, data: UpdateProfileInput): Promise<User>;
  followUser(followerId: string, followingId: string): Promise<void>;
  getFollowers(userId: string): Promise<User[]>;
  getFollowing(userId: string): Promise<User[]>;
}

interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPattern(pattern: string): Promise<void>;
}
```

### 3.3 Hook Modularity (Current Pattern — Keep)

Custom hooks already follow single-responsibility; maintain this pattern:

- `useFeedPosts` — data fetching + local mutation helpers
- `useFeedInteractions` — optimistic like/dislike/bookmark/follow (with rollback)
- `useComments` — comment CRUD with modal state
- `useNewPostsNotification` — polling + banner trigger
- `useNotifications` — notification CRUD + read state
- `useOnlineStatus` — navigator.onLine observer
- `useAuth` — auth state from `AuthProvider` context

---

## 4. DESIGN TOKENS

### 4.1 CSS Custom Properties (globals.css)

```css
/* Light Mode */
:root {
  --color-primary: #00623b; /* Along Green — brand primary */
  --color-primary-light: #00a862; /* Hover states */
  --color-bg-base: #ffffff;
  --color-bg-elevated: #f7f7f7; /* Cards, sidebars */
  --color-bg-card: #ffffff;
  --color-text-base: #232323;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;
  --color-success: #a4f4e7;
  --color-warning: #f4c790;
  --color-error: #e4626f;
}

/* Dark Mode (.dark class) */
.dark {
  --color-primary: #00a862;
  --color-primary-light: #00d17a;
  --color-bg-base: #0f0f0f;
  --color-bg-elevated: #1a1a1a;
  --color-bg-card: #1f1f1f;
  --color-text-base: #f5f5f5;
  --color-text-secondary: #d1d5db;
  --color-border: #2d2d2d;
  --color-border-light: #262626;
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-error: #ef4444;
}
```

### 4.2 Tailwind Extended Palette (`tailwind.config.ts`)

| Token            | Hex               | Usage                                |
| ---------------- | ----------------- | ------------------------------------ |
| `alonggreen`     | `#00623B`         | Primary brand buttons, active states |
| `basewhite`      | `#f7f7f7`         | Elevated surfaces                    |
| `baseblack`      | `#232323`         | Primary text                         |
| `primary100`     | `#00a23b`         | Light primary                        |
| `primary200`     | `#00c23b`         | Lighter                              |
| `primary400`     | `#00523b`         | Dark primary                         |
| `primary500`     | `#006200`         | Darkest                              |
| `neutral100–500` | `#e4e4e4–#363636` | Greyscale scale                      |
| `success`        | `#a4f4e7`         | Success backgrounds                  |
| `success200`     | `#15b097`         | Success text                         |
| `success300`     | `#0b7b69`         | Success dark                         |
| `warning`        | `#f4c790`         | Warning bg                           |
| `warning200`     | `#eda145`         | Warning text                         |
| `warning300`     | `#cc7914`         | Warning dark                         |
| `error`          | `#e4626f`         | Error bg                             |
| `error200`       | `#c03744`         | Error text                           |
| `error300`       | `#8c1823`         | Error dark                           |

### 4.3 Typography

- **Font family**: `Inter, Roboto, system-ui, -apple-system, …`
- **Font weights**: `400` body, `600` labels, `700` headings, `800` hero
- **Heading scale**: `text-xl font-bold` (post titles), `text-lg font-semibold` (section heads)
- **Body**: `text-gray-800 dark:text-gray-200`
- **Muted**: `text-gray-500 dark:text-gray-400 text-xs`

### 4.4 Spacing & Layout Patterns

- `max-h-[85vh]` / `max-h-[90vh]` on mobile — `.h-almost` utility class
- Cards: `mb-4 hover:shadow-md transition-shadow` (Ant Design Card, `variant="borderless"`)
- Route connector line: `.route-entry:not(:last-child)::before` — pseudo-element left-border
- Input highlight: `.input-container:focus-within { border: 1px solid #22c55e }`

### 4.5 Animation Tokens

```css
/* Defined in globals.css */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translate(-50%, -100%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
@keyframes slide-down {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

- Button hover: `transform scale-105` via `ant-btn:hover:not(:disabled)`
- Page transitions: `.fade-in { animation: fadeIn 0.3s ease-out }`
- Notification banners: `.animate-slideDown { animation: slideDown 0.3s ease-out }`

### 4.6 Ant Design Theme Configuration

Configured in `AntdProvider.tsx`. Key overrides to align with Along brand:

```typescript
theme: {
  token: {
    colorPrimary: '#00623B',
    colorSuccess: '#15b097',
    colorWarning: '#eda145',
    colorError: '#e4626f',
    borderRadius: 8,
    fontFamily: 'Inter, Roboto, system-ui',
  },
  components: {
    Button: { borderRadius: 6 },
    Card:   { borderRadius: 12 },
    Input:  { borderRadius: 6 },
  }
}
```

### 4.7 Google Stitch / Design Token Export

For Google Stitch compatibility, extract tokens as a flat JSON:

```json
{
  "$type": "color",
  "along.color.primary.default": { "$value": "#00623B" },
  "along.color.primary.light": { "$value": "#00a862" },
  "along.color.neutral.background": { "$value": "#f7f7f7" },
  "along.color.neutral.text": { "$value": "#232323" },
  "along.color.success.base": { "$value": "#a4f4e7" },
  "along.color.warning.base": { "$value": "#f4c790" },
  "along.color.error.base": { "$value": "#e4626f" },
  "along.font.family": {
    "$type": "string",
    "$value": "Inter, Roboto, system-ui"
  },
  "along.spacing.card.gap": { "$type": "dimension", "$value": "16px" },
  "along.border.radius.card": { "$type": "dimension", "$value": "12px" },
  "along.border.radius.input": { "$type": "dimension", "$value": "6px" },
  "along.animation.duration.fast": { "$type": "duration", "$value": "150ms" },
  "along.animation.duration.base": { "$type": "duration", "$value": "200ms" },
  "along.animation.duration.page": { "$type": "duration", "$value": "300ms" }
}
```

---

## 5. FEATURE SPECS

### 5.1 Validity Engine

> **Purpose**: Quantify route post trustworthiness into a 0–100 score driving a "Trust Badge" UX element.

#### 5.1.1 Algorithm

```typescript
// lib/services/ValidityEngine.ts

interface ValidityConfig {
  weights: {
    likeRatio: number; // default 0.35
    detailScore: number; // default 0.35
    similarityRatio: number; // default 0.20
    recency: number; // default 0.10
  };
  thresholds: {
    low: number; // < 30  → red badge
    medium: number; // 30–59 → yellow badge
    high: number; // 60–79 → green badge
    trusted: number; // ≥ 80  → blue "Trusted" badge
  };
}

interface ScoreBreakdown {
  likeRatio: number; // likes / (likes + dislikes), 0–1 normalized
  detailScore: number; // derived from route text length, image count, link count, vehicle selection
  similarityRatio: number; // cosine-like comparison with other posts sharing same tags (community corroboration)
  recency: number; // decay: 1.0 at 0 days → 0.0 at 90 days
  total: number; // weighted sum * 100
  trustLevel: "low" | "medium" | "high" | "trusted";
}

class ValidityEngine {
  constructor(private config: ValidityConfig) {}

  compute(post: Post, context: { similarPosts: Post[] }): ScoreBreakdown {
    const likeRatio = this.computeLikeRatio(post);
    const detailScore = this.computeDetailScore(post);
    const similarityRatio = this.computeSimilarityRatio(
      post,
      context.similarPosts,
    );
    const recency = this.computeRecency(post.createdAt);

    const { weights } = this.config;
    const total = Math.round(
      likeRatio * weights.likeRatio * 100 +
        detailScore * weights.detailScore * 100 +
        similarityRatio * weights.similarityRatio * 100 +
        recency * weights.recency * 100,
    );

    return {
      likeRatio,
      detailScore,
      similarityRatio,
      recency,
      total,
      trustLevel: this.getTrustLevel(total),
    };
  }

  private computeLikeRatio(post: Post): number {
    const total = post.likes + post.dislikes;
    return total === 0 ? 0.5 : post.likes / total;
  }

  private computeDetailScore(post: Post): number {
    const textScore = Math.min(
      post.routes.reduce((s, r) => s + r.text.length, 0) / 1500,
      1,
    );
    const imageScore = Math.min(post.images.length / 3, 1);
    const linkScore = Math.min(
      post.routes.flatMap((r) => r.links).length / 5,
      1,
    );
    const vehicleScore = Math.min(
      post.routes.filter((r) => r.vehicles.length > 0).length /
        post.routes.length,
      1,
    );
    const verifiedRouteScore =
      post.routes.filter((r) => r.status === "verified").length /
      post.routes.length;
    return (
      textScore * 0.4 +
      imageScore * 0.2 +
      linkScore * 0.15 +
      vehicleScore * 0.1 +
      verifiedRouteScore * 0.15
    );
  }

  private computeSimilarityRatio(post: Post, similarPosts: Post[]): number {
    if (similarPosts.length === 0) return 0;
    const corroborated = similarPosts.filter(
      (p) => p.tags.some((tag) => post.tags.includes(tag)) && p.id !== post.id,
    ).length;
    return Math.min(corroborated / 5, 1); // up to 5 similar posts = full score
  }

  private computeRecency(createdAt: string): number {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    return Math.max(0, 1 - ageDays / 90);
  }

  getTrustLevel(score: number): ScoreBreakdown["trustLevel"] {
    const { thresholds } = this.config;
    if (score < thresholds.low) return "low";
    if (score < thresholds.medium) return "medium";
    if (score < thresholds.high) return "high";
    return "trusted";
  }
}
```

#### 5.1.2 TrustBadge UX Component

```typescript
// components/ui/TrustBadge.tsx
interface TrustBadgeProps {
  score: ScoreBreakdown;
  size?: 'small' | 'default';
  showTooltip?: boolean;
}

const BADGE_CONFIG: Record<ScoreBreakdown['trustLevel'], { label: string; color: string; icon: string }> = {
  low:     { label: 'Low Trust',   color: 'red',    icon: '⚠️' },
  medium:  { label: 'Developing',  color: 'orange', icon: '🔸' },
  high:    { label: 'Verified',    color: 'green',  icon: '✅' },
  trusted: { label: 'Trusted',     color: 'blue',   icon: '🏅' },
};

// Tooltip shows breakdown: Like Ratio, Detail Score, Similarity, Recency (each as progress bars)
export function TrustBadge({ score, size = 'default', showTooltip = true }: TrustBadgeProps) {
  const config = BADGE_CONFIG[score.trustLevel];

  const tooltipContent = (
    <div className="space-y-2 min-w-[200px]">
      <div className="font-semibold text-sm">Validity Score: {score.total}/100</div>
      {[
        { label: 'Community Approval', value: score.likeRatio,       weight: '35%' },
        { label: 'Route Detail',       value: score.detailScore,     weight: '35%' },
        { label: 'Corroboration',      value: score.similarityRatio, weight: '20%' },
        { label: 'Recency',            value: score.recency,         weight: '10%' },
      ].map(({ label, value, weight }) => (
        <div key={label}>
          <div className="flex justify-between text-xs">
            <span>{label}</span><span>{weight} · {Math.round(value * 100)}%</span>
          </div>
          <Progress percent={Math.round(value * 100)} size="small" showInfo={false} />
        </div>
      ))}
    </div>
  );

  const badge = <Tag color={config.color}>{config.icon} {config.label} · {score.total}</Tag>;

  return showTooltip
    ? <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: 260 }}>{badge}</Tooltip>
    : badge;
}
```

---

### 5.2 Drafting Coach

> **Purpose**: Real-time nudge system in `ShareRouteModal` that rewards quality behaviors and guides posts toward higher Validity scores before submission.

#### 5.2.1 Quality Checkpoint Config

```typescript
// lib/config/draftingCoach.ts
export interface QualityCheckpoint {
  id: string;
  label: string; // e.g. "Add at least 2 photos"
  description: string;
  scoreBoost: number; // how much score this adds (0–100 budget)
  evaluate: (draft: Partial<Post>) => boolean;
  nudge: string; // copy shown when NOT met
  celebrationEmoji: string; // shown when met
  priority: number; // order of display / importance
}

export const QUALITY_CHECKPOINTS: QualityCheckpoint[] = [
  {
    id: "has-title",
    label: "Route title added",
    scoreBoost: 10,
    evaluate: (d) => (d.title?.trim().length ?? 0) >= 5,
    nudge: "Give your route a catchy title — first impressions count!",
    celebrationEmoji: "✏️",
    priority: 1,
  },
  {
    id: "min-routes",
    label: "At least 2 route steps",
    scoreBoost: 15,
    evaluate: (d) =>
      (d.routes?.filter((r) => r.text.trim().length > 0).length ?? 0) >= 2,
    nudge: "Break your route into steps — travelers love clear directions.",
    celebrationEmoji: "🗺️",
    priority: 2,
  },
  {
    id: "has-images",
    label: "2+ photos added",
    scoreBoost: 20,
    evaluate: (d) => (d.images?.length ?? 0) >= 2,
    nudge: "Photos boost trust by 20 points — snap what you see on the route!",
    celebrationEmoji: "📸",
    priority: 3,
  },
  {
    id: "has-vehicles",
    label: "Vehicle types selected",
    scoreBoost: 10,
    evaluate: (d) =>
      d.routes?.every((r) => (r.vehicles?.length ?? 0) > 0) ?? false,
    nudge: "Which vehicles do you use? Helps people plan their ride.",
    celebrationEmoji: "🚌",
    priority: 4,
  },
  {
    id: "has-fares",
    label: "Fares included",
    scoreBoost: 10,
    evaluate: (d) => d.routes?.some((r) => (r.fare ?? 0) > 0) ?? false,
    nudge: "Add approximate fares — budget travelers will thank you!",
    celebrationEmoji: "💰",
    priority: 5,
  },
  {
    id: "has-tags",
    label: "3+ tags added",
    scoreBoost: 10,
    evaluate: (d) => (d.tags?.length ?? 0) >= 3,
    nudge: "Tags help people discover your route — add at least 3.",
    celebrationEmoji: "🏷️",
    priority: 6,
  },
  {
    id: "dense-text",
    label: "Detailed descriptions",
    scoreBoost: 15,
    evaluate: (d) =>
      (d.routes?.reduce((s, r) => s + r.text.length, 0) ?? 0) >= 300,
    nudge:
      "More detail = more trust. Aim for 300+ characters across all steps.",
    celebrationEmoji: "📝",
    priority: 7,
  },
  {
    id: "has-links",
    label: "External links added",
    scoreBoost: 10,
    evaluate: (d) => (d.routes?.flatMap((r) => r.links ?? []).length ?? 0) >= 1,
    nudge: "Add a Google Maps link or transit schedule for extra credibility.",
    celebrationEmoji: "🔗",
    priority: 8,
  },
];
```

#### 5.2.2 DraftingCoach Component Integration

```typescript
// components/features/posts/DraftingCoach.tsx
// Embedded inside ShareRouteModal — live-updates as user types

interface DraftingCoachProps {
  draft: Partial<Post>;
  checkpoints: QualityCheckpoint[];    // from config or DB
}

export function DraftingCoach({ draft, checkpoints }: DraftingCoachProps) {
  const coach = new DraftingCoachService(checkpoints);
  const score = coach.getScore(draft);
  const feedback = coach.evaluate(draft);
  const met = feedback.filter(f => f.met);
  const unmet = feedback.filter(f => !f.met).sort((a, b) => b.checkpoint.priority - a.checkpoint.priority);

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Drafting Coach</span>
        <Tag color={score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red'}>
          Score: {score}/100
        </Tag>
      </div>
      <Progress percent={score} strokeColor={{ '0%': '#e4626f', '50%': '#f4c790', '100%': '#00623B' }} />

      {/* Top unmet nudge */}
      {unmet.length > 0 && (
        <Alert type="info" showIcon
          message={unmet[0].checkpoint.nudge}
          className="text-sm"
        />
      )}

      {/* Completed checkpoints */}
      <div className="flex flex-wrap gap-1">
        {met.map(f => (
          <Tag key={f.checkpoint.id} color="green" className="text-xs">
            {f.checkpoint.celebrationEmoji} {f.checkpoint.label}
          </Tag>
        ))}
      </div>
    </div>
  );
}
```

---

### 5.3 Maps: Route Tracing & Polyline Strategy

> **Goal**: Automatically visualize the sequence of geographic pins/waypoints in a route as a polyline on a map, while allowing manual user alteration.

#### 5.3.1 Open-Source Tool Selection

| Tool                                      | Purpose                                                | License    |
| ----------------------------------------- | ------------------------------------------------------ | ---------- |
| **Leaflet** (`leaflet` + `react-leaflet`) | Map rendering, polyline display                        | BSD-2      |
| **OpenRouteService API**                  | Auto-route between waypoints (free tier: 2000 req/day) | Apache 2.0 |
| **Nominatim** (already used)              | Forward geocoding of place names → coordinates         | ODbL       |
| **OSRM** (optional self-host)             | Offline routing engine for high-volume                 | BSD-2      |

#### 5.3.2 Data Model Extension

```typescript
// Extend Route interface with optional geo data
interface RoutePin {
  placeId?: string; // Nominatim place_id
  label: string; // Human-readable stop name
  lat: number;
  lng: number;
  type: "origin" | "waypoint" | "destination";
}

// Extend Route (add to interfaces.ts)
interface Route {
  // … existing fields …
  pin?: RoutePin; // optional geographic anchor
  polyline?: string; // encoded polyline string (Google format or GeoJSON LineString)
}
```

#### 5.3.3 Auto-Tracing Flow

```
User adds Route steps (text + vehicle + fare)
  ↓
Optional: User types location name in each step → Nominatim forward geocode → RoutePin{lat,lng}
  ↓
[Auto-Route button] → OpenRouteService /directions/driving-car?coordinates=[[lng1,lat1],[lng2,lat2]...]
  ↓
Response: GeoJSON LineString → decoded → Leaflet Polyline rendered on map
  ↓
User can drag Leaflet markers to adjust waypoints → re-query ORS → update polyline
  ↓
On submit: store pin[] and polyline string in Route.pin / Route.polyline (JSON column in Prisma)
```

#### 5.3.4 `RouteMap` Component Spec

```typescript
// components/features/posts/RouteMap.tsx
interface RouteMapProps {
  routes: Route[];
  editable?: boolean; // true in ShareRouteModal, false in PostCard
  onRoutePinsChange?: (pins: RoutePin[]) => void;
  height?: number; // default 300px
}

// Key behaviors:
// - Renders Leaflet Map with OpenStreetMap tiles (no API key)
// - Plots RoutePin markers numbered 1…n (matching route steps)
// - Draws Polyline between pins (auto-traced or straight-line fallback)
// - In editable mode: draggable markers + "Auto-trace route" button (calls ORS)
// - Persists to parent via onRoutePinsChange callback
// - Falls back to straight-line segments if ORS unavailable (no API key / rate limit)
```

#### 5.3.5 Polyline Encoding/Storage

- Store as **Encoded Polyline** (Google format) for compact JSON column storage
- Decode client-side with `@mapbox/polyline` (tiny, no dependencies)
- Alternative: store as GeoJSON `LineString` in a `Json` Prisma column

---

## 6. STATE & INTEGRATIONS

### 6.1 State Architecture

#### 6.1.1 Current State Layers

| Layer         | Technology                      | Scope                                                 |
| ------------- | ------------------------------- | ----------------------------------------------------- |
| Global Auth   | React Context (`AuthProvider`)  | User identity, login/logout                           |
| Global Theme  | React Context (`ThemeProvider`) | Dark/light mode                                       |
| Server Cache  | Upstash Redis                   | Feed, post, profile TTL caches                        |
| Client State  | `useState` / custom hooks       | Component-local + cross-component via props           |
| Optimistic UI | Hook-level rollback pattern     | Like/dislike/bookmark/follow in `useFeedInteractions` |

#### 6.1.2 RxJS / In-Memory Caching (Recommended Addition)

For reactive streams (real-time feed updates, notification polling), introduce RxJS:

```typescript
// lib/streams/feedStream.ts
import { BehaviorSubject, Subject, combineLatest, interval } from "rxjs";
import { switchMap, distinctUntilChanged, debounceTime } from "rxjs/operators";

// Feed state as observable
const feedPosts$ = new BehaviorSubject<Post[]>([]);
const newPostsAvailable$ = new Subject<number>();

// Poll for new posts every 30s
const feedPoller$ = interval(30000).pipe(
  switchMap(() => fetchLatestPostTimestamp()),
  distinctUntilChanged(),
);

// In-memory interaction cache (avoids repeated API calls per session)
const interactionCache$ = new BehaviorSubject<
  Map<string, UserInteractionState>
>(new Map());

// Search with debounce
const searchQuery$ = new Subject<string>();
const searchResults$ = searchQuery$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap((query) => fetchSearchResults(query)),
);
```

**Adoption path**: Replace the current `useNewPostsNotification` polling with `feedPoller$`. Introduce `interactionCache$` to eliminate N+1 per-post interaction checks in `useFeedInteractions`.

### 6.2 OAuth Integration

#### 6.2.1 Google OAuth

```typescript
// app/api/auth/google/route.ts (new)
// Uses next-auth or manual OAuth 2.0 flow
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/google/callback`,
  scope: "openid email profile",
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
};

// Flow:
// 1. GET /api/auth/google → redirect to Google consent screen
// 2. Callback: GET /api/auth/google/callback?code=...
// 3. Exchange code for tokens → fetch userInfo
// 4. Upsert User in DB (by email) → issue Along JWT → set cookie
// 5. Redirect to /home
```

#### 6.2.2 Email Magic Link (Passwordless)

```typescript
// app/api/auth/magic-link/route.ts (new)
// Flow:
// 1. POST /api/auth/magic-link { email } → generate signed JWT (15min TTL) → send via email provider
// 2. GET /api/auth/magic-link/verify?token=... → decode JWT → upsert user → set cookie → /home

// Token structure
const magicLinkPayload = {
  email: string;
  type: 'magic-link';
  exp: number;              // 15 minutes
};
```

#### 6.2.3 OTP Enhancement (Current)

Current: 6-digit numeric OTP stored in-memory (dev) or Redis (prod).  
Upgrade: use `TOTP` (time-based, no storage needed) via `otplib`.

### 6.3 Integration Hooks

#### 6.3.1 "Transact" Marketplace Integration

> Stub page exists at `/marketplace`. Future: embedded microfrontend or redirect.

```typescript
// lib/integrations/transact.ts
export interface TransactConfig {
  baseUrl: string; // e.g. https://transact.along.app
  apiKey: string; // service-to-service key
  webhookSecret: string;
}

export interface TransactListing {
  routePostId: string; // links back to Along post
  sellerId: string; // Along userId
  type: "guide" | "tour" | "ticket";
  price: number;
  currency: "NGN";
  available: boolean;
}

// Integration points:
// - PostCard: "Buy Guide" button if listing exists for post
// - Profile: "Seller Dashboard" link to Transact
// - Webhook: Transact → Along /api/webhooks/transact (order confirmations, payouts)
```

#### 6.3.2 "Tega" Events Integration

```typescript
// lib/integrations/tega.ts
export interface TegaConfig {
  baseUrl: string;
  apiKey: string;
}

export interface TegaEvent {
  id: string;
  routePostId?: string; // optional link to Along post
  title: string;
  date: string;
  location: string;
  capacity: number;
  registered: number;
}

// Integration points:
// - Feed: "Events near this route" widget (sidebar)
// - Post detail: embedded event card if event references this route
// - Webhook: Tega → Along /api/webhooks/tega (event RSVPs, cancellations)
```

#### 6.3.3 Webhook Handler Pattern

```typescript
// app/api/webhooks/[provider]/route.ts
// Verifies HMAC signature → routes to handler → queues background job

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } },
) {
  const signature = req.headers.get("x-webhook-signature");
  const body = await req.text();

  if (
    !verifyWebhookSignature(body, signature, getWebhookSecret(params.provider))
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  await enqueueWebhookJob({ provider: params.provider, event });
  return NextResponse.json({ received: true });
}
```

### 6.4 Feed Algorithm Config Object

```typescript
// lib/config/feedAlgorithm.ts (promotes inline weights from feedService.ts)
export interface FeedAlgorithmConfig {
  weights: {
    following: number; // 0.70
    tagMatch: number; // 0.20
    trending: number; // 0.10
    location: number; // 0.15 (bonus, additive)
  };
  trendingFormula: {
    likeWeight: number; // 1.0
    commentWeight: number; // 2.0
    bookmarkWeight: number; // 1.5
    windowDays: number; // 7
  };
  tagHistory: {
    maxActivities: number; // 100
    activityTypes: ActivityType[];
    maxTags: number; // 10
  };
  scoreTiebreak: {
    threshold: number; // 5 — if score delta < this, prefer newer
  };
  pageSize: number; // 20
}

export const DEFAULT_FEED_CONFIG: FeedAlgorithmConfig = {
  weights: { following: 0.7, tagMatch: 0.2, trending: 0.1, location: 0.15 },
  trendingFormula: {
    likeWeight: 1.0,
    commentWeight: 2.0,
    bookmarkWeight: 1.5,
    windowDays: 7,
  },
  tagHistory: {
    maxActivities: 100,
    activityTypes: ["LIKE", "BOOKMARK", "COMMENT"],
    maxTags: 10,
  },
  scoreTiebreak: { threshold: 5 },
  pageSize: 20,
};
```

---

## 7. PERFORMANCE

### 7.1 ACID-Compliant Bulk Operations

Use Prisma `$transaction` for all multi-step mutations to guarantee atomicity:

#### 7.1.1 Like Toggle (atomic counter + record)

```typescript
await prisma.$transaction([
  prisma.like.upsert({
    where: { postId_userId: { postId, userId } },
    create: { postId, userId, type },
    update: { type },
  }),
  prisma.post.update({
    where: { id: postId },
    data: { likes: { increment: 1 } },
  }),
  prisma.userActivity.create({
    data: { userId, type: "LIKE", postId, score: 1.0 },
  }),
]);
```

#### 7.1.2 Follow Toggle (atomic follower counts)

```typescript
await prisma.$transaction([
  prisma.follow.create({ data: { followerId, followingId } }),
  prisma.notification.create({
    data: {
      type: "FOLLOW",
      actorId: followerId,
      recipients: { create: { userId: followingId } },
    },
  }),
]);
```

#### 7.1.3 Post Delete (cascade cleanup)

Prisma schema uses `onDelete: Cascade` on Comment, Like, Bookmark, Notification — single delete cascades correctly.

#### 7.1.4 Bulk Feed Enrichment

```typescript
// Instead of N+1 per-post queries (current useFeedInteractions bug):
const [likes, bookmarks, following] = await prisma.$transaction([
  prisma.like.findMany({ where: { userId, postId: { in: postIds } } }),
  prisma.bookmark.findMany({ where: { userId, postId: { in: postIds } } }),
  prisma.follow.findMany({
    where: { followerId: userId, followingId: { in: authorIds } },
  }),
]);
```

### 7.2 Webhook-Driven Scaling

```
Event Triggers → API Route → Redis Queue (Bull/BullMQ or Upstash QStash)
                                          ↓
                                  Worker (Vercel Function / separate service)
                                          ↓
                              DB write + Cache invalidation + Push notification
```

**Webhook-scaled operations**:
| Event | Queue Job | Side Effects |
|---|---|---|
| Post created | `post.created` | Invalidate feed caches for followers; send push to followers; update trending cache |
| Post liked | `post.liked` | Increment counter; notify author; invalidate post cache |
| User followed | `user.followed` | Notify followee; invalidate feed cache for follower |
| Comment added | `comment.added` | Notify post author; increment comment count; invalidate post cache |
| Image uploaded to Cloudinary | `image.uploaded` | Store URL in DB; delete old image if replaced |

### 7.3 Indexing Strategy (Prisma Schema)

Already defined — key indexes to verify are deployed:

```sql
-- Users
CREATE INDEX idx_users_username ON "User"("userName");
CREATE INDEX idx_users_email ON "User"("email");
CREATE INDEX idx_users_created ON "User"("createdAt");

-- Posts
CREATE INDEX idx_posts_user ON "Post"("userId");
CREATE INDEX idx_posts_created_desc ON "Post"("createdAt" DESC);
CREATE INDEX idx_posts_tags ON "Post" USING GIN("tags");  -- GIN for array search

-- Follows (critical for feed)
CREATE INDEX idx_follows_follower ON "Follow"("followerId");
CREATE INDEX idx_follows_following ON "Follow"("followingId");

-- UserActivity (critical for tag scoring)
CREATE INDEX idx_activity_user_created ON "UserActivity"("userId", "createdAt");
```

### 7.4 Caching Strategy Summary

| Resource         | Key Pattern              | TTL    | Invalidation Trigger                |
| ---------------- | ------------------------ | ------ | ----------------------------------- |
| User feed        | `feed:{userId}:{cursor}` | 5 min  | Post create/delete by followed user |
| Post detail      | `post:{postId}`          | 15 min | Post update/delete/like             |
| User profile     | `user:{userId}`          | 10 min | Profile update / follow change      |
| Trending posts   | `trending:posts`         | 10 min | New post with high engagement       |
| User suggestions | `suggestions:{userId}`   | 30 min | Follow/unfollow                     |
| Search results   | `search:{type}:{query}`  | 5 min  | New content matching query          |
| Site config      | `config:{key}`           | 60 min | Admin config update                 |

### 7.5 N+1 Query Elimination

**Current bug** in `useFeedInteractions.ts`: per-post API calls for likes/bookmarks in a loop.

**Fix**: Single enrichment query at feed fetch time (see §7.1.4), return `isLiked`, `isDisliked`, `isBookmarked` flags embedded in each post from the server — eliminating all client-side N+1 calls.

**Pattern for all list views**:

```typescript
// Always use include with select, never separate queries per item
const posts = await prisma.post.findMany({
  include: {
    postLikes: { where: { userId }, select: { type: true } },
    postBookmarks: { where: { userId }, select: { id: true } },
    user: {
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        avatar: true,
        verified: true,
      },
    },
    _count: { select: { postComments: true } },
  },
});
```

### 7.6 Image Optimization

- All post images served via Cloudinary transformations (`w_800,q_auto,f_auto`)
- Next.js `<Image>` with `fill` + `sizes` for responsive loading (already implemented in PostCard)
- Blur placeholder via base64 data URL (already implemented)
- Lazy loading: images below fold deferred by browser default with `loading="lazy"`

### 7.7 Bundle Optimization

- `ShareRouteModal` already lazily imported in `Feed.tsx` (`React.lazy` + `Suspense`)
- Apply same pattern to: `EditProfileModal`, `CommentSection` (when not in viewport)
- `RouteMap` (Leaflet) must always be lazy — Leaflet doesn't support SSR:
  ```typescript
  const RouteMap = dynamic(
    () => import("@/components/features/posts/RouteMap"),
    { ssr: false },
  );
  ```

---

## APPENDIX A: MIGRATION CHECKLIST (Mock → Production)

- [ ] Set `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` env vars
- [ ] Run `npx prisma migrate deploy` against production PostgreSQL
- [ ] Run `npx prisma db seed` for initial data
- [ ] Configure Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- [ ] Configure JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- [ ] Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` for OAuth
- [ ] Set `NEXTAUTH_URL` for OAuth callback
- [ ] Set `NEXT_PUBLIC_API_URL` if using external API (otherwise Next.js API routes handle all)
- [ ] Configure webhook secrets for Transact and Tega integrations
- [ ] Deploy service worker and verify push notification endpoint
- [ ] Verify GIN index on `Post.tags` column is created

## APPENDIX B: ENVIRONMENT VARIABLES REFERENCE

| Variable                   | Required | Default                 | Purpose                        |
| -------------------------- | -------- | ----------------------- | ------------------------------ |
| `DATABASE_URL`             | Prod     | —                       | PostgreSQL connection string   |
| `UPSTASH_REDIS_REST_URL`   | Prod     | —                       | Redis URL (mock used in dev)   |
| `UPSTASH_REDIS_REST_TOKEN` | Prod     | —                       | Redis auth token               |
| `JWT_SECRET`               | Yes      | —                       | Access token signing key       |
| `JWT_REFRESH_SECRET`       | Yes      | —                       | Refresh token signing key      |
| `CLOUDINARY_CLOUD_NAME`    | Prod     | —                       | Cloudinary account             |
| `CLOUDINARY_API_KEY`       | Prod     | —                       | Cloudinary API key             |
| `CLOUDINARY_API_SECRET`    | Prod     | —                       | Cloudinary API secret          |
| `GOOGLE_CLIENT_ID`         | OAuth    | —                       | Google OAuth client ID         |
| `GOOGLE_CLIENT_SECRET`     | OAuth    | —                       | Google OAuth client secret     |
| `NEXTAUTH_URL`             | OAuth    | `http://localhost:3000` | Base URL for OAuth callbacks   |
| `NEXT_PUBLIC_API_URL`      | Optional | `/api`                  | Override for external API base |
| `NODE_ENV`                 | Auto     | `development`           | Switches mock-redis ↔ Upstash  |

---

_End of PROJECT_CONTEXT.md — Along App v1.0_  
_Optimized for Claude context window indexing: dense headers, TypeScript code blocks, tabular data._
