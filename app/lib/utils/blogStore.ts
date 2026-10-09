/**
 * Blog store — SiteConfig-backed managed posts merged over filesystem MDX.
 * Public readers see published managed posts + filesystem seeds;
 * admin sees everything (drafts/archived included). All managed content is
 * sanitized on write (same allowlist pipeline as email templates) and
 * re-sanitized defensively on read — never throws.
 */
import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import { getAllPosts as getSeedPosts } from "@/app/lib/utils/blog";
import { sanitizeEmailHtml, stripTags } from "@/app/lib/utils/emailSanitize";
import {
  BLOG_MANAGEMENT_CONFIG,
  normalizeSlug,
  isBlogStatus,
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
    Number.isFinite(Number(p.readingTime)) && Number(p.readingTime) > 0
      ? Math.min(120, Math.max(1, Math.round(Number(p.readingTime))))
      : Math.max(1, Math.round(stripTags(rawContent).split(/\s+/).length / 200));
  return {
    slug,
    title,
    description: stripTags(String(p.description ?? "")).slice(0, BLOG_MANAGEMENT_CONFIG.maxDescription),
    date: String(p.date ?? "").trim() || new Date().toISOString().slice(0, 10),
    author: stripTags(String(p.author ?? BLOG_MANAGEMENT_CONFIG.defaultAuthor)).slice(0, 80) || BLOG_MANAGEMENT_CONFIG.defaultAuthor,
    category: stripTags(String(p.category ?? "updates")).slice(0, 40).toLowerCase() || "updates",
    image: String(p.image ?? BLOG_MANAGEMENT_CONFIG.defaultImage).slice(0, 500) || BLOG_MANAGEMENT_CONFIG.defaultImage,
    readingTime,
    content: sanitizeEmailHtml(rawContent, BLOG_MANAGEMENT_CONFIG.maxContent),
    status,
    updatedAt: String(p.updatedAt ?? "") || new Date().toISOString(),
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
