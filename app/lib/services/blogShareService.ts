/**
 * Blog share service (config-driven, zero app deps) — mirrors postShareService:
 * Web Share API → clipboard → legacy textarea. Never throws.
 * URL shape comes from BLOG_SHARE_CONFIG.postPath.
 */
import { BLOG_SHARE_CONFIG } from "@/app/lib/config/blogManagement";

export type BlogShareOutcome =
  | { ok: true; method: "web-share" | "clipboard" | "legacy-copy" }
  | { ok: false; reason: "unavailable" | "denied" | "failed" };

export function buildBlogUrl(slug: string, origin?: string): string {
  const safe = encodeURIComponent(String(slug ?? ""));
  const path = `${BLOG_SHARE_CONFIG.postPath}/${safe}`;
  if (origin && origin.length > 0) {
    const trimmed = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    return `${trimmed}${path}`;
  }
  return path;
}

export function resolveBlogShareOrigin(): string {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
  } catch {
    /* SSR — fall through */
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
    /* fall through */
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

export async function shareBlogLink(slug: string, title?: string): Promise<BlogShareOutcome> {
  try {
    const origin = resolveBlogShareOrigin();
    const url = buildBlogUrl(slug, origin || undefined);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: title || url, url });
        return { ok: true, method: "web-share" };
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: true, method: "web-share" };
      }
    }
    if (await copyViaClipboard(url)) return { ok: true, method: "clipboard" };
    if (copyViaLegacyTextarea(url)) return { ok: true, method: "legacy-copy" };
    return { ok: false, reason: canUseDom() ? "failed" : "unavailable" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
