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
  /** Page hosting the bug-report form (prefilled via ?title=&description=). */
  bugReportPath: "/report-bug",
  /** Title template — `{name}` + `{path}` interpolated, truncated to fit. */
  titleTemplate: "Client error: {name} on {path}",
  /** Hard caps so payloads always satisfy API validation (1–200 / 1–10000). */
  maxTitleLength: 120,
  maxDescriptionLength: 8000,
  maxStackLength: 3000,
  maxMessageLength: 500,
  /** Query-param caps so the prefilled bug-report URL stays shareable. */
  maxPrefillTitleLength: 120,
  maxPrefillDescriptionLength: 4000,
  /** Copy states so boundaries never claim a notification that didn't happen. */
  copy: {
    pending: "Logging this error for our team…",
    reported: "Our team has been notified — this error was logged for review.",
    unreported: "Please try again. If it keeps happening, use “Report a bug” so our team can look into it.",
  },
  /**
   * Toast CTA raised by error boundaries alongside the inline status copy.
   * Fired through the existing toastService action slot (undoLabel + onUndo
   * → routes to the prefilled bug-report page), so no toast shape changes.
   */
  toast: {
    message: "Something went wrong. Tap to report it with the details filled in.",
    actionLabel: "Report a bug",
  },
  /** CTA label rendered inline on the error surfaces. */
  reportCtaLabel: "Report a bug",
  /**
   * Stale-chunk auto-recovery (deploys invalidate hashed chunks — the
   * classic `ChunkLoadError: Loading chunk 72 failed` on /login and friends).
   * When an error matches a pattern below, the boundary attempts ONE
   * `location.reload()` per browser session (sessionStorage once-flag) so a
   * hard refresh isn't needed; a second match falls through to the normal
   * report flow (prevents reload loops).
   */
  chunkLoad: {
    /** Patterns identifying stale-chunk / dynamic-import failures. */
    patterns: [
      /ChunkLoadError/i,
      /Loading chunk [\w-]+ failed/i,
      /Loading CSS chunk [\w-]+ failed/i,
      /Failed to fetch dynamically imported module/i,
      /error loading dynamically imported module/i,
    ],
    /** sessionStorage once-flag key (per browser session, private-mode safe). */
    reloadGuardKey: "along-chunk-reload-at",
    /** Status copy shown while the auto-reload is in flight. */
    recoveringCopy: "App update detected — refreshing to load the latest version…",
    /** Toast copy for the auto-reload attempt (best-effort). */
    toastMessage: "A newer version of Along is available — refreshing…",
  },
  /**
   * Prefill scaffolding for the bug-report description. `{summary}` is the
   * sanitized error capture; the hints invite the reporter to add their own
   * context above or below it without wiping the capture.
   */
  prefillHeader: "You can add your own details above or below the auto-filled summary — please keep the summary so our team has context.",
  prefillTitle: "Auto-filled error summary (from the app — keep it, and add your notes above or below):",
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
