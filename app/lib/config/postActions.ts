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
  /** Shared "share this post" copy + URL shape (used by postShareService). */
  shareLabel: string;
  shareTitleDefault: string;
  postPath: (postId: string) => string;
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
  // --- Post/comment management (owner + admin), all destructive actions go
  // through the global confirm modal + global undo toast (see
  // postModerationService). Labels/copy live here so UI stays metadata-driven.
  editLabel: string;
  deleteLabel: string;
  archiveLabel: string;
  unarchiveLabel: string;
  deleteTitle: string;
  deleteDescription: string;
  archiveTitle: string;
  archiveDescription: string;
  unarchiveTitle: string;
  unarchiveDescription: string;
  deleteSuccess: string;
  deleteError: string;
  deleteUndoLabel: string;
  deleteUndoMessage: string;
  restoreSuccess: string;
  archiveSuccess: string;
  archiveError: string;
  archiveUndoMessage: string;
  unarchiveSuccess: string;
  unarchiveError: string;
  editSuccess: string;
  editError: string;
  adminDeleteTitle: string;
  adminDeleteDescription: string;
  commentDeleteTitle: string;
  commentDeleteDescription: string;
  commentDeleteSuccess: string;
  commentDeleteError: string;
  commentEditLabel: string;
  commentEditSuccess: string;
  commentEditError: string;
}

export const POST_ACTIONS_CONFIG: PostActionsConfig = {
  copyLinkLabel: "Copy link",
  reportLabel: "Report",
  copySuccess: "Link copied to clipboard",
  copyError: "Couldn't copy the link. Please try again.",
  shareLabel: "Share",
  shareTitleDefault: "Check out this route on Along",
  postPath: (postId: string) => `/posts/${encodeURIComponent(postId)}`,
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
  editLabel: "Edit",
  deleteLabel: "Delete",
  archiveLabel: "Archive",
  unarchiveLabel: "Unarchive",
  deleteTitle: "Delete this post?",
  deleteDescription: "This will remove the post from everyone's feed. You can undo this right after deleting.",
  archiveTitle: "Archive this post?",
  archiveDescription: "Archived posts are hidden from feeds, explore and search, but you can restore them any time.",
  unarchiveTitle: "Restore this post?",
  unarchiveDescription: "This will make the post visible in feeds, explore and search again.",
  deleteSuccess: "Post deleted",
  deleteError: "Couldn't delete the post. Please try again.",
  deleteUndoLabel: "Undo",
  deleteUndoMessage: "Post deleted",
  restoreSuccess: "Post restored",
  archiveSuccess: "Post archived",
  archiveError: "Couldn't archive the post. Please try again.",
  archiveUndoMessage: "Post archived",
  unarchiveSuccess: "Post restored to feed",
  unarchiveError: "Couldn't restore the post. Please try again.",
  editSuccess: "Post updated",
  editError: "Couldn't save your changes. Please try again.",
  adminDeleteTitle: "Delete this post as admin?",
  adminDeleteDescription: "The author and their followers will no longer see this post. The author is not notified of who removed it.",
  commentDeleteTitle: "Delete this comment?",
  commentDeleteDescription: "This will remove the comment for everyone. You can undo this right after deleting.",
  commentDeleteSuccess: "Comment deleted",
  commentDeleteError: "Couldn't delete the comment. Please try again.",
  commentEditLabel: "Edit comment",
  commentEditSuccess: "Comment updated",
  commentEditError: "Couldn't save your comment. Please try again.",
};
