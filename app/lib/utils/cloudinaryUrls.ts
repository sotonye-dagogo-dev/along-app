/**
 * Pure Cloudinary URL helpers — client + server safe (no SDK import).
 * Post.images stores only `secure_url` strings (no public_id column, by
 * design non-breaking), so public_ids are derived by parsing at cleanup time.
 */

const CLOUDINARY_HOST_RE = /(^|\.)cloudinary\.com$/i;

/** True when the URL points at Cloudinary (http/https only). */
export function isCloudinaryUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.trim().length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return CLOUDINARY_HOST_RE.test(parsed.hostname.toLowerCase());
}

/**
 * Derive the destroyable public_id from a Cloudinary delivery URL.
 * Handles `/upload/` (+ optional version + optional transformation
 * segments are NOT in stored secure_urls, but tolerated) and strips the
 * file extension + query string.
 *
 * Examples:
 *  https://res.cloudinary.com/demo/image/upload/v123/along/posts/abc.jpg
 *    → "along/posts/abc"
 *  https://res.cloudinary.com/demo/image/upload/along/posts/abc.webp?x=1
 *    → "along/posts/abc"
 *
 * Returns null when the URL is not a parseable Cloudinary image URL.
 */
export function extractPublicId(raw: unknown): string | null {
  if (!isCloudinaryUrl(raw)) return null;
  try {
    const parsed = new URL((raw as string).trim());
    const marker = "/upload/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;
    let tail = parsed.pathname.slice(idx + marker.length).replace(/^\/+/, "");
    if (!tail) return null;
    // Strip version segment (v123456/).
    tail = tail.replace(/^v\d+\//, "");
    // Strip extension from the last segment only.
    const lastSlash = tail.lastIndexOf("/");
    const head = lastSlash >= 0 ? tail.slice(0, lastSlash + 1) : "";
    let last = lastSlash >= 0 ? tail.slice(lastSlash + 1) : tail;
    const dot = last.lastIndexOf(".");
    if (dot > 0) last = last.slice(0, dot);
    if (!last) return null;
    const publicId = `${head}${last}`.replace(/^\/+|\/+$/g, "");
    if (!publicId || publicId.includes("..")) return null;
    return decodeURIComponent(publicId);
  } catch {
    return null;
  }
}

/** True when the public_id lives under an allowlisted folder prefix. */
export function isAllowedPublicId(
  publicId: string,
  allowedPrefixes: string[]
): boolean {
  const norm = publicId.replace(/^\/+|\/+$/g, "");
  return allowedPrefixes.some(
    (p) => norm === p || norm.startsWith(`${p.replace(/^\/+|\/+$/g, "")}/`)
  );
}

/** Keep only destroyable Cloudinary URLs (host + folder allowlist). */
export function filterCleanableUrls(
  urls: unknown,
  allowedPrefixes: string[]
): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const publicId = extractPublicId(u);
    if (!publicId) continue;
    if (!isAllowedPublicId(publicId, allowedPrefixes)) continue;
    out.push(u);
  }
  return [...new Set(out)];
}

/** URLs present in `before` but absent from `after` (edit-diff). */
export function diffRemovedUrls(before: unknown, after: unknown): string[] {
  if (!Array.isArray(before)) return [];
  const afterSet = new Set(Array.isArray(after) ? after.filter((u) => typeof u === "string") : []);
  return [...new Set(before.filter((u): u is string => typeof u === "string" && !afterSet.has(u)))];
}
