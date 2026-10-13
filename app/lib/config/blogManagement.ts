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

/**
 * Default (shipped) blog posts — hardcoded fallbacks mirroring the Email
 * Studio pattern. Stored DB rows win per-slug; these only backfill and power
 * "restore to default" rollback. Never edited at runtime.
 */
export interface DefaultBlogPost extends Omit<ManagedBlogPost, "status" | "updatedAt"> {
  status: BlogPostStatus;
}

export const DEFAULT_BLOG_POSTS: DefaultBlogPost[] = [
  {
    slug: "welcome-to-along",
    title: "Welcome to Along — Navigate Together",
    description: "Introducing Along, a social travel-intelligence platform for West African commuters.",
    date: "2026-06-01",
    author: "Along Team",
    category: "updates",
    image: "/og-image.png",
    readingTime: 3,
    content: "<h1>Welcome to Along</h1><p>Hi {{firstName||traveller}}, we're excited to introduce <strong>{{appName||Along}}</strong> — a community-powered platform for sharing, verifying, and discovering transport routes across West Africa.</p><p>Explore route tips, platform updates, and community stories on the <a href=\"{{appUrl||/}}/blog\">blog</a>.</p>",
    status: "published",
  },
  {
    slug: "routing-tips",
    title: "5 Routing Tips for Lagos Commuters",
    description: "Practical tips for faster, cheaper daily commutes in Lagos.",
    date: "2026-06-15",
    author: "Along Team",
    category: "tips",
    image: "/og-image.png",
    readingTime: 4,
    content: "<h1>5 Routing Tips</h1><p>Hi {{firstName||traveller}}, here are five field-tested tips to beat traffic, save fares, and verify routes with the {{appName||Along}} community.</p><ul><li>Leave 15 minutes earlier on bridge corridors</li><li>Compare fares before boarding</li><li>Verify routes with likes and comments</li><li>Share your own route to earn trust</li><li>Check the <a href=\"{{appUrl||/}}/explore\">explore map</a> before you go</li></ul>",
    status: "published",
  },
];

/**
 * Share config for blogs — mirrors POST_ACTIONS_CONFIG share fields so blog
 * share links stay in one place (path shape + labels + network templates).
 */
export const BLOG_SHARE_CONFIG = {
  postPath: "/blog",
  shareLabel: "Share",
  copyLinkLabel: "Copy link",
  shareTitleDefault: "Along blog post",
  copiedMessage: "Blog link copied to clipboard",
  copyError: "Couldn't copy the link. Please try again.",
  networks: [
    { id: "x", label: "X", href: (url: string, title: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
    { id: "facebook", label: "Facebook", href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { id: "whatsapp", label: "WhatsApp", href: (url: string, title: string) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  ] as { id: string; label: string; href: (url: string, title: string) => string }[],
} as const;

/**
 * Blog variable catalog — curated selects for the Studio insert-variable UI.
 * Every entry documents its fallback so unauthenticated/guest renders and
 * manual sends never leak `{{identifier}}` and never throw.
 */
export const BLOG_VARIABLE_CATALOG = [
  { name: "firstName", label: "First name", example: "Adaobi", fallback: "traveller", description: "Reader first name (guest when signed out)" },
  { name: "userName", label: "Username", example: "adaobi", fallback: "guest", description: "Reader username (guest when signed out)" },
  { name: "appName", label: "App name", example: "Along", fallback: "Along", description: "Platform display name" },
  { name: "appUrl", label: "App URL", example: "https://www.alongng.com", fallback: "/", description: "Base URL of the platform" },
  { name: "logoUrl", label: "Logo URL", example: "https://www.alongng.com/logo.svg", fallback: "/logo.svg", description: "Absolute logo URL" },
  { name: "title", label: "Post title", example: "Welcome to Along", fallback: "", description: "Current post title" },
  { name: "author", label: "Author", example: "Along Team", fallback: "Along Team", description: "Post author" },
  { name: "category", label: "Category", example: "updates", fallback: "updates", description: "Post category" },
  { name: "year", label: "Year", example: "2026", fallback: "2026", description: "Current year" },
] as const;

export function isDefaultBlogSlug(slug: string): boolean {
  return DEFAULT_BLOG_POSTS.some((p) => p.slug === normalizeSlug(slug));
}
