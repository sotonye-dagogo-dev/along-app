/**
 * Client-error reporting. Sends a sanitized capture (message, stack, route,
 * digest — never raw PII/secrets) to `POST /api/bug-reports` so error
 * boundaries can truthfully say the team was notified.
 *
 * Never throws — reporting is best-effort and must not break error UI.
 */

import {
  ERROR_REPORTING_CONFIG,
  ERROR_SENSITIVE_PATTERNS,
} from "@/app/lib/config/errorReporting";

export interface ClientErrorContext {
  digest?: string;
  /** Route pathname at the time of the crash (no query string — may hold tokens). */
  path?: string;
}

/** Redact emails, tokens, passwords and cookie secrets from free text. */
export function sanitizeErrorText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") {
    input = input == null ? "" : String(input);
  }
  let out = input as string;
  for (const pattern of ERROR_SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "[redacted]");
  }
  if (out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

function currentPath(fallback?: string): string {
  if (fallback && fallback.length > 0) return fallback.slice(0, 120);
  try {
    if (typeof window !== "undefined" && window.location?.pathname) {
      return window.location.pathname.slice(0, 120);
    }
  } catch {
    // ignore — fall through to fallback label
  }
  return "unknown route";
}

export interface ErrorReportResult {
  reported: boolean;
}

/**
 * Prefilled bug-report draft captured from a client error. Everything is
 * sanitized (emails/tokens/passwords redacted, path-only, capped) so the
 * prefill is safe to render in a form, put in a URL, and file as-is. Never
 * throws — failures yield an empty draft rather than breaking error UI.
 */
export interface ErrorReportPrefill {
  title: string;
  description: string;
}

export function buildErrorReportPrefill(
  error: unknown,
  context?: ClientErrorContext,
): ErrorReportPrefill {
  try {
    const name =
      error instanceof Error && error.name ? error.name : "Error";
    const rawMessage =
      error instanceof Error ? error.message : "Unknown client error";
    const rawStack = error instanceof Error ? (error.stack ?? "") : "";
    const path = currentPath(context?.path);
    const title = sanitizeErrorText(
      ERROR_REPORTING_CONFIG.titleTemplate
        .replace("{name}", name)
        .replace("{path}", path),
      ERROR_REPORTING_CONFIG.maxPrefillTitleLength,
    );
    const summaryLines = [
      sanitizeErrorText(
        rawMessage || "No message",
        ERROR_REPORTING_CONFIG.maxMessageLength,
      ),
      "",
      `Route: ${path}`,
      ...(context?.digest ? [`Digest: ${context.digest}`] : []),
      `When: ${new Date().toISOString()}`,
      ...(typeof navigator !== "undefined" && navigator.userAgent
        ? [`Agent: ${navigator.userAgent.slice(0, 200)}`]
        : []),
      "",
      "Stack (sanitized):",
      sanitizeErrorText(rawStack || "n/a", ERROR_REPORTING_CONFIG.maxStackLength),
    ];
    const description = sanitizeErrorText(
      [
        ERROR_REPORTING_CONFIG.prefillHeader,
        "",
        ERROR_REPORTING_CONFIG.prefillTitle,
        ...summaryLines,
      ].join("\n"),
      ERROR_REPORTING_CONFIG.maxPrefillDescriptionLength,
    );
    return {
      title: title.length > 0 ? title : "Client error",
      description,
    };
  } catch {
    return { title: "Client error", description: "" };
  }
}

/**
 * Bug-report page URL carrying the sanitized prefill as query params. The
 * report-bug page reads `?title=` + `?description=` into its form's
 * initial values (editable — the reporter adds context above/below).
 */
export function buildBugReportUrl(prefill: ErrorReportPrefill): string {
  try {
    const params = new URLSearchParams();
    if (prefill?.title) params.set("title", prefill.title);
    if (prefill?.description) params.set("description", prefill.description);
    const query = params.toString();
    return query
      ? `${ERROR_REPORTING_CONFIG.bugReportPath}?${query}`
      : ERROR_REPORTING_CONFIG.bugReportPath;
  } catch {
    return ERROR_REPORTING_CONFIG.bugReportPath;
  }
}

/**
 * File the error as a BugReport. Resolves `{ reported: true }` only when
 * the API persisted the row (HTTP 2xx); any failure resolves
 * `{ reported: false }` so callers render honest copy.
 */
export async function reportClientError(
  error: unknown,
  context?: ClientErrorContext,
): Promise<ErrorReportResult> {
  try {
    const name =
      error instanceof Error && error.name ? error.name : "Error";
    const rawMessage =
      error instanceof Error ? error.message : "Unknown client error";
    const rawStack = error instanceof Error ? (error.stack ?? "") : "";

    const path = currentPath(context?.path);
    const title = sanitizeErrorText(
      ERROR_REPORTING_CONFIG.titleTemplate
        .replace("{name}", name)
        .replace("{path}", path),
      ERROR_REPORTING_CONFIG.maxTitleLength,
    );
    const lines = [
      sanitizeErrorText(
        rawMessage || "No message",
        ERROR_REPORTING_CONFIG.maxMessageLength,
      ),
      "",
      `Route: ${path}`,
      ...(context?.digest ? [`Digest: ${context.digest}`] : []),
      `When: ${new Date().toISOString()}`,
      ...(typeof navigator !== "undefined" && navigator.userAgent
        ? [`Agent: ${navigator.userAgent.slice(0, 200)}`]
        : []),
      "",
      "Stack (sanitized):",
      sanitizeErrorText(rawStack || "n/a", ERROR_REPORTING_CONFIG.maxStackLength),
    ];
    const description = sanitizeErrorText(
      lines.join("\n"),
      ERROR_REPORTING_CONFIG.maxDescriptionLength,
    );

    const res = await fetch(ERROR_REPORTING_CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.length > 0 ? title : "Client error",
        category: ERROR_REPORTING_CONFIG.category,
        description,
        metadata: {
          source: "error-boundary",
          digest: context?.digest ?? null,
          path,
        },
      }),
    });
    return { reported: res.ok };
  } catch {
    return { reported: false };
  }
}
