/**
 * Endless carousel configuration (config-driven, zero app deps).
 * Single source of truth for the home suggestions tape autoplay,
 * pause/resume behaviour, and the wrapping-container classes that keep
 * the tape's overflow inside its own box (never the feed column).
 */
export interface EndlessCarouselConfig {
  /** Seconds for one full loop at the reference track width. */
  defaultDurationSec: number;
  /** Loop duration used for the mobile rail (usually slightly slower). */
  mobileDurationSec: number;
  /** Pixels-per-second fallback when track width can't be measured. */
  fallbackSpeedPxPerSec: number;
  /** Pause autoplay while hovered / focused (desktop affordance). */
  pauseOnHover: boolean;
  /** Pause autoplay while the tab is hidden (perf + battery). */
  pauseWhenHidden: boolean;
  /** Ms to wait after an interaction ends before resuming autoplay. */
  resumeDelayMs: number;
  /** Default accessible name for the carousel region. */
  defaultLabel: string;
  /** Outer wrapper: owns the overflow so the feed column never grows. */
  wrapperClass: string;
  /** Native scroll viewport: the element that actually scrolls. */
  viewportClass: string;
  /** Track holding the (duplicated) cards. */
  trackClass: string;
}

export const ENDLESS_CAROUSEL_CONFIG: EndlessCarouselConfig = {
  defaultDurationSec: 45,
  mobileDurationSec: 50,
  fallbackSpeedPxPerSec: 40,
  pauseOnHover: true,
  pauseWhenHidden: true,
  resumeDelayMs: 1200,
  defaultLabel: "Suggestions",
  wrapperClass: "w-full min-w-0 max-w-full overflow-hidden",
  viewportClass:
    "overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  trackClass: "flex w-max items-stretch",
};
