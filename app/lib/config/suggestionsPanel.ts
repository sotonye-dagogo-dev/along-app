/**
 * Desktop suggestions-panel configuration (config-driven, zero app deps).
 * Single source of truth for the "Open route requests" section behaviour:
 * a single request stays a static row (non-breaking), while 2+ requests
 * render in the shared `EndlessCarousel` tape so the rail scrolls instead
 * of growing the sidebar. The carousel viewport is a native `overflow-x-auto`
 * scroller, so keyboard/touch users can always scrub freely even when
 * autoplay is paused or reduced-motion is on.
 */
export interface SuggestionsPanelConfig {
  openRequests: {
    /** Item count at/above which the section switches to carousel mode. */
    minForCarousel: number;
    /** Fixed card width inside the narrow (w-80) desktop rail. */
    cardWidthClass: string;
    /** Loop duration for the desktop open-requests tape. */
    carouselDurationSec: number;
    /** Accessible name for the carousel region. */
    carouselLabel: string;
    /** Hint shown beside the count when multiple requests exist. */
    scrollHint: string;
    /** Vertical fallback cap (reduced-motion plain scroller context). */
    listMaxHeightClass: string;
  };
}

export const SUGGESTIONS_PANEL_CONFIG: SuggestionsPanelConfig = {
  openRequests: {
    minForCarousel: 2,
    cardWidthClass: "w-[228px]",
    carouselDurationSec: 40,
    carouselLabel: "Open route requests",
    scrollHint: "swipe or scroll for more",
    listMaxHeightClass: "max-h-72",
  },
};
