/**
 * Blog variable interpolation — `{{name||fallback}}` with safe defaults.
 * Mirrors the email render pipeline but targets sanitized blog HTML.
 * Never throws; missing vars render fallback (or ""), never `{{identifier}}`.
 * Unauthenticated readers see "guest"/"traveller" fallbacks for identity vars.
 */
import { parseVarToken, escapeHtmlValue } from "@/app/lib/utils/emailSanitize";

export interface BlogVarContext {
  firstName?: string | null;
  userName?: string | null;
  appName?: string;
  appUrl?: string;
  logoUrl?: string;
  title?: string;
  author?: string;
  category?: string;
  year?: string;
}

const GUEST_FALLBACKS: Record<string, string> = {
  firstName: "traveller",
  userName: "guest",
  appName: "Along",
  appUrl: "/",
  logoUrl: "/logo.svg",
  author: "Along Team",
  category: "updates",
  year: String(new Date().getFullYear()),
};

export function buildBlogVarContext(
  post?: { title?: string; author?: string; category?: string } | null,
  viewer?: { firstName?: string | null; userName?: string | null } | null,
  overrides?: Record<string, string>,
): Record<string, string> {
  try {
    const ctx: Record<string, string> = { ...GUEST_FALLBACKS };
    if (post?.title) ctx.title = String(post.title).slice(0, 200);
    if (post?.author) ctx.author = String(post.author).slice(0, 80);
    if (post?.category) ctx.category = String(post.category).slice(0, 40);
    const fn = String(viewer?.firstName ?? "").trim();
    const un = String(viewer?.userName ?? "").trim();
    if (fn) ctx.firstName = fn.slice(0, 80);
    if (un) ctx.userName = un.slice(0, 80);
    if (overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        if (/^\w+$/.test(k) && typeof v === "string" && v.trim()) {
          ctx[k] = v.slice(0, 500);
        }
      }
    }
    return ctx;
  } catch {
    return { ...GUEST_FALLBACKS };
  }
}

/**
 * Interpolate `{{vars}}` inside already-sanitized blog HTML. Values are
 * HTML-escaped (blog content is an HTML fragment). Never throws.
 */
export function renderBlogContent(html: string, vars: Record<string, string>): string {
  try {
    const merged = { ...GUEST_FALLBACKS, ...vars };
    return String(html ?? "").replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (m, inner: string) => {
      try {
        const parsed = parseVarToken(inner);
        if (!parsed) return "";
        const raw = merged[parsed.name];
        let s = raw == null ? "" : String(raw);
        if (!s.trim() && parsed.fallback) s = parsed.fallback;
        if (!s) {
          // Catalog-level guest fallback before giving up.
          s = GUEST_FALLBACKS[parsed.name] ?? "";
        }
        if (!s) return "";
        return escapeHtmlValue(s);
      } catch {
        return "";
      }
    });
  } catch {
    return String(html ?? "");
  }
}
