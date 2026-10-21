/**
 * Floating-UI stack configuration (config-driven, zero app deps).
 *
 * The mobile bottom tab bar is 64px tall (`h-16`) and full-width, so every
 * floating surface must clear it. Lanes (mobile, px above viewport bottom):
 * - Offline banner / pill: 76 (12px gap above the tab bar + safe-area).
 * - Install card / pill: 76 when online, 152 when the offline banner is also
 *   up (one card height + gap) so the two never paint over each other.
 * - Round action buttons (Back to top, theme toggle): docked RIGHT on mobile
 *   and desktop (established right-side stack). All other floating surfaces
 *   (offline banner, install card, transient prompts) keep their existing
 *   centered/full-width lanes above the tab bar, so only the two round
 *   buttons move — nothing else changes dock.
 * - Review prompt: top lane above the transient prompts (one transient-card
 *   height + gap) so the push opt-in and the review ask never share pixels.
 * - Guest tour prompt: the install lane (76 online / 152 offline). It is
 *   serialized after the cookie bar and install prompt, so those surfaces are
 *   already clear when it appears — no extra stacked card.
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
    /** Review notice — above the transient lane so stacked surfaces never collide. */
    reviewNoticeBottomPx: number;
    /** Guest tour prompt — takes the install lane once install has cleared. */
    guestTourNoticeBottomPx: number;
    guestTourNoticeOfflineBottomPx: number;
  };
  /** Mobile dock side for the round action buttons (BackToTop + ThemeToggle). */
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
    reviewNoticeBottomPx: 356,
    guestTourNoticeBottomPx: 76,
    guestTourNoticeOfflineBottomPx: 152,
  },
  mobileDockSide: "right",
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
