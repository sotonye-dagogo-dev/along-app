/**
 * Post-card action configuration (config-driven, zero app deps).
 * Labels, toast feedback, and report-dialog copy for the Copy link /
 * Report menu on every post card. Metadata-driven report reasons keep the
 * dialog and the API category mapping in one place.
 */
export interface PostActionsConfig {
  copyLinkLabel: string;
  reportLabel: string;
  copySuccess: string;
  copyError: string;
  reportTitle: string;
  reportSubtitle: (title: string) => string;
  reportReasonLabel: string;
  reportDetailsLabel: string;
  reportDetailsPlaceholder: string;
  reportSubmitLabel: string;
  reportCancelLabel: string;
  reportSuccess: string;
  reportError: string;
  reportEmptyError: string;
  reportReasons: { value: string; label: string }[];
  /** Bug-report category used when filing a post report (must exist in the API allow-list). */
  reportCategory: string;
}

export const POST_ACTIONS_CONFIG: PostActionsConfig = {
  copyLinkLabel: "Copy link",
  reportLabel: "Report",
  copySuccess: "Link copied to clipboard",
  copyError: "Couldn't copy the link. Please try again.",
  reportTitle: "Report this post",
  reportSubtitle: (title: string) =>
    title ? `Tell us what's wrong with "${title.slice(0, 80)}"` : "Tell us what's wrong with this post",
  reportReasonLabel: "Reason",
  reportDetailsLabel: "Details (optional)",
  reportDetailsPlaceholder: "Add context that helps moderators review…",
  reportSubmitLabel: "Submit report",
  reportCancelLabel: "Cancel",
  reportSuccess: "Thanks — your report was received",
  reportError: "Couldn't submit the report. Please try again.",
  reportEmptyError: "Please choose a reason for the report.",
  reportReasons: [
    { value: "spam", label: "Spam or misleading" },
    { value: "harassment", label: "Harassment or hate" },
    { value: "explicit", label: "Explicit or unsafe content" },
    { value: "wrong-route", label: "Wrong or dangerous route info" },
    { value: "other", label: "Something else" },
  ],
  reportCategory: "OTHER",
};
