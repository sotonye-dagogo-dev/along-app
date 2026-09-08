/**
 * Safe fetch utilities — prevents "Unexpected token '<' / 'An error o...' is not valid JSON"
 * when the server returns HTML error pages (e.g. 504 Gateway Timeout) instead of JSON.
 * Always returns a sanitized, user-friendly error message.
 */

export interface SafeJsonResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

const FRIENDLY_MESSAGES: Record<number, string> = {
  400: "Please check your input and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  408: "The request timed out. Please try again.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again in a moment.",
  502: "Service temporarily unavailable. Please try again soon.",
  503: "Service temporarily unavailable. Please try again soon.",
  504: "The server took too long to respond. Please try again.",
};

function friendlyMessage(status: number, serverMessage?: string): string {
  // Prefer server message if it's a clean short string, otherwise use mapping
  if (serverMessage && typeof serverMessage === "string") {
    const trimmed = serverMessage.trim();
    // Reject HTML / too long / starts with "<" or "An error"
    if (
      trimmed.length > 0 &&
      trimmed.length < 200 &&
      !trimmed.startsWith("<") &&
      !trimmed.startsWith("<!") &&
      !trimmed.toLowerCase().startsWith("an error occurred")
    ) {
      return trimmed;
    }
  }
  return FRIENDLY_MESSAGES[status] ?? FRIENDLY_MESSAGES[500];
}

export async function safeJsonParse<T = unknown>(res: Response): Promise<{ data: T | null; error: string | null }> {
  const text = await res.text();
  if (!text) return { data: null, error: null };
  try {
    const json = JSON.parse(text) as T & { error?: string; message?: string };
    // Extract error field if present
    const serverError =
      (json as unknown as Record<string, unknown>).error ??
      (json as unknown as Record<string, unknown>).message ??
      null;
    return {
      data: json,
      error: typeof serverError === "string" ? serverError : null,
    };
  } catch {
    // Response was not JSON — likely an HTML error page (Vercel 504, etc.)
    // Never surface raw HTML / "Unexpected token" to user
    const statusMsg = friendlyMessage(res.status);
    return { data: null, error: statusMsg };
  }
}

export async function safeFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  try {
    const res = await fetch(input, init);
    const { data, error } = await safeJsonParse<T>(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: friendlyMessage(res.status, error ?? undefined),
      };
    }
    return { ok: true, status: res.status, data, error: null };
  } catch (err) {
    // Network failure / abort etc.
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Request was cancelled."
        : "Network error. Please check your connection and try again.";
    return { ok: false, status: 0, data: null, error: message };
  }
}

/**
 * Throw-friendly helper for `fetch` call sites that expect to `await res.json()`.
 * Usage: const data = await parseOrThrow(res);
 */
export async function parseOrThrow<T>(res: Response): Promise<T> {
  const { data, error } = await safeJsonParse<T>(res);
  if (!res.ok) {
    throw new Error(friendlyMessage(res.status, error ?? undefined));
  }
  if (data === null) {
    throw new Error(friendlyMessage(res.status));
  }
  return data;
}

export function getFriendlyErrorMessage(status: number, fallback?: string): string {
  return friendlyMessage(status, fallback);
}
