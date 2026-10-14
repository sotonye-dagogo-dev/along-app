/**
 * Blog image-URL helpers — pure, client + server safe, never throws.
 *
 * Covers the full lifecycle the Studio needs:
 * - resolve: normalize a cover/image candidate into a safe renderable URL
 *   (Cloudinary https, site-relative `/…`, or absolute https pass through;
 *   anything else falls back to the configured default cover).
 * - extract: pull every inline `<img src>` out of stored/sanitized article HTML.
 * - collect: cover + inline set for a post (what to guard / what to purge).
 * - diff: removed-set between two collections (replacement + cleanup driver).
 *
 * URL handling mirrors `resolveOgImage` (metadata) so the Studio, the public
 * pages, and SEO agree on what counts as a valid cover. Cleanup callers reuse
 * `filterCleanableUrls`/`diffRemovedUrls` from cloudinaryUrls for the actual
 * destroy allowlist — this module only computes the logical sets.
 */
import {
  BLOG_MANAGEMENT_CONFIG,
} from "@/app/lib/config/blogManagement";

const ABSOLUTE_HTTP_RE = /^https?:\/\//i;

/** Safe cover/image URL or the configured default. Never throws. */
export function resolveBlogImageUrl(candidate: unknown): string {
  try {
    const fallback = BLOG_MANAGEMENT_CONFIG.defaultImage;
    if (typeof candidate !== "string") return fallback;
    const trimmed = candidate.trim().slice(0, 500);
    if (!trimmed) return fallback;
    // Never allow executable / data URIs into <img src> (sanitizer drops them
    // anyway, but the Studio preview + public page resolve first).
    if (/^\s*(javascript|data|vbscript|blob):/i.test(trimmed)) return fallback;
    if (trimmed.startsWith("/") || trimmed.startsWith("{{") || ABSOLUTE_HTTP_RE.test(trimmed)) {
      return trimmed;
    }
    return fallback;
  } catch {
    return BLOG_MANAGEMENT_CONFIG.defaultImage;
  }
}

/** True when the value resolves to a real (non-default) image. Never throws. */
export function hasCustomBlogImage(candidate: unknown): boolean {
  try {
    if (typeof candidate !== "string" || !candidate.trim()) return false;
    return resolveBlogImageUrl(candidate) !== BLOG_MANAGEMENT_CONFIG.defaultImage;
  } catch {
    return false;
  }
}

/**
 * Extract every inline `<img src="…">` URL from article HTML.
 * Returns resolved, deduped URLs (default cover excluded — it is not inline).
 * Never throws.
 */
export function extractBlogInlineImageUrls(html: unknown): string[] {
  try {
    if (typeof html !== "string" || !html) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    const re = /<img[^>]*\ssrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const raw = (m[1] ?? "").replace(/^["']|["']$/g, "").trim().slice(0, 500);
      if (!raw || /^\s*(javascript|data|vbscript|blob):/i.test(raw)) continue;
      const resolved = resolveBlogImageUrl(raw);
      if (resolved === BLOG_MANAGEMENT_CONFIG.defaultImage) continue;
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      out.push(resolved);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Full image set for a post: resolved cover (when custom) + inline URLs.
 * Used for cleanup diffing and live-post reference guards. Never throws.
 */
export function collectBlogPostImageUrls(post: { image?: unknown; content?: unknown } | null | undefined): string[] {
  try {
    if (!post || typeof post !== "object") return [];
    const out: string[] = [];
    const seen = new Set<string>();
    const coverRaw = (post as { image?: unknown }).image;
    if (hasCustomBlogImage(coverRaw)) {
      const cover = resolveBlogImageUrl(coverRaw);
      seen.add(cover);
      out.push(cover);
    }
    for (const u of extractBlogInlineImageUrls((post as { content?: unknown }).content)) {
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * URLs present in `before` but absent from `after` — the replacement/removal
 * set to purge best-effort after a successful save/delete. Order-stable,
 * deduped, capped (matches the cleanup endpoint cap). Never throws.
 */
export function diffRemovedBlogUrls(
  before: unknown,
  after: unknown,
  maxUrls = 20,
): string[] {
  try {
    const beforeList = Array.isArray(before)
      ? before.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      : [];
    const afterSet = new Set(
      Array.isArray(after) ? after.filter((u): u is string => typeof u === "string") : [],
    );
    const out: string[] = [];
    const seen = new Set<string>();
    for (const u of beforeList) {
      if (afterSet.has(u) || seen.has(u)) continue;
      seen.add(u);
      out.push(u);
      if (out.length >= maxUrls) break;
    }
    return out;
  } catch {
    return [];
  }
}
