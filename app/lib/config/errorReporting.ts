/**
 * Error-reporting policy (config-driven, zero app deps).
 *
 * The global/segment error boundaries file real `BugReport` rows (category
 * OTHER) with a sanitized capture of the error so "our team has been
 * notified" is a true statement — and the team actually gets context.
 * Nothing here may throw; the service layer enforces that.
 */
export const ERROR_REPORTING_CONFIG = {
  /** BugReport category for automatic client-error captures. */
  category: "OTHER",
  /** POST target — anonymous reports allowed (reporterId stays null). */
  endpoint: "/api/bug-reports",
  /** Title template — `{name}` + `{path}` interpolated, truncated to fit. */
  titleTemplate: "Client error: {name} on {path}",
  /** Hard caps so payloads always satisfy API validation (1–200 / 1–10000). */
  maxTitleLength: 120,
  maxDescriptionLength: 8000,
  maxStackLength: 3000,
  maxMessageLength: 500,
  /** Copy states so boundaries never claim a notification that didn't happen. */
  copy: {
    pending: "Logging this error for our team…",
    reported: "Our team has been notified — this error was logged for review.",
    unreported: "Please try again. If it keeps happening, use “Report a bug” so our team can look into it.",
  },
} as const;

/** Patterns scrubbed from messages/stacks/metadata before any network send. */
export const ERROR_SENSITIVE_PATTERNS: readonly RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.]+/g, // emails
  /bearer\s+[A-Za-z0-9\-._~+/=]+/gi, // bearer tokens
  /(password|passwd|pwd)\s*[:=]\s*\S+/gi, // password assignments
  /(otp|token|secret|api[-_]?key)\s*[:=]\s*\S+/gi, // secrets/OTPs/tokens
  /access_token=[^&\s;]+/gi, // cookie/query token leaks
  /refresh_token=[^&\s;]+/gi,
] as const;
