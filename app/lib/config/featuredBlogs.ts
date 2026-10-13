/**
 * Featured blogs config: one source of truth for the featured blogs
 * carousel shown on the landing page, the about page (after reviews), and
 * the invite page (after the leaderboard). Copy uses short plain sentences
 * (ASD-STE100 style). No emdashes. Never throws.
 */

export interface FeaturedBlogsConfig {
  /** Max posts shown in the tape. */
  maxItems: number;
  /**
   * When true, admin-flagged posts (`featured: true`) sort before
   * unflagged ones; newest-first still orders within each group.
   */
  preferFeatured: boolean;
  /** Section heading on each surface. */
  sectionTitle: string;
  /** Section subheading on each surface. */
  sectionSubtitle: string;
  /** Per-card CTA that opens the post. */
  readPostLabel: string;
  /** Section CTA that opens the full blog list. */
  viewAllLabel: string;
  /** Autoplay loop length for the tape (seconds). */
  carouselDurationSec: number;
  /** Card width classes (responsive, fixed per breakpoint). */
  cardWidthClass: string;
  /** Shown when no published posts exist. */
  emptyTitle: string;
  emptyDescription: string;
}

export const FEATURED_BLOGS_CONFIG: FeaturedBlogsConfig = {
  maxItems: 6,
  preferFeatured: true,
  sectionTitle: "From the Blog",
  sectionSubtitle: "Route tips, platform news, and community stories.",
  readPostLabel: "Read post",
  viewAllLabel: "View all posts",
  carouselDurationSec: 45,
  cardWidthClass: "w-[260px] sm:w-[300px]",
  emptyTitle: "No featured posts yet",
  emptyDescription: "New stories will show here. Check back soon.",
};

export interface FeaturedBlogItem {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  image: string;
  readingTime: number;
  /** Admin featured flag (see ManagedBlogPost.featured). Optional so
   *  older API payloads without the field still sort newest-first. */
  featured?: boolean;
}

/** Featured first (when configured), then newest first, capped at maxItems. Pure and never throws. */
export function pickFeaturedBlogs(
  posts: FeaturedBlogItem[],
  maxItems = FEATURED_BLOGS_CONFIG.maxItems,
): FeaturedBlogItem[] {
  try {
    const list = Array.isArray(posts) ? [...posts] : [];
    list.sort((a, b) => {
      if (FEATURED_BLOGS_CONFIG.preferFeatured) {
        const fa = (a as { featured?: unknown }).featured === true ? 0 : 1;
        const fb = (b as { featured?: unknown }).featured === true ? 0 : 1;
        if (fa !== fb) return fa - fb;
      }
      const ta = new Date(a?.date ?? "").getTime();
      const tb = new Date(b?.date ?? "").getTime();
      const sa = Number.isNaN(ta) ? 0 : ta;
      const sb = Number.isNaN(tb) ? 0 : tb;
      return sb - sa;
    });
    const cap = Math.min(20, Math.max(1, Math.floor(maxItems) || FEATURED_BLOGS_CONFIG.maxItems));
    return list.slice(0, cap);
  } catch {
    return [];
  }
}

/** Path to a blog post. Pure and never throws. */
export function featuredBlogHref(slug: unknown): string {
  const clean = String(slug ?? "").trim().slice(0, 120);
  return clean ? `/blog/${encodeURIComponent(clean)}` : "/blog";
}
