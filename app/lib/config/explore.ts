/**
 * Explore map pin-popup configuration (config-driven, zero app deps).
 * Single source of truth for the selected-pin tooltip card so the same
 * popup renders on every viewport: tapped pins on mobile show the identical
 * card as clicked pins on desktop, only the placement differs.
 */
export interface ExplorePinPopupConfig {
  /** Desktop card width (px). */
  desktopWidth: number;
  /** Desktop placement (px from the map container). */
  desktopTop: number;
  desktopLeft: number;
  /** Mobile side inset (px) — card stretches full-width minus insets. */
  mobileSideInset: number;
  /** Gap (px) above the mobile bottom sheet so the card never hides behind it. */
  mobileAboveSheetGap: number;
  /** Breakpoint (px) at or above which desktop placement applies. Mirrors Tailwind lg. */
  desktopBreakpointPx: number;
}

export const EXPLORE_PIN_POPUP_CONFIG: ExplorePinPopupConfig = {
  desktopWidth: 280,
  desktopTop: 200,
  desktopLeft: 420,
  mobileSideInset: 12,
  mobileAboveSheetGap: 64,
  desktopBreakpointPx: 1024,
};
