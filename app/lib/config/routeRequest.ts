import { MessageCircleQuestion } from "lucide-react";

/**
 * Route-request trigger configuration (config-driven, Lucide-only).
 * The query-style icon opens the request-route flow; the tagline doubles
 * as the native tooltip (`title`) and the accessible label.
 */
export interface RequestRouteTriggerConfig {
  icon: typeof MessageCircleQuestion;
  /** Tagline shown as tooltip + aria-label (directive: "Request?"). */
  tagline: string;
  ariaLabel: string;
}

export const REQUEST_ROUTE_TRIGGER_CONFIG: RequestRouteTriggerConfig = {
  icon: MessageCircleQuestion,
  tagline: "Request?",
  ariaLabel: "Request a route",
};
