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
  /**
   * Token classes for the per-photo remove button. Always visible (no
   * hover-only `opacity-0`) so touch users and keyboard users can discover
   * it; hover/focus only deepen the treatment. Design tokens only.
   */
  photoRemoveButtonClass: string;
  /** Icon size (px) for the per-photo remove X. */
  photoRemoveIconSize: number;
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
  photoRemoveButtonClass:
    "absolute top-1 right-1 z-10 w-7 h-7 rounded-circle bg-black/85 text-white flex items-center justify-center border border-white/60 ring-2 ring-white/80 shadow-md opacity-100 visible hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors",
  photoRemoveIconSize: 14,
};
