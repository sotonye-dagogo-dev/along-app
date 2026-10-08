/**
 * Share-route modal section configuration (config-driven, zero app deps).
 * Controls which sections start collapsed so the user sees the preview
 * and quality score before reaching the Share action, and labels for the
 * collapsible section headers.
 */
export interface ShareRouteModalConfig {
  /** Route preview starts collapsed; user expands to verify the trace. */
  previewDefaultOpen: boolean;
  /** Route quality score starts collapsed. */
  scoreDefaultOpen: boolean;
  /** Route form starts expanded (primary task) but can be collapsed. */
  formDefaultOpen: boolean;
  previewTitle: string;
  scoreTitle: string;
  formTitle: string;
  actionsNote: string;
  /** Show the "Request?" query-icon trigger in the modal header (opens the request flow). */
  showRequestTrigger: boolean;
}

export const SHARE_ROUTE_MODAL_CONFIG: ShareRouteModalConfig = {
  previewDefaultOpen: false,
  scoreDefaultOpen: false,
  formDefaultOpen: true,
  previewTitle: "Route preview",
  scoreTitle: "Route Quality Score",
  formTitle: "Route details",
  actionsNote: "Drafts are saved locally",
  showRequestTrigger: true,
};
