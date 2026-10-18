/**
 * Map pick / focus configuration (Sprint 72).
 *
 * Tap-to-assign flow in the route preview: an EMPTY-area tap (no interactive
 * route/traffic feature hit) opens a small card anchored at the tap listing
 * `pickOptions` from the parent — picking one assigns the tapped point to
 * that stop. Route-line taps keep the Sprint 68/69 stretch/mini tooltips.
 * The card dismisses via X, Escape, or re-taps (re-anchors).
 *
 * "Find on map" focuses the preview camera through `focusRequest`: the
 * fly-to bypasses the baseline-fit deferral (it IS the user request) and
 * shows an auto-hiding tap-hint pill so the next tap is discoverable.
 *
 * Enabled only when a parent arms it (`pickOptions` + `onPickOption`), so
 * every other RouteMap (post cards, detail, nav) is untouched.
 */
export interface MapPickOption {
  id: string;
  label: string;
}

export const MAP_PICKER_CONFIG = {
  /** Card chrome (token classes only, mirrors the stretch/mini tooltip cards). */
  cardClass: "rounded-md bg-bg-card border border-border shadow-lg p-3 text-left",
  cardMaxWidth: "16rem",
  /**
   * Generous ceiling so a long stop list (many steps + long location names)
   * never overflows the small preview map — the option list scrolls instead.
   */
  cardMaxHeight: "42vh",
  /** Scrollable options list — same pattern as the geocode dropdown. */
  optionListClass: "flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-0.5",
  cardTitle: "Assign this point",
  /** Body line under the title. */
  cardBody: "Choose the stop this tapped point should become.",
  dismissLabel: "Close point picker",
  optionButtonClass:
    "w-full text-left px-2 py-1.5 radius-md text-xs font-medium text-text-primary bg-bg-elevated border border-border hover:bg-bg-surface transition-colors cursor-pointer",
  /** Auto-hiding hint pill after a "Find on map" focus fly-to. */
  focusHint: "Tap anywhere on the map to set a point",
  focusHintMs: 2500,
  focusHintClass:
    "absolute bottom-7 left-1/2 -translate-x-1/2 z-[4] px-3 py-1.5 rounded-full bg-bg-card border border-border shadow-md text-[11px] font-medium text-text-primary pointer-events-none",
  /** Explicit focus fly-to framing (bypasses the baseline-fit deferral). */
  focusZoom: 15,
  focusDurationMs: 600,
} as const;
