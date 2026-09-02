# Design System

> **Metadata**
> - last-updated-by: update-ai-system
> - last-verified-against-code: 2026-07-08
> - staleness-policy: re-verify if UI components or styling dependencies change

> **Overview:** Along uses a dual design system — Ant Design 5 for complex UI components (tables, modals, forms, navigation) and Tailwind CSS 4 for layout, spacing, and utility styling. A universal component library of App* wrappers (AppButton, AppCard, AppInput, etc.) abstracts raw Ant Design imports, ensuring consistent theming and preventing direct Ant Design usage outside of `app/components/ui/`. Color tokens are defined as CSS custom properties supporting light and dark modes via a `class`-based dark mode toggle. Zero emoji policy — all icons use Lucide React exclusively.

---

## Visual Language

### Colour Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-primary` | #1677ff | #1677ff | Buttons, links, CTAs |
| `--color-primary-light` | #e6f4ff | #1a3a5c | Background highlights |
| `--color-primary-dark` | #0958d9 | #0958d9 | Hover states |
| `--color-success` | #52c41a | #49aa19 | Confirmations, verified routes |
| `--color-warning` | #faad14 | #d89614 | Warnings, pending verifications |
| `--color-error` | #ff4d4f | #d84a4b | Errors, destructive actions |
| `--color-background` | #ffffff | #141414 | Page background |
| `--color-foreground` | #1a1a2e | #e5e7eb | Body text |
| `--color-border` | #e5e7eb | #303030 | Dividers, borders |
| `--color-muted` | #6b7280 | #a0a0a0 | Labels, captions, secondary text |
| `--color-bg-elevated` | #f9fafb | #1f1f1f | Elevated surfaces |
| `--color-bg-card` | #ffffff | #1d1d1d | Card backgrounds |
| `--color-suggestion` | #e8f5e9 | #1b3d1b | Suggested routes highlight |

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
- **Primary**: Solid `--color-primary` background, white text, border-radius `--radius-button` (8px)
- **Secondary**: Outlined with `--color-border`, default text color
- **Destructive**: Solid `--color-error` background, white text
- **Ghost**: No background/border, used in navigation contexts
- **Disabled state**: Opacity 0.4, pointer-events none
- App* wrapper: `AppButton` — accepts Ant Design Button props + custom loading/icon variants

### Forms
- **Input fields**: Bordered, rounded (8px), clear focus ring using `--color-primary`
- **Validation**: Inline error messages below the field in `--color-error` with red border
- **Submit buttons**: Show loading spinner during async operations
- App* wrappers: `AppInput`, `AppTextarea`, `AppSelect`, `ConfigDrivenForm`

### Navigation
- **Mobile**: Bottom tab bar with 5 icons (Home, Explore, Bookmarks, Notifications, Profile)
- **Desktop**: Top nav bar with search, notifications bell, user avatar dropdown
- **Admin**: Left sidebar with collapsible menu
- Ant Design Menu component via App wrappers

### Cards / Containers
- Border-radius: `--radius-card` (12px)
- Shadow: `--shadow-card` (0 2px 8px rgba(0,0,0,0.08))
- Hover shadow: `--shadow-card-hover` (0 4px 16px rgba(0,0,0,0.12))
- Glass morphism variant available for overlay cards

### Modals / Dialogs
- `AppModal` wrapper around Ant Design Modal
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
