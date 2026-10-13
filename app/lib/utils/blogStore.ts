/**
 * Blog store — SiteConfig-backed managed posts merged over filesystem MDX.
 * Public readers see published managed posts + filesystem seeds;
 * admin sees everything (drafts/archived included). All managed content is
 * sanitized on write (blog article pipeline: allowlist + inline-style strip
 * so prose classes apply) and re-sanitized defensively on read — never throws.
 */
import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import { getAllPosts as getSeedPosts } from "@/app/lib/utils/blog";
import { sanitizeBlogHtml, stripTags } from "@/app/lib/utils/emailSanitize";
import {
  BLOG_MANAGEMENT_CONFIG,
  DEFAULT_BLOG_POSTS,
  normalizeSlug,
  isBlogStatus,
  normalizeReadingTime,
  estimateReadingTime,
} from "@/app/lib/config/blogManagement";
import type { ManagedBlogPost } from "@/app/lib/config/blogManagement";

export type { ManagedBlogPost };

function sanitizePost(p: Partial<ManagedBlogPost>): ManagedBlogPost | null {
  const slug = normalizeSlug(p.slug ?? "");
  if (!slug || !BLOG_MANAGEMENT_CONFIG.slugPattern.test(slug)) return null;
  const title = stripTags(String(p.title ?? "")).slice(0, BLOG_MANAGEMENT_CONFIG.maxTitle);
  if (!title) return null;
  const status = isBlogStatus(p.status) ? p.status : BLOG_MANAGEMENT_CONFIG.defaultStatus;
  const rawContent = String(p.content ?? "").slice(0, BLOG_MANAGEMENT_CONFIG.maxContent);
  if (!rawContent.trim()) return null;
  const readingTime =
    normalizeReadingTime(p.readingTime) ?? estimateReadingTime(stripTags(rawContent));
  return {
    slug,
    title,
    description: stripTags(String(p.description ?? "")).slice(0, BLOG_MANAGEMENT_CONFIG.maxDescription),
    date: String(p.date ?? "").trim() || new Date().toISOString().slice(0, 10),
    author: stripTags(String(p.author ?? BLOG_MANAGEMENT_CONFIG.defaultAuthor)).slice(0, 80) || BLOG_MANAGEMENT_CONFIG.defaultAuthor,
    category: stripTags(String(p.category ?? "updates")).slice(0, 40).toLowerCase() || "updates",
    image: String(p.image ?? BLOG_MANAGEMENT_CONFIG.defaultImage).slice(0, 500) || BLOG_MANAGEMENT_CONFIG.defaultImage,
    readingTime,
    content: sanitizeBlogHtml(rawContent, BLOG_MANAGEMENT_CONFIG.maxContent),
    status,
    updatedAt: String(p.updatedAt ?? "") || new Date().toISOString(),
    featured: (p as { featured?: unknown }).featured === true,
  };
}

export async function getManagedPosts(): Promise<ManagedBlogPost[]> {
  try {
    const stored = await getSiteConfig<ManagedBlogPost[]>(BLOG_MANAGEMENT_CONFIG.storeKey, []);
    if (!Array.isArray(stored)) return [];
    return stored
      .map((p) => sanitizePost(p))
      .filter((p): p is ManagedBlogPost => p !== null);
  } catch {
    return [];
  }
}

/**
 * Hardcoded default posts (config-driven fallbacks). Returned sanitized and
 * never throws — powers the admin "restore to default" rollback.
 */
export function getDefaultBlogPosts(): ManagedBlogPost[] {
  try {
    const now = new Date().toISOString();
    return DEFAULT_BLOG_POSTS.map((d) => ({
      slug: d.slug,
      title: d.title,
      description: d.description,
      date: d.date,
      author: d.author,
      category: d.category,
      image: d.image,
      readingTime: d.readingTime,
      content: d.content,
      status: d.status,
      updatedAt: now,
      featured: (d as { featured?: unknown }).featured === true,
    }));
  } catch {
    return [];
  }
}

/**
 * Merge hardcoded defaults UNDER stored rows (stored wins per-slug, new
 * defaults backfill) — same contract as mergeEmailTemplatesWithDefaults so
 * config updates never overwrite DB-saved admin edits.
 */
export function mergeBlogPostsWithDefaults(stored: ManagedBlogPost[]): ManagedBlogPost[] {
  try {
    const bySlug = new Map((Array.isArray(stored) ? stored : []).map((p) => [p.slug, p]));
    for (const d of getDefaultBlogPosts()) {
      if (!bySlug.has(d.slug)) bySlug.set(d.slug, d);
    }
    return [...bySlug.values()];
  } catch {
    return Array.isArray(stored) ? stored : [];
  }
}

/** Public feed: published managed posts first, then filesystem seeds. */
export async function getPublicBlogPosts(): Promise<ManagedBlogPost[]> {
  const [managed, seeds] = await Promise.all([
    getManagedPosts(),
    (async () => {
      try {
        return getSeedPosts();
      } catch {
        return [];
      }
    })(),
  ]);
  const managedSlugs = new Set(managed.map((m) => m.slug));
  const seedMapped: ManagedBlogPost[] = seeds
    .filter((s) => !managedSlugs.has(s.slug))
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      description: s.description,
      date: s.date,
      author: s.author,
      category: s.category,
      image: s.image,
      readingTime: s.readingTime,
      content: s.content,
      status: "published" as const,
      updatedAt: s.date,
      readonly: true,
      featured: false,
    }));
  return [...managed.filter((m) => m.status === "published"), ...seedMapped].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function getPublicPostBySlug(slug: string): Promise<ManagedBlogPost | null> {
  const posts = await getPublicBlogPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export { sanitizePost as sanitizeBlogPost, normalizeSlug };
