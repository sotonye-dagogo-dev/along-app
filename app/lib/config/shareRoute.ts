/**
 * Share-route modal section configuration (config-driven, zero app deps).
 *
 * The composer is a tabbed workspace: Details, Map, Score and Drafts occupy
 * one shared panel so no section gets squeezed into a narrow column or
 * clipped. Tabs use short labels + icons (count badge on Drafts) and the
 * footer keeps only the two primary actions (Save Draft, Share). The legacy
 * collapsible flags below are retained for backwards compatibility but the
 * tabbed layout is now the renderer.
 */
export type ShareRouteTabId = "details" | "map" | "score" | "drafts";

/** Icon keys resolved to Lucide components inside the modal (config stays zero-dep). */
export type ShareRouteTabIcon = "details" | "map" | "score" | "drafts";

/**
 * Cross-surface events (window CustomEvent names). The platform tour uses
 * these to open the composer on demand and switch to the tab it is talking
 * about without coupling the two features together.
 */
export const SHARE_ROUTE_OPEN_EVENT = "along:share-route-open";
export const SHARE_ROUTE_TAB_EVENT = "along:share-route-tab";

export interface ShareRouteTabEventDetail {
  tab: ShareRouteTabId;
}

export interface ShareRouteTabConfig {
  id: ShareRouteTabId;
  /** Short label so it never clips on small screens. */
  label: string;
  icon: ShareRouteTabIcon;
  /** Full accessible name (label may be abbreviated). */
  ariaLabel: string;
  /** Optional live count badge. Drafts is the only counted section today. */
  badge?: "drafts";
}

/**
 * "Check map + score before sharing" callout shown at the bottom of Details.
 * Split into parts so the map/score words can be rendered as real buttons.
 */
export interface ShareRouteDetailsHintConfig {
  text: string;
  mapLabel: string;
  conjunction: string;
  scoreLabel: string;
  /**
   * Live score suffix rendered inside the Score link, e.g. "(72/100)".
   * `{score}` / `{max}` are replaced with the current evaluation. Empty
   * string always renders the label alone (safe fallback).
   */
  scoreValueTemplate: string;
  suffix: string;
  ariaLabel: string;
}

export interface ShareRouteModalConfig {
  /** @deprecated Kept for compatibility; the preview now lives in the Map tab. */
  previewDefaultOpen: boolean;
  /** @deprecated Kept for compatibility; the score tab always opens expanded. */
  scoreDefaultOpen: boolean;
  /** @deprecated Kept for compatibility; Details is the default tab. */
  formDefaultOpen: boolean;
  previewTitle: string;
  scoreTitle: string;
  formTitle: string;
  actionsNote: string;
  /** Accessible label for the tablist. */
  tabsAriaLabel: string;
  /** Tab shown when the composer opens (falls back to Details). */
  defaultTab: ShareRouteTabId;
  /** Tab metadata — labels/icons are rendered in config order. */
  tabs: ShareRouteTabConfig[];
  /** Pre-share nudge rendered at the bottom of the Details tab. */
  detailsHint: ShareRouteDetailsHintConfig;
  /** Map preview height (px) in the Map tab. */
  mapPanelHeight: number;
  /** Show the "Request?" query-icon trigger in the modal header (opens the request flow). */
  showRequestTrigger: boolean;
  /** Generic route description input (feeds the quality-score description checkpoint). */
  descriptionTitle: string;
  descriptionPlaceholder: string;
  descriptionHint: string;
  descriptionMinLength: number;
  /** Accessible label for the per-photo remove button in the composer. */
  photoRemoveLabel: string;
  /**
   * Token classes for the per-photo remove button. Always visible (no
   * hover-only `opacity-0`) so touch users and keyboard users can discover
   * it; hover/focus only deepen the treatment. Design tokens only.
   */
  photoRemoveButtonClass: string;
  /** Icon size (px) for the per-photo remove X. */
  photoRemoveIconSize: number;
  /**
   * Dismiss control on the "Replying to …" response banner. Lets the user
   * abandon a route-request response mid-composer (changed mind, posting
   * something else first, or resuming another draft) without closing the
   * modal. Dismissal only unlinks the request — typed input is preserved.
   */
  responseBannerDismissLabel: string;
  responseBannerDismissTitle: string;
}

export const SHARE_ROUTE_MODAL_CONFIG: ShareRouteModalConfig = {
  previewDefaultOpen: false,
  scoreDefaultOpen: false,
  formDefaultOpen: true,
  previewTitle: "Route preview",
  scoreTitle: "Route Quality Score",
  formTitle: "Route details",
  actionsNote: "Drafts are saved locally",
  tabsAriaLabel: "Route composer sections",
  defaultTab: "details",
  tabs: [
    { id: "details", label: "Detail", icon: "details", ariaLabel: "Route details" },
    { id: "map", label: "Map", icon: "map", ariaLabel: "Map preview" },
    { id: "score", label: "Score", icon: "score", ariaLabel: "Route quality score" },
    { id: "drafts", label: "Drafts", icon: "drafts", ariaLabel: "Saved drafts", badge: "drafts" },
  ],
  detailsHint: {
    text: "Before you share, check the",
    mapLabel: "map",
    conjunction: "and",
    scoreLabel: "score",
    scoreValueTemplate: "({score}/{max})",
    suffix: "— they help others trust your route.",
    ariaLabel: "Check the map and route score before sharing",
  },
  mapPanelHeight: 380,
  showRequestTrigger: true,
  descriptionTitle: "Route description",
  descriptionPlaceholder: "Describe the route experience, best time to go, cost tips… (min 10 characters)",
  descriptionHint: "Adds to your Route Quality Score and helps others trust this route.",
  descriptionMinLength: 10,
  photoRemoveLabel: "Remove photo",
  photoRemoveButtonClass:
    "absolute top-1 right-1 z-10 w-7 h-7 rounded-circle bg-black/85 text-white flex items-center justify-center border border-white/60 ring-2 ring-white/80 shadow-md opacity-100 visible hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors",
  photoRemoveIconSize: 14,
  responseBannerDismissLabel: "Stop responding to this request",
  responseBannerDismissTitle: "Dismiss — share a normal route instead",
};

/**
 * Resolve any tab id (possibly stale/unknown) to a real configured tab.
 * Never throws and always returns a tab the UI can render: unknown ids fall
 * back to `defaultTab`, then the first configured tab, then Details.
 */
export function resolveShareRouteTabId(id: unknown): ShareRouteTabId {
  if (typeof id === "string") {
    const match = SHARE_ROUTE_MODAL_CONFIG.tabs.find((tab) => tab.id === id);
    if (match) return match.id;
  }
  const preferred = SHARE_ROUTE_MODAL_CONFIG.tabs.find(
    (tab) => tab.id === SHARE_ROUTE_MODAL_CONFIG.defaultTab,
  );
  return preferred?.id ?? SHARE_ROUTE_MODAL_CONFIG.tabs[0]?.id ?? "details";
}
