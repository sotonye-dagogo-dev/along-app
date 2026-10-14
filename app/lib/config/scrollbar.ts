/**
 * Scrollbar display registry — single source of truth for scrollbar class
 * names used across the platform.
 *
 * The actual styling lives in `app/globals.css` and is built exclusively
 * from design-system tokens (`--color-border-strong`, `--color-text-muted`,
 * `--radius-pill`), so scrollbars automatically follow light/dark theme
 * changes via the `.dark` token overrides — no JS theme listeners needed.
 *
 * Components must reference these class names (never hardcoded
 * `"scroll-thin"` strings) so a future rename stays in one place.
 */
export const SCROLLBAR_CONFIG = {
  /**
   * Class names (defined in globals.css).
   * - `thin`: slim 6px scrollbar for compact inner scroll areas
   *   (tooltips, dropdowns, sidebar link regions).
   * - `stable`: reserves gutter space so layout never shifts when a
   *   scrollbar appears/disappears (`scrollbar-gutter: stable`).
   */
  classes: {
    thin: "scroll-thin",
    stable: "scroll-stable",
  },
  /**
   * Documented geometry mirrors (informational — the CSS owns the values).
   * Kept here so tests + reviews can assert intent without parsing CSS.
   */
  geometry: {
    baseWidthPx: 10,
    thinWidthPx: 6,
    thumbMinHeightPx: 24,
  },
} as const;

export type ScrollbarClassKey = keyof typeof SCROLLBAR_CONFIG.classes;
