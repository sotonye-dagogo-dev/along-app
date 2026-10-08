/**
 * Route-drafts library configuration (config-driven, zero app deps).
 * Single source of truth for the savable share-route drafts: storage keys,
 * capacity, and every user-facing label for the drafts access/restore UI.
 */
export interface RouteDraftsConfig {
  /** localStorage key holding the drafts collection (JSON array). */
  collectionKey: string;
  /** Legacy single-draft key — migrated into the collection on first read. */
  legacyKey: string;
  /** Legacy response-mode single-draft key — migrated the same way. */
  legacyResponseKey: string;
  /** Max drafts kept; oldest overflow is pruned on save. */
  maxDrafts: number;
  /** Browser event fired after every save/delete so badges stay in sync. */
  changedEvent: string;
  panelTitle: string;
  panelToggleLabel: string;
  emptyText: string;
  saveLabel: string;
  savedToast: string;
  saveEmptyError: string;
  restoreLabel: string;
  continueLabel: string;
  deleteLabel: string;
  restoredToast: string;
  deletedToast: string;
  resumeChipLabel: (count: number) => string;
  draftsCountLabel: (count: number) => string;
  /** Badge shown on drafts that were saved as a response to a route request. */
  responseBadgeLabel: (title: string) => string;
}

export const ROUTE_DRAFTS_CONFIG: RouteDraftsConfig = {
  collectionKey: "along_route_drafts",
  legacyKey: "along_route_draft",
  legacyResponseKey: "along_route_draft_resp",
  maxDrafts: 10,
  changedEvent: "along:drafts-changed",
  panelTitle: "Saved drafts",
  panelToggleLabel: "Drafts",
  emptyText: "No saved drafts yet. Tap Save Draft while composing to park your progress here.",
  saveLabel: "Save Draft",
  savedToast: "Draft saved locally",
  saveEmptyError: "Nothing to save yet — add a title or at least one route step.",
  restoreLabel: "Restore",
  continueLabel: "Continue to upload",
  deleteLabel: "Delete draft",
  restoredToast: "Draft restored — review and share when ready",
  deletedToast: "Draft deleted",
  resumeChipLabel: (count: number) =>
    count === 1 ? "1 saved draft — continue" : `${count} saved drafts — continue`,
  draftsCountLabel: (count: number) => (count === 1 ? "1 draft" : `${count} drafts`),
  responseBadgeLabel: (title: string) =>
    title ? `Response to "${title.slice(0, 60)}"` : "Response to a request",
};
