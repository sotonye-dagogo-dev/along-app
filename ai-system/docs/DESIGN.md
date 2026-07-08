# Along — Design System
> Version 1.0 · The authoritative visual and interaction specification for all Along UI.
> Every screen, component, and interaction derives from this document.
> "Navigate Together."

---

## 1. BRAND IDENTITY

### 1.1 Positioning
Along is a **social travel-intelligence platform** — the intersection of Twitter's social feed and Google Maps' geographic intelligence. It is where urban commuters in Nigeria and West Africa share, validate, and discover real-world transport routes. The product personality is: **trustworthy, energetic, community-driven, and approachable.** Not corporate. Not cold. Warm but precise.

### 1.2 Logo Usage
- Primary logo: wordmark "Along" + a route-pin icon (two overlapping map-pin shapes forming a path)
- Icon-only variant: the pin pair alone, used for favicon, app icon, and avatar placeholder
- Never distort, recolor (outside brand palette), or add effects to the logo
- Minimum clear space: the height of the letter "A" on all sides
- On dark backgrounds: use white wordmark + white icon
- On light backgrounds: use `#00623B` wordmark + icon
- Never place logo on a busy photographic background without a semi-transparent scrim

### 1.3 Tagline
**"Navigate Together."** — used in hero contexts, onboarding, and empty states. Not a legal footer item.

---

## 2. COLOR SYSTEM

All colors are defined as CSS custom properties in `globals.css` inside a Tailwind v4 `@theme {}` block. **Never use raw hex values in component files.** Reference tokens exclusively.

### 2.1 Core Palette

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--color-primary` | `#00623B` | `#00A862` | Brand primary — CTAs, active states, key accents |
| `--color-primary-light` | `#00A862` | `#00C876` | Hover states, progress fills, soft accents |
| `--color-primary-dark` | `#004A2C` | `#007A48` | Pressed states, deep accents |
| `--color-primary-muted` | `#E6F4EE` | `rgba(0,168,98,0.12)` | Tinted backgrounds, suggestion cards |
| `--color-bg-base` | `#FFFFFF` | `#0F0F0F` | Page background |
| `--color-bg-elevated` | `#F7F7F7` | `#1A1A1A` | Cards, sidebars, inputs |
| `--color-bg-card` | `#FFFFFF` | `#1F1F1F` | Card surfaces |
| `--color-bg-overlay` | `rgba(0,0,0,0.48)` | `rgba(0,0,0,0.72)` | Modal/drawer scrim |
| `--color-text-primary` | `#1A1A1A` | `#F0F0F0` | Headings, body text |
| `--color-text-secondary` | `#6B7280` | `#9CA3AF` | Captions, metadata, placeholders |
| `--color-text-muted` | `#9CA3AF` | `#6B7280` | Disabled, de-emphasized |
| `--color-text-inverse` | `#FFFFFF` | `#0F0F0F` | Text on primary-colored backgrounds |
| `--color-border` | `#E5E7EB` | `#2A2A2A` | Default borders, dividers |
| `--color-border-strong` | `#D1D5DB` | `#3A3A3A` | Focused borders, table lines |

### 2.2 Semantic Colors

| Token | Light Value | Dark Value | Usage |
|---|---|---|---|
| `--color-success` | `#D1FAE5` | `rgba(16,185,129,0.15)` | Success backgrounds |
| `--color-success-text` | `#065F46` | `#34D399` | Success text |
| `--color-success-border` | `#6EE7B7` | `#059669` | Success borders |
| `--color-warning` | `#FEF3C7` | `rgba(245,158,11,0.15)` | Warning backgrounds |
| `--color-warning-text` | `#92400E` | `#FCD34D` | Warning text |
| `--color-warning-border` | `#FCD34D` | `#D97706` | Warning borders |
| `--color-error` | `#FEE2E2` | `rgba(239,68,68,0.15)` | Error backgrounds |
| `--color-error-text` | `#7F1D1D` | `#FCA5A5` | Error text |
| `--color-error-border` | `#FCA5A5` | `#DC2626` | Error borders |
| `--color-info` | `#DBEAFE` | `rgba(59,130,246,0.15)` | Info backgrounds |
| `--color-info-text` | `#1E3A8A` | `#93C5FD` | Info text |
| `--color-info-border` | `#93C5FD` | `#2563EB` | Info borders |

### 2.3 Trust Level Colors (Validity System)

| Level | Score | Background | Text | Border | Icon |
|---|---|---|---|---|---|
| Low Trust | 0–29 | `#FEE2E2` | `#7F1D1D` | `#FCA5A5` | `AlertTriangle` |
| Developing | 30–59 | `#FEF3C7` | `#92400E` | `#FCD34D` | `Clock` |
| Verified | 60–79 | `#D1FAE5` | `#065F46` | `#6EE7B7` | `CheckCircle` |
| Trusted | 80–100 | `#DBEAFE` | `#1E3A8A` | `#93C5FD` | `ShieldCheck` |

### 2.4 Vehicle Type Colors

| Vehicle | Background | Text |
|---|---|---|
| Taxi | `bg-yellow-50` | `text-yellow-800` |
| Bike | `bg-orange-50` | `text-orange-800` |
| Keke | `bg-green-50` | `text-green-800` |
| Bus | `bg-blue-50` | `text-blue-800` |
| Trekking | `bg-gray-50` | `text-gray-700` |
| Car | `bg-indigo-50` | `text-indigo-800` |
| Bolt Ride | `bg-lime-50` | `text-lime-800` |

### 2.5 Glass Morphism

Used on: map overlay cards, notification dropdowns, hero sections over map backgrounds, floating action panels.

```css
/* Light mode glass */
.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.48);
}

/* Dark mode glass */
.dark .glass {
  background: rgba(15, 15, 15, 0.72);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Intensity variants */
.glass-low    { --glass-opacity: 0.48; }
.glass-medium { --glass-opacity: 0.72; }   /* default */
.glass-high   { --glass-opacity: 0.88; }
```

---

## 3. TYPOGRAPHY

**Font:** Inter (primary), system-ui fallback. Load via `next/font/google`.

### 3.1 Type Scale

| Role | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `display-xl` | 48px / 3rem | 800 | 1.1 | -0.02em | Hero headlines |
| `display-lg` | 36px / 2.25rem | 700 | 1.15 | -0.02em | Page titles |
| `display-md` | 28px / 1.75rem | 700 | 1.2 | -0.01em | Section headings |
| `title-lg` | 22px / 1.375rem | 600 | 1.3 | -0.01em | Card titles, modal headings |
| `title-md` | 18px / 1.125rem | 600 | 1.4 | 0 | Post titles, sidebar headings |
| `title-sm` | 16px / 1rem | 600 | 1.4 | 0 | Small card titles |
| `body-lg` | 16px / 1rem | 400 | 1.6 | 0 | Primary body text |
| `body-md` | 14px / 0.875rem | 400 | 1.6 | 0 | Secondary body, descriptions |
| `body-sm` | 13px / 0.8125rem | 400 | 1.5 | 0 | Captions, metadata |
| `label-lg` | 14px / 0.875rem | 500 | 1.4 | 0.01em | Form labels, tags |
| `label-sm` | 12px / 0.75rem | 500 | 1.4 | 0.02em | Small badges, timestamps |
| `code` | 13px / 0.8125rem | 400 | 1.6 | 0 | Monospace (Courier New) |

### 3.2 Typography Rules
- Post titles: `title-md` (18px/600)
- User display name: `body-md` (14px) bold or `label-lg`
- @username handle: `body-sm` (13px) `text-secondary`
- Route step text: `body-md`
- Fare amounts: `label-lg` bold
- Timestamps: `label-sm` `text-muted`
- Trust score number: `label-sm` bold
- Nav labels: `label-lg`

---

## 4. SPACING & LAYOUT

### 4.1 Spacing Scale
Base unit: 4px. All spacing values are multiples.

```
4px  (1) — micro gaps, icon padding
8px  (2) — compact padding, small gaps
12px (3) — input padding, tight card padding
16px (4) — standard padding, section gaps
20px (5) — card padding
24px (6) — section padding, larger gaps
32px (8) — page section spacing
48px (12) — major section breaks
64px (16) — hero spacing
```

### 4.2 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-xs` | `4px` | Chips in dense UI |
| `--radius-sm` | `6px` | Inputs, small buttons |
| `--radius-md` | `8px` | Buttons, tags |
| `--radius-lg` | `12px` | Cards, dropdowns |
| `--radius-xl` | `16px` | Modals, panels |
| `--radius-2xl` | `24px` | Bottom sheets, large panels |
| `--radius-pill` | `999px` | Badge chips, toggle pills |
| `--radius-circle` | `50%` | Avatars, FAB |

### 4.3 Elevation / Shadows

```css
--shadow-xs:  0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm:  0 2px 8px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
--shadow-md:  0 4px 16px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
--shadow-lg:  0 8px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);
--shadow-xl:  0 16px 48px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.08);
--shadow-primary: 0 8px 32px rgba(0,98,59,0.20), 0 2px 8px rgba(0,98,59,0.12);
```

### 4.4 Responsive Breakpoints

| Name | Min Width | Layout |
|---|---|---|
| `sm` | 640px | Larger mobile / small tablet |
| `md` | 768px | Tablet — 2 column |
| `lg` | 1024px | Desktop — 3 column |
| `xl` | 1280px | Wide desktop — content max-widths enforced |
| `2xl` | 1536px | Ultra-wide — same as xl, just more whitespace |

### 4.5 Layout Grid

**Feed (dashboard):**
- Mobile: single column, 100% width
- Tablet (md+): 2-col — feed (fluid) + sidebar (280px)
- Desktop (lg+): 3-col — sidebar-nav (240px fixed) + feed (max 640px centered) + right panel (280px)

**Explore (map):**
- Mobile: full-viewport map + bottom sheet (draggable, 40vh collapsed, 80vh expanded)
- Desktop: full-viewport map + left side panel (320px, slide-in overlay)

**Admin:**
- Desktop only: sidebar nav (240px) + main content area (fluid, max 1100px)
- Mobile: accessible but not optimized (admin is desktop-primary)

**Public pages (landing, about, etc.):**
- Centered content, max-width 1200px, gutter 24px (mobile 16px)

---

## 5. ICONOGRAPHY

**System:** Lucide React — exclusively. Zero emojis in the UI. Zero other icon libraries.

**Sizes:**
- Navigation icons: 20px
- Inline action icons: 16px
- Feature icons (card, section): 24px
- Large decorative icons: 32–48px
- FAB icon: 24px

**Usage rules:**
- Every icon-only button must have an `aria-label`
- Icons in buttons sit 8px from the text label
- Never resize icons with CSS `transform:scale()` — always use the `size` prop
- In the nav: unfilled icon = default; filled/colored = active state

### 5.1 Icon Map

| Context | Icon(s) |
|---|---|
| Home / Feed | `Home`, `HomeIcon` (filled active) |
| Explore / Map | `Compass`, `Map` |
| Share Route / Create | `MapPin`, `Plus`, `PlusCircle` |
| Bookmarks | `Bookmark`, `BookmarkCheck` (filled) |
| Notifications | `Bell`, `BellRing` (active) |
| Profile | `User`, `UserCircle` |
| Analytics | `BarChart2`, `TrendingUp` |
| Invite | `UserPlus`, `Share2` |
| Settings | `Settings` |
| Admin | `Shield`, `ShieldCheck` |
| Search | `Search`, `SearchX` (no results) |
| Like | `Heart`, `HeartIcon` (filled active) |
| Dislike | `ThumbsDown` |
| Comment | `MessageCircle` |
| Bookmark (action) | `Bookmark` |
| Share | `Share2`, `Link2` |
| More options | `MoreHorizontal` |
| Delete | `Trash2` |
| Edit | `Pencil`, `Edit2` |
| Close / Dismiss | `X` |
| Back | `ArrowLeft` |
| External link | `ExternalLink` |
| Verified | `BadgeCheck`, `ShieldCheck` |
| Trust Low | `AlertTriangle` |
| Trust Developing | `Clock` |
| Trust Verified | `CheckCircle` |
| Trust Trusted | `ShieldCheck` |
| Route / Direction | `Navigation`, `Route`, `ArrowRight` |
| Location pin | `MapPin`, `LocateFixed` |
| Fare / Money | `Coins`, `Banknote`, `DollarSign` |
| Distance | `Ruler` |
| Time | `Clock`, `Timer` |
| Vehicle: Taxi | `Car` |
| Vehicle: Bike | `Bike` |
| Vehicle: Keke | `Tractor` |
| Vehicle: Bus | `Bus` |
| Vehicle: Trekking | `PersonStanding` |
| Vehicle: Car | `Car` |
| Vehicle: Bolt | `Truck` |
| Drag handle | `GripVertical` |
| Upload | `Upload`, `ImagePlus` |
| Camera | `Camera` |
| Copy | `Copy`, `CopyCheck` |
| Download | `Download` |
| Filter | `Filter`, `SlidersHorizontal` |
| Sort | `ArrowUpDown` |
| Refresh | `RefreshCw` |
| Loader | `Loader2` (with spin class) |
| Back to top | `ArrowUp` |
| Expand | `ChevronDown`, `ChevronsDown` |
| Collapse | `ChevronUp` |
| Warning | `AlertTriangle` |
| Error | `XCircle` |
| Info | `Info` |
| Success | `CheckCircle` |
| Rewards | `Star`, `Award`, `Trophy` |
| Invite | `UserPlus`, `Gift` |
| QR Code | `QrCode` |
| Sparkle / AI | `Sparkles` |
| Offline | `WifiOff` |
| Online | `Wifi` |
| Cookie | `Cookie` |
| Report / Flag | `Flag` |
| Block | `Ban` |

---

## 6. COMPONENT SPECIFICATIONS

### 6.1 AppButton

**Variants:**

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| `primary` | `var(--color-primary)` | white | none | `var(--color-primary-light)`, shadow-primary |
| `secondary` | transparent | `var(--color-primary)` | `1.5px var(--color-primary)` | `var(--color-primary-muted)` bg |
| `ghost` | transparent | `var(--color-text-secondary)` | none | `var(--color-bg-elevated)` bg |
| `destructive` | `var(--color-error-text)` | white | none | darken 8% |
| `icon` | transparent | `var(--color-text-secondary)` | none | `var(--color-bg-elevated)` bg, circular |

**Sizes:**

| Size | Height | Padding | Font size |
|---|---|---|---|
| `sm` | 32px | 0 12px | 13px |
| `default` | 40px | 0 16px | 14px |
| `lg` | 48px | 0 24px | 16px |

- Border radius: `--radius-md` (8px) for all except `icon` which is `--radius-circle`
- Loading state: `Loader2` icon with `animate-spin`, text hidden but width preserved
- Disabled: `opacity-50 cursor-not-allowed`
- Full-width: `w-full`
- Icon buttons: 40px × 40px square with `--radius-md`, or circular with `--radius-circle`

### 6.2 AppCard

| Variant | Style |
|---|---|
| `default` | white bg, `--shadow-sm`, `--radius-lg`, `1px solid var(--color-border)` |
| `elevated` | white bg, `--shadow-md`, `--radius-lg`, no border |
| `glass` | glass morphism styles, `--radius-xl` |
| `flat` | `var(--color-bg-elevated)` bg, no shadow, `1px solid var(--color-border)`, `--radius-lg` |
| `suggestion` | default + `border-l-4 border-primary` + `bg-primary-muted` tint |

Hover lift (when `hover=true`): `translateY(-2px)` + `--shadow-md` transition 200ms ease.

### 6.3 AppInput / AppTextarea / AppSelect

- Height: 40px (input), auto (textarea, min-height 80px)
- Border: `1.5px solid var(--color-border)`
- Border radius: `--radius-sm` (6px)
- Padding: `10px 12px`
- Focus: `border-color: var(--color-primary)`, `box-shadow: 0 0 0 3px rgba(0,98,59,0.12)`
- Error: `border-color: var(--color-error-border)`, error message below in `--color-error-text`
- Placeholder: `var(--color-text-muted)`
- Prefix/suffix icons: 16px Lucide, `var(--color-text-muted)` color, 8px gap from text
- Label: above input, 14px/500, `var(--color-text-primary)`, 4px gap, required asterisk in `--color-error-text`

### 6.4 AppTable

- Header: `var(--color-bg-elevated)` bg, 13px/500 `var(--color-text-secondary)`, uppercase tracking
- Row height: 56px
- Row hover: `var(--color-bg-elevated)` bg
- Striped rows: every even row gets `opacity: 0.5` tint
- Cell padding: `12px 16px`
- Clickable rows: `cursor-pointer` + hover tint, `e.stopPropagation()` on action cells
- Sticky header on scroll when `stickyHeader=true`
- Empty state: centered `AppEmptyState` occupies full table height (240px min)

### 6.5 AppModal

| Size | Max width |
|---|---|
| `sm` | 400px |
| `default` | 520px |
| `lg` | 680px |
| `xl` | 800px |
| `fullscreen` | 100vw × 100vh (mobile sheets) |

- Overlay: `var(--color-bg-overlay)`
- Border radius: `--radius-xl` (16px)
- Header: title (18px/600) + optional subtitle (14px secondary) + close `X` button (top-right)
- Padding: 24px
- Footer: separated by `1px solid var(--color-border)`, padding 16px 24px, action buttons right-aligned
- Destructive footer: cancel (ghost) left, confirm (destructive) right
- Slide-up animation on mobile (bottom sheet), fade+scale on desktop

### 6.6 AppEmptyState

- Centered flex column, min-height 240px
- Icon: 48px, `var(--color-text-muted)`, `--radius-xl` bg chip in `var(--color-bg-elevated)`
- Title: `title-sm` (16px/600), `var(--color-text-primary)`, 12px gap below icon
- Description: `body-sm`, `var(--color-text-secondary)`, 8px gap below title
- Action button: 24px below description, `AppButton` (variant from config)

### 6.7 AppTag / AppBadge

- Pill shape: `--radius-pill` (999px)
- Padding: `2px 8px` (xs), `4px 10px` (sm), `4px 12px` (default)
- Font: `label-sm` (12px/500)
- Icon: 12px, 4px gap from text
- Removable: `X` icon (12px) after text, 4px gap, hover highlight

### 6.8 AppAvatar

- Always circular (`--radius-circle`)
- Source priority: 1) DiceBear URL from `user.avatarConfig`, 2) `getFallbackAvatarUrl(user.firstName)`
- Verified badge: `BadgeCheck` icon (14px, `--color-primary`) at `bottom: -1px, right: -1px`
- Sizes: 24/32/40/56/80/120px
- Loading: skeleton pulse circle
- Alt text: `"${user.firstName}'s avatar"`
- When `linkToProfile=true`: wraps in `<Link href="/profile/[userName]">` with `e.stopPropagation()`

### 6.9 PostCard

Full specification:

```
┌─────────────────────────────────────────────────────┐
│ [Avatar 40px] [Name Bold] @handle · [timestamp]  [•••]│ ← AppUserLabel + AppDropdown
│               [Vehicle chips row]                      │ ← AppTag per vehicle
├─────────────────────────────────────────────────────┤
│ Post Title (18px / 600)                               │
│                                                       │
│ ● Stop 1 — Route step text               [₦200]      │ ← numbered connector list
│   └── [🚌] Bus · [🛺] Keke chips                     │   (Lucide icons, not emoji)
│ ● Stop 2 — Next step text                [₦150]      │
│   └── [🚗] Taxi chips                                │
│                                                       │
│ [Image grid — 1, 2, or 3-up, rounded 8px]            │
│                                                       │
│ [Mini map preview — 100px, MapLibre, SSR disabled]    │ ← only if pins exist
├─────────────────────────────────────────────────────┤
│ [♥ 42] [👎 3] [💬 12] [🔖] [Share]  [TrustBadge]    │ ← all Lucide icons
└─────────────────────────────────────────────────────┘
```

- Card variant: `default` with hover lift
- Route step connector: left border line `2px var(--color-border)` connecting numbered circles
- Step number circles: 20px, `var(--color-primary)` bg, white text, `--radius-circle`
- Fare chip: `AppTag` variant `muted`, `Coins` icon prefix, 13px
- Image grid: `1` = full-width, `2` = side-by-side 50%, `3` = left 50% + right 2-row 50%
- Action bar: `text-secondary` default, hover transitions to semantic color (heart→error, bookmark→primary)
- "Along Suggestion" card: `suggestion` card variant + `Sparkles` icon chip at top (primary color)

### 6.10 TrustBadge

Compact pill: `[Icon 12px] [Level label] [Score]`
- Tooltip on hover: breakdown panel with 4 `AppProgress` bars (community, detail, corroboration, recency)
- Score number: 13px/600
- Icon and colors per Trust Level Colors table (§2.3)

### 6.11 DraftingCoach

Collapsible panel inside ShareRouteModal:
- Header: `[BarChart2 icon] Route Quality Score` + collapse chevron
- Score bar: `AppProgress` gradient (red 0 → orange 40 → green 80 → blue 90), shows predicted score
- Top nudge: `AppAlert` (info style) with next most impactful checkpoint
- Completed chips: row of small `AppTag` (success variant) with `CheckCircle` + checkpoint label

### 6.12 RouteMap

- MapLibre GL, always `dynamic(() => ..., { ssr: false })`
- Height: 180px (PostCard), 280px (PostDetail), 100vh (Explore)
- Border radius: `--radius-md` (clipped)
- Origin marker: green `#00623B` filled pin
- Waypoint markers: white pin with green border
- Destination marker: dark green `#004A2C` filled pin
- Numbered badges on markers: white circle, primary text, 20px
- Polyline: `#00623B`, 3px stroke, `0.8` opacity
- Suggestion polyline: dashed `#00A862`
- Glass overlay card (PostDetail and Explore): distance + estimated time + avg fare
- Loading state: `MapSkeleton` shimmer

### 6.13 Navigation

**Desktop sidebar (240px):**
- Along logo + wordmark top (24px padding)
- Nav items from `NAV_REGISTRY` (role-filtered): icon (20px) + label, 44px height, `--radius-md`
- Active: `var(--color-primary-muted)` bg, `var(--color-primary)` text/icon
- Hover: `var(--color-bg-elevated)` bg
- Admin section: thin divider + "Admin" label (12px/500 muted) + admin nav items
- Bottom: user mini-card (AppAvatar 32px + name + role badge)

**Mobile bottom tab bar:**
- 5 items: Home, Explore, [FAB], Bookmarks, Profile
- FAB: center, 56px circle, `var(--color-primary)` bg, white `MapPin` icon, `--shadow-primary`
- Active tab: `var(--color-primary)` icon + label
- Tab bar background: `var(--color-bg-card)` + top border `var(--color-border)` + glass blur

**Mobile top bar:**
- Along logo (left) + Bell notifications (right) + optional search
- Height 56px, `var(--color-bg-card)` bg, bottom border `var(--color-border)`

### 6.14 AppFooter

Config-driven from `FOOTER_CONFIG`:
- Three link columns on desktop, stacked on mobile
- Social icons: Lucide equivalents, 20px, `var(--color-text-muted)` → `var(--color-text-primary)` hover
- Copyright: `label-sm` muted
- Dev credit: `"Built by S.D"` → `<a href="https://sotonye-dagogo.is-a.dev">` in `label-sm opacity-60`

### 6.15 GlobalConfirmModal

- `AppModal` size `sm` (400px)
- Icon: `AlertTriangle` (destructive, 32px, error color) or `HelpCircle` (sensitive, 32px, warning)
- Icon on colored rounded-square bg (`48px, --radius-xl`)
- Title: `title-lg` centered
- Description: `body-md` `text-secondary` centered
- Footer: Cancel (ghost) left, Confirm right (destructive=red, sensitive=primary)
- Keyboard: Enter=confirm, Escape=cancel

### 6.16 CookieConsent Banner

- Fixed bottom, full width, `z-50`
- `AppCard` variant `flat` with `--shadow-lg` top
- Text: "Along uses necessary cookies to keep you signed in and improve your experience. By continuing to use Along, you accept this." + inline link "Privacy Policy"
- Single "Got it" button (`AppButton primary sm`)
- Slides up from bottom on first render (200ms ease-out)

---

## 7. PAGE-LEVEL DESIGN SPECIFICATIONS

### 7.1 Landing Page `/`

Hero (full viewport height):
- Dark green gradient background: `linear-gradient(135deg, #004A2C 0%, #00623B 50%, #00A862 100%)`
- Along logo (white) centered, large
- Tagline: "Navigate Together." — `display-md` white
- Subheadline: "Share routes. Discover better ways. Together." — `body-lg` `rgba(255,255,255,0.80)`
- CTA row: "Get Started" (primary, white bg, green text — inverted) + "Sign In" (ghost, white text/border)
- Background decorative element: subtle map grid or route-line SVG pattern at low opacity

Below fold:
- 3-column feature grid (AppCard flat): Route Sharing (`Route` icon), Trust Scores (`ShieldCheck`), Community (`Users`)
- Each card: 48px icon on `--color-primary-muted` bg, title, 2-line description

### 7.2 Auth Pages `/login`, `/register`, `/otp`

Split layout (≥ md):
- Left 45%: `linear-gradient(160deg, #00623B, #004A2C)` brand panel — logo + tagline + decorative route illustration
- Right 55%: white card, centered form, max-width 420px

Mobile: full screen, logo top, form below

Form card: `AppCard elevated`, 40px padding

Login fields: Email → Password → "Sign in with Google" divider → submit
Register fields: First Name + Last Name (row) → Username → Email → Password → submit
OTP: heading "Verify your email" + 6-box OTP input + resend countdown + submit

Google button: white bg, Google G SVG (official), `border var(--color-border)`, full width

### 7.3 Home / Feed `/home`

3-panel layout (desktop), 1-column (mobile).

Top of feed:
- Compose area: `AppCard flat` with `AppAvatar` (user's) + "Share a route..." placeholder text → opens `ShareRouteModal`
- "New posts available" pill: fixed below top-bar, primary bg, white text, `RefreshCw` icon, slide-down on new content

Feed items:
- PostCard (user posts)
- Every 8th item: Along Suggestion (AppCard suggestion variant)
- Feed end: `AppEmptyState` "You're all caught up" with explore CTA

Right sidebar:
- "Who to follow" card: 3 user rows (`AppUserLabel` + `AppButton secondary sm "Follow"`)
- "Trending tags" card: up to 8 `AppTag` chips
- "Events near you" card: Tega events (if geolocation granted)

### 7.4 Explore `/explore`

Full-viewport MapLibre map.

Top overlay (glass):
- Search bar (full width mobile, 360px desktop) with `Search` icon prefix
- Filter chips row: vehicle types + trust level + region (horizontal scroll on mobile)
- "Near me" `LocateFixed` button (right of search)

Desktop side panel (320px, glass, slides from left):
- Filtered post list with mini PostCards (no map preview nested)
- Sort: Validity score / Recency / Distance
- Collapse toggle

Mobile bottom sheet:
- 40vh default, draggable to 80vh
- Handle indicator (40px wide, 4px tall, rounded, `--color-border`)
- Post list inside

Map:
- Post pins: clustered, primary green, white number
- Click pin → glass popup card (AppCard glass): title + AppUserLabel + TrustBadge + "View Route" button
- "Share this view" button: bottom-right, `AppButton ghost` with `Link2` icon

### 7.5 Post Detail `/posts/[id]`

Centered, max-width 680px.

Header: `AppUserLabel (large)` + timestamp + edit/delete (if own post) + share
Title: `display-md` (28px/700)
TrustBadge: full size, with tooltip
Tags row: `AppTag` chips linking to `/explore?tag=`
Region chip: links to `/explore?region=`

Route section:
- Full `RouteMap` (280px)
- Route steps list (full step text, vehicle chips, fares)
- Summary row: total distance + estimated time + total fare range

Image gallery: masonry or 2-up grid, click to lightbox (AppModal fullscreen)

Engagement bar: like / dislike / comment count / bookmark / share — all full-width on mobile

If Transact listing: `AppCard elevated` "Buy Route Guide" CTA — price chip + Transact logo + "Get Access" `AppButton primary`

Comments section: `CommentInput` (with @mention) + `CommentList`
Related posts: horizontal scroll of 3 mini PostCards

### 7.6 Profile `/profile/[username]`

Twitter-style layout:
- Cover: 180px tall, `linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))` (default) or user-set Cloudinary image
- Avatar: 80px, `border: 3px solid var(--color-bg-base)`, overlapping cover bottom by 40px
- Name: `title-lg` (22px/600), verified badge inline
- Handle: `@username` `body-sm text-secondary`
- Bio: `body-md`, max 160 chars
- Stats row: Posts · Followers · Following · Avg Validity — each as bold number + label

Own profile:
- "Edit Profile" `AppButton secondary`
- Avatar edit button (small camera overlay on avatar)
- Access to AvatarEditor modal

Other's profile:
- "Follow" / "Following→Unfollow on hover" `AppButton`
- Mutual follows count (if any)

Tabs: Posts · Liked · Bookmarks (own only) · Routes
Content: `ConfigDrivenList` of PostCards

RewardsPanel section (own profile): tier badge, points, progress to next tier

### 7.7 ShareRouteModal

`AppModal xl` (800px), scrollable body.

Layout (2-column on desktop, 1-column mobile):
- Left col (flex 1): form inputs
- Right col (320px): live map preview + DraftingCoach

Form sections:
1. Title input (`AppInput`)
2. Route builder: draggable steps (GripVertical handle), each step:
   - Location autocomplete (Google Places, `MapPin` icon prefix)
   - Text description (`AppTextarea`)
   - Vehicle selector: icon-chip row from `VEHICLE_REGISTRY`
   - Fare input with `₦` prefix
   - `+Add step` / `×Remove` controls
3. Image upload: drag-and-drop zone with `ImagePlus` icon + file count chip, 10-image max
4. Tags: tokenized input, `#` prefix suggestion
5. Submit row: "Save Draft" (ghost) + "Share Route" (primary)

DraftingCoach: collapsible panel, always visible initially
RouteMap: live-updating preview as pins are added

### 7.8 Admin Pages `/admin/*`

Shared layout: sidebar nav (240px) + content area.

Dashboard (`/admin`): 4-stat Bento grid (users, posts today, avg validity, open bug reports) + signups line chart + top routes bar chart

Users (`/admin/users`): `AppTable` with sortable columns — avatar, name, email, role badge, trust tier badge, joined date, post count — row links to user detail, action column (role change, ban)

Posts (`/admin/posts`): `AppTable` — title (linked), author, validity score, status badge, created date — filter by validity range + status

Config (`/admin/config`): key-value table with inline edit (textarea for JSON values), save per row

Bug Reports (`/admin/bugs`): table with status dot, category badge, email — row click opens detail drawer

Reviews (`/admin/reviews`): table with rating stars (1-5, rendered as filled/empty Star icons), status, feature toggle

### 7.9 Notifications `/notifications`

Centered max-width 640px. "Mark all as read" button (top right).

Notification item:
- Left: `AppAvatar (40px)` with notification type icon overlay (16px colored circle)
- Center: message text with bold actor name (links to profile), action description, link to target
- Right: timestamp + unread dot
- Type-specific icon colors from `NOTIFICATION_REGISTRY`
- Entire row is a `<Link>` to the relevant post/profile

Tabs: All · Unread · Rewards

### 7.10 About Page `/about`

Hero: green gradient, same style as landing, with "Our Story" heading

Team grid: 3-col desktop, 2-col tablet, 1-col mobile
- `AppCard elevated` per member: photo (80px circle avatar), name, role badge, bio, social icon links

Reviews carousel: glass-morphism quote cards on subtle green-tinted bg
- Rotation every 5s, manual prev/next arrows, dot indicators

Feature highlights: icon + title + description rows

### 7.11 Invite Page `/invite`

Hero card: user's invite link in styled input (read-only + copy button)
QR code: white card, centered
Stats: cards for invites sent / accepted / points earned from invites
Leaderboard: `AppTable` — rank, avatar+name, accepted count, points earned

### 7.12 Analytics `/analytics`

Bento grid, 2-col desktop:
- Large: engagement over time (line chart)
- Large: top posts by validity (horizontal bar chart)
- Medium: follower growth
- Medium: tag distribution (donut)
- Small stat cards: total views, total likes, avg score, total posts

---

## 8. MOTION & ANIMATION

All animations respect `prefers-reduced-motion` — if set, all transitions and animations are disabled.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--duration-fast` | 120ms | `ease-out` | Icon state changes, dot indicators |
| `--duration-base` | 200ms | `ease-in-out` | Button hover, card hover, tag transitions |
| `--duration-moderate` | 300ms | `ease-out` | Modal appear, dropdown, page transitions |
| `--duration-slow` | 400ms | `cubic-bezier(0.34,1.56,0.64,1)` | Bottom sheet, drawer slide, FAB expand |
| `--duration-toast` | 350ms | `cubic-bezier(0.34,1.56,0.64,1)` | Toast enter/exit |

### 8.1 Named Animations

**fadeSlideUp:** `opacity 0→1, translateY 12px→0` — for modals, toast entries, sheet expand

**shimmer:** skeleton loading — `background-position` animate from `-200%` to `200%` on a gradient, 1.5s infinite

**scaleIn:** `scale 0.95→1.0, opacity 0→1` — for dropdowns, tooltips, popovers

**slideDown:** `translateY -8px→0, opacity 0→1` — for "new posts available" banner

**countUp:** number counters animate from 0 to target over 800ms on first viewport entry

**spinSlow:** `rotate 0→360deg`, 2s linear infinite — for Loader2 loading states

---

## 9. DARK MODE

Dark mode via `class="dark"` on `<html>`. Toggle stored in localStorage + system preference respected.

All color tokens already have dark-mode values defined in §2. Additional dark-mode specifics:
- Map tiles: use MapTiler dark style when dark mode is active
- Code blocks: `#1A1A1A` bg, `#E5E7EB` text
- Ant Design theme: override `colorBgContainer`, `colorBgElevated`, `colorPrimary`, `colorText` to match dark tokens
- Glass morphism: uses `.dark .glass` variant (see §2.5)
- Charts: dark background, lighter grid lines, same brand colors for data

---

## 10. ACCESSIBILITY

- Color contrast: minimum 4.5:1 for body text, 3:1 for large text and UI components
- All icon-only interactive elements: `aria-label` required (enforced by `AppButton variant="icon"`)
- All images: `alt` text (avatars use `"${user.firstName}'s avatar"`, post images use post title)
- Form inputs: always have an associated `<label>` or `aria-label`
- Modals: trap focus, return focus to trigger on close, `aria-modal="true"`
- Toast notifications: `role="alert"` + `aria-live="polite"`
- Dynamic content regions: `aria-live="polite"` (feed updates, score updates)
- Keyboard: all interactive elements reachable via Tab, dropdowns close on Escape
- Skip-to-content link: visually hidden, appears on focus, links to `#main-content`

---

## 11. SEO & META

Every page exports Next.js Metadata. Minimum required per page:

```typescript
{
  title: "[Page Title] | Along",
  description: "[Unique 150-char description]",
  openGraph: {
    title, description, url, siteName: "Along",
    images: [{ url: ogImage, width: 1200, height: 630 }]
  },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
}
```

Dynamic pages (`/posts/[id]`, `/profile/[username]`): use `generateMetadata()` to fetch content for OG title, description, image.

Structured data (JSON-LD): `Article` on post pages, `ProfilePage` on profile pages, `WebSite` on root.

---

## 12. FORMS & VALIDATION

- All validation via Zod schemas defined in `lib/schemas/`
- Errors shown inline below the relevant field (not top-of-form banner)
- Error text: `body-sm` `--color-error-text`, `XCircle` icon (12px) prefix
- Success state on submission: replace form with `AppEmptyState` success variant
- Required field indicator: red asterisk after label
- Debounce on async validations (e.g. username availability): 400ms
- Submit button: loading state while submitting, re-enable on error

---

## 13. PLATFORM-SPECIFIC UX CONVENTIONS

These are expected behaviors on social travel platforms. Implement all of them.

- **Subtle contextual links:** User name/avatar in any post, comment, notification, or table → profile page. Post title → post detail. Tag chip → explore filtered. Region chip → explore map. All implemented as Next.js `<Link>` with `e.stopPropagation()` to prevent parent click handler interference.
- **Optimistic interactions:** Likes, bookmarks, follows update UI instantly. Rollback on API error with error toast.
- **"Following" hover state:** Following button shows "Unfollow" + `UserMinus` icon on hover.
- **Double-tap to like:** On touch devices, double-tap a post image to like it.
- **Long-press context menu:** On mobile, long-press PostCard shows quick actions: Like, Share, Bookmark, Copy Link.
- **Pull to refresh:** On mobile feed, pull-down gesture triggers feed refresh.
- **Back to top FAB:** Appears after 500px scroll, `AppButton icon` with `ArrowUp`, bottom-right.
- **New posts banner:** Fixed pill below top nav, primary color, showing count + refresh icon. Click → scroll to top and reload.
- **Share post:** Web Share API on mobile, fallback to clipboard copy with "Link copied!" toast.
- **Mention autocomplete:** `@` in comment textarea → user search dropdown with avatar + name.
- **Tagging links:** `@username` in rendered comments → subtle primary-colored link to profile.
- **Permalink explore view:** `/explore?lat=x&lng=y&zoom=z` restores map position from URL.
