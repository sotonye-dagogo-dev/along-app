import { MessageCircleQuestion } from "lucide-react";

/**
 * Route-request trigger configuration (config-driven, Lucide-only).
 * The query-style icon opens the request-route flow; the tagline doubles
 * as the native tooltip (`title`) and the accessible label.
 *
 * Sprint 59: the trigger carries a visible text label *inside* the button
 * (so the text performs the action too) — stacked below the icon on small
 * screens, beside the icon on larger screens (responsive classes below).
 */
export interface RequestRouteTriggerConfig {
  icon: typeof MessageCircleQuestion;
  /** Tagline shown as tooltip + aria-label (directive: "Request?"). */
  tagline: string;
  ariaLabel: string;
  /** Full visible label — "Request a route" (below icon on mobile). */
  label: string;
  /** Short visible label — "Request" (beside icon on desktop). */
  shortLabel: string;
  /** Button layout: column on mobile (label below), row on desktop. */
  buttonClass: string;
  /** Mobile label (below icon) classes. */
  mobileLabelClass: string;
  /** Desktop label (beside icon) classes. */
  desktopLabelClass: string;
}

export const REQUEST_ROUTE_TRIGGER_CONFIG: RequestRouteTriggerConfig = {
  icon: MessageCircleQuestion,
  tagline: "Request?",
  ariaLabel: "Request a route",
  label: "Request a route",
  shortLabel: "Request",
  buttonClass:
    "inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:h-8 radius-md border border-border bg-bg-elevated text-text-secondary cursor-pointer font-sans transition-colors duration-fast hover:bg-primary-muted hover:text-primary hover:border-primary-muted shrink-0",
  mobileLabelClass: "sm:hidden text-[10px] leading-tight font-semibold whitespace-nowrap",
  desktopLabelClass: "hidden sm:inline text-xs font-semibold whitespace-nowrap",
};
