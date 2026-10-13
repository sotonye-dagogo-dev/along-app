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
