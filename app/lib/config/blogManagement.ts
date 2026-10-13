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
  /**
   * Admin featured flag. Featured published posts sort first in the
   * featured tape (`pickFeaturedBlogs`) and the /blog hero slot.
   * Optional + additive so existing stored rows read as unfeatured.
   */
  featured?: boolean;
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
    title: "Welcome to Along: Navigate Together",
    description: "Meet Along, a social travel guide for West African commuters. Learn what it does and how to start.",
    date: "2026-06-01",
    author: "Along Team",
    category: "updates",
    image: "/og-image.png",
    readingTime: 3,
    content: "<h1>Welcome to Along</h1><p>Hi {{firstName||traveller}}. Welcome to <strong>{{appName||Along}}</strong>. Along is a community platform for transport routes across West Africa.</p><p>Commuters share routes. Commuters verify routes. You get clear facts before you travel.</p><h2>What you can do</h2><ul><li>Share a route you know well</li><li>Find routes on the <a href=\"{{appUrl||/}}/explore\">explore map</a></li><li>Like and comment to verify a route</li><li>Ask the community for a route you need</li></ul><p>Start with your first route today. Read more tips on the <a href=\"{{appUrl||/}}/blog\">blog</a>.</p>",
    status: "published",
  },
  {
    slug: "routing-tips",
    title: "5 Routing Tips for Lagos Commuters",
    description: "Five simple tips for faster and cheaper daily trips in Lagos.",
    date: "2026-06-15",
    author: "Along Team",
    category: "tips",
    image: "/og-image.png",
    readingTime: 4,
    content: "<h1>5 Routing Tips</h1><p>Hi {{firstName||traveller}}. These five tips help you beat traffic and save money in Lagos.</p><ul><li>Leave 15 minutes early on bridge routes</li><li>Compare fares before you board</li><li>Check likes and comments before you trust a route</li><li>Share your own route to help others</li><li>Check the <a href=\"{{appUrl||/}}/explore\">explore map</a> before you go</li></ul><h2>One more tip</h2><p>Save a draft of your route first. Review it. Then share it. Good drafts get more likes.</p>",
    status: "published",
  },
  {
    slug: "know-your-fare",
    title: "Know Your Fare Before You Board",
    description: "How to read fare facts on routes and avoid overpaying on your trip.",
    date: "2026-07-01",
    author: "Along Team",
    category: "routes",
    image: "/og-image.png",
    readingTime: 3,
    content: "<h1>Know Your Fare Before You Board</h1><p>Hi {{firstName||traveller}}. Every route on {{appName||Along}} can show fare facts for each step. Read them before you travel.</p><h2>How to read fares</h2><ul><li>Open the route and read each step in order</li><li>Note the vehicle type for each step</li><li>Add the step fares to get the full trip cost</li><li>Note that the last step is the destination, so it shows no fare</li></ul><h2>If a fare looks wrong</h2><p>Comment on the route. Tell the poster the correct fare. The community will verify it.</p>",
    status: "published",
  },
  {
    slug: "travel-safe",
    title: "Travel Safe: 6 Rules for Daily Trips",
    description: "Six simple safety rules for bus, taxi, keke, bike, and trek trips.",
    date: "2026-07-15",
    author: "Along Team",
    category: "tips",
    image: "/og-image.png",
    readingTime: 4,
    content: "<h1>Travel Safe</h1><p>Hi {{firstName||traveller}}. Safety comes first on every trip. Follow these six rules.</p><ul><li>Share your trip plan with a friend</li><li>Board at known parks and stops</li><li>Keep your bag closed and in front of you</li><li>Avoid late night trips on unknown routes</li><li>Trust verified routes with high trust scores</li><li>Report unsafe routes with the Report button</li></ul><h2>See something wrong</h2><p>Use the Report option on the post. Our team reviews every report. Your name stays private.</p>",
    status: "published",
  },
  {
    slug: "how-maps-work",
    title: "How Maps Work on Along",
    description: "Route lines, numbered stops, your location dot, and how to move the map on your phone.",
    date: "2026-08-01",
    author: "Along Team",
    category: "updates",
    image: "/og-image.png",
    readingTime: 4,
    content: "<h1>How Maps Work on Along</h1><p>Hi {{firstName||traveller}}. Maps on {{appName||Along}} work without an API key. They show your route clearly.</p><h2>What you see</h2><ul><li>The line traces your full route from start to destination</li><li>Numbered dots mark each stop in order</li><li>A blue dot with a ring marks your own location</li><li>Your dot moves with you when you grant location access</li></ul><h2>How to use the map on your phone</h2><ul><li>Drag with one finger to move the map</li><li>Pinch with two fingers to zoom in and out</li><li>Tap a numbered dot to see that stop</li><li>Start live navigation for turn by turn guidance</li></ul><p>Find a route on the <a href=\"{{appUrl||/}}/explore\">explore map</a> and try it today.</p>",
    status: "published",
  },
  {
    slug: "trust-and-community",
    title: "Trust Scores: How the Community Verifies Routes",
    description: "What trust scores mean, what changes them, and how you can build trust.",
    date: "2026-08-15",
    author: "Along Team",
    category: "community",
    image: "/og-image.png",
    readingTime: 4,
    content: "<h1>Trust Scores</h1><p>Hi {{firstName||traveller}}. Each route has a trust score. The score shows how much the community trusts the route.</p><h2>What changes a score</h2><ul><li>Likes and bookmarks raise the score</li><li>Helpful comments raise the score</li><li>Reports lower the score until review ends</li><li>Full facts help: clear steps, photos, and fair fares</li></ul><h2>How to build trust</h2><p>Share accurate routes. Add clear facts for each step. Respond to comments. Your score grows with each good post.</p><p>Thank you for keeping {{appName||Along}} honest. Read more stories on the <a href=\"{{appUrl||/}}/blog\">blog</a>.</p>",
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
