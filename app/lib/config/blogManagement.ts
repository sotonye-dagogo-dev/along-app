/**
 * Blog management config — mirrors the Email Studio shape so blog admin
 * feels familiar: drafts → published → archived lifecycle, visual builder
 * blocks for non-HTML admins, config-driven statuses/categories.
 * Storage is SiteConfig-backed (`blogPosts` key) merged over the
 * filesystem MDX seeds — no migration needed, non-breaking.
 */

export const BLOG_MANAGEMENT_CONFIG = {
  /** SiteConfig key backing the admin-managed posts. */
  storeKey: "blogPosts",
  statuses: ["draft", "published", "archived"] as const,
  defaultStatus: "published" as const,
  defaultAuthor: "Along Team",
  defaultImage: "/og-image.png",
  slugPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  maxTitle: 140,
  maxDescription: 300,
  maxContent: 100000,
} as const;

export type BlogPostStatus = (typeof BLOG_MANAGEMENT_CONFIG.statuses)[number];

export interface ManagedBlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  image: string;
  readingTime: number;
  /** Sanitized HTML fragment (visual-builder output). */
  content: string;
  status: BlogPostStatus;
  updatedAt: string;
  /** True when seeded from filesystem MDX (read-only in admin). */
  readonly?: boolean;
}

export function isBlogStatus(v: unknown): v is BlogPostStatus {
  return (
    (BLOG_MANAGEMENT_CONFIG.statuses as readonly string[]).includes(
      String(v ?? ""),
    )
  );
}

export function normalizeSlug(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
