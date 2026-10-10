/**
 * Post share service (config-driven, zero app deps).
 * Single source of truth for "share this post" used by every post surface
 * (feed, search, post detail, profile tabs, bookmarks). Previously the share
 * logic lived only inside ProfilePostCard, so the Share icon on every other
 * surface silently did nothing.
 *
 * Strategy (graceful fallbacks, never throws):
 *  1. Web Share API (`navigator.share`) when available — native sheet.
 *  2. Clipboard (`navigator.clipboard.writeText`) — link copied.
 *  3. Legacy `textarea + execCommand("copy")` — older browsers.
 *
 * URL shape comes from POST_ACTIONS_CONFIG.postPath so deep links stay in
 * one place. Callers own auth-gating + toasts (see `usePostShare`).
 */

export type ShareOutcome =
  | { ok: true; method: "web-share" | "clipboard" | "legacy-copy" }
  | { ok: false; reason: "unavailable" | "denied" | "failed" };

export function buildPostUrl(postId: string, origin?: string): string {
  const safeId = encodeURIComponent(postId);
  if (origin && origin.length > 0) {
    const trimmed = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    return `${trimmed}/posts/${safeId}`;
  }
  return `/posts/${safeId}`;
}

export function resolveShareOrigin(): string {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
  } catch {
    /* SSR / non-DOM — fall through to relative URL */
  }
  return "";
}

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function copyViaClipboard(url: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  return false;
}

function copyViaLegacyTextarea(url: string): boolean {
  try {
    if (!canUseDom()) return false;
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(ta);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Share a post link. Never throws — always resolves to a ShareOutcome so
 * callers can toast accurately (success vs "couldn't copy").
 */
export async function sharePostLink(postId: string, title?: string): Promise<ShareOutcome> {
  try {
    const origin = resolveShareOrigin();
    const url = buildPostUrl(postId, origin || undefined);

    // Native sheet first (mobile + supported desktop). A user dismissing the
    // sheet rejects — treat as handled, not as an error.
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: title || url, url });
        return { ok: true, method: "web-share" };
      }
    } catch (err) {
      // AbortError = user closed the sheet — still "handled".
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: true, method: "web-share" };
      }
      /* fall through to clipboard */
    }

    if (await copyViaClipboard(url)) {
      return { ok: true, method: "clipboard" };
    }
    if (copyViaLegacyTextarea(url)) {
      return { ok: true, method: "legacy-copy" };
    }
    return { ok: false, reason: canUseDom() ? "failed" : "unavailable" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
