# Along App — Google Stitch Design Brief
**Version:** 2.0 · April 2026  
**Purpose:** Feed this document directly into Google Stitch (or any AI design tool) to generate high-fidelity UI designs for the Along platform.  
**Works standalone** — Figma file and UI screenshots are optional enrichments. Attach them if available.

---

## OPTIONAL ATTACHMENTS (Include if available)
- `[ATTACH: original_ui_designs.png/pdf]` — Original Along UI/UX design reference  
- `[ATTACH: figma_file_link]` — Figma source file URL  
> If neither is attached, proceed with the design system and specs below as the sole reference.

---

## 1. PRODUCT BRIEF

Along is a **social travel-intelligence platform** — conceptually a **Twitter × Google Maps hybrid**. Users share detailed transport routes (like tweets), which are pinned to a map (like Google Maps pins). The core loop: **share → discover → validate → navigate**.

**Audience:** Urban commuters and travelers in Nigeria and West Africa — mobile-first users who navigate cities daily using a mix of taxis, keke napep, buses, bikes, and ridehail.

**Mood board keywords:** Modern · Clean · Purposeful · Bold green energy · Trust · Community  
**Design aesthetic:** Glassmorphism where it adds depth, Bento grid layouts for dashboards, blurry glassy card surfaces over map backgrounds, dark/light mode parity.

---

## 2. DESIGN SYSTEM

### 2.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#00623B` | Brand primary — buttons, active states, headings |
| `primary-light` | `#00A862` | Hover states, progress fills |
| `primary-dark` | `#004A2C` | Pressed states, dark mode primary |
| `bg-base` | `#FFFFFF` | Page background (light mode) |
| `bg-elevated` | `#F7F7F7` | Cards, sidebars, modals (light mode) |
| `bg-base-dark` | `#0F0F0F` | Page background (dark mode) |
| `bg-card-dark` | `#1F1F1F` | Cards in dark mode |
| `text-primary` | `#232323` | Body text (light mode) |
| `text-secondary` | `#6B7280` | Captions, metadata |
| `text-muted` | `#9CA3AF` | Placeholder, disabled |
| `success` | `#A4F4E7` | Success backgrounds |
| `success-text` | `#15B097` | Success text |
| `warning` | `#F4C790` | Warning backgrounds |
| `warning-text` | `#CC7914` | Warning text |
| `error` | `#E4626F` | Error backgrounds |
| `error-text` | `#8C1823` | Error text |
| `border` | `#E5E7EB` | Default borders |
| `glass-bg` | `rgba(255,255,255,0.12)` | Glassmorphism card base |
| `glass-border` | `rgba(255,255,255,0.25)` | Glassmorphism card border |

### 2.2 Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| App Font | Inter (fallback: Roboto, system-ui) | — | — |
| Hero heading | Inter | 800 | 32–48px |
| Section heading | Inter | 700 | 22–28px |
| Card title | Inter | 600 | 18–20px |
| Body text | Inter | 400 | 14–16px |
| Caption / meta | Inter | 400 | 12px |
| Code / monospace | Courier New, monospace | 400 | 13px |

### 2.3 Spacing & Shapes

- **Border radius:** 8px inputs, 12px cards, 16px modals, 24px large sheets, 999px pill badges
- **Card padding:** 16–20px
- **Page gutter:** 16px mobile, 24px tablet, 32px desktop
- **Max content width:** 680px (feed), 1200px (explore/dashboard)
- **Shadow:** `0 2px 16px rgba(0,0,0,0.08)` cards; `0 8px 32px rgba(0,98,59,0.15)` primary elements

### 2.4 Glass Morphism Style

Apply to: Map overlay cards, notification dropdowns, floating action panels, hero sections over map backgrounds.

```
background: rgba(255, 255, 255, 0.10)  (dark: rgba(15,15,15,0.55))
backdrop-filter: blur(16px) saturate(180%)
border: 1px solid rgba(255, 255, 255, 0.20)
border-radius: 16px
box-shadow: 0 8px 32px rgba(0,0,0,0.12)
```

### 2.5 Iconography

- **Icon library:** Lucide React (consistent stroke-based icons, 20–24px default)
- **No emojis** anywhere in the UI — replace all emoji with Lucide icons
- Vehicle icons: Car, Bike, Bus, PersonStanding, Truck (for Bolt/taxi)
- Trust icons: AlertTriangle (low), Clock (developing), CheckCircle (verified), ShieldCheck (trusted)
- Navigation: Home, Compass, Bookmark, ShoppingBag, Bell, User, Map, BarChart2, Settings

---

## 3. COMPONENT LIBRARY

### 3.1 Atoms

**Button variants:**
- `primary` — filled `#00623B`, white text, hover lighten to `#00A862`
- `secondary` — white bg, `#00623B` border + text
- `ghost` — transparent, `#6B7280` text
- `destructive` — `#E4626F` fill, white text
- All buttons: `border-radius: 6px`, `font-weight: 600`, `padding: 8px 16px`

**Input field:**
- Border `#E5E7EB`, radius 6px
- Focus: `border: 1.5px solid #00623B`, subtle green glow
- Error: `border: 1.5px solid #E4626F`

**Badge / Tag:**
- Pill shape (`border-radius: 999px`)
- Size variants: xs (10px), sm (12px), default (14px)
- Colors inherit from semantic system (success, warning, error, primary, neutral)

**Trust Badge:**
- Inline pill with Lucide icon + label + score number
- Hover: Tooltip with 4-row breakdown (progress bars for likeRatio, detailScore, similarityRatio, recency)
- Colors: Red (0–29), Orange (30–59), Green (60–79), Blue brand (80–100)

**Avatar:**
- Circle, sizes: 24px / 32px / 40px / 56px / 80px / 120px
- Source: DiceBear API SVG URL (loaded + cached)
- Fallback: initials on `#00623B` background
- Verified tick: small `CheckCircle` icon at bottom-right corner of avatar

### 3.2 Cards

**PostCard** (Twitter-style, full-width in feed):
- White card, 12px radius, 1px `#E5E7EB` border, hover lift shadow
- Top: Avatar + username + handle + timestamp + vehicle badges (icon + label)
- Title: Bold 18px
- Route steps: numbered list with connector line (left border line between stops)
- Images: if present, 2-up or 3-up grid with rounded corners
- Mini map preview: 100px tall MapLibre embed if coordinates present
- Bottom action bar: Like | Dislike | Comment | Bookmark | Share — icon + count
- Trust Badge inline (bottom right of card)
- Overflow menu (•••): Edit, Delete (destructive), Report

**RouteStep** (inside PostCard):
- Left: numbered circle (small, `#00623B` bg)
- Center: step text + vehicle icon + fare chip (e.g. "₦200–₦300")
- Connector line between steps (dashed left border)

**UserSuggestionCard** (sidebar):
- Horizontal: Avatar + name + handle + mutual follows count + Follow button
- Compact variant for suggestion list

### 3.3 Organisms

**Feed:**
- Single column, max-width 680px, centered
- "New posts available" banner (slides from top, green, non-blocking)
- Infinite scroll with skeleton loaders
- "Along Suggestion" cards: same as PostCard but with subtle green-tinted left border and "Along Suggestion • Based on community routes" label at top

**DashboardNavbar — Desktop:**
- Left sidebar, 240px wide, sticky
- Along logo (top) + nav items (icons + labels) + Profile mini-card (bottom)
- Active state: filled `#00623B` bg chip on item
- Admin users see additional "Admin" section below main nav

**DashboardNavbar — Mobile:**
- Bottom tab bar, 5 icons (Home, Explore, + (FAB center), Bookmarks, Profile)
- FAB (center): large round `#00623B` button with MapPin icon = "Share Route"
- Notifications accessible via bell in mobile top bar

**RouteMap:**
- MapLibre GL map with OpenStreetMap tiles
- Numbered markers (origin=green, waypoints=white+green border, destination=dark green)
- Polyline in `#00623B` with 3px stroke
- In editable mode: draggable markers, "Auto-Trace" button overlay
- Glass-morphism mini overlay card showing route summary (distance, time, avg fare)

**DraftingCoach (inside ShareRouteModal):**
- Collapsible panel at bottom of modal
- Progress bar (red→orange→green gradient) showing current predicted score
- Current top nudge: Alert card (info style)
- Completed checkpoints: row of small green pill badges with Lucide icons

**AvatarEditor:**
- Grid of style preview cards (3-col) — each shows DiceBear preview with style name
- Selected style: green border + checkmark
- Right panel: color/option pickers specific to chosen style
- Live preview: large avatar render (120px) updates in real time
- Save button at bottom

**GlobalConfirmModal:**
- Center overlay, max-width 420px
- Title (bold) + description
- Destructive variant: red "Delete/Confirm" button + gray "Cancel"
- Sensitive variant: primary green "Confirm" + gray "Cancel"
- Always includes icon (AlertTriangle for destructive, Info for sensitive)

**UndoToast:**
- Bottom-right toast (or bottom-center on mobile)
- "Post deleted" + countdown bar + "Undo" button (text link, green)
- Disappears after 10s or on tap Undo

**OfflineIndicator:**
- Fixed bottom banner or toast
- Dark/muted bg with WifiOff Lucide icon + "You're offline — some features unavailable"
- On reconnect: replaces with green "Back online" toast (auto-dismisses 3s)

---

## 4. PAGE MAP & WIREFRAMES

### 4.1 Landing Page `/`
**Layout:** Full-screen hero, centered content  
**Elements:**  
- Along logo + tagline "Navigate Together"  
- Hero illustration: stylized map with route pins (or abstract city SVG)  
- CTA buttons: "Get Started" (primary) + "Sign In" (secondary)  
- Below fold: 3-column feature highlights (Route Sharing, Trust Scores, Community)  
- Footer: minimal, links + devCredit

---

### 4.2 Auth Pages `/login`, `/register`, `/otp`
**Layout:** Split — left 40% brand panel (green gradient + logo + tagline), right 60% form  
**Mobile:** Full screen, form only, logo at top  
**Login form:** Email + Password + "Sign in with Google" + "Forgot password" link  
**Register form:** First/Last name + Username + Email + Password  
**OTP page:** 6-digit input (spaced boxes), resend timer, "Verify Email" heading  
**Glass effect:** Form container has glass-morphism card on light gray background

---

### 4.3 Home / Feed `/home`
**Layout:** 3-column desktop (left nav sidebar 240px · center feed 680px · right suggestions 280px)  
**Mobile:** Single column + bottom tab nav  

Left sidebar: NAV_REGISTRY items  
Center feed:  
- SearchBar (sticky on scroll, top of feed)  
- ShareRouteButton (large CTA, opens ShareRouteModal)  
- "New posts available" banner (conditionally shown)  
- PostCard list (infinite scroll)  
- Along Suggestions interspersed every 8th post  

Right sidebar:  
- "Who to follow" widget (3 UserSuggestionCards)  
- "Nearby events" Tega widget (if geolocation granted)  
- Trending tags cloud  

---

### 4.4 Explore `/explore`
**Layout:** Full-width map view (MapLibre, fills viewport) with overlaid Bento panels  
**Top:** Search bar + filter chips (vehicle type, trust level, region)  
**Map:** PostCard markers as clustered pins on map  
**Bottom sheet (mobile):** Draggable bottom sheet with post list  
**Desktop:** Side panel (320px) with filtered post list; clicking a post flies map to its bounds  
**Glass overlay:** Post summary cards on map hover/tap use glass-morphism style  

---

### 4.5 Post Detail `/posts/[id]`
**Layout:** Centered, max-width 720px  
**Top:** Author info row + Trust Badge (large) + route stats  
**Route section:** Full RouteMap (300px tall) + all route steps with vehicle icons + fare chips  
**Images:** Masonry or 2-up grid  
**Engagement bar:** Like/Dislike/Bookmark/Share with counts  
**Comments section:** Thread-style, infinite scroll  
**Related posts:** 3-card horizontal scroll at bottom  
**If listing exists:** Transact "Buy Guide" CTA card  

---

### 4.6 Profile `/profile` and `/profile/[username]`
**Layout:** Twitter-style — header banner + avatar + stats + tab content  
**Header:** Cover image (or gradient banner) + DiceBear avatar (overlapping bottom of banner)  
**Stats row:** Posts · Followers · Following · Validity Avg · Reward Tier badge  
**Tabs:** Posts | Liked | Bookmarks (own profile only) | Routes  
**Own profile:** "Edit Profile" button + AvatarEditor access  
**Others' profile:** Follow/Unfollow + "View on map" (shows their routes on Explore)  
**Reward Tier:** Prominent tier badge icon next to username  

---

### 4.7 ShareRouteModal (overlay)
**Layout:** Drawer/modal, max-width 640px, max-height 90vh, scrollable  
**Sections (top to bottom):**  
1. Title input  
2. Route Builder — add/remove/reorder steps (drag handles), each step: text area + vehicle selector (icon chips) + fare input + location autocomplete (Google Places)  
3. RouteMap preview (updates as pins added, auto-trace button)  
4. Image upload (drag-drop or file picker, Cloudinary direct upload, max 10)  
5. Tags input (tokenized)  
6. DraftingCoach panel (collapsible, live score)  
7. Submit / Save Draft buttons  

---

### 4.8 Notifications `/notifications`
**Layout:** Centered, max-width 640px  
**Item structure:** Avatar + icon (colored by type) + message + timestamp + "Mark read" dot  
**Types:** Like (green heart), Comment (blue bubble), Follow (purple user+), Mention (orange @), Reward (brand star)  
**Tabs:** All | Unread | Rewards  
**Empty state:** Illustrated empty with "No notifications yet"  

---

### 4.9 Marketplace `/marketplace`
**Layout:** Full page, grid of listing cards (Bento-style 3-col desktop, 2-col tablet, 1-col mobile)  
**ListingCard:** Post thumbnail + price chip + type badge (Guide/Tour/Ticket) + Seller avatar + "View" CTA  
**Seller profile section:** Featured sellers section at top (horizontal scroll)  

---

### 4.10 About Page `/about` (public, admin-editable content)
**Layout:** Multi-section public page  
**Sections:**  
1. Hero — Along brand statement + illustration  
2. **Team grid** — Bento layout cards per TeamMember (photo + name + role + bio + social links) — content from teamConfig / SiteConfig DB  
3. **Reviews carousel** — Featured user reviews in stylish quote cards (glassmorphism on green-tinted bg) — top-rated, admin-curated  
4. Product features overview  
5. Footer  

---

### 4.11 Admin Pages `/admin/*` (role-gated, same nav + admin section)
**Admin Dashboard:** Analytics overview Bento grid (total users, posts today, avg validity score, top regions)  
**Users:** Sortable table + search + bulk actions + ban/role controls  
**Posts:** Moderation queue + filter by validity score + approve/reject/archive  
**Config:** Key-value editor for SiteConfig with field types (number, JSON, textarea)  
**Bug Reports:** Table with status filters + detail drawer  
**Reviews:** Approve/feature/reject user reviews  
**Team:** CRUD for TeamMember cards (inline edit + Cloudinary image upload)  

---

### 4.12 Analytics `/analytics`
**Layout:** Bento grid dashboard  
**Cards:**  
- Engagement over time (line chart)  
- Top posts by validity  
- Tag distribution (treemap or bubble chart)  
- Followers gained over time  
- Invite leaderboard (if applicable)  
**Filters:** Date range picker, metric selector  

---

### 4.13 Bug Report `/report-bug`
**Layout:** Centered form card, max-width 560px  
**Fields:** Category dropdown (from BUG_CATEGORIES config) + Subject + Description (textarea) + Image attachment (optional, Cloudinary) + Email (pre-filled for auth users)  
**Submit:** Primary button + "Your feedback helps improve Along" caption  

---

### 4.14 Avatar Editor (modal overlay)
**Layout:** Two-panel modal (style picker left · preview right)  
**Left panel:** Scrollable grid of AVATAR_STYLES preview cards (3-col)  
**Right panel:** Large 120px live preview + style-specific option controls (color pickers, toggles)  
**Bottom:** "Save Avatar" primary button + "Cancel"  
**Behind the scenes:** Builds DiceBear URL from selected style + options + user seed (userName), stores JSON config in DB, renders via API URL  

---

## 5. INTERACTION PATTERNS

### 5.1 Confirm Modal (Global)
Triggered for: Delete Post, Delete Comment, Unfollow, Block User, Admin bans  
- Slides in from center with backdrop blur  
- Always has icon (AlertTriangle for destructive, HelpCircle for sensitive)  
- Keyboard: Enter = confirm, Escape = cancel  

### 5.2 Undo Toast
After: Delete, Unfollow, Unlike, Remove Bookmark  
- Appears bottom-right desktop / bottom-center mobile  
- Shows action name + countdown timer bar (10s) + "Undo" text button  
- Green progress bar depletes to zero  

### 5.3 Offline Indicator
- Non-blocking: soft bottom banner with WifiOff icon  
- Network-dependent CTAs get `opacity: 0.5 + cursor: not-allowed + tooltip "Available when online"`  
- On reconnect: green "Back online" toast with Lightning icon (auto-dismisses)  

### 5.4 Optimistic UI
Like/bookmark/follow: instant UI update, rollback on API error with error toast  
Visual: counter animates (+1 or -1), icon fill transitions with 200ms ease  

### 5.5 Loading States
- Feed: 3 PostCard skeletons (shimmer animation)  
- Map: blurred overlay with spinning MapPin icon  
- Profile: skeleton for avatar + stats + 5 PostCard skeletons  
- Images: blur placeholder → full image transition  

---

## 6. RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 768px | Single column, bottom tab nav, bottom sheets |
| Tablet | 768–1024px | 2-column (feed + sidebar), side drawer nav |
| Desktop | > 1024px | 3-column with left sidebar, center feed, right panel |
| Wide | > 1280px | Same as desktop, content max-widths enforced |

---

## 7. DARK MODE

Full dark mode via `.dark` class on `<html>`. All surfaces shift per design tokens:  
- Backgrounds: `#0F0F0F` (base), `#1A1A1A` (elevated), `#1F1F1F` (card)  
- Text: `#F5F5F5` (primary), `#D1D5DB` (secondary)  
- Primary color lightens to `#00A862` in dark mode for contrast  
- Glass cards: `rgba(15,15,15,0.55)` base with same blur/border treatment  
- Map tiles: use dark style variant from MapTiler  

---

## 8. ANIMATION TOKENS

| Name | Duration | Easing | Use |
|---|---|---|---|
| fast | 150ms | ease-out | Icon state changes, badge updates |
| base | 200ms | ease-in-out | Button hover, card hover |
| page | 300ms | ease-out | Page transitions, modal appear |
| slide | 300ms | cubic-bezier(0.34,1.56,0.64,1) | Bottom sheets, drawers |
| toast | 400ms | spring | Toast enter/exit |

Specific animations:  
- `fadeIn`: opacity 0→1 + translateY 10px→0 (300ms)  
- `slideDown`: for notification banners, new-posts indicator  
- `shimmer`: skeleton loader gradient animation (1.5s loop)  
- Score progress bar: width transition on mount (600ms ease-out)  

---

## 9. SPECIAL DESIGN CONSIDERATIONS

### Bento Layout (Explore, Admin, Analytics)
Use CSS Grid with varying cell sizes:  
- Large cells (2×2): map view, main analytics chart, primary stats  
- Medium cells (2×1): secondary charts, user lists  
- Small cells (1×1): KPI numbers, quick actions  
- All cells: rounded 16px, consistent padding, subtle border  

### "Along Suggestion" Posts
Differentiate from user posts:  
- Thin left border in `#00A862` (4px)  
- Subtle green-tinted background (`rgba(0,168,98,0.04)`)  
- Small label chip at top: "Along Suggestion" with Sparkles Lucide icon  
- All other PostCard elements identical  

### Trust Badge States
Make the trust level immediately scannable in feed:  
- **Low:** Red AlertTriangle chip — subtle, doesn't dominate  
- **Developing:** Orange Clock chip  
- **Verified:** Green CheckCircle chip — positive, inviting  
- **Trusted:** Blue ShieldCheck chip — prestigious, slightly larger  

### DiceBear Avatar Display
- Always circular clip  
- Loading: skeleton circle placeholder  
- Error/fallback: initials circle in brand green  
- Profile page: 80px avatar with verify tick if user.verified  
- Comment/notification: 32px  
- Feed post: 40px  

### Vehicle Type Chips (in PostCard route steps)
Row of small icon + label chips per step:  
- Background from VEHICLE_REGISTRY.color  
- Text from VEHICLE_REGISTRY.textColor  
- Icon from VEHICLE_REGISTRY.icon (Lucide, 14px)  
- Pill shape, 4px radius  

---

## 10. PAGE-LEVEL COMPONENT INVENTORY

| Page | Key Components |
|---|---|
| Landing | HeroSection, FeatureGrid, Footer (with devCredit) |
| Login/Register | AuthCard, ConfigDrivenForm, GoogleOAuthButton, OTPInput |
| Home/Feed | DashboardNavbar, SearchBar, ShareRouteButton, Feed (PostCard list), SuggestionsPanel, TegaEventsWidget, TrendingTags |
| Explore | ExploreMap (MapLibre), RouteSearchBar, FilterChips, PostListPanel, PostMapMarker |
| Post Detail | PostHeader, RouteMap, RouteStepList, ImageGallery, EngagementBar, CommentSection, TransactCTA |
| Profile | ProfileHeader, RewardTierBadge, ProfileTabs, PostGrid, FollowButton, AvatarEditor (modal) |
| ShareRouteModal | RouteBuilder, RouteStepInput (Google Places), RouteMap (editable), ImageUploader, TagInput, DraftingCoach |
| Notifications | NotificationList, NotificationItem (per type) |
| Analytics | KPIGrid, EngagementChart, TagDistribution, InviteLeaderboard |
| Admin Dashboard | AdminStatsBento, UsersTable, PostModerationQueue, SiteConfigEditor, BugReportList, TeamEditor, ReviewManager |
| About | TeamGrid, ReviewsCarousel, FeatureHighlights, Footer |
| Bug Report | BugReportForm (category select, description, optional image) |
| Avatar Editor | StylePicker, OptionControls, AvatarPreview |
| Invite | InviteCard (user's unique link + QR), InviteStats, InviteLeaderboard |

---

## 11. FOOTER COMPONENT

Config-driven. Always shows:  
- Along logo + tagline  
- Link columns (Product · Company · Legal)  
- Social icon links  
- Copyright line  
- **Dev credit:** Small line — `"Built by S.D"` with hyperlink to `https://sotonye-dagogo.is-a.dev`  
- Dev credit should be subtle: `text-xs text-muted` — present but not competing with brand  

---

*End of Along — Google Stitch Design Brief v2.0*  
*Designed for feed into Google Stitch, Galileo, v0, or any AI design generation tool.*  
*All colors, typography, spacing, and component specs are production-ready.*
