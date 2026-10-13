/**
 * Floating-UI stack configuration (config-driven, zero app deps).
 *
 * The mobile bottom tab bar is 64px tall (`h-16`) and full-width, so every
 * floating surface must clear it. Lanes (mobile, px above viewport bottom):
 * - Offline banner / pill: 76 (12px gap above the tab bar + safe-area).
 * - Install card / pill: 76 when online, 152 when the offline banner is also
 *   up (one card height + gap) so the two never paint over each other.
 * - Round action buttons (Back to top, theme toggle): docked LEFT on mobile
 *   (the Profile tab lives on the right — right-docked rounds covered it),
 *   stacked vertically; desktop keeps the established right-side stack.
 *
 * Desktop (lg+) has a sidebar instead of a tab bar, so lanes drop to the
 * classic bottom offsets. All values flow through CSS `max()` with
 * `env(safe-area-inset-bottom)` so notched devices keep clearance.
 */

export interface FloatingUiConfig {
  /** Mobile tab-bar height (must match DashboardNav h-16). */
  mobileNavbarHeightPx: number;
  /** Gap between stacked floating surfaces. */
  stackGapPx: number;
  lanes: {
    offlineBottomPx: number;
    installBottomOnlinePx: number;
    installBottomOfflinePx: number;
    /** Transient prompts (push opt-in, SW update) — top lane, above install. */
    transientBottomPx: number;
  };
  /** Mobile dock side for the round action buttons. */
  mobileDockSide: "left" | "right";
  roundButtons: {
    /** Bottom offset of the lower round button on mobile. */
    firstBottomPx: number;
    /** Bottom offset of the upper round button on mobile. */
    secondBottomPx: number;
    sideOffsetPx: number;
  };
}

export const FLOATING_UI_CONFIG: FloatingUiConfig = {
  mobileNavbarHeightPx: 64,
  stackGapPx: 12,
  lanes: {
    offlineBottomPx: 76,
    installBottomOnlinePx: 76,
    installBottomOfflinePx: 152,
    transientBottomPx: 228,
  },
  mobileDockSide: "left",
  roundButtons: {
    firstBottomPx: 96,
    secondBottomPx: 152,
    sideOffsetPx: 12,
  },
};

/** `bottom` CSS value for a lane that also respects the device safe-area. */
export function laneBottom(lanePx: number): string {
  return `max(${lanePx}px, calc(${lanePx}px + env(safe-area-inset-bottom, 0px)))`;
}
