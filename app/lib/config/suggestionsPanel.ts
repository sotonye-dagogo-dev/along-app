/**
 * Desktop suggestions-panel configuration (config-driven, zero app deps).
 * Single source of truth for the "Open route requests" section behaviour:
 * a single request stays a static row (non-breaking), while 2+ requests
 * render in the shared `EndlessCarousel` tape so the rail scrolls instead
 * of growing the sidebar. The carousel viewport is a native `overflow-x-auto`
 * scroller, so keyboard/touch users can always scrub freely even when
 * autoplay is paused or reduced-motion is on.
 *
 * The rail itself is sticky at `top-4`. On short desktop viewports its
 * stacked cards can exceed the screen, so the panel owns an independent
 * vertical scroller capped to the viewport (minus the sticky offset). Every
 * section stays reachable without the page having to scroll the rail away.
 */
export interface SuggestionsPanelConfig {
  panel: {
    /** Viewport cap for the sticky rail (top-4 = 1rem above + 1rem below). */
    maxHeightClass: string;
    /** Native vertical scroller so trackpad/keyboard/touch all work. */
    overflowClass: string;
    /** Slim themed scrollbar (design-system tokens). */
    scrollbarClass: string;
    /** Keep wheel/touch gestures inside the rail once it bottoms out. */
    overscrollClass: string;
  };
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
  panel: {
    maxHeightClass: "max-h-[calc(100vh-2rem)]",
    overflowClass: "overflow-y-auto",
    scrollbarClass: "scroll-thin scroll-stable",
    overscrollClass: "overscroll-contain",
  },
  openRequests: {
    minForCarousel: 2,
    cardWidthClass: "w-[228px]",
    carouselDurationSec: 40,
    carouselLabel: "Open route requests",
    scrollHint: "swipe or scroll for more",
    listMaxHeightClass: "max-h-72",
  },
};
