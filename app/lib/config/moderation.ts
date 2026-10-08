/**
 * Moderation/report lifecycle configuration (config-driven, zero app deps).
 * Drives the end-to-end report flow: filing (reasons, dedup window), user
 * feedback (receipt + outcome toasts), and admin triage actions. Reporter
 * anonymity is enforced server-side — the reported author never learns who
 * reported, and admin identities are never exposed to reporters.
 */

export interface ModerationActionConfig {
  value: "DISMISS" | "ARCHIVE_POST" | "REMOVE_POST";
  label: string;
  description: string;
}

export interface ModerationConfig {
  /** Duplicate-report window: same reporter + post + reason inside this window is rejected as duplicate. */
  duplicateWindowHours: number;
  duplicateError: string;
  reportReceived: string;
  reportOutcomeDismissed: string;
  reportOutcomeArchived: string;
  reportOutcomeRemoved: string;
  /** Admin triage actions available on a post report (metadata-driven). */
  adminActions: ModerationActionConfig[];
  adminActionSuccess: string;
  adminActionError: string;
  adminConfirmRemoveTitle: string;
  adminConfirmRemoveDescription: string;
  adminConfirmArchiveTitle: string;
  adminConfirmArchiveDescription: string;
  /** Route-request display rules: requests are not routes, so they never show these. */
  routeRequestHides: {
    map: boolean;
    navigationGuide: boolean;
    trustScore: boolean;
  };
  /**
   * Post nature preservation: these fields are set once at creation and are
   * stripped from every edit/archive payload server-side, so operations like
   * editing or archiving can never turn a ROUTE into a ROUTE_REQUEST (or
   * re-parent a ROUTE_RESPONSE). The undo-restore replay re-sends the
   * snapshot through POST (create), where they are still honoured.
   */
  immutablePostFields: string[];
}

export const MODERATION_CONFIG: ModerationConfig = {
  duplicateWindowHours: 24,
  duplicateError: "You've already reported this post for this reason. Our team is reviewing it.",
  reportReceived: "Thanks — your report was received. We'll notify you once it's reviewed.",
  reportOutcomeDismissed: "Thanks for reporting — our team reviewed it and found no violation.",
  reportOutcomeArchived: "Thanks for reporting — the post was hidden from feeds while under review.",
  reportOutcomeRemoved: "Thanks for reporting — the post was removed for violating community standards.",
  adminActions: [
    { value: "DISMISS", label: "Dismiss", description: "No violation — close the report and notify the reporter." },
    { value: "ARCHIVE_POST", label: "Hide post", description: "Hide the post from feeds (restorable) and notify the reporter." },
    { value: "REMOVE_POST", label: "Remove post", description: "Permanently delete the post and notify the reporter." },
  ],
  adminActionSuccess: "Moderation action applied",
  adminActionError: "Couldn't apply the moderation action. Please try again.",
  adminConfirmRemoveTitle: "Remove this reported post?",
  adminConfirmRemoveDescription: "The post will be permanently deleted. The author is not told who reported it.",
  adminConfirmArchiveTitle: "Hide this reported post?",
  adminConfirmArchiveDescription: "The post will be hidden from feeds but can be restored later.",
  routeRequestHides: {
    map: true,
    navigationGuide: true,
    trustScore: true,
  },
  immutablePostFields: ["type", "quotedPostId"],
};
