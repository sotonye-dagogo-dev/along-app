+-----------------------------------------------------------------------+
| **ALONG**                                                             |
|                                                                       |
| **METADATA-DRIVEN STARTUP REVIVAL**                                   |
|                                                                       |
| Product Requirements Document · Engineering Roadmap · Architecture    |
| Spec                                                                  |
|                                                                       |
| Version 2.0 · April 2026 · CONFIDENTIAL                               |
+-----------------------------------------------------------------------+

**DOCUMENT METADATA**

  -----------------------------------------------------------------------
  **Field**          **Value**
  ------------------ ----------------------------------------------------
  Document Title     Along --- Metadata-Driven Startup Revival PRD &
                     Engineering Roadmap

  Version            2.0 (Production Candidate)

  Status             Active Development

  Date               April 22, 2026

  Authors            Senior PM & Technical Architect

  Stack              Next.js 15 · React 19 · TypeScript 5 · Prisma 7 ·
                     PostgreSQL · Upstash Redis

  Classifier         CONFIDENTIAL --- Internal Engineering Use Only
  -----------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **EXECUTIVE SUMMARY**                                                 |
|                                                                       |
| Along is a social travel-intelligence platform --- a Twitter × Google |
| Maps hybrid --- where users share, verify, and discover transport     |
| routes. This document supersedes all prior specs and defines the      |
| complete architecture for a config-first, OOP-compliant,              |
| production-grade rebuild. Scope covers: Config-Driven Engine,         |
| Validity & Trust System, Maps & Travel Discovery, Global              |
| Infrastructure, Ecosystem Integrations, Sustainable Rewards, and a    |
| phased Execution Roadmap.                                             |
+-----------------------------------------------------------------------+

**TABLE OF CONTENTS**

**1. Config-First Architecture**

1.1 Config-to-Code Principle

1.2 Master Config Registry Structure

1.3 Vehicle & Status Registries (with Icon System)

1.4 Navigation, Form, Notification Registries

1.5 DiceBear Avatar System

1.6 Footer & Team Config

1.7 Admin-Editable DB Config Pattern

1.8 Dependency Update Matrix

**2. Validity & Trust System**

2.1 ValidityEngine Algorithm (full spec)

2.2 Trust Badge UX

2.3 Drafting Coach --- Real-Time Score Prediction

**3. Maps & Travel Discovery**

3.1 Map Stack Decision (MapLibre + Google APIs)

3.2 Data Model Extension

3.3 Route Auto-Tracing Flow

3.4 Feed, Route & User Suggestion Algorithms

3.5 Platform-Generated Route Suggestions

3.6 Config-Based Transport Integrations

**4. Global Infrastructure**

4.1 Modal & Toast System

4.2 Confirm Modal & Undo System

4.3 Offline / PWA Architecture

4.4 Image Handling (Cloudinary)

4.5 Bug Report & Contact System

4.6 Analytics & Invite System

**5. ACID-Compliant DB Schema**

5.1 Full Extended Prisma Schema

5.2 Index Strategy

5.3 Key Transaction Patterns

**6. Ecosystem API Contracts**

6.1 Transact Marketplace

6.2 Tega Promotions

6.3 Webhook Handler Pattern

**7. Sustainable Rewards System**

7.1 Points Economy Design

7.2 Reward Tiers

7.3 Invite System

**8. Execution & Phased Roadmap**

8.1 Phase 0: Foundation (Weeks 1-2)

8.2 Phase 1: Core Product (Weeks 3-6)

8.3 Phase 2: Discovery & Maps (Weeks 7-10)

8.4 Phase 3: Ecosystem & Rewards (Weeks 11-14)

8.5 Phase 4: Scale & Polish (Weeks 15+)

**Appendix A: Environment Variables**

**Appendix B: Architectural Diagrams (Text)**

**Appendix C: Key File Directory**

**1. CONFIG-FIRST ARCHITECTURE**

+-----------------------------------------------------------------------+
| **PRINCIPLE**                                                         |
|                                                                       |
| Every UI component, business logic path, and page structure MUST      |
| derive from a centralized Config Object. \'Adding a feature\' means   |
| updating a config registry, never rewriting component logic. All      |
| lists and modules are rendered via Object.values() mapping over       |
| config arrays. The codebase is strictly OOP-compliant, modular, and   |
| zero-hardcode.                                                        |
+-----------------------------------------------------------------------+

**1.1 Config-to-Code Principle**

The Config-Driven Engine has four layers:

-   Config Layer --- lib/config/\* --- canonical source-of-truth
    TypeScript objects

-   Engine Layer --- lib/services/\* --- classes that read config and
    execute logic

-   Component Layer --- components/ui/\* --- generic renderers that
    iterate config

-   Data Layer --- lib/db/\* --- repositories wired through
    BaseRepository\<T\>

**1.2 Master Config Registry Structure**

All config files live in lib/config/. Each exports a typed constant +
TypeScript interface.

  ----------------------------------------------------------------------------
  **File**              **Export**                 **Consumers**
  --------------------- -------------------------- ---------------------------
  vehicles.ts           VEHICLE_REGISTRY           PostCard, ShareRouteModal,
                                                   FilterBar, RouteForm

  routeStatus.ts        ROUTE_STATUS_REGISTRY      PostCard, AdminDashboard,
                                                   ValidityEngine

  navigation.ts         NAV_REGISTRY               DashboardNavbar,
                                                   DesktopTopBar,
                                                   MobileBottomNav, Sitemap

  forms.ts              REGISTER_FIELDS,           ConfigDrivenForm, Zod
                        LOGIN_FIELDS, POST_FIELDS, validation
                        ...                        

  notifications.ts      NOTIFICATION_REGISTRY      NotificationItem,
                                                   NotificationDropdown,
                                                   PushHandler

  feedAlgorithm.ts      DEFAULT_FEED_CONFIG        feedService.ts, SiteConfig
                                                   DB override

  draftingCoach.ts      QUALITY_CHECKPOINTS        DraftingCoach component,
                                                   ValidityEngine

  avatar.ts             DICEBEAR_CONFIG,           AvatarEditor, ProfileCard,
                        AVATAR_STYLES              UserAvatar

  footer.ts             FOOTER_CONFIG              AppFooter component

  teamConfig.ts         TEAM_MEMBERS               About page, Admin team
                                                   editor

  mapIntegrations.ts    MAP_INTEGRATION_REGISTRY   RouteMap, ExploreMap,
                                                   SuggestionEngine

  rewards.ts            REWARD_TIERS,              RewardsPanel, UserProfile,
                        POINTS_CONFIG              InviteSystem

  rateLimits.ts         RATE_LIMITS                API_REGISTRY,
                                                   BaseApiHandler

  validationRules.ts    VALIDATION_RULES           Zod schemas,
                                                   ConfigDrivenForm rules

  cache.ts              CACHE_TTL, CACHE_KEYS      redis.ts, all repositories

  apiRegistry.ts        API_REGISTRY               axios wrapper,
                                                   auto-generated client
  ----------------------------------------------------------------------------

**1.3 Vehicle Registry --- Icon System (No Emojis)**

All vehicle representations use Lucide React icons or Ant Design icons
--- never emoji strings. The VEHICLE_REGISTRY is the single source of
truth across the entire codebase.

> // lib/config/vehicles.ts
>
> import { Car, Bike, Bus, PersonStanding, Truck, Tractor } from
> \'lucide-react\';
>
> export type VehicleType = \'taxi\' \| \'bike\' \| \'keke\' \| \'bus\'
> \| \'trekking\' \| \'car\' \| \'bolt\';
>
> export interface VehicleConfig {
>
> value: VehicleType;
>
> label: string;
>
> icon: React.ComponentType\<{ size?: number; className?: string }\>;
>
> iconName: string; // for serialization / icon lookup
>
> color: string; // Tailwind bg class
>
> textColor: string; // Tailwind text class
>
> maxPassengers?: number;
>
> estimatedSpeed?: number; // km/h average, for ETA calc
>
> isPublic: boolean;
>
> }
>
> export const VEHICLE_REGISTRY: Record\<VehicleType, VehicleConfig\> =
> {
>
> taxi: { value:\'taxi\', label:\'Taxi\', icon:Car, iconName:\'Car\',
> color:\'bg-yellow-100\', textColor:\'text-yellow-800\',
> maxPassengers:4, estimatedSpeed:35, isPublic:false },
>
> bike: { value:\'bike\', label:\'Bike\', icon:Bike, iconName:\'Bike\',
> color:\'bg-orange-100\', textColor:\'text-orange-800\',
> maxPassengers:1, estimatedSpeed:25, isPublic:false },
>
> keke: { value:\'keke\', label:\'Keke\', icon:Tractor,
> iconName:\'Tractor\', color:\'bg-green-100\',
> textColor:\'text-green-800\', maxPassengers:3, estimatedSpeed:20,
> isPublic:true },
>
> bus: { value:\'bus\', label:\'Bus\', icon:Bus, iconName:\'Bus\',
> color:\'bg-blue-100\', textColor:\'text-blue-800\', maxPassengers:50,
> estimatedSpeed:30, isPublic:true },
>
> trekking: { value:\'trekking\', label:\'Trekking\',
> icon:PersonStanding,iconName:\'PersonStanding\',color:\'bg-gray-100\',
> textColor:\'text-gray-800\', maxPassengers:1, estimatedSpeed:5,
> isPublic:true },
>
> car: { value:\'car\', label:\'Car\', icon:Car, iconName:\'Car\',
> color:\'bg-indigo-100\', textColor:\'text-indigo-800\',
> maxPassengers:5, estimatedSpeed:40, isPublic:false },
>
> bolt: { value:\'bolt\', label:\'Bolt Ride\', icon:Truck,
> iconName:\'Truck\', color:\'bg-lime-100\',
> textColor:\'text-lime-800\', maxPassengers:4, estimatedSpeed:40,
> isPublic:false },
>
> };

**1.4 Navigation Registry --- Context-Aware Rendering**

NAV_REGISTRY drives all navigation surfaces. Components read role and
auth status from context and filter accordingly --- there are no
role-specific pages, only role-aware components.

> export interface NavItem {
>
> key: string;
>
> label: string;
>
> href: string;
>
> icon: React.ComponentType;
>
> activeIcon?: React.ComponentType;
>
> requiresAuth: boolean;
>
> requiredRole?: \'admin\' \| \'user\'; // undefined = all roles
>
> badge?: \'notifications\' \| \'messages\';
>
> showInMobile: boolean;
>
> showInDesktop: boolean;
>
> group?: \'primary\' \| \'admin\'; // admin items rendered separately
>
> }
>
> // Admin users see both \'primary\' group AND \'admin\' group items
>
> // Regular users see only \'primary\' group items where requiredRole
> !== \'admin\'
>
> export function filterNavItems(items: NavItem\[\], role: string,
> isAuth: boolean): NavItem\[\] {
>
> return items.filter(i =\>
>
> (!i.requiresAuth \|\| isAuth) &&
>
> (!i.requiredRole \|\| i.requiredRole === role \|\| role === \'admin\')
>
> );
>
> }

**1.5 DiceBear Avatar System**

Avatars are generated dynamically via the DiceBear API --- no image
uploads needed for avatars. The system saves API query parameters in the
DB, generating URLs at runtime with CDN caching.

> // lib/config/avatar.ts
>
> export const DICEBEAR_BASE_URL = \'https://api.dicebear.com/9.x\';
>
> export const AVATAR_STYLES = \[
>
> { id:\'adventurer\', label:\'Adventurer\', previewSeed:\'along\' },
>
> { id:\'avataaars\', label:\'Avataaars\', previewSeed:\'along\' },
>
> { id:\'big-smile\', label:\'Big Smile\', previewSeed:\'along\' },
>
> { id:\'bottts\', label:\'Bottts\', previewSeed:\'along\' },
>
> { id:\'croodles\', label:\'Croodles\', previewSeed:\'along\' },
>
> { id:\'fun-emoji\', label:\'Fun Emoji\', previewSeed:\'along\' },
>
> { id:\'lorelei\', label:\'Lorelei\', previewSeed:\'along\' },
>
> { id:\'micah\', label:\'Micah\', previewSeed:\'along\' },
>
> { id:\'notionists\', label:\'Notionists\', previewSeed:\'along\' },
>
> { id:\'open-peeps\', label:\'Open Peeps\', previewSeed:\'along\' },
>
> \] as const;
>
> export interface AvatarConfig {
>
> style: string; // e.g. \'adventurer\'
>
> seed: string; // user\'s deterministic seed (userName or UUID)
>
> options: Record\<string, string \| boolean\>; // style-specific
> options
>
> }
>
> export function buildAvatarUrl(config: AvatarConfig): string {
>
> const params = new URLSearchParams({ seed: config.seed,
> \...config.options });
>
> return \`\${DICEBEAR_BASE_URL}/\${config.style}/svg?\${params}\`;
>
> }
>
> // Fallback: if DiceBear unreachable, show initials-based avatar
>
> export function getFallbackAvatarUrl(name: string): string {
>
> return
> \`https://ui-avatars.com/api/?name=\${encodeURIComponent(name)}&background=00623B&color=fff\`;
>
> }

The AvatarEditor UI provides style selector cards with live previews,
color pickers for supported styles, and an instant preview panel --- all
mutations are client-side before save.

**1.6 Footer & Team Config**

> // lib/config/footer.ts
>
> export const FOOTER_CONFIG = {
>
> brand: { name: \'Along\', tagline: \'Navigate Together\' },
>
> links: \[
>
> { group: \'Product\', items:
> \[{label:\'Home\',href:\'/home\'},{label:\'Explore\',href:\'/explore\'},{label:\'Marketplace\',href:\'/marketplace\'}\]
> },
>
> { group: \'Company\', items:
> \[{label:\'About\',href:\'/about\'},{label:\'Contact\',href:\'/contact\'},{label:\'Careers\',href:\'/careers\'}\]
> },
>
> { group: \'Legal\', items:
> \[{label:\'Privacy\',href:\'/privacy\'},{label:\'Terms\',href:\'/terms\'}\]
> },
>
> \],
>
> social: \[
>
> { platform:\'twitter\', href:\'https://twitter.com/alongapp\',
> icon:\'Twitter\' },
>
> { platform:\'instagram\', href:\'https://instagram.com/alongapp\',
> icon:\'Instagram\' },
>
> \],
>
> devCredit: {
>
> text: \'Built by S.D\',
>
> href: \'https://sotonye-dagogo.is-a.dev\',
>
> },
>
> copyright: \`© \${new Date().getFullYear()} Along. All rights
> reserved.\`,
>
> };
>
> // lib/config/teamConfig.ts --- admin-editable via SiteConfig DB
>
> export interface TeamMember {
>
> id: string;
>
> name: string;
>
> role: string;
>
> bio: string;
>
> imageUrl: string; // Cloudinary URL
>
> links: { platform: string; href: string }\[\];
>
> }

**1.7 Admin-Editable DB Config Pattern**

Runtime config without deploys. Admin UI at /admin/config allows
updating live parameters. Redis caches with 60-min TTL; local TypeScript
fallbacks guarantee zero-downtime.

  ----------------------------------------------------------------------------------------------------------------------
  **Config Key**                  **Type**                         **Default**     **Admin-Editable**   **Purpose**
  ------------------------------- -------------------------------- --------------- -------------------- ----------------
  feedAlgorithm.weights           {follow,tag,trending,location}   {70,20,10,15}   Yes                  Feed ranking

  validityEngine.thresholds       {low,medium,high,trusted}        {30,60,80,90}   Yes                  Trust badge
                                                                                                        levels

  draftingCoach.checkpoints       QualityCheckpoint\[\]            See §2.3        Yes                  Coach guidance

  postLimits.maxRoutes            number                           20              Yes                  UX cap

  postLimits.maxImages            number                           10              Yes                  Storage budget

  rewards.pointsPerPost           number                           50              Yes                  Incentive
                                                                                                        economy

  rewards.pointsPerVerification   number                           25              Yes                  Incentive
                                                                                                        economy

  rateLimits.\*                   RateLimitConfig                  See             Yes                  Dynamic throttle
                                                                   rateLimits.ts                        

  teamMembers                     TeamMember\[\]                   teamConfig.ts   Yes                  About page

  featuredReviews                 Review\[\]                       Top-rated       Yes                  About page
                                                                   reviews                              
  ----------------------------------------------------------------------------------------------------------------------

**1.8 Dependency Update Matrix**

All packages pinned to latest stable. Peer dependency conflicts resolved
as noted.

  -----------------------------------------------------------------------------------------
  **Package**               **Current**   **Target**   **Breaking    **Migration Note**
                                                       Changes**     
  ------------------------- ------------- ------------ ------------- ----------------------
  next                      15.x          15.3.x       None          Verify turbopack
                                          (latest)                   stability

  react / react-dom         19.x          19.1.x       None          None

  typescript                5.x           5.7.x        None          Enable
                                                                     isolatedDeclarations

  tailwindcss               3.x           4.1.x        \@apply       Migrate globals.css
                                                       changes       

  \@ant-design/icons        5.x           5.6.x        None          None

  antd                      5.x           5.23.x       None          None

  prisma                    7.x           7.1.x        None          Run prisma generate
                                          (latest)                   

  zod                       4.x           4.x latest   None          None

  next-cloudinary           6.x           6.16.x       None          None

  jest                      30.x          30.x latest  None          None

  \@testing-library/react   16.x          16.3.x       None          None

  maplibre-gl               new           4.7.x        N/A           Replaces Leaflet for
                                                                     MapLibre strategy

  react-map-gl              new           7.1.x        N/A           MapLibre React wrapper

  \@dicebear/core           new           9.x          N/A           Avatar generation

  lucide-react              new           0.469.x      N/A           Icon system (replaces
                                                                     emojis)

  rxjs                      new           7.8.x        N/A           Reactive streams for
                                                                     feed

  \@upstash/qstash          new           2.7.x        N/A           Webhook job queue

  workbox-webpack-plugin    7.x           7.3.x        None          PWA service worker
  -----------------------------------------------------------------------------------------

**2. VALIDITY & TRUST SYSTEM**

+-----------------------------------------------------------------------+
| **PURPOSE**                                                           |
|                                                                       |
| The Validity Score (0--100) quantifies route post trustworthiness. It |
| is computed server-side, cached per post, and surfaced through the    |
| Trust Badge UI element and the Drafting Coach real-time feedback      |
| system. This is Along\'s core quality moat --- it separates signal    |
| from noise.                                                           |
+-----------------------------------------------------------------------+

**2.1 ValidityEngine --- Full Algorithm Spec**

**Score Formula**

total = (likeRatio × 0.35) + (detailScore × 0.35) + (similarityRatio ×
0.20) + (recency × 0.10) × 100

  -------------------------------------------------------------------------------------
  **Dimension**     **Weight**   **Computation**                            **Range**
  ----------------- ------------ ------------------------------------------ -----------
  likeRatio         35%          likes / (likes + dislikes). Returns 0.5    0.0 -- 1.0
                                 when no votes (neutral prior).             

  detailScore       35%          Composite: textLength (40%) + imageCount   0.0 -- 1.0
                                 (20%) + linkCount (15%) + vehicleSelection 
                                 (10%) + verifiedRoutes (15%). Each         
                                 sub-score capped at 1.0.                   

  similarityRatio   20%          Count of OTHER posts sharing ≥1 tag.       0.0 -- 1.0
                                 min(corroborated / 5, 1.0). Community      
                                 corroboration signal.                      

  recency           10%          Linear decay: 1.0 at 0 days → 0.0 at 90    0.0 -- 1.0
                                 days. max(0, 1 - ageDays/90).              
  -------------------------------------------------------------------------------------

**Trust Levels**

  ------------------------------------------------------------------------------
  **Level**    **Score    **Badge    **Icon**        **Meaning**
               Range**    Color**                    
  ------------ ---------- ---------- --------------- ---------------------------
  Low Trust    0 -- 29    Red        AlertTriangle   Insufficient data or
                                                     community rejection

  Developing   30 -- 59   Orange     Clock           Route gaining traction, use
                                                     with caution

  Verified     60 -- 79   Green      CheckCircle     Community-approved,
                                                     reliable

  Trusted      80 -- 100  Blue       Shield + Star   Exceptional quality, high
                          (brand)                    corroboration
  ------------------------------------------------------------------------------

**DetailScore Sub-Computation**

> private computeDetailScore(post: Post): number {
>
> const totalTextLen = post.routes.reduce((s, r) =\> s + r.text.length,
> 0);
>
> const textScore = Math.min(totalTextLen / 1500, 1); // 1500 chars =
> full
>
> const imageScore = Math.min(post.images.length / 3, 1); // 3 images =
> full
>
> const linkScore = Math.min(post.routes.flatMap(r =\> r.links).length /
> 5, 1);
>
> const vehicleScore = post.routes.length \> 0
>
> ? post.routes.filter(r =\> r.vehicles.length \> 0).length /
> post.routes.length
>
> : 0;
>
> const verifiedScore = post.routes.length \> 0
>
> ? post.routes.filter(r =\> r.status === \'verified\').length /
> post.routes.length
>
> : 0;
>
> return textScore\*0.40 + imageScore\*0.20 + linkScore\*0.15 +
> vehicleScore\*0.10 + verifiedScore\*0.15;
>
> }

**Caching Strategy**

Validity scores are recomputed on: post update, new like/dislike, new
similar-tag post created. They are cached in Redis at key
validity:{postId} with TTL of 30 minutes. Stale-while-revalidate pattern
--- show cached score, recompute in background.

**2.2 TrustBadge UX Component**

The TrustBadge renders inline on PostCard (compact) and in PostDetail
(full). A Tooltip provides a score breakdown with visual progress bars
for each dimension.

> // components/ui/TrustBadge.tsx --- icon-only (no emojis)
>
> import { AlertTriangle, Clock, CheckCircle, ShieldCheck } from
> \'lucide-react\';
>
> const BADGE_CONFIG: Record\<TrustLevel, BadgeConfig\> = {
>
> low: { label:\'Low Trust\', icon:AlertTriangle,
> colorClass:\'text-red-600 bg-red-50\', border:\'border-red-200\' },
>
> medium: { label:\'Developing\', icon:Clock,
> colorClass:\'text-orange-600 bg-orange-50\',
> border:\'border-orange-200\' },
>
> high: { label:\'Verified\', icon:CheckCircle,
> colorClass:\'text-green-600 bg-green-50\', border:\'border-green-200\'
> },
>
> trusted: { label:\'Trusted\', icon:ShieldCheck,
> colorClass:\'text-blue-700 bg-blue-50\', border:\'border-blue-200\' },
>
> };
>
> // Tooltip breakdown shows 4 Progress bars (likeRatio, detailScore,
> similarityRatio, recency)
>
> // each labeled with dimension name, weight, and percentage value

**2.3 Drafting Coach --- Real-Time Score Prediction**

Embedded in ShareRouteModal. Re-evaluates on every keystroke / field
change via debounced useMemo. Shows current projected score, next
highest-impact improvement, and completed checkpoints.

  ---------------------------------------------------------------------------
  **Checkpoint    **Score   **Evaluate            **Nudge Copy**
  ID**            Boost**   Condition**           
  --------------- --------- --------------------- ---------------------------
  has-title       +10       title.trim().length   Give your route a catchy
                            \>= 5                 title!

  min-routes      +15       ≥2 non-empty route    Break into steps ---
                            steps                 travelers love clear
                                                  directions.

  has-images      +20       images.length \>= 2   Photos boost trust by 20
                                                  pts --- snap the route!

  has-vehicles    +10       every route has ≥1    Which vehicles do you use?
                            vehicle               Helps people plan.

  has-fares       +10       any route.fare \> 0   Add fares --- budget
                                                  travelers will thank you!

  has-tags        +10       tags.length \>= 3     Tags help discovery --- add
                                                  at least 3.

  dense-text      +15       total route text ≥    More detail = more trust.
                            300 chars             Aim for 300+ chars.

  has-links       +10       ≥1 external link      Add a Maps link for extra
                            across routes         credibility.
  ---------------------------------------------------------------------------

All checkpoints are admin-configurable via SiteConfig DB --- scoreBoost
values, nudge copy, and evaluate lambdas can be updated without a
deploy.

**3. MAPS & TRAVEL DISCOVERY**

**3.1 Map Stack Decision**

+-----------------------------------------------------------------------+
| **DECISION**                                                          |
|                                                                       |
| Primary: MapLibre GL JS (v4.7) + react-map-gl for open-source,        |
| high-performance vector tile rendering --- no per-request API cost.   |
| Supplementary: Google Maps Platform APIs consumed where premium data  |
| is worth cost (Places Autocomplete, Traffic Layer, Directions for     |
| transit). OpenRouteService for free-tier routing. Nominatim for       |
| reverse geocoding.                                                    |
+-----------------------------------------------------------------------+

  -----------------------------------------------------------------------------
  **Service**        **Use Case**         **Cost**        **License**
  ------------------ -------------------- --------------- ---------------------
  MapLibre GL JS     Base map rendering,  Free            BSD-3
                     polylines, markers,                  
                     clustering                           

  OpenFreeMap /      Vector tile source   Free            ODbL
  MapTiler Free Tier for MapLibre                         

  OpenRouteService   Auto-route between   Free (2k        Apache 2.0
  API                waypoints,           req/day)        
                     isochrones                           

  Google Places      Location search with \$0.017/req     Commercial
  Autocomplete       place intelligence   (cache          
                                          aggressively)   

  Google Traffic     Real-time traffic    Tile overlay    Commercial
  Layer              overlay on MapLibre  via JS API      

  Google Directions  Public transit       \$0.005/req     Commercial
  (Transit)          routing (BRT, rail)                  

  Nominatim (OSM)    Reverse geocoding,   Free (self-host ODbL
                     address lookup       or public)      

  Open-Meteo         Weather data overlay Free            CC BY 4.0
                     on route                             
  -----------------------------------------------------------------------------

**3.2 Data Model Extension**

> // Extend Route interface in lib/types/interfaces.ts
>
> interface RoutePin {
>
> placeId?: string; // Google Place ID or Nominatim place_id
>
> label: string; // Human-readable stop name
>
> lat: number;
>
> lng: number;
>
> type: \'origin\' \| \'waypoint\' \| \'destination\';
>
> address?: string; // Full formatted address
>
> googlePlaceId?: string; // Google Places ID for enrichment
>
> }
>
> interface Route {
>
> // \... existing fields \...
>
> pin?: RoutePin; // Optional geographic anchor per step
>
> polyline?: string; // Encoded polyline (Google format) or GeoJSON
> string
>
> estimatedDuration?: number; // minutes
>
> estimatedFareRange?: { min: number; max: number; currency: string };
>
> }
>
> // New: Post-level geographic metadata
>
> interface Post {
>
> // \... existing \...
>
> startCoords?: { lat: number; lng: number };
>
> endCoords?: { lat: number; lng: number };
>
> boundingBox?: { north: number; south: number; east: number; west:
> number };
>
> region?: string; // e.g. \'Lagos Island\', \'Port Harcourt GRA\'
>
> totalDistanceKm?: number;
>
> estimatedTotalTime?: number; // minutes
>
> }

**3.3 Route Auto-Tracing Flow**

The complete flow from text input to rendered polyline:

1.  User types location name in each route step → Google Places
    Autocomplete suggests addresses

2.  User selects → RoutePin{lat, lng, googlePlaceId} stored per step

3.  Click \'Auto-Trace Route\' → call OpenRouteService /directions with
    coordinates array

4.  ORS returns GeoJSON LineString → decode → render as MapLibre Layer
    (line type)

5.  User can drag MapLibre markers to adjust waypoints → re-query ORS →
    update polyline

6.  On submit: store pin\[\] and polyline string in Route JSON column
    (Prisma)

7.  Fallback: if ORS unavailable, draw straight-line segments between
    pins

+-----------------------------------------------------------------------+
| **OFFLINE TRACING**                                                   |
|                                                                       |
| When offline, the map renders last-fetched tiles from Cache API       |
| (service worker). Auto-trace is queued for when connectivity returns. |
| Manual straight-line mode is always available offline.                |
+-----------------------------------------------------------------------+

**3.4 Feed, Route & User Suggestion Algorithms**

**Route Suggestion Algorithm**

Platform-generated route suggestions are created from aggregating and
synthesizing existing user posts. They are clearly labeled \'Along
Suggestion\' and are non-blocking (rendered after user posts).

  ---------------------------------------------------------------------------------------
  **Signal**       **Weight**   **Data Source**            **Notes**
  ---------------- ------------ -------------------------- ------------------------------
  User\'s tag      0.35         UserActivity table (last   Tags the user engages with
  history                       100)                       most

  Geographic       0.30         Post.startCoords vs        Haversine distance \< 10km
  proximity                     user.lastKnownLocation     preferred

  Validity score   0.20         ValidityEngine.compute()   Higher score = higher rank

  Social graph     0.10         Posts from 2nd-degree      Friends-of-friends boost
  overlap                       follows                    

  Recency boost    0.05         Post.createdAt             Posts \< 7 days old get +5%

  Fare             +bonus       Route.fare vs user\'s      Additive signal, not ranked
  accessibility                 historical fare range      

  Vehicle          +bonus       User\'s liked posts\'      Additive signal
  preference                    vehicle types              
  ---------------------------------------------------------------------------------------

**User Suggestion Algorithm**

  ----------------------------------------------------------------------------
  **Signal**          **Weight**   **Logic**
  ------------------- ------------ -------------------------------------------
  Common tag          0.40         Overlap between user\'s top tags and
  interests                        candidate\'s post tags

  Mutual follows      0.25         Count of shared follows / total follows
                                   (Jaccard similarity)

  Geographic overlap  0.20         Posts in same region

  Validity score of   0.15         High-quality posters surfaced
  posts                            preferentially
  ----------------------------------------------------------------------------

**Platform-Generated Route Suggestions**

When a user searches for a route and insufficient user posts exist,
Along synthesizes suggestions from related posts:

8.  Query posts whose startCoords/endCoords overlap the search bounding
    box

9.  Apply ValidityEngine.compute() --- only surface routes with score ≥
    40

10. If multiple posts cover overlapping tags/regions, synthesize a
    composite \'suggestion card\' showing the most common vehicle types,
    average fare range, and highest-validity waypoints

11. Label clearly as \'Along Suggestion • Based on community routes\'
    --- never presented as user content

12. Non-blocking: user posts render first; suggestions appear after
    300ms debounce

**3.5 Config-Based Transport Integrations**

> // lib/config/mapIntegrations.ts
>
> export interface TransportIntegrationConfig {
>
> id: string;
>
> label: string;
>
> icon: React.ComponentType;
>
> type: \'ridehail\' \| \'transit\' \| \'accommodation\' \| \'event\';
>
> enabled: boolean;
>
> deeplinkTemplate?: string; // {lat},{lng},{origin},{destination}
>
> apiEndpoint?: string;
>
> requiresApiKey: boolean;
>
> }
>
> export const TRANSPORT_INTEGRATION_REGISTRY:
> TransportIntegrationConfig\[\] = \[
>
> { id:\'bolt\', label:\'Bolt\', type:\'ridehail\', enabled:true,
> deeplinkTemplate:\'https://bolt.eu/deeplink?pickup={originLat},{originLng}&destination={destLat},{destLng}\'
> },
>
> { id:\'uber\', label:\'Uber\', type:\'ridehail\', enabled:false,
> deeplinkTemplate:\'uber://?action=setPickup&pickup\[latitude\]={originLat}\...\'
> },
>
> { id:\'airbnb\', label:\'Airbnb\',
> type:\'accommodation\',enabled:true,
> apiEndpoint:\'/api/integrations/airbnb\' },
>
> { id:\'events\', label:\'Events\', type:\'event\', enabled:true,
> apiEndpoint:\'/api/integrations/tega\' },
>
> { id:\'brt-lagos\', label:\'BRT Lagos\', type:\'transit\',
> enabled:true, apiEndpoint:\'/api/integrations/brt\' },
>
> \];

**4. GLOBAL INFRASTRUCTURE**

**4.1 Modal & Toast Global System**

A single GlobalModalProvider and GlobalToastProvider wrap the app root.
All modals and toasts are triggered imperatively via a singleton service
--- no prop-drilling.

> // lib/services/modalService.ts
>
> class ModalService {
>
> private static subscribers: Map\<string, ModalHandler\> = new Map();
>
> static show(id: string, config: ModalConfig): void { ... }
>
> static hide(id: string): void { ... }
>
> static confirm(config: ConfirmConfig): Promise\<boolean\> { ... } //
> returns user decision
>
> }
>
> // Usage anywhere in codebase:
>
> const confirmed = await ModalService.confirm({
>
> title: \'Delete Post?\',
>
> description: \'This action cannot be undone.\',
>
> destructive: true, // renders red confirm button
>
> confirmLabel: \'Delete\',
>
> cancelLabel: \'Cancel\',
>
> });
>
> if (confirmed) await deletePost(id);

**4.2 Confirm Modal & Global Undo System**

  ---------------------------------------------------------------------------------------
  **Action Type**    **Confirm       **Undo         **Undo    **Rollback Mechanism**
                     Modal?**        Available?**   TTL**     
  ------------------ --------------- -------------- --------- ---------------------------
  Delete Post        Yes             Yes            10        Optimistic delete; restore
                     (destructive)                  seconds   from local state on undo

  Delete Comment     Yes             Yes            10        Optimistic delete; restore
                     (destructive)                  seconds   

  Unfollow User      Yes (sensitive) Yes            5 seconds Optimistic unfollow;
                                                              re-follow on undo

  Unlike/Undislike   No              Yes            5 seconds Rollback counter in
                                                              useFeedInteractions

  Remove Bookmark    No              Yes            5 seconds Restore bookmark in hook

  Edit Profile       No              No             N/A       Cancel button in modal

  Block User         Yes             No             N/A       Intentional --- no
                     (destructive)                            accidental unblock

  Report Content     No              No             N/A       Form submission

  Upload Image       No              Yes (while     Until     Remove from draft state
                                     draft)         submit    

  Admin: Ban User    Yes             No             N/A       Admin action log only
                     (destructive)                            
  ---------------------------------------------------------------------------------------

**4.3 Offline / PWA Architecture**

Offline-first architecture using Workbox strategies. Key behaviors:

-   Service Worker registered via lib/utils/sw-register.ts ---
    non-blocking, deferred after page load

-   Network-first for API calls with offline fallback to cached
    last-known data

-   Cache-first for static assets, fonts, and map tiles

-   Background sync for network-dependent actions queued while offline

-   Offline indicator: non-blocking toast banner (OfflineIndicator
    component)

-   Online restoration: auto-flush queued actions with toast
    confirmation

-   Critical pages pre-cached: /home, /explore, /profile, /notifications

> // Offline action queue in lib/services/offlineQueue.ts
>
> interface QueuedAction {
>
> id: string;
>
> type: \'like\' \| \'comment\' \| \'follow\' \| \'post_create\';
>
> payload: unknown;
>
> createdAt: number;
>
> retries: number;
>
> }
>
> // When online: flush queue in order, show toast per action
>
> // When action fails online: show error toast, remove from queue

**4.4 Image Handling --- Cloudinary Organization**

  ----------------------------------------------------------------------------------------------------
  **Upload Type** **Cloudinary Folder**            **Transformations**                **Access**
  --------------- -------------------------------- ---------------------------------- ----------------
  Post images     along/posts/{userId}/{postId}/   w_800,q_auto,f_auto,c_limit        Public

  Profile images  along/profiles/{userId}/         w_200,h_200,c_fill,g_face,q_auto   Public

  Team member     along/team/{memberId}/           w_400,h_400,c_fill,q_auto          Public
  images                                                                              

  Bug report      along/reports/{reportId}/        w_1200,q_auto,f_auto               Private (admin
  attachments                                                                         only)

  Admin uploads   along/admin/                     Passthrough                        Private (admin
                                                                                      only)
  ----------------------------------------------------------------------------------------------------

All Cloudinary URLs stored in DB. Deletion hook: on post delete,
Cloudinary API called to remove associated resources (webhook-queued for
reliability).

**4.5 Bug Report & Contact System**

> // Bug report interface --- authenticated users have email pre-filled
>
> interface BugReport {
>
> id: string;
>
> userId?: string; // null for anonymous
>
> email: string; // auto-retrieved for authenticated users
>
> category: BugCategory; // enum from config
>
> subject: string;
>
> description: string;
>
> attachmentUrl?: string; // Cloudinary URL
>
> status: \'open\' \| \'in_progress\' \| \'resolved\' \| \'closed\';
>
> createdAt: DateTime;
>
> }
>
> // Bug categories (config-driven):
>
> export const BUG_CATEGORIES = \[
>
> { value:\'ui_bug\', label:\'UI / Display Issue\' },
>
> { value:\'performance\', label:\'Performance / Slow Loading\' },
>
> { value:\'data_error\', label:\'Incorrect Data / Route Info\' },
>
> { value:\'auth_issue\', label:\'Login / Account Problem\' },
>
> { value:\'map_issue\', label:\'Map / Location Issue\' },
>
> { value:\'other\', label:\'Other\' },
>
> \] as const;

**4.6 Analytics & Invite System**

All analytics are computed from UserActivity and PostEngagement tables.
Both user-facing dashboards and platform-level admin views are
supported.

  -----------------------------------------------------------------------------
  **Metric        **Tracked Events**    **Visualization**   **Scope**
  Category**                                                
  --------------- --------------------- ------------------- -------------------
  Post Engagement Views, likes,         Time-series line    Per-post +
                  dislikes, bookmarks,  chart               aggregate
                  shares, comments                          

  User Growth     Registrations,        Bar chart + funnel  Platform-wide
                  DAU/WAU/MAU, churn                        (admin)

  Route Discovery Search queries,       Heatmap + top       Platform-wide
                  explore clicks, map   queries             
                  interactions                              

  Trust Scores    Average validity by   Distribution        Platform-wide
                  tag/region/user       histogram           (admin)

  Invite          Invites sent,         Leaderboard + tree  Per-user + platform
  Performance     accepted,             view                
                  invited-user activity                     

  Marketplace     Listings viewed,      Revenue dashboard   Admin only
                  purchases, revenue                        
  -----------------------------------------------------------------------------

> // Invite system --- lib/config/inviteConfig.ts
>
> export const INVITE_CONFIG = {
>
> linkTemplate: \'https://along.app/join?ref={userId}\',
>
> pointsPerAcceptedInvite: 100,
>
> pointsPerInvitedUserPost: 10, // credited to inviter
>
> pointsPerInvitedUserVerification: 5, // credited to inviter
>
> maxTrackedInviteDepth: 1, // no multi-level MLM
>
> };

**5. ACID-COMPLIANT DATABASE SCHEMA**

+-----------------------------------------------------------------------+
| **NOTE**                                                              |
|                                                                       |
| Full Prisma schema with all new models. Use prisma migrate dev        |
| \--name \[migration-name\] for each phase. All multi-step mutations   |
| use prisma.\$transaction(\[\]) to guarantee ACID atomicity.           |
+-----------------------------------------------------------------------+

**5.1 Extended Prisma Schema**

> // prisma/schema.prisma --- Along v2.0
>
> generator client { provider = \"prisma-client-js\"; output =
> \"../app/generated/prisma\" }
>
> datasource db { provider = \"postgresql\"; url = env(\"DATABASE_URL\")
> }
>
> // ─── ENUMS
> ───────────────────────────────────────────────────────────────
>
> enum LikeType { LIKE DISLIKE }
>
> enum NotificationType { LIKE COMMENT FOLLOW MENTION ROUTE_VERIFIED
> REWARD }
>
> enum ActivityType { VIEW LIKE COMMENT BOOKMARK SHARE SEARCH
> INVITE_ACCEPTED }
>
> enum PostStatus { DRAFT PUBLISHED ARCHIVED }
>
> enum UserRole { USER ADMIN MODERATOR }
>
> enum RewardTier { BRONZE SILVER GOLD PLATINUM EXPLORER }
>
> enum BugStatus { OPEN IN_PROGRESS RESOLVED CLOSED }
>
> enum BugCategory { UI_BUG PERFORMANCE DATA_ERROR AUTH_ISSUE MAP_ISSUE
> OTHER }
>
> enum ReviewStatus { PENDING APPROVED REJECTED }
>
> // ─── USER
> ────────────────────────────────────────────────────────────────
>
> model User {
>
> id String \@id \@default(cuid())
>
> userName String \@unique
>
> email String \@unique
>
> password String?
>
> firstName String
>
> lastName String
>
> bio String?
>
> avatarConfig Json? // DiceBear AvatarConfig object
>
> location String?
>
> lastKnownLat Float?
>
> lastKnownLng Float?
>
> role UserRole \@default(USER)
>
> verified Boolean \@default(false)
>
> rewardPoints Int \@default(0)
>
> rewardTier RewardTier \@default(BRONZE)
>
> inviteCode String \@unique \@default(cuid())
>
> invitedById String?
>
> invitedBy User? \@relation(\"invites\", fields:\[invitedById\],
> references:\[id\])
>
> invitedUsers User\[\] \@relation(\"invites\")
>
> googleId String? \@unique
>
> createdAt DateTime \@default(now())
>
> updatedAt DateTime \@updatedAt
>
> // Relations
>
> posts Post\[\]
>
> followers Follow\[\] \@relation(\"following\")
>
> following Follow\[\] \@relation(\"follower\")
>
> postLikes PostLike\[\]
>
> postBookmarks PostBookmark\[\]
>
> postComments PostComment\[\]
>
> notifications NotificationRecipient\[\]
>
> activities UserActivity\[\]
>
> bugReports BugReport\[\]
>
> reviews UserReview\[\]
>
> analyticsEvents AnalyticsEvent\[\]
>
> @@index(\[userName\]) @@index(\[email\]) @@index(\[createdAt\])
> @@index(\[inviteCode\])
>
> }
>
> // ─── POST
> ────────────────────────────────────────────────────────────────
>
> model Post {
>
> id String \@id \@default(cuid())
>
> userId String
>
> title String
>
> routes Json // Route\[\] --- includes pin\[\], polyline, vehicles,
> fare
>
> images String\[\] // Cloudinary URLs
>
> tags String\[\]
>
> likes Int \@default(0)
>
> dislikes Int \@default(0)
>
> bookmarks Int \@default(0)
>
> views Int \@default(0)
>
> shares Int \@default(0)
>
> status PostStatus \@default(PUBLISHED)
>
> validityScore Float? // cached from ValidityEngine
>
> validityTier String? // \'low\'\|\'medium\'\|\'high\'\|\'trusted\'
>
> startLat Float?
>
> startLng Float?
>
> endLat Float?
>
> endLng Float?
>
> region String?
>
> totalDistanceKm Float?
>
> estimatedMins Int?
>
> isPlatformGen Boolean \@default(false) // true for Along Suggestions
>
> createdAt DateTime \@default(now())
>
> updatedAt DateTime \@updatedAt
>
> user User \@relation(fields:\[userId\], references:\[id\],
> onDelete:Cascade)
>
> postLikes PostLike\[\]
>
> postBookmarks PostBookmark\[\]
>
> postComments PostComment\[\]
>
> notifications Notification\[\]
>
> @@index(\[userId\]) @@index(\[createdAt DESC\]) @@index(\[tags\],
> type:Gin)
>
> @@index(\[startLat, startLng\]) @@index(\[region\])
> @@index(\[validityScore DESC\])
>
> }
>
> // ─── NEW MODELS
> ──────────────────────────────────────────────────────────
>
> model SiteConfig {
>
> key String \@id
>
> value String // JSON-serialized
>
> updatedAt DateTime \@updatedAt
>
> }
>
> model BugReport {
>
> id String \@id \@default(cuid())
>
> userId String?
>
> email String
>
> category BugCategory
>
> subject String
>
> description String \@db.Text
>
> attachmentUrl String?
>
> status BugStatus \@default(OPEN)
>
> createdAt DateTime \@default(now())
>
> user User? \@relation(fields:\[userId\], references:\[id\])
>
> }
>
> model UserReview {
>
> id String \@id \@default(cuid())
>
> userId String
>
> rating Int // 1--5
>
> title String
>
> body String \@db.Text
>
> status ReviewStatus \@default(PENDING)
>
> featured Boolean \@default(false)
>
> createdAt DateTime \@default(now())
>
> user User \@relation(fields:\[userId\], references:\[id\])
>
> @@index(\[status, featured\])
>
> }
>
> model AnalyticsEvent {
>
> id String \@id \@default(cuid())
>
> userId String?
>
> event String // e.g. \'post.view\', \'route.search\', \'map.interact\'
>
> meta Json? // arbitrary event properties
>
> sessionId String?
>
> createdAt DateTime \@default(now())
>
> user User? \@relation(fields:\[userId\], references:\[id\])
>
> @@index(\[event, createdAt\]) @@index(\[userId, createdAt\])
>
> }

**5.2 Index Strategy**

  --------------------------------------------------------------------------
  **Table**        **Index**              **Type**   **Trigger**
  ---------------- ---------------------- ---------- -----------------------
  User             userName, email,       BTree      All lookups
                   createdAt, inviteCode             

  Post             userId, createdAt DESC BTree      Feed queries

  Post             tags                   GIN        Tag-based filtering

  Post             startLat+startLng,     BTree      Geographic queries
                   endLat+endLng                     

  Post             region, validityScore  BTree      Region + quality
                   DESC                              queries

  Follow           followerId,            BTree      Feed & social graph
                   followingId                       

  UserActivity     userId+createdAt       BTree      Tag scoring

  AnalyticsEvent   event+createdAt,       BTree      Analytics aggregation
                   userId+createdAt                  
  --------------------------------------------------------------------------

**5.3 Key ACID Transaction Patterns**

All multi-step mutations are wrapped in prisma.\$transaction(\[\]) for
atomicity. Critical patterns:

-   **Post Create:** Insert Post + UserActivity(SHARE) + invalidate
    follower feed caches

-   **Like Toggle:** Upsert PostLike + update Post.likes counter +
    insert UserActivity(LIKE) + create Notification

-   **Follow Toggle:** Insert Follow + create Notification + invalidate
    both users\' suggestion caches

-   **Award Points:** Update User.rewardPoints + update
    User.rewardTier + create Notification(REWARD)

-   **Post Delete:** Cascade via Prisma onDelete:Cascade --- Comments,
    Likes, Bookmarks, Notifications auto-deleted + Cloudinary cleanup
    queued

**6. ECOSYSTEM API CONTRACTS**

**6.1 Transact Marketplace --- API Contract**

> // Service-to-service API contract (Along ↔ Transact)
>
> // POST /api/integrations/transact/listings
>
> // Create or update a listing for a route post
>
> interface CreateListingRequest {
>
> routePostId: string;
>
> sellerId: string; // Along userId
>
> type: \'guide\' \| \'tour\' \| \'ticket\';
>
> price: number;
>
> currency: \'NGN\';
>
> title: string;
>
> description: string;
>
> }
>
> // GET /api/integrations/transact/listings?postId={id}
>
> interface ListingResponse {
>
> id: string;
>
> routePostId: string;
>
> available: boolean;
>
> price: number;
>
> currency: string;
>
> checkoutUrl: string; // deep-link to Transact checkout
>
> }
>
> // Incoming webhook: POST /api/webhooks/transact
>
> interface TransactWebhookPayload {
>
> event: \'order.created\' \| \'order.completed\' \|
> \'payout.initiated\';
>
> orderId: string;
>
> routePostId: string;
>
> buyerId: string;
>
> sellerId: string;
>
> amount: number;
>
> currency: string;
>
> }

**6.2 Tega Promotions --- API Contract**

> // GET /api/integrations/tega/events?lat={lat}&lng={lng}&radius={km}
>
> interface TegaEventsResponse {
>
> events: TegaEvent\[\];
>
> }
>
> interface TegaEvent {
>
> id: string;
>
> routePostId?: string; // nullable --- links to Along route
>
> title: string;
>
> date: string; // ISO 8601
>
> location: string;
>
> lat?: number;
>
> lng?: number;
>
> capacity: number;
>
> registered: number;
>
> rsvpUrl: string; // deep-link to Tega RSVP
>
> imageUrl?: string;
>
> }
>
> // Incoming webhook: POST /api/webhooks/tega
>
> interface TegaWebhookPayload {
>
> event: \'event.rsvp\' \| \'event.cancelled\' \|
> \'promotion.activated\';
>
> eventId: string;
>
> userId?: string; // Along userId if matched
>
> meta: Record\<string, unknown\>;
>
> }

**6.3 Webhook Handler Pattern**

> // app/api/webhooks/\[provider\]/route.ts
>
> // HMAC-SHA256 signature verification → enqueue to QStash
>
> export async function POST(req: NextRequest, { params }) {
>
> const body = await req.text();
>
> const signature = req.headers.get(\'x-webhook-signature\') ?? \'\';
>
> const secret = WEBHOOK_SECRETS\[params.provider\];
>
> if (!verifyHmacSignature(body, signature, secret)) {
>
> return NextResponse.json({ error:\'Invalid signature\' }, { status:401
> });
>
> }
>
> const event = JSON.parse(body);
>
> await qstash.publishJSON({
>
> url: \`\${process.env.APP_URL}/api/workers/\${params.provider}\`,
>
> body: { provider: params.provider, event },
>
> retries: 3,
>
> });
>
> return NextResponse.json({ received: true });
>
> }

**7. SUSTAINABLE REWARDS SYSTEM**

+-----------------------------------------------------------------------+
| **DESIGN PRINCIPLE**                                                  |
|                                                                       |
| Low-cost, purely digital incentive system. No real-money payouts in   |
| Phase 1. Points are earned through quality contributions and social   |
| actions. They unlock cosmetic perks, platform features, and           |
| eventually Transact marketplace credits. The goal is to make          |
| high-quality route sharing intrinsically rewarding.                   |
+-----------------------------------------------------------------------+

**7.1 Points Economy**

  -------------------------------------------------------------------------
  **Action**          **Points   **Conditions /   **Anti-Abuse**
                      Earned**   Caps**           
  ------------------- ---------- ---------------- -------------------------
  Publish a route     +50        Max 5/day        Validity score must be ≥
  post                                            20 after 24h

  Post reaches        +100       One-time per     Validity ≥ 80
  Verified trust                 post             
  level                                           

  Post reaches        +200       One-time per     Validity ≥ 90
  Trusted trust level            post             

  Receive a like on a +2         Max 200 pts/post Distinct users only
  post                           from likes       

  Receive a bookmark  +5         Max 100 pts/post Distinct users only
                                 from bookmarks   

  Comment that        +15        Max 3/day        Original comment only
  receives 3+ likes                               

  Post receives       +50        One-time per     Auto-computed by
  corroboration (5               post             ValidityEngine
  similar)                                        

  Invite a new user   +100       No cap           Invited user must post
  (accepted)                                      within 30 days

  Invited user\'s     +10 per    Max 500          Invitee must have ≥ 1
  post activity       post       pts/invitee      verified post

  Daily login streak  +25        Once per streak  Must be active (action in
  (7 days)                       milestone        session)

  Complete profile    +50        One-time         All optional fields
  (all fields)                                    filled
  -------------------------------------------------------------------------

**7.2 Reward Tiers**

  -------------------------------------------------------------------------
  **Tier**   **Points     **Perks**                       **Badge**
             Required**                                   
  ---------- ------------ ------------------------------- -----------------
  Bronze     0            Standard access                 Bronze shield
                                                          icon

  Silver     500          Priority in suggestion          Silver shield
                          algorithm (+10% boost), custom  
                          avatar frame                    

  Gold       2,000        Silver perks + early access to  Gold shield
                          new features, Gold profile      
                          badge                           

  Platinum   5,000        Gold perks + route moderation   Platinum shield
                          voting rights, Platinum         
                          verified checkmark              

  Explorer   10,000       All perks + Along Explorer      Explorer star
                          badge, Transact seller fee      badge
                          waiver (Phase 2)                
  -------------------------------------------------------------------------

**7.3 Invite System Implementation**

> // Each user has a unique inviteCode = cuid() stored on User model
>
> // Invite link: https://along.app/join?ref={inviteCode}
>
> // On registration with ref param:
>
> // 1. Look up User by inviteCode
>
> // 2. Set invitedById on new User
>
> // 3. Award 100 points to inviter (transaction: User.rewardPoints +=
> 100)
>
> // 4. Send notification to inviter: \'{name} accepted your invite!\'
>
> // Ongoing: on invited user\'s post → award +10 to inviter (max 500
> per invitee)
>
> // Tracked via UserActivity table: type INVITE_ACCEPTED, actor =
> invitedUser

The invite leaderboard is a public page showing top inviters by accepted
invites and total invited-user engagement, driving viral growth
organically.

**8. EXECUTION & PHASED ROADMAP**

+-----------------------------------------------------------------------+
| **APPROACH**                                                          |
|                                                                       |
| Config-First Refactoring: migrate hardcoded logic to config objects   |
| first (fastest wins). Then layer new features on top of the clean     |
| config-driven foundation. Each phase ends with a deployable           |
| checkpoint.                                                           |
+-----------------------------------------------------------------------+

**8.1 Phase 0 --- Foundation (Weeks 1--2)**

Priority: Config migration, dependency updates, global infrastructure.

  ------------------------------------------------------------------------------------------
  **Task**                        **Files Affected**             **Effort**   **Priority**
  ------------------------------- ------------------------------ ------------ --------------
  Create all config files         lib/config/\*.ts (all new)     M            P0
  (vehicles, status, nav, forms,                                              
  notifications, footer, avatar,                                              
  rewards)                                                                    

  Replace emoji references with   PostCard, ShareRouteModal,     S            P0
  Lucide icons throughout         TrustBadge, DraftingCoach                   

  Update all dependencies per     package.json, all imports      M            P0
  §1.8 matrix                                                                 

  Implement GlobalModalProvider + providers/,                    M            P0
  ModalService.confirm()          lib/services/modalService.ts                

  Implement GlobalToastProvider   providers/,                    S            P0
                                  lib/services/toastService.ts                

  Implement GlobalUndoSystem      lib/services/undoService.ts,   M            P0
                                  useFeedInteractions.ts                      

  Apply Prisma schema additions   prisma/schema.prisma +         M            P0
  (SiteConfig, BugReport,         migration                                   
  UserReview, AnalyticsEvent,                                                 
  User role/invite fields)                                                    

  Wire NAV_REGISTRY into          navigation/ components         S            P0
  DashboardNavbar + DesktopTopBar                                             

  Wire VEHICLE_REGISTRY (with     posts/ components              S            P0
  icons) into PostCard +                                                      
  ShareRouteModal                                                             
  ------------------------------------------------------------------------------------------

**8.2 Phase 1 --- Core Product (Weeks 3--6)**

Priority: ValidityEngine, DraftingCoach, DiceBear avatars, Auth
improvements, Bug reporting.

  -----------------------------------------------------------------------------------------------------------
  **Task**                        **Files Affected**                              **Effort**   **Priority**
  ------------------------------- ----------------------------------------------- ------------ --------------
  Ship ValidityEngine class +     lib/services/ValidityEngine.ts,                 M            P0
  TrustBadge component            components/ui/TrustBadge.tsx                                 

  Integrate DraftingCoach into    components/features/posts/DraftingCoach.tsx     M            P0
  ShareRouteModal                                                                              

  DiceBear AvatarEditor UI + save components/features/profile/AvatarEditor.tsx,   M            P0
  to User.avatarConfig            /api/users/\[id\]/avatar                                     

  Admin-editable SiteConfig DB    lib/db/SiteConfigRepository.ts,                 M            P1
  pattern + Redis caching         /api/admin/config                                            

  Bug report form + admin         app/(dashboard)/report-bug, app/(admin)/bugs    M            P1
  dashboard                                                                                    

  Google OAuth integration        app/api/auth/google/, AntdProvider GoogleButton M            P1

  Admin pages: user management,   app/(admin)/\*                                  L            P1
  post moderation, config editor                                                               

  Role-aware component rendering  All nav/component consumers of NAV_REGISTRY     S            P1
  (Admin vs User)                                                                              

  Confirmations on all            ModalService usage in all hooks                 S            P1
  destructive + sensitive actions                                                              

  PWA offline queue for           lib/services/offlineQueue.ts, service worker    M            P1
  likes/follows/comments                                                                       
  -----------------------------------------------------------------------------------------------------------

**8.3 Phase 2 --- Maps & Discovery (Weeks 7--10)**

  ----------------------------------------------------------------------------------------------------------
  **Task**                        **Files Affected**                             **Effort**   **Priority**
  ------------------------------- ---------------------------------------------- ------------ --------------
  MapLibre integration + replace  components/features/posts/RouteMap.tsx,        L            P0
  Leaflet                         lib/config/mapIntegrations.ts                               

  Google Places Autocomplete in   components/features/posts/RouteStepInput.tsx   M            P0
  route step inputs                                                                           

  OpenRouteService auto-trace +   lib/services/routeTracing.ts                   M            P0
  polyline encode/decode                                                                      

  Route geographic data           API routes, Post model                         M            P0
  (startCoords, endCoords,                                                                    
  region) stored in Post                                                                      

  Route + User suggestion         lib/services/suggestionsService.ts (refactor)  L            P1
  algorithm implementation                                                                    

  Platform-generated route        lib/services/platformSuggestions.ts, Feed.tsx  L            P1
  suggestions (Along Suggestions)                                                             

  Explore map view --- PostCard   app/(dashboard)/explore/page.tsx               M            P1
  markers on MapLibre                                                                         

  Transport integrations: Bolt    lib/config/mapIntegrations.ts, PostDetail      M            P2
  deep-link, Airbnb widget, Tega                                                              
  events                                                                                      

  Traffic and weather overlay     RouteMap enhancements                          M            P2
  (Google Traffic + Open-Meteo)                                                               
  ----------------------------------------------------------------------------------------------------------

**8.4 Phase 3 --- Ecosystem & Rewards (Weeks 11--14)**

  ----------------------------------------------------------------------------------------------------------
  **Task**                        **Files Affected**                             **Effort**   **Priority**
  ------------------------------- ---------------------------------------------- ------------ --------------
  Rewards engine: points          lib/services/rewardsService.ts                 M            P0
  calculation + tier upgrade                                                                  
  triggers                                                                                    

  Rewards UI: user points         components/features/profile/RewardsPanel.tsx   M            P0
  display, tier badge, history                                                                

  Invite system: inviteCode,      lib/services/inviteService.ts,                 M            P0
  referral tracking, leaderboard  app/(dashboard)/invite                                      

  Transact marketplace            lib/integrations/transact.ts,                  L            P1
  integration (PostCard CTA +     /api/webhooks/transact                                      
  webhook)                                                                                    

  Tega events integration + feed  lib/integrations/tega.ts, /api/webhooks/tega   M            P1
  widget                                                                                      

  Analytics dashboard ---         app/(dashboard)/analytics/page.tsx             L            P1
  user-facing                                                                                 

  Analytics dashboard ---         app/(admin)/analytics/page.tsx                 L            P1
  admin/platform                                                                              

  Contact page, About page with   app/(public)/about, contact, reviews           M            P2
  team config, reviews section                                                                

  Featured reviews management     app/(admin)/reviews                            S            P2
  (admin)                                                                                     
  ----------------------------------------------------------------------------------------------------------

**8.5 Phase 4 --- Scale & Polish (Weeks 15+)**

  -----------------------------------------------------------------------
  **Task**                        **Type**           **Effort**
  ------------------------------- ------------------ --------------------
  BullMQ / QStash background job  Infrastructure     L
  workers for all webhook events                     

  N+1 elimination audit --- bulk  Performance        M
  feed enrichment for all list                       
  views                                              

  RxJS reactive feed stream +     Architecture       M
  notification polling                               

  Comprehensive Jest test suite   Testing            L
  (repositories, ValidityEngine,                     
  suggestion algorithms)                             

  E2E Playwright test suite (auth Testing            L
  flow, post creation, map                           
  interaction)                                       

  Full PWA audit --- Lighthouse   Quality            M
  score ≥ 90 across all                              
  categories                                         

  Cloudinary webhook cleanup for  Infrastructure     S
  deleted posts                                      

  GDPR compliance: data export,   Compliance         M
  account deletion, cookie                           
  consent                                            

  Structured data (JSON-LD) for   SEO                S
  public posts --- SEO                               

  i18n foundation (react-intl)    Localization       L
  --- English + Pidgin English as                    
  Day 1 locales                                      
  -----------------------------------------------------------------------

**APPENDIX A: ENVIRONMENT VARIABLES**

  -------------------------------------------------------------------------------------
  **Variable**                     **Required**   **Purpose**
  -------------------------------- -------------- -------------------------------------
  DATABASE_URL                     Yes (Prod)     PostgreSQL connection string

  UPSTASH_REDIS_REST_URL           Yes (Prod)     Redis URL (mock-redis in dev)

  UPSTASH_REDIS_REST_TOKEN         Yes (Prod)     Redis auth token

  JWT_SECRET                       Yes            Access token signing key

  JWT_REFRESH_SECRET               Yes            Refresh token signing key

  CLOUDINARY_CLOUD_NAME            Yes (Prod)     Cloudinary account

  CLOUDINARY_API_KEY               Yes (Prod)     Cloudinary API key

  CLOUDINARY_API_SECRET            Yes (Prod)     Cloudinary API secret

  GOOGLE_CLIENT_ID                 OAuth          Google OAuth client ID

  GOOGLE_CLIENT_SECRET             OAuth          Google OAuth client secret

  GOOGLE_MAPS_API_KEY              Maps           Google Places + Directions APIs

  NEXTAUTH_URL                     OAuth          Base URL for OAuth callbacks

  NEXT_PUBLIC_API_URL              Optional       Override for external API base

  TRANSACT_API_KEY                 Ecosystem      Transact service-to-service key

  TRANSACT_WEBHOOK_SECRET          Ecosystem      Transact webhook HMAC secret

  TEGA_API_KEY                     Ecosystem      Tega service-to-service key

  TEGA_WEBHOOK_SECRET              Ecosystem      Tega webhook HMAC secret

  QSTASH_TOKEN                     Workers        Upstash QStash token for job queue

  OPEN_ROUTE_SERVICE_KEY           Maps           OpenRouteService API key (free tier)

  NEXT_PUBLIC_MAPLIBRE_STYLE_URL   Maps           MapLibre/MapTiler style URL
  -------------------------------------------------------------------------------------

**APPENDIX B: ARCHITECTURAL DIAGRAMS (TEXT)**

**B.1 Config-Driven Engine Flow**

> ┌─────────────────────────────────────────────────────────────────┐
>
> │ CONFIG LAYER (lib/config/) │
>
> │ vehicles.ts · navigation.ts · forms.ts · feedAlgorithm │
>
> │ routeStatus · notifications · avatar · rewards │
>
> └────────────────────────┬────────────────────────────────────────┘
>
> │ imported by
>
> ┌────────────────────────▼────────────────────────────────────────┐
>
> │ ENGINE LAYER (lib/services/) │
>
> │ ValidityEngine · DraftingCoach · FeedService │
>
> │ SuggestionsService · RewardsService · RouteTracingService │
>
> └────────────────────────┬────────────────────────────────────────┘
>
> │ consumed by
>
> ┌────────────────────────▼────────────────────────────────────────┐
>
> │ COMPONENT LAYER (components/) │
>
> │ ConfigDrivenForm · ConfigDrivenList · TrustBadge │
>
> │ DraftingCoach · RouteMap · AvatarEditor · RewardsPanel │
>
> └─────────────────────────────────────────────────────────────────┘

**B.2 Request Lifecycle**

> Client Request
>
> └─→ Next.js App Router (edge)
>
> └─→ BaseApiHandler.handle()
>
> ├─→ authenticate(req) → JWT verify → User
>
> ├─→ enforceRateLimit(req) → Redis sliding window
>
> ├─→ validateBody(req) → Zod schema
>
> └─→ execute(req, auth, body)
>
> └─→ Repository.method()
>
> ├─→ cache.get() → Redis HIT → return
>
> └─→ prisma.query() → DB → cache.set() → return

**B.3 Feed Algorithm Flow**

> GET /api/posts/feed?userId={id}&cursor={c}
>
> │
>
> ├─\[Cache HIT\]──→ Redis feed:{userId}:{cursor} → return paginated
> posts
>
> │
>
> └─\[Cache MISS\]
>
> ├─ 1. Fetch following IDs for userId
>
> ├─ 2. Fetch top tags from UserActivity (last 100 events)
>
> ├─ 3. Fetch trending post IDs (Redis: trending:posts, TTL 10min)
>
> ├─ 4. Fetch posts from followed users (score × 0.70)
>
> ├─ 5. Fetch posts matching top tags (score × 0.20)
>
> ├─ 6. Merge trending boost (score × 0.10)
>
> ├─ 7. Location bonus if User.lastKnownLat set (score + 0.15)
>
> ├─ 8. Tiebreak: prefer newer when score delta \< 5
>
> ├─ 9. Enrich: bulk fetch likes/bookmarks/following flags
>
> ├─10. Attach ValidityScore from Redis or recompute
>
> └─11. Cache result → Redis feed:{userId}:{cursor} TTL 5min → return

**B.4 Validity Score Computation**

> Post Created / Updated / Liked
>
> └─→ Queue: validity.compute:{postId}
>
> └─→ Worker:
>
> ├─ Fetch post with routes, images, tags
>
> ├─ Fetch similar posts (same tags, last 30 days)
>
> ├─ ValidityEngine.compute(post, { similarPosts })
>
> │ ├─ computeLikeRatio() → 0--1
>
> │ ├─ computeDetailScore() → 0--1
>
> │ ├─ computeSimilarityRatio() → 0--1
>
> │ └─ computeRecency() → 0--1
>
> ├─ Store: Post.validityScore + Post.validityTier
>
> ├─ Cache: Redis validity:{postId} TTL 30min
>
> └─ Trigger: RewardsService.checkTierThresholds(post)

**B.5 PWA Offline Flow**

> User Action (offline)
>
> └─→ useOnlineStatus() returns false
>
> └─→ Action handler checks offline status
>
> ├─\[Optimistic UI\] → Update local state immediately
>
> ├─\[Non-critical: like/bookmark\] → Queue in OfflineActionQueue
>
> ├─\[Critical: post create\] → Show blocking \'No connection\' modal
>
> └─\[Network-dependent UI\] → Disable with tooltip \'Available online\'
>
> Network Restored
>
> └─→ useOnlineStatus() fires \'online\' event
>
> └─→ OfflineQueue.flush()
>
> ├─→ Execute queued actions in order
>
> ├─→ Show toast per completed action
>
> └─→ Handle conflicts: server state wins, show diff to user

**APPENDIX C: KEY FILE DIRECTORY**

New and significantly modified files. All new files in bold.

  ----------------------------------------------------------------------------------------------
  **File Path**                                  **Status**   **Description**
  ---------------------------------------------- ------------ ----------------------------------
  lib/config/vehicles.ts                         MODIFY       Replace emoji with Lucide icons,
                                                              add icon field

  lib/config/routeStatus.ts                      MODIFY       Icon system, add trustScore

  lib/config/navigation.ts                       MODIFY       Add requiredRole, group fields

  lib/config/avatar.ts                           NEW          DiceBear config, styles, URL
                                                              builder

  lib/config/footer.ts                           NEW          Footer + devCredit config

  lib/config/teamConfig.ts                       NEW          Team member array config

  lib/config/mapIntegrations.ts                  NEW          Transport integration registry

  lib/config/rewards.ts                          NEW          Points economy + tier config

  lib/config/inviteConfig.ts                     NEW          Invite system config

  lib/services/ValidityEngine.ts                 MODIFY       Full implementation per §2.1

  lib/services/DraftingCoachService.ts           NEW          Coach evaluation logic (class)

  lib/services/rewardsService.ts                 NEW          Points + tier management

  lib/services/routeTracingService.ts            NEW          ORS + MapLibre polyline

  lib/services/platformSuggestions.ts            NEW          Along-generated suggestions

  lib/services/offlineQueue.ts                   NEW          PWA action queue

  lib/services/modalService.ts                   NEW          Imperative modal system

  lib/services/toastService.ts                   NEW          Imperative toast system

  lib/services/undoService.ts                    NEW          Global undo with TTL

  lib/db/SiteConfigRepository.ts                 NEW          Admin-editable config CRUD

  components/ui/TrustBadge.tsx                   MODIFY       Icon-based, breakdown tooltip

  components/ui/ConfigDrivenForm.tsx             NEW          Generic form from FieldConfig\[\]

  components/ui/ConfigDrivenList.tsx             NEW          Generic list from items\[\]

  components/ui/GlobalConfirmModal.tsx           NEW          Destructive action confirm

  components/ui/GlobalUndoToast.tsx              NEW          Undo notification with timer

  components/features/profile/AvatarEditor.tsx   NEW          DiceBear avatar UI

  components/features/posts/DraftingCoach.tsx    MODIFY       Wire DraftingCoachService

  components/features/posts/RouteMap.tsx         MODIFY       Migrate to MapLibre GL

  app/(admin)/                                   NEW          Admin pages group

  app/(public)/about, contact, report-bug        NEW          Public facing pages

  app/(dashboard)/analytics, invite              NEW          User analytics + invite pages

  prisma/schema.prisma                           MODIFY       Add all new models per §5.1
  ----------------------------------------------------------------------------------------------
