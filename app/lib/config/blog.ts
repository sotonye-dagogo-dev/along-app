export interface BlogCategory {
  id: string;
  label: string;
  description: string;
}

export interface BlogLayoutConfig {
  postsPerPage: number;
  featuredCount: number;
}

export const DEFAULT_BLOG_CATEGORIES: BlogCategory[] = [
  { id: "all", label: "All Posts", description: "Every blog post" },
  { id: "tips", label: "Travel Tips", description: "Commuting advice and best practices" },
  { id: "updates", label: "Platform Updates", description: "New features and improvements" },
  { id: "community", label: "Community", description: "Stories from the Along community" },
  { id: "routes", label: "Route Guides", description: "Detailed route breakdowns and guides" },
];

export const BLOG_LAYOUT_CONFIG: BlogLayoutConfig = {
  postsPerPage: 12,
  featuredCount: 1,
};

/**
 * Single source of truth for article body styling (public post page + admin
 * Studio live preview). Body copy (paragraphs, list items, strong) uses the
 * `text-primary` design token per design-system.md (body text #1A1A1A light /
 * #F0F0F0 dark) — never `text-secondary`/`text-muted`, which are reserved for
 * labels, captions, and meta. Blockquotes stay secondary (supporting voice);
 * links stay primary; code keeps the elevated-surface treatment. The tokens
 * already flip under `.dark`, so no `dark:prose-invert` is needed.
 */
export const BLOG_CONTENT_PROSE_CLASSES =
  "prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-primary prose-p:leading-relaxed prose-li:text-text-primary prose-strong:text-text-primary prose-a:text-primary prose-blockquote:text-text-secondary prose-blockquote:border-border prose-code:text-text-primary prose-code:bg-bg-elevated prose-code:px-1 prose-code:rounded" as const;
