/**
 * Bug-report lifecycle copy (config-driven).
 * Status emails + in-app notes share this copy so the wording the reporter
 * sees by email matches what they see in-app. Admins edit copy here, never
 * in API routes.
 */
export const BUG_REPORT_STATUS_COPY: Record<string, string> = {
  IN_PROGRESS: "Our team is actively working on this. We will email you again when it is resolved.",
  RESOLVED: "Our team has resolved this. Please update the app / refresh and let us know via a new report if you still see it.",
  CLOSED: "This report is now closed. Thanks for helping improve Along — file a new report if anything resurfaces.",
  DEFAULT: "The status of your report changed. Thanks for helping improve Along.",
} as const;

/**
 * Admin action-modal copy (config-driven). The modal handles status changes
 * + custom note entry + screenshot review + full context in one place so
 * admins never have to accept the default note blindly. The note input is
 * PREFILLED with the status default copy; custom notes are sanitized +
 * capped server-side; emptied (even whitespace-only) input falls back to
 * the status default copy — legacy behaviour preserved.
 */
export const BUG_REPORT_ACTION_MODAL = {
  title: "Update report",
  description: "Change status, optionally replace the reporter note, and review screenshots before confirming.",
  noteLabel: "Note sent to reporter (prefilled — edit as needed, or clear to use the default)",
  notePlaceholder: "e.g. Fixed in the latest release — please refresh and confirm…",
  noteMaxLength: 1000,
  useDefaultLabel: (status: string) => `Use default note for ${status.replace("_", " ")}`,
  resetDefaultLabel: "Reset to default note",
  confirmLabel: "Confirm update",
  cancelLabel: "Cancel",
  statusLabel: "Status",
  screenshotsLabel: "Screenshots",
  noScreenshots: "No screenshots attached to this report.",
  /** Full attached context (description + structured metadata). */
  contextLabel: "Full context",
  contextShowLabel: "Show full context",
  contextHideLabel: "Hide full context",
  /** Reporter identification (admin-only; already collected with the report). */
  reportedByLabel: "Reported by",
  reportedAnonymous: "Anonymous",
  /** Auto-assigned reviewer (least-loaded admin at creation time). */
  assignedToLabel: "Assigned to",
  assignedToNobody: "Unassigned",
  /** Structured metadata rows (source / route / digest / category). */
  metaSourceLabel: "Source",
  metaPathLabel: "Route",
  metaDigestLabel: "Digest",
  metaCategoryLabel: "Category",
} as const;
