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
  /** Generic route description input (feeds the quality-score description checkpoint). */
  descriptionTitle: string;
  descriptionPlaceholder: string;
  descriptionHint: string;
  descriptionMinLength: number;
  /** Accessible label for the per-photo remove button in the composer. */
  photoRemoveLabel: string;
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
  descriptionTitle: "Route description",
  descriptionPlaceholder: "Describe the route experience, best time to go, cost tips… (min 10 characters)",
  descriptionHint: "Adds to your Route Quality Score and helps others trust this route.",
  descriptionMinLength: 10,
  photoRemoveLabel: "Remove photo",
};
