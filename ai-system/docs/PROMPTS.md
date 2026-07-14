# PROMPTS.md — Along AI Tool Prompts

> Feed these prompts in sequence. Each section is labelled by tool and stage.
> Always attach the files listed under "Attach" before submitting the prompt.
> Design prompts → Open Design. Development prompts → Open Code (with ai-system active).

---

## ─── OPEN DESIGN ──────────────────────────────────────────────────────────────

### PROMPT OD-1 — Design System Bootstrap

**Attach:** `DESIGN.md`
**Purpose:** Establish the full Along design system before generating any screens.

```
You are a senior UI/UX designer working on Along — a social travel-intelligence platform for urban commuters in Nigeria and West Africa. Think Twitter × Google Maps: users share, validate, and discover real transport routes in their city.

Read the attached DESIGN.md in full before doing anything. This is the single source of truth for all visual and interaction design decisions.

Your task: Generate a complete Along design system including:

1. COLOUR STYLES — all tokens from DESIGN.md §2 as named styles: Light and Dark themes.
   Name convention: {theme}/{category}/{name} — e.g. light/brand/primary, dark/text/muted
   Include trust level colours (§2.3) and vehicle type colours (§2.4) as named styles.

2. TEXT STYLES — all type styles from DESIGN.md §3. Font: Inter only.
   Name convention: {role}/{weight} — e.g. display-xl/extrabold, body-md/regular, label-sm/medium

3. EFFECT STYLES — all shadow tokens from DESIGN.md §4.3. Glass morphism recipe as reusable background style (light and dark variants from DESIGN.md §2.5).

4. SPACING & GRID — spacing scale and border radius tokens from DESIGN.md §4.
   Grids: 1-column (375px mobile), 2-column (768px tablet), 3-column (1280px desktop).

5. ICON SYSTEM — document the Lucide React icon map from DESIGN.md §5 as annotated icon swatches. Groups: Navigation, Actions, Vehicles, Trust Levels, Status.
   Note: ZERO emoji are used anywhere in Along. All iconography is Lucide stroke icons at 20px or 24px.

6. COMPONENT LIBRARY (Base — these map to the App* universal components built in code):
   - AppButton: 5 variants (Primary, Secondary, Ghost, Destructive, Icon-only) × all states (default, hover, active, disabled, loading). Per DESIGN.md §6.1.
   - AppCard: 5 variants (default, elevated, glass, flat, suggestion) with hover lift. Per DESIGN.md §6.2.
   - AppInput / AppSelect / AppTextarea: default / focus / error / disabled. Per DESIGN.md §6.3.
   - AppTag / AppBadge: all variants × sizes. Per DESIGN.md §6.7.
   - AppAvatar: all 6 sizes (24/32/40/56/80/120px), verified badge, profile-link indicator. Per DESIGN.md §6.8.
   - AppUserLabel: horizontal and vertical layouts, with/without handle. Per DESIGN.md §6.8.
   - TrustBadge: all 4 trust levels (Low/Developing/Verified/Trusted) in compact + default sizes, with tooltip breakdown panel. Per DESIGN.md §6.10.
   - AppModal: all 5 sizes, header variants. Per DESIGN.md §6.5.
   - AppEmptyState: sm / default / lg sizes with action button. Per DESIGN.md §6.6.
   - AppTable: header, row states (default, hover, selected, clickable), empty state, loading skeleton. Per DESIGN.md §6.4.
   - Navigation: DashboardSidebar (240px desktop), MobileTopBar, MobileBottomNav with FAB. Per DESIGN.md §6.13.
   - PostCard: full spec per DESIGN.md §6.9 — all zones, numbered connector list, image grids (1/2/3-up), action bar, Along Suggestion variant.
   - VehicleChip: all 7 types (Taxi, Bike, Keke, Bus, Trekking, Car, Bolt) with Lucide icon + label + colour per DESIGN.md §2.4.
   - DraftingCoach panel: collapsed and expanded states, score bar, nudge alert, completed chips. Per DESIGN.md §6.11.

All components must use the colour and text styles above — no raw hex values.
Annotate every component with token references (e.g. "bg: light/brand/primary-muted").
Organise into pages: 🎨 Tokens | 🧱 Components | 🗺️ Patterns

EXPORT REQUIREMENT:
Export each page as a self-contained HTML file:
- Fully self-contained (inline CSS, no external dependencies)
- CSS variables must use the exact names from DESIGN.md §2 (e.g. --color-primary, --color-text-secondary)
- Annotate major sections with comments: <!-- §6.9 PostCard — default variant -->
- Interactive states via CSS :hover / :focus-visible / [data-state] attribute selectors
- Include in each file's <head>:
  <meta name="along-route" content="design-system">
  <meta name="along-component" content="[comma-separated component names featured]">
Save to: ai-system/designs/ as 01-design-system-tokens.html and 02-design-system-components.html
Create ai-system/designs/README.md with index table: | File | Screen | Components | Status |
```

---

### PROMPT OD-2 — Landing Page + Auth Flow

**Attach:** `DESIGN.md`
**Purpose:** Generate the public entry points.

```
Using the Along design system from OD-1 and the attached DESIGN.md, design two page groups:

PAGE GROUP A: Landing Page (/)
Design all three:
1. Mobile Portrait (375px) — Light Theme
2. Mobile Portrait (375px) — Dark Theme
3. Desktop (1280px) — Light Theme

Context: Along is a social travel platform for Nigerian urban commuters. Landing page must feel energetic and trustworthy — like a modern fintech, not a generic travel app. Big bold green. Community energy. Route intelligence as the differentiator.

Required zones in order (DESIGN.md §7.1):
1. TopNav: Along logo + wordmark left, "Sign In" ghost + "Get Started" primary right. Glass on scroll.
2. Hero: Full-viewport green gradient (linear-gradient(135deg, #004A2C 0%, #00623B 50%, #00A862 100%)). Along logo white centred. Tagline "Navigate Together." display-xl white. Subheadline + CTA row (Get Started primary, Sign In secondary — inverted on dark bg). Decorative SVG: abstract map pins connected by route lines in lighter green tones.
3. Feature grid: 3 AppCard flat (desktop row / mobile stack). "Share Routes" Route icon, "Trust Scores" ShieldCheck icon, "Community" Users icon. Icon on primary-muted bg, title, 2-line description.
4. Social proof strip: glass surface — "10,000+ Routes · 50,000+ Commuters · Lagos · Abuja · Port Harcourt"
5. Sample feed preview: 2 PostCard previews (actual component spec, not placeholder box). One standard, one Along Suggestion variant. TrustBadge visible on each.
6. CTA section: "Start navigating smarter" heading + "Create Free Account" AppButton primary.
7. AppFooter: brand, link columns, social Lucide icons, dev credit "Built by S.D".

PAGE GROUP B: Auth Pages (/login, /register, /otp)
Design Mobile (375px) + Desktop (1280px) for each.
Split layout desktop: brand panel left 45% (green gradient, white logo, tagline, abstract route SVG), form right 55%.
Mobile: logo top, form below.

Design rules:
- No hardcoded text — use placeholder variables: {{hero_headline}}, {{cta_label}}, {{placeholder_email}}
- Vehicle chips on sample PostCard: annotate Lucide icon names (no emoji)
- TrustBadge on sample PostCard: show "Verified" level (CheckCircle, green)
- OTP: 6 individual input boxes, paste fills all, annotated
- Auth form card: AppCard elevated, 40px padding
- Google sign-in button: white bg, Google G SVG, border-color, full width

EXPORT: Save as 03-landing-light.html, 04-landing-dark.html, 05-auth-flow.html to ai-system/designs/
Annotate sections with <!-- §7.x Zone --> comments. Update README.md index.
```

---

### PROMPT OD-3 — Home Feed + PostCard System + ShareRouteModal

**Attach:** `DESIGN.md`
**Purpose:** Design the core social feed — the heart of the product.

```
Using the Along design system and DESIGN.md, design the authenticated Home Feed page and ShareRouteModal.

Context: This is the main screen post-login. Twitter equivalent of Along — a social feed of route posts. TrustBadge and VehicleChips are the key differentiators from a generic social feed. Every route step has a numbered connector — like a transit diagram.

Design three viewports:
1. Mobile Portrait (375px) — Light Theme
2. Mobile Portrait (375px) — Dark Theme
3. Desktop (1280px) — Light Theme

Required layout (DESIGN.md §7.3):
- Mobile: MobileTopBar + single-column feed + MobileBottomNav with green FAB
- Desktop: DashboardSidebar (240px fixed) + centre feed (max 640px) + right sidebar (280px)

Feed centre column:
1. Compose card: AppCard flat — AppAvatar 32px (user's) + "Share a route..." ghost input style
2. "New posts available" pill: fixed below topbar, primary bg, RefreshCw icon, "3 new posts" — annotate slide-down animation
3. THREE PostCard samples:
   - PostCard A: 3-step route (Bus step 1, Keke step 2, Trekking step 3). 2 images, 4 tags, TrustBadge "Verified" score 72. Show full connector list: numbered circles (primary bg white text), step text, vehicle chips (Lucide icon annotated, colours from §2.4), fare chips (Coins icon).
   - PostCard B: 2-step route (Taxi). 3 images, TrustBadge "Trusted" score 88. Filled Heart icon (liked state, error-text colour). High like count.
   - PostCard C: AppCard suggestion variant (border-l-4 primary, primary-muted tint). "Along Suggestion" AppTag with Sparkles icon top of card. Same PostCard structure below. TrustBadge "Developing" score 44.
4. PostCardSkeleton: shimmer state shown between cards

Right sidebar (desktop):
- "Who to follow": 3 user rows — AppUserLabel (40px) + "Follow" AppButton secondary sm
- "Trending tags": 8 AppTag chips
- "Events near you": placeholder Tega widget (2 event rows)

ShareRouteModal (DESIGN.md §7.7) — show as overlay in a 4th desktop frame:
- AppModal xl. 2-column layout: form left (flex-1), right panel (320px: RouteMap placeholder + DraftingCoach)
- Form sections: title AppInput, route builder (3 steps — each: location input MapPin prefix, text AppTextarea, vehicle chip selector row from VEHICLE_REGISTRY, fare AppInput ₦ prefix, GripVertical drag handle, × remove). Image upload zone (dashed border, Upload icon, "Up to 10 images"). Tags tokenized input.
- DraftingCoach: score 45/100 (AppProgress orange fill), AppAlert info nudge ("Add 2+ images to boost +20 pts"), 2 completed chips (has-title CheckCircle, min-routes CheckCircle)
- RouteMap preview: map placeholder with 3 numbered pins connected by green polyline

Design rules:
- Action bar icons: Heart (outline → filled on like), ThumbsDown, MessageCircle, Bookmark (outline → filled), Share2 — all Lucide at 16px
- Annotate every subtle link: "title links to /posts/[id]", "tag chips link to /explore?tag=", "avatar links to /profile/[userName]"
- Back-to-top FAB: AppButton icon ArrowUp, primary bg, fixed bottom-right in desktop frame

EXPORT: Save as 06-home-feed-light.html, 07-home-feed-dark.html, 08-share-route-modal.html to ai-system/designs/
Annotate with <!-- §6.9 PostCard — [variant] --> and <!-- §7.3 [Zone] --> comments. Update README.md.
```

---

### PROMPT OD-4 — Explore Map + Post Detail

**Attach:** `DESIGN.md`
**Purpose:** Design the map discovery experience and full route detail view.

```
Using the Along design system and DESIGN.md, design two core pages:

PAGE A: Explore Page (/explore) — DESIGN.md §7.4
Mobile Portrait (375px) + Desktop (1280px) — Light theme.

Full-viewport MapLibre map as base layer. All UI overlaid.

Desktop:
1. Top overlay bar (glass): Search AppInput (360px, Search prefix icon) + filter chip row (7 VehicleChip filters + 2 trust level filters) + "Near me" AppButton icon LocateFixed
2. Left side panel (320px, glass, slides from left): mini PostCard list (no nested map), sort AppSelect, "47 routes found" count, collapse ChevronLeft toggle
3. Map: clustered pins (primary green circle + white count). One selected pin with glass popup card (AppCard glass, 280px wide): post title + AppUserLabel 32px + TrustBadge sm + 2 VehicleChips + "View Route" AppButton primary sm. Green polyline visible for selected route.
4. "Share this view" AppButton ghost sm + Link2 icon, bottom-right

Mobile:
1. Top: search input full-width + SlidersHorizontal AppButton icon
2. Full-screen map behind
3. Bottom sheet: drag handle (40px wide bar, 4px tall, rounded, border-color) + collapsed post list 40vh. Show 2 mini PostCards.

PAGE B: Post Detail (/posts/[id]) — DESIGN.md §7.5
Mobile Portrait (375px) + Desktop (1280px) — Light + Dark themes.

Full layout in order:
1. Back ArrowLeft + breadcrumb "Routes" + share + bookmark actions (top bar)
2. Post title (display-md, 28px/700)
3. AppUserLabel large (40px avatar, full name, @handle, timestamp)
4. TrustBadge default size — full label + score + annotate "tooltip shows breakdown"
5. Tag row: 4 AppTag default + 1 AppTag primary (MapPin icon "Lagos Island" region link)
6. RouteMap 280px: 3 numbered pins (green origin, white border waypoint, dark green destination) + polyline + glass summary card bottom-left ("4.2 km · ~18 min · ₦450–₦700")
7. Route steps (full): 3 steps — numbered connector, full text, VehicleChips, fare AppTag Coins icon
8. Image gallery: 3 images, left 50% + right 2-stacked, click-to-lightbox indicator
9. Engagement bar: Heart 42, ThumbsDown 3, MessageCircle 12, Bookmark, Share2 — full-width
10. Transact CTA: AppCard elevated — "Buy Route Guide" heading, "₦2,500" AppTag primary, "Get Full Access" AppButton primary
11. Comments section: CommentInput (AppTextarea + Send AppButton primary sm) + 3 comment rows (AppUserLabel 32px + comment text with "@mention" in primary colour + timestamp + delete icon)
12. "Related Routes" heading + 3 mini PostCards horizontal scroll

Dark: same layout, dark surface tokens, map dark tile style annotated.

EXPORT: Save as 09-explore-map.html, 10-post-detail-light.html, 11-post-detail-dark.html to ai-system/designs/
Annotate with <!-- §7.4/§7.5 [Zone] --> comments. Update README.md.
```

---

### PROMPT OD-5 — Profile + Notifications + Bookmarks

**Attach:** `DESIGN.md`
**Purpose:** Design user identity and social notification surfaces.

```
Using the Along design system and DESIGN.md, design three pages:

PAGE A: Profile Page (/profile/[username]) — DESIGN.md §7.6
Mobile (375px) + Desktop (1280px) — Light theme.
Show two variants: OWN profile and OTHER user's profile.

Layout:
1. Cover: 180px, primary gradient (linear-gradient(135deg, var(--color-primary-dark), var(--color-primary)))
2. AppAvatar 80px, 3px white border, overlapping cover by 40px. Camera overlay button (own only, 28px circle).
3. Name title-lg + BadgeCheck icon (primary colour) inline
4. @handle body-sm text-secondary
5. Bio body-md max 2 lines
6. Stats row: [Posts 47] · [Followers 1.2K] · [Following 284] · [Avg Score 74] — bold number + muted label, | dividers
7. Own: "Edit Profile" AppButton secondary + camera on avatar
   Other: "Follow" AppButton primary (show alternative "Following" state with hover showing "Unfollow" + UserMinus icon annotated). "12 mutual follows" muted text.
8. RewardsPanel (own only): AppCard flat — Gold shield AppTag, "2,140 pts" large, AppProgress bar to Platinum (5,000 pts), recent activity row
9. Tabs: Posts · Liked · Bookmarks (own only) · Routes — active tab indicator (underline + primary text)
10. Tab content: 2× PostCard at feed width

PAGE B: Notifications (/notifications) — DESIGN.md §7.9
Mobile (375px) + Desktop (1280px) — Light theme.

1. Page heading "Notifications" + "Mark all as read" AppButton ghost right
2. Tabs: All · Unread · Rewards
3. Six notification rows — one per type:
   - LIKE: Heart 16px red circle badge — "@chioma_travel liked your route"
   - COMMENT: MessageCircle blue circle — "@kolade_goes commented: 'This helped...'"
   - FOLLOW: UserPlus green circle — "@routes_ng started following you"
   - MENTION: AtSign purple circle — "@lagos_rider mentioned you in a comment"
   - ROUTE_VERIFIED: CheckCircle green circle — "Your route reached Verified status"
   - REWARD: Star amber circle — "You earned 100 pts! Gold tier approaching."
   Each row: AppAvatar 40px (actor, links to profile) + type icon badge overlay 16px + message text (actor name bold) + timestamp + unread blue dot
   Entire row: pointer cursor, hover bg-elevated
4. AppEmptyState noNotifications in empty Rewards tab

PAGE C: Bookmarks (/bookmarks)
Mobile (375px) — Light theme only.
Page heading + 2 PostCards + dimmed AppEmptyState noBookmarks at bottom (for reference).

EXPORT: Save as 12-profile-page.html, 13-notifications.html, 14-bookmarks.html to ai-system/designs/
Annotate with <!-- §7.6/§7.9 [Zone] --> comments. Update README.md.
```

---

### PROMPT OD-6 — Admin Dashboard + Analytics + Public Pages

**Attach:** `DESIGN.md`
**Purpose:** Admin-facing surfaces, analytics, and public informational pages.

```
Using the Along design system and DESIGN.md, design three sections:

SECTION A: Admin Dashboard (/admin) — DESIGN.md §7.8
Desktop (1280px) — Light theme. Admin is desktop-primary.

Layout: DashboardSidebar (240px) with Admin section visible (thin divider + "Admin" label 12px muted + Shield + admin nav items listed below) + main content.

Dashboard (Bento grid, 2-col):
1. 4-stat AppCard row: Total Users (Users icon), Posts Today (FileText), Avg Validity Score (ShieldCheck), Open Bug Reports (Bug) — each: large bold number + muted label + trend delta text
2. Signups line chart: AppCard elevated (7-day, primary green line, @ant-design/charts style)
3. Top Routes by Validity: horizontal bar chart AppCard elevated, 5 routes
4. Users AppTable: AppUserLabel, email, role AppTag (User/Moderator/Admin), reward tier AppTag (Bronze/Gold), post count, joined date, Actions AppDropdown (•••). Show one row with role dropdown open. Show AppStatusDot (green active, red banned).

SECTION B: Analytics Page (/analytics) — DESIGN.md §7.12
Desktop (1280px) — Light theme.

Bento grid, 2-col:
1. Engagement over time: line chart (views, likes, bookmarks — 3 lines). AppCard elevated.
2. Top 5 posts by validity: horizontal bar chart. AppCard elevated.
3. Follower growth: area chart. AppCard flat.
4. Tag distribution: donut chart. AppCard flat.
5. KPI row: 4 AppCard flat — total views, total likes, avg score, total posts. Large number + Lucide icon.

SECTION C: Public Pages
About (/about) — Desktop (1280px) — Light theme (DESIGN.md §7.10):
1. Hero: green gradient, "Our Story" heading
2. Team grid: 3-col AppCard elevated — AppAvatar 80px circle, name, role AppTag, bio 2 lines, social Lucide icon links
3. Reviews carousel: 3 AppCard glass on subtle green-tinted bg — quote text, 5 filled Star icons, reviewer AppUserLabel. Dot indicators + prev/next arrow buttons.

Contact (/contact) — Mobile (375px) — Light theme:
1. "Get in touch" heading
2. Form: Name AppInput, Email AppInput, Subject AppInput, Message AppTextarea 4 rows, "Send Message" AppButton primary full-width
3. Success state: AppEmptyState CheckCircle icon "Message sent!"

EXPORT: Save as 15-admin-dashboard.html, 16-analytics.html, 17-about-contact.html to ai-system/designs/
Annotate with <!-- §7.8/§7.12/§7.10 [Zone] --> comments.
Update README.md — verify the index table is complete with all 17 files (01 through 17).
```

---

## ─── OPEN DESIGN → OPEN CODE HANDOFF NOTE ────────────────────────────────────

### How to Hand Off Designs to Open Code

After completing all Open Design prompts (OD-1 through OD-6):

1. All HTML exports must be in `ai-system/designs/` with the naming convention above
2. `ai-system/designs/README.md` must be fully populated with the 17-file index table
3. When running Open Code prompts, **always attach the relevant HTML files** from `ai-system/designs/` alongside `DESIGN.md` and `ROADMAP.md`
4. Open Code treats the attached HTML files as the pixel-precise reference — DESIGN.md prose is secondary
5. The HTML annotations (`<!-- §7.x Zone -->`, token references) are what Open Code reads to extract exact values

**File attachment guide per Open Code prompt:**

| OC Prompt                          | HTML files to attach                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OC-2 (Universal Components)        | 01-design-system-tokens.html, 02-design-system-components.html                                                                                                            |
| OC-3 (Auth)                        | 05-auth-flow.html                                                                                                                                                         |
| OC-4 (Posts + Feed)                | 06-home-feed-light.html, 07-home-feed-dark.html, 08-share-route-modal.html, 10-post-detail-light.html, 11-post-detail-dark.html, 13-notifications.html, 14-bookmarks.html |
| OC-5 (Maps + Profiles)             | 09-explore-map.html, 12-profile-page.html                                                                                                                                 |
| OC-6 (Admin + Analytics + Rewards) | 15-admin-dashboard.html, 16-analytics.html                                                                                                                                |
| OC-7 (Public Pages)                | 03-landing-light.html, 04-landing-dark.html, 17-about-contact.html                                                                                                        |

---

## ─── OPEN CODE ────────────────────────────────────────────────────────────────

### PROMPT OC-1 — Project Bootstrap + ai-system Verification

**Attach:** `ROADMAP.md`, `DESIGN.md`, `ai-context.md`
**Purpose:** Verify the ai-system is correctly configured and the project foundation is solid before writing any feature code.

```
Read the following files before anything else, in this order:
1. ai-context.md — project identity and stack
2. ROADMAP.md — full architecture, file structure, phases, and principles
3. DESIGN.md — design system (required before any UI work)
4. ai-system/agents/general-instructions.md — coding standards
5. ai-system/planning/task-queue.md — current sprint tasks
6. ai-system/checkpoints/session-log.md — what was last completed

Report what you find in each file. Then execute:

TASK 1 — Dependency audit
Compare package.json against ROADMAP.md §DEPENDENCY CHECKLIST.
List every package that is missing, outdated, or needs removal.
Run `npm install`. Resolve peer conflicts. Document resolutions in ai-system/memory/project-decisions.md.

TASK 2 — Tailwind v4 migration
Check globals.css for `@import "tailwindcss"` and `@theme {}` block.
If missing or incomplete, implement the full token system from DESIGN.md §2 and §4:
- All --color-* tokens (§2.1, §2.2, §2.3 trust levels, §2.4 vehicle colours)
- All --radius-*, --shadow-*, --duration-* tokens
- .glass and .dark .glass utility classes from §2.5
- Global :focus-visible rule and prefers-reduced-motion media query
- Inter font via next/font/google

TASK 3 — Config registry
Check app/lib/config/ for completeness against ROADMAP.md §0.2 table.
Create every missing config file. Rewrite every existing file that has emoji, raw hex values, or non-Lucide icon references.
Show which files were created, rewritten, or already correct.

TASK 4 — Prisma schema
Compare prisma/schema.prisma against ROADMAP.md §0.3.
Add any missing enum, model, field, or index.
Run: `npx prisma migrate dev --name verify-schema` then `npx prisma generate`.

TASK 5 — Quality gate
Run: `npm run build && npx tsc --noEmit && npx next lint`
Fix every error. Show the final clean output of all three commands.

Log everything in ai-system/checkpoints/session-log.md.
Update ai-system/planning/task-queue.md — mark Phase 0 tasks complete.
```

---

### PROMPT OC-2 — Universal Component Library

**Attach:** `ROADMAP.md`, `DESIGN.md`, `01-design-system-tokens.html`, `02-design-system-components.html`
**Purpose:** Build the complete App\* component library. All feature code consumes these wrappers exclusively.

```
Read ROADMAP.md and DESIGN.md. Open the attached HTML design files as pixel-precise visual references for every component.
Read ai-system/agents/general-instructions.md and ai-system/planning/task-queue.md.

COMPONENT RULE: All page and feature files import ONLY from '@/components/ui'. Never raw Ant Design in feature files.
DESIGN REPLICATION: Extract exact spacing, colour token references, border radius, and shadow from HTML annotations.
ICON RULE: Every icon in every component uses a Lucide React import. Zero emoji anywhere.

Build all components in app/components/ui/ per ROADMAP.md §0.4. In order:

BATCH 1 — Primitives:
AppButton (5 variants × all states), AppInput, AppTextarea, AppSelect, AppProgress, AppAlert, AppDivider, AppSpinner, AppPageLoader, AppStatusDot

BATCH 2 — Layout containers:
AppCard (5 variants + hover lift), AppModal (5 sizes), AppEmptyState (all presets from EMPTY_STATES config), AppTooltip, AppDropdown, AppPagination, AppTag

BATCH 3 — Skeleton loaders:
AppSkeleton with named presets: PostCardSkeleton, UserCardSkeleton, TableRowSkeleton, StatCardSkeleton, MapSkeleton

BATCH 4 — Social components:
AppAvatar (DiceBear URL, fallback, verified badge, linkToProfile default true), AppUserLabel (profile link, reward tier badge), AppTable (generic, rowHref subtle linking, selectable, sticky header, empty state)

BATCH 5 — Form infrastructure:
ConfigDrivenForm (typed FieldConfig[], renders App* inputs per type, Zod inline errors), ConfigDrivenList (renderItem, skeleton, empty state, pagination)

BATCH 6 — Global overlays:
GlobalConfirmModal (consumes ModalService, AlertTriangle / HelpCircle icon, destructive and sensitive variants), GlobalUndoToast (countdown bar, Undo button, slide-up/down animation), CookieConsent (bottom fixed, "Along uses necessary cookies", Privacy Policy link, "Got it" button, cookie persistence)

BATCH 7 — Domain components:
TrustBadge (4 trust levels, sm/default sizes, AppTooltip breakdown with 4 AppProgress bars, colours from DESIGN.md §2.3), VehicleChip (icon from VEHICLE_REGISTRY, colour from config, Lucide icon — no emoji), AppFooter (config-driven from FOOTER_CONFIG, devCredit: "Built by S.D" → https://sotonye-dagogo.is-a.dev, text-xs opacity-60), StructuredData (JSON-LD script injector)

Create app/components/ui/index.ts barrel exporting everything.
Run `npm run build && npx tsc --noEmit`. Fix all errors.
Log in ai-system/checkpoints/session-log.md. Update task-queue.md.
```

---

### PROMPT OC-3 — Authentication System

**Attach:** `ROADMAP.md`, `DESIGN.md`, `05-auth-flow.html`
**Purpose:** Complete auth — API, pages, context, and middleware.

```
Read ROADMAP.md, DESIGN.md, and ai-system/planning/task-queue.md.
Open 05-auth-flow.html as the pixel-precise visual reference for all auth pages.

DESIGN REPLICATION: Extract exact form layout, left panel gradient, OTP box dimensions and spacing, Google button styling from 05-auth-flow.html annotations. Replicate with App* components.
COMPONENT RULE: Use ConfigDrivenForm with LOGIN_FIELDS / REGISTER_FIELDS from app/lib/config/forms.ts.

BACKEND:
- app/lib/utils/auth.ts: issueTokens(), verifyAccessToken(), getUserFromRequest()
- app/lib/utils/cookies.ts: setAuthCookies(), clearAuthCookies()
- app/lib/schemas/auth.ts: REGISTER_SCHEMA, LOGIN_SCHEMA, OTP_SCHEMA (Zod)
- /api/auth/register: validate → bcrypt hash (12 rounds) → create User (inviteCode=cuid(), check ?ref param → set invitedById) → OTP hashed to Redis TTL 15min
- /api/auth/otp: verify hashed OTP → User.verified=true → issue JWT pair → set httpOnly cookies
- /api/auth/login: find by email → compare hash → check verified → issue tokens → cookies
- /api/auth/logout: clear cookies
- /api/auth/refresh: verify refresh token → new access token
- /api/auth/google + /api/auth/google/callback: code exchange → userInfo → upsert user → JWT → redirect /home
- /api/auth/me: verify access_token cookie → return User (no password)

FRONTEND:
- app/(auth)/layout.tsx: split-panel layout. Left: green gradient, white logo, tagline, abstract route-line SVG. Right: form. Mobile: stacked.
- app/(auth)/login/page.tsx: ConfigDrivenForm LOGIN_FIELDS + Google button + "Forgot password?" + "Register" link. Metadata noIndex.
- app/(auth)/register/page.tsx: ConfigDrivenForm REGISTER_FIELDS + username availability check (debounced 400ms) + terms note. Metadata noIndex.
- app/(auth)/otp/page.tsx: 6-box OTP (paste fills all, auto-advance, backspace returns) + resend countdown.
- app/providers/AuthProvider.tsx: user state, token refresh on 401, logout. GET /api/auth/me on mount.
- hooks/useAuth.ts, hooks/useRequireAuth.ts
- middleware.ts: protect /(dashboard) and /(admin), verify JWT server-side, redirect /login on fail
- app/(dashboard)/layout.tsx: useRequireAuth guard + DashboardSidebar + MobileTopBar + MobileBottomNav + skip-to-content link + <main id="main-content">
- app/(admin)/layout.tsx: role guard (role !== 'admin' → /home) + admin nav visible from NAV_REGISTRY

Global services — implement if not done:
- app/lib/services/modalService.ts + app/providers/GlobalModalProvider.tsx
- app/lib/services/toastService.ts + app/providers/GlobalToastProvider.tsx
- app/lib/services/undoService.ts
- app/lib/services/offlineQueue.ts
- app/providers/CookieConsentProvider.tsx
- Update app/layout.tsx: correct provider nesting + CookieConsent + GlobalConfirmModal + GlobalUndoToast mounted

Run `npm run build && npx tsc --noEmit`. Fix all errors.
Log in ai-system/checkpoints/session-log.md. Update task-queue.md.
```

---

### PROMPT OC-4 — Posts, Feed + Core Social Interactions

**Attach:** `ROADMAP.md`, `DESIGN.md`, `06-home-feed-light.html`, `07-home-feed-dark.html`, `08-share-route-modal.html`, `10-post-detail-light.html`, `11-post-detail-dark.html`, `13-notifications.html`, `14-bookmarks.html`
**Purpose:** Build the entire post system — the core product loop.

```
Read ROADMAP.md, DESIGN.md, and ai-system/planning/task-queue.md.
Open all attached HTML files. These are pixel-precise references — extract exact values from their annotations.

DESIGN REPLICATION:
- PostCard connector line, numbered circles, vehicle chip layout, action bar spacing: from 06-home-feed-light.html
- DraftingCoach score bar gradient, nudge alert style, chip row: from 08-share-route-modal.html
- Post detail gallery, engagement bar, comment row layout: from 10-post-detail-light.html
- Notification row structure, type icon badge position: from 13-notifications.html

COMPONENT RULE: PostCard uses AppCard, AppUserLabel, AppDropdown, AppTag, TrustBadge, VehicleChip only. Zero raw Ant Design.
ICON RULE: Zero emoji in PostCard or any social component. All icons Lucide.
LINK RULE: Every user name/avatar → /profile/[userName]. Every post title → /posts/[id]. Every tag → /explore?tag=. Every region → /explore?region=. All as Next.js Link with e.stopPropagation() where nested in clickable parents.

BACKEND:
- app/lib/schemas/post.ts: CREATE_POST_SCHEMA, UPDATE_POST_SCHEMA, COMMENT_SCHEMA (Zod)
- app/lib/services/feedService.ts: FeedService class, full weighted algorithm (weights from getSiteConfig), Redis cache feed:{userId}:{cursor} TTL 5min, bulk enrichment (zero N+1 — single query per resource type)
- app/lib/services/ValidityEngine.ts: full implementation (likeRatio, detailScore, similarityRatio, recency). getTrustLevel(). Export singleton.
- app/lib/services/DraftingCoachService.ts: evaluate(), getScore(), getNextSuggestion(). Implement evaluateFn for all 8 QUALITY_CHECKPOINTS. Export singleton.
- /api/posts: POST (ACID: create + UserActivity + invalidate cache + points stub) + GET (filtered)
- /api/posts/feed: GET auth, feedService.getFeed(), cursor-based
- /api/posts/[id]: GET (public, enriched with flags) + PATCH (own) + DELETE (own/admin)
- /api/posts/[id]/like: POST auth, ACID toggle, counter, Notification(LIKE), validity recompute → cache Redis validity:{postId} TTL 30min
- /api/posts/[id]/bookmark: POST auth, ACID toggle + counter
- /api/posts/[id]/comments: GET paginated + POST (ACID: create + Notification(MENTION) per @mention)

FRONTEND:
- components/features/posts/PostCard.tsx: full pixel-precise to 06-home-feed-light.html. All zones from DESIGN.md §6.9. optimistic interactions via hooks/useFeedInteractions.ts. ModalService.confirm before delete. UndoService(10s) after delete. AppDropdown (•••): Edit, Delete, Report, Copy Link.
- components/features/posts/ShareRouteModal.tsx: full 2-col layout, pixel-precise to 08-share-route-modal.html. RouteStepInput (location + vehicle chips + fare). DraftingCoach. LiveRouteMap placeholder (MapSkeleton — will be replaced in OC-5). Cloudinary image upload.
- components/features/posts/DraftingCoach.tsx: pixel-precise to 08-share-route-modal.html annotations.
- hooks/useFeedInteractions.ts: optimistic like/dislike/bookmark with rollback + UndoService.
- app/(dashboard)/home/page.tsx: 3-panel layout pixel-precise to 06-home-feed-light.html + 07-home-feed-dark.html. Compose card, new-posts banner (IntersectionObserver-based), infinite scroll, Along Suggestion every 8th item (AppCard suggestion variant), right sidebar, back-to-top FAB.
- app/(dashboard)/posts/[id]/page.tsx: pixel-precise to 10-post-detail-light.html + 11-post-detail-dark.html. generateMetadata, StructuredData Article, RouteMap (placeholder), image gallery with lightbox AppModal, engagement bar, CommentInput + CommentList with @mentions.
- components/features/comments/CommentInput.tsx: @mention trigger → search dropdown → insert @username.
- app/lib/utils/commentParser.tsx: renderCommentWithMentions() — @username → primary Link.
- app/(dashboard)/notifications/page.tsx: pixel-precise to 13-notifications.html. All 6 NotificationType variants.
- app/(dashboard)/bookmarks/page.tsx: pixel-precise to 14-bookmarks.html.

Run `npm run build && npx tsc --noEmit && npm test -- --passWithNoTests && npx next lint`
Fix every error. Log in ai-system/checkpoints/session-log.md. Update task-queue.md.
```

---

### PROMPT OC-5 — Maps, Explore + User Profiles

**Attach:** `ROADMAP.md`, `DESIGN.md`, `09-explore-map.html`, `12-profile-page.html`
**Purpose:** MapLibre migration, explore page, user profile system, and avatar editor.

```
Read ROADMAP.md, DESIGN.md, and ai-system/planning/task-queue.md.
Open 09-explore-map.html and 12-profile-page.html as pixel-precise references.

DESIGN REPLICATION:
- Explore: glass overlay bar blur/opacity from 09-explore-map.html annotations. Pin popup exact dimensions and glass card style. Bottom sheet drag handle and snap points. Side panel width.
- Profile: cover gradient values. Avatar border width and overlap. Stats row divider style. RewardsPanel layout. Tab active indicator.

MAPLIBRE: All map components: dynamic(() => import(...), { ssr: false }) — mandatory, no exceptions.
Add to next.config.ts if missing:
  webpack: (config) => { config.resolve.alias = { ...config.resolve.alias, 'maplibre-gl': 'maplibre-gl/dist/maplibre-gl.js' }; return config; }

MAPS:
- components/features/posts/RouteMap.tsx: full implementation per DESIGN.md §6.12 and 09-explore-map.html. Origin (green filled), waypoint (white + green border), destination (dark green) numbered markers. Polyline from @mapbox/polyline decode. Fallback: straight lines between pins. Editable mode: draggable markers + "Auto-Trace" AppButton. Glass summary card overlay. Dark mode: swap map style URL on html.classList change. MapSkeleton loading.
- app/lib/services/routeTracingService.ts: OpenRouteService /directions → encoded polyline → fallback straight-line segments
- /api/routes/trace: POST { pins } → { polyline, distance, duration }. Rate limited 20/hour.
- Wire RouteMap into: ShareRouteModal (replace placeholder), PostDetail (280px, not editable), PostCard (100px, only if pins exist)
- components/features/posts/RouteStepInput.tsx: Google Places Autocomplete (script load, MapPin icon prefix), returns RoutePin
- /api/posts POST: wire geographic extraction (startCoords, endCoords, region via Nominatim, totalDistanceKm)
- app/(dashboard)/explore/page.tsx: full pixel-precise to 09-explore-map.html. Full-viewport map. Top glass bar. Desktop side panel (320px glass). Mobile bottom sheet (draggable, 40vh→80vh snap). Supercluster clustering. Click pin → glass popup. "Near me" geolocation. "Share this view" permalink. URL state sync (lat/lng/zoom ↔ query params, replaceState).

PROFILES + IDENTITY:
- /api/users/[id]: GET + PATCH (own)
- /api/users/[id]/avatar: PATCH → save AvatarConfig JSON
- /api/users/[id]/follow: POST ACID (Follow + Notification) + DELETE ACID
- /api/users/search: GET ?q= → UserPublic[] for @mention autocomplete
- app/(dashboard)/profile/page.tsx (own): pixel-precise to 12-profile-page.html own variant. generateMetadata + ProfilePage JSON-LD. Cover, AppAvatar 80px, stats, EditProfileModal, AvatarEditor access, RewardsPanel, tabs.
- app/(dashboard)/profile/[username]/page.tsx (other): pixel-precise to 12-profile-page.html other variant. Follow button with hover→Unfollow + UserMinus state. Mutual follows count.
- components/features/profile/EditProfileModal.tsx: AppModal + ConfigDrivenForm EDIT_PROFILE_FIELDS
- components/features/profile/AvatarEditor.tsx: 2-panel AppModal. Style grid (3-col AVATAR_STYLES cards with DiceBear img). Live 120px AppAvatar preview. Option controls. Save → PATCH /api/users/[id]/avatar.

SUBTLE LINKS FULL-CODEBASE AUDIT:
Find every user name, @handle, avatar, post title, tag chip, and region chip that is NOT a Next.js Link. Fix every instance. List every change by file.

Run `npm run build && npx tsc --noEmit && npx next lint`
Log in ai-system/checkpoints/session-log.md. Update task-queue.md.
```

---

### PROMPT OC-6 — Admin, Analytics, Rewards + Invite

**Attach:** `ROADMAP.md`, `DESIGN.md`, `15-admin-dashboard.html`, `16-analytics.html`
**Purpose:** Admin surface, analytics, rewards engine, invite system.

```
Read ROADMAP.md, DESIGN.md, and ai-system/planning/task-queue.md.
Open 15-admin-dashboard.html and 16-analytics.html as pixel-precise references.

DESIGN REPLICATION: Extract Bento grid cell sizes, chart card proportions, table column widths, stat card layout, AppStatusDot colours from HTML annotations.
ADMIN RULE: All AppTable in admin use rowHref for subtle row navigation. All destructive actions use ModalService.confirm(destructive). Role guard in layout.

REWARDS ENGINE:
- app/lib/services/rewardsService.ts: full — awardPoints(userId, action, meta) ACID (increment + tier check + REWARD notification if tier upgrades), computeTier(points), checkTierUpgrade(userId)
- Wire into: /api/posts (PUBLISH_POST), /api/posts/[id]/like (RECEIVE_LIKE), /api/posts/[id]/bookmark (RECEIVE_BOOKMARK), ValidityEngine tier-change event (VALIDITY_TIER_CHANGE)
- components/features/profile/RewardsPanel.tsx: tier badge AppTag, points, AppProgress to next tier, 10-item history, "Invite friends" CTA

INVITE:
- /api/invite: GET user invite stats + top 10 leaderboard
- app/(dashboard)/invite/page.tsx: invite link AppInput + copy AppButton + QRCode (qrcode.react) + 3 stat AppCards + AppTable leaderboard
- /api/auth/register: if ?ref= → set invitedById → awardPoints(inviterId, INVITE_ACCEPTED) after OTP

ADMIN PAGES:
- app/(admin)/page.tsx: pixel-precise to 15-admin-dashboard.html. 4 stat AppCards + signups line chart + top routes bar chart + users AppTable preview.
- app/(admin)/users/page.tsx: full AppTable (rowHref, sortable, role AppDropdown, ban/unban with ModalService.confirm)
- app/(admin)/posts/page.tsx: AppTable + TrustBadge per row + validity range filter + archive/delete
- app/(admin)/config/page.tsx: SiteConfig rows, inline JSON edit, save/cancel per row
- app/(admin)/bugs/page.tsx: AppTable + AppStatusDot + detail AppModal on row click
- app/(admin)/reviews/page.tsx: AppTable + filled/empty Star icons + approve/feature/reject actions
- All /api/admin/* routes with role guard

ANALYTICS:
- /api/analytics/user: aggregate AnalyticsEvent + UserActivity
- app/(dashboard)/analytics/page.tsx: Bento grid pixel-precise to 16-analytics.html. @ant-design/charts. Dark mode compatible.

Run `npm run build && npx tsc --noEmit && npm test -- --passWithNoTests && npx next lint`
Log in ai-system/checkpoints/session-log.md. Update task-queue.md.
```

---

### PROMPT OC-7 — Public Pages, Footer + SEO Completion

**Attach:** `ROADMAP.md`, `DESIGN.md`, `03-landing-light.html`, `04-landing-dark.html`, `17-about-contact.html`
**Purpose:** All public pages, footer, complete SEO, cookie consent.

```
Read ROADMAP.md, DESIGN.md, and ai-system/planning/task-queue.md.
Open 03-landing-light.html, 04-landing-dark.html, 17-about-contact.html as pixel-precise references.

DESIGN REPLICATION: Hero gradient exact values, decorative SVG style, feature card dimensions, review carousel glass card, contact form layout — all from HTML annotations.
SEO RULE: Every public page must have unique title, description, OG tags. Dynamic pages use generateMetadata(). No page without metadata.

PUBLIC PAGES:
- app/(public)/layout.tsx: shared layout, includes AppFooter, no dashboard nav
- app/(public)/page.tsx: pixel-precise to 03-landing-light.html + 04-landing-dark.html. Hero gradient, white logo, tagline, CTA row, decorative route SVG, feature grid, social proof strip, 2 PostCard previews, CTA section. buildMetadata() + StructuredData WebSite.
- app/(public)/about/page.tsx: pixel-precise to 17-about-contact.html about section. Hero, team grid (getSiteConfig('teamMembers', TEAM_MEMBERS) → AppCard elevated), reviews carousel (featured=true, AppCard glass, auto-rotate 5s). buildMetadata().
- app/(public)/contact/page.tsx: pixel-precise to 17-about-contact.html contact section. ConfigDrivenForm CONTACT_FIELDS. Success → AppEmptyState CheckCircle. buildMetadata().
- app/(public)/privacy/page.tsx + app/(public)/terms/page.tsx: react-markdown rendered. Inter typography max-width 720px. buildMetadata().
- app/(public)/report-bug/page.tsx: ConfigDrivenForm BUG_REPORT_FIELDS. Cloudinary attachment. Email pre-fill for auth users. buildMetadata().

FOOTER:
- Full AppFooter.tsx: FOOTER_CONFIG-driven, link columns, social Lucide icons, copyright, dev credit "Built by S.D" → https://sotonye-dagogo.is-a.dev (text-xs opacity-60)
- Wire into: app/(public)/layout.tsx + app/(dashboard)/layout.tsx

SEO COMPLETION:
- generateMetadata on: /posts/[id] (buildPostMetadata), /profile/[username] (buildProfileMetadata)
- Static metadata on: /, /about, /contact, /explore, /marketplace
- noIndex on: /(auth)/*, /(admin)/*, /(dashboard)/home
- app/sitemap.ts: static + dynamic (published posts + all profiles)
- app/robots.ts: disallow /admin, /api, /(auth)
- StructuredData on: landing (WebSite), /posts/[id] (Article), /profile/[username] (ProfilePage)
- CookieConsent: verify appears on first visit, links to /privacy, sets cookie on dismiss, does not reappear after acceptance

Run `npm run build && npx tsc --noEmit && npx next lint`
Log in ai-system/checkpoints/session-log.md. Update task-queue.md.
```

---

### PROMPT OC-8 — Performance, Testing + Production Hardening

**Attach:** `ROADMAP.md`, all `ai-system/designs/*.html` files
**Purpose:** Design-to-code delta, performance, tests, PWA, final gate.

```
Read ROADMAP.md. Open ai-system/designs/README.md and verify all 17 HTML files are present.
Design-to-code delta check: for each HTML file, compare annotated sections against the implemented pages. Log every gap in ai-system/checkpoints/session-log.md. Fix every gap before continuing.
Read ai-system/agents/repair-system.md and fix all known patterns logged there.

1. EMOJI AUDIT — final sweep
   Grep entire codebase for any emoji (Unicode ranges or literal emoji characters). Replace every one with the Lucide icon from DESIGN.md §5.1. List every file changed.

2. COMPONENT COMPLIANCE AUDIT
   Find every page or feature file importing raw Ant Design components instead of App* wrappers. List and fix every violation.

3. SUBTLE LINKS AUDIT (final)
   Find any remaining user name, avatar, post title, tag, or region not wrapped in Next.js Link. List and fix.

4. PERFORMANCE
   - Audit all list API routes for N+1 queries. Fix with bulk batch queries. Show routes changed.
   - Verify dynamic imports: RouteMap (ssr:false), AvatarEditor, ShareRouteModal, chart components.
   - Verify cursor-based pagination (not offset) on all paginated routes.
   - Verify Redis cache keys and TTLs: feed (5min), validity (30min), suggestions (30min), siteConfig (60min).
   - Verify IntersectionObserver (not scroll listener) drives infinite scroll.

5. TESTING
   Write Jest unit tests for:
   - ValidityEngine.compute(): all 4 sub-computations, edge cases (0 votes, 0 routes, 91-day post, maxed scores)
   - DraftingCoachService.evaluate(): all 8 checkpoints, partial draft, full draft, empty draft
   - filterNavItems(): all role / auth / surface combinations
   - buildAvatarUrl(): valid config + missing options
   - buildMetadata(): title + description + fallbacks
   - rewardsService.computeTier(): every tier threshold boundary
   Write component tests:
   - AppEmptyState: all EMPTY_STATES presets render with correct icon and text
   - AppUserLabel: linkToProfile=true and linkToProfile=false
   - TrustBadge: all 4 levels, sm and default sizes
   Run: `npm test`. Fix failures.

6. PWA
   - Verify manifest.json: name, short_name, icons (public/icon-192.png + public/icon-512.png), theme_color: '#00623B', display: 'standalone'
   - Verify public/favicon.ico and public/apple-touch-icon.png exist and are referenced correctly
   - Verify offline indicator shows when navigator.onLine = false
   - Verify offlineQueue.flush() on 'online' event

7. FINAL GATE
   Run: `npm run build && npx tsc --noEmit && npm test && npx next lint`
   All must pass with zero errors and zero warnings.
   Update ai-system/agents/system-architecture.md — current live state.
   Update ai-system/memory/project-decisions.md — all architectural decisions.
   Update ai-system/planning/task-queue.md — all tasks marked [x].
   Write final entry in ai-system/checkpoints/session-log.md: "OC-8 COMPLETE — Production ready."
```

---

## ─── SESSION CONTINUITY PROMPT (use at the start of every new session) ────────

### PROMPT SC-1 — Resume Session

**Attach:** `ROADMAP.md`, `DESIGN.md`, `ai-context.md`, plus the `ai-system/designs/*.html` files relevant to your current task

```
Read the following files before anything else, in this order:
1. ai-context.md — project identity and stack
2. ROADMAP.md — architecture, patterns, conventions, phases
3. DESIGN.md — design system (before any UI work)
4. ai-system/agents/general-instructions.md — coding standards
5. ai-system/planning/task-queue.md — current sprint tasks
6. ai-system/checkpoints/session-log.md — what was last completed and any blockers
7. ai-system/designs/README.md — design index (open the relevant HTML files for your current task)

Report:
- What is the current task from task-queue.md?
- What was last completed per session-log.md?
- Are there any design-to-code deltas or repair patterns logged?
- Which ai-system/designs/*.html file applies to the current task?

Then proceed with the next task from the queue.

Enforce throughout this session without exception:

ARCHITECTURE:
- Config-driven: no hardcoded labels, icon strings, option lists, or weight values. All from lib/config/*.
- OOP services: business logic in class-based services. Pages → services → repositories → Prisma.
- Repository pattern: no prisma.* calls outside app/lib/db/.
- ACID: any mutation touching >1 table uses prisma.$transaction([]).
- Interface-first: define TypeScript interface before implementation. No any in new files.

COMPONENTS:
- Only import from '@/components/ui' in feature and page files. Never raw Ant Design in feature code.
- All user name/avatar: AppUserLabel or AppAvatar with linkToProfile=true.
- All forms: ConfigDrivenForm. All tables: AppTable. All lists: ConfigDrivenList.
- All destructive/sensitive actions: ModalService.confirm() before execution.

DESIGN:
- CSS variables only — never raw hex values in component or style files.
- Zero emoji — Lucide React per DESIGN.md §5.1 exclusively.
- Role-aware not role-specific: filterNavItems() from nav config.
- ai-system/designs/*.html is the pixel-precise reference. DESIGN.md prose is secondary.

QUALITY:
- npm run build passes before marking any task done.
- npx tsc --noEmit — zero TypeScript errors.
- npx next lint — zero warnings.
- Log session in ai-system/checkpoints/session-log.md.
- Update ai-system/planning/task-queue.md — mark [x] on completed tasks.
```

---

## ─── DESIGN FILE INDEX ────────────────────────────────────────────────────────

After completing all OD prompts, `ai-system/designs/` must contain:

| File                             | Screen                 | OD Prompt | OC Prompt |
| -------------------------------- | ---------------------- | --------- | --------- |
| 01-design-system-tokens.html     | Token reference        | OD-1      | OC-2      |
| 02-design-system-components.html | Component library      | OD-1      | OC-2      |
| 03-landing-light.html            | Landing (light)        | OD-2      | OC-7      |
| 04-landing-dark.html             | Landing (dark)         | OD-2      | OC-7      |
| 05-auth-flow.html                | Login / Register / OTP | OD-2      | OC-3      |
| 06-home-feed-light.html          | Home feed (light)      | OD-3      | OC-4      |
| 07-home-feed-dark.html           | Home feed (dark)       | OD-3      | OC-4      |
| 08-share-route-modal.html        | ShareRouteModal        | OD-3      | OC-4      |
| 09-explore-map.html              | Explore map            | OD-4      | OC-5      |
| 10-post-detail-light.html        | Post detail (light)    | OD-4      | OC-4      |
| 11-post-detail-dark.html         | Post detail (dark)     | OD-4      | OC-4      |
| 12-profile-page.html             | Profile page           | OD-5      | OC-5      |
| 13-notifications.html            | Notifications          | OD-5      | OC-4      |
| 14-bookmarks.html                | Bookmarks              | OD-5      | OC-4      |
| 15-admin-dashboard.html          | Admin dashboard        | OD-6      | OC-6      |
| 16-analytics.html                | Analytics              | OD-6      | OC-6      |
| 17-about-contact.html            | About + Contact        | OD-6      | OC-7      |

_End of PROMPTS.md_
