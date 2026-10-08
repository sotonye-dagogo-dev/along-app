# Design System

> **Metadata**
> - last-updated-by: execute-feature 2026-10-08
> - last-verified-against-code: 2026-10-08 (globals.css @theme, app/components/ui/ 42 files, DashboardNav MOBILE_TABS, zero antd imports in app/)
> - staleness-policy: re-verify if UI components or styling dependencies change

> **Overview:** Along uses Tailwind CSS 4 (CSS-first `@theme` tokens in `app/globals.css`) plus a universal library of App* components (`app/components/ui/`, 42 files) built on Tailwind + Lucide React. `antd@^5.23.3` remains a declared dependency in `package.json` but is NOT imported anywhere in `app/` (verified 2026-10-08: zero `antd` / `@ant-design` imports) — App* wrappers do not wrap Ant Design in the current code. Color tokens are defined as CSS custom properties supporting light and dark modes via a `class`-based dark mode toggle (`ThemeProvider` toggles `dark` on document root). Zero emoji policy — all icons use Lucide React exclusively (72 `lucide-react` imports across `app/`).

---

## Visual Language

### Colour Palette

Verified against `app/globals.css` `@theme` 2026-10-08. Full token set (semantic success/warning/error/info, trust-level, radius, shadow scales) lives in `globals.css`; table below is the brand core.

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-primary` | #00623B | #00A862 (`--color-primary-dark-mode`) | Buttons, links, CTAs |
| `--color-primary-light` | #00A862 | #00C876 (`--color-primary-light-dark`) | Background highlights |
| `--color-primary-dark` | #004A2C | #007A48 (`--color-primary-dark-dark`) | Hover states |
| `--color-primary-muted` | #E6F4EE | rgba(0,168,98,0.12) (`--color-primary-muted-dark`) | Muted brand backgrounds |
| `--color-success` | #D1FAE5 (bg) / #065F46 (text) | same scale | Confirmations, verified routes |
| `--color-warning` | #FEF3C7 (bg) / #92400E (text) | same scale | Warnings, pending verifications |
| `--color-error` | #FEE2E2 (bg) / #7F1D1D (text) | same scale | Errors, destructive actions |
| `--color-bg-base` | #FFFFFF | #0F0F0F (`--color-bg-base-dark`) | Page background |
| `--color-text-primary` | #1A1A1A | #F0F0F0 (`--color-text-primary-dark`) | Body text |
| `--color-border` | #E5E7EB | #2A2A2A (`--color-border-dark`) | Dividers, borders |
| `--color-text-secondary` | #6B7280 | #9CA3AF | Labels, captions, secondary text |
| `--color-bg-elevated` | #F7F7F7 | #1A1A1A (`--color-bg-elevated-dark`) | Elevated surfaces |
| `--color-bg-card` | #FFFFFF | #1F1F1F (`--color-bg-card-dark`) | Card backgrounds |

### Typography

| Style | Font | Size | Weight |
|-------|------|------|--------|
| Heading 1 | Inter / system-ui | 2rem (32px) | 700 |
| Heading 2 | Inter / system-ui | 1.5rem (24px) | 600 |
| Heading 3 | Inter / system-ui | 1.25rem (20px) | 600 |
| Body | Inter / system-ui | 1rem (16px) | 400 |
| Small / Caption | Inter / system-ui | 0.875rem (14px) | 400 |
| Tiny | Inter / system-ui | 0.75rem (12px) | 400 |
| Code | JetBrains Mono / monospace | 0.875rem (14px) | 400 |

### Spacing Scale

Base unit 4px: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

---

## Component Patterns

### Buttons
- **Primary**: Solid `--color-primary` (#00623B) background, white text, pill/rounded radius (`rounded-circle` / 8px per variant)
- **Secondary**: Outlined with `--color-primary` border, primary text color
- **Destructive**: Solid `--color-error-text` background, white text
- **Ghost**: No background/border, used in navigation contexts
- **Disabled state**: Opacity 0.4, pointer-events none
- App* wrapper: `AppButton` — pure Tailwind + `lucide-react` Loader2 spinner (no Ant Design import in code; verified 2026-10-08)

### Forms
- **Input fields**: Bordered, rounded (8px via `--radius-md`), clear focus ring using `--color-primary`
- **Validation**: Inline error messages below the field in `--color-error-text` with red border
- **Submit buttons**: Show loading spinner during async operations
- App* wrappers: `AppInput`, `AppTextarea`, `AppSelect`, `ConfigDrivenForm` — Tailwind-based (no Ant Design Form import in code)

### Navigation
- **Mobile**: Bottom tab bar (`DashboardNav` MOBILE_TABS, verified 2026-10-08) — Home, Explore, Share-Route FAB (center), Bookmarks, Profile
- **Desktop**: Collapsible sidebar (`w-60` / `w-16`) with main nav items via `filterNavItems(role, "main")` + top nav actions
- **Admin**: Left sidebar with collapsible menu
- No Ant Design Menu in code — nav is Tailwind + `lucide-react` icons + `next/link`

### Cards / Containers
- Border-radius: `--radius-lg` (12px) for cards; scale `--radius-xs` (4px) through `--radius-2xl` (24px), `--radius-pill`, `--radius-circle` (verified in `globals.css` 2026-10-08)
- Shadow: `--shadow-sm` (0 2px 8px rgba(0,0,0,0.08)) for cards
- Hover shadow: `--shadow-md` (0 4px 16px rgba(0,0,0,0.10))
- Glass morphism variant available for overlay cards

### Modals / Dialogs
- `AppModal` — Tailwind-based modal wrapper (no Ant Design Modal import in code; verified 2026-10-08)
- Global confirm modal via `GlobalConfirmModal` context provider
- Confirmation required for destructive actions
- Centered, backdrop blur

---

## UX Principles

1. **Always show loading state** — every async action must display a spinner or skeleton
2. **Destructive actions require confirmation** — delete, ban, remove all require a confirm dialog
3. **Error messages explain the fix** — not just "Something went wrong", but "Email already registered" or "Password must be at least 8 characters"
4. **Mobile-first** — all layouts must work at 320px minimum width
5. **Offline gracefulness** — cached data shown when offline, with clear indicator of stale state
6. **Optimistic updates** — UI responds instantly, rolls back on failure
7. **Empty states are designed** — every list/view has a meaningful empty state illustration and CTA
8. **Zero emoji** — all icons use Lucide React; no emoji in UI text

---

## Responsive Breakpoints

| Breakpoint | Value | Target |
|------------|-------|--------|
| xs | < 640px | Small mobile |
| sm | 640px | Mobile |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Wide screens |
| 2xl | 1536px | Large desktop |

---

## Accessibility Requirements

- All interactive elements must have visible keyboard focus states (focus ring)
- Colour contrast must meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Images must have descriptive alt text
- Forms must have associated `<label>` elements
- Interactive elements must be navigable by keyboard (Tab order)
- ARIA labels on icon-only buttons
- Reduced motion media query support for animations

---

## Reference Library

External design languages — competitor, inspiration, or reference sites — pulled into `design-references/<name>/DESIGN.md` (Tier 4, read when explicitly relevant). The `generate-design-md` command creates them.

These are **inputs to be reconciled**, never the project's source of truth. The token tables in this file remain the single source of truth per engineering principles §5. Promotion from a reference into the project's real tokens is a human decision, not an agent write.

See `design-references/README.md` for the folder contract.

---

## Design Asset Viewer (dev-only entry point)

A human-facing route to browse design assets — HTML mocks, images, PDFs — without those assets touching the app's real route table when deployed. This is a dev tool, not an agent workflow, and it is itself governed by the engineering principles like any other page.

**Hard rules (not conventions):**
- Mounted at a distinct, configurable base path (e.g. `/__design/*`) on its own router/middleware branch — never nested under app routes.
- **Gated:** only mountable when the env flag is set (e.g. `ENABLE_DESIGN_VIEWER=true`), defaulting off. **Never enabled in a production build regardless of the flag** — this is a hard rule, not a convention.
- Reads a config manifest (engineering principles §1) listing which local folders/paths it is allowed to serve — never an open filesystem browser.
- No hardcoded asset lists in code.

**Rendering by type:**
- HTML → sandboxed iframe
- Images → `<img>`
- PDF → render pages; where text/structure extraction is needed, use the classify-then-extract approach from the `pdf-html-asset-inspection` skill (detect text vs scanned, extract with position awareness, convert to Markdown) via a small internal utility or thin wrapper.

**Extraction backend decision:** chooses between the two registered extraction candidates (see `tools/registry.md` → PDF-extraction-tooling rows; approach documented in `tools/integrations/`) based on the project stack; the choice is documented in `memory/project-decisions.md`.

**Where it lives:** see also the `system-architecture.md` configuration points (the `ENABLE_DESIGN_VIEWER` flag) and the viewer's security isolation note for the deployment platform.
