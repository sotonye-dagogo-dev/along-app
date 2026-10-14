import { Clock, User } from "lucide-react";
import { BLOG_CONTENT_PROSE_CLASSES } from "@/app/lib/config/blog";
import { resolveBlogImageUrl } from "@/app/lib/utils/blogImages";
import type { ManagedBlogPost } from "@/app/lib/config/blogManagement";

function formatPostDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return raw;
  }
}

/**
 * BlogPostArticle — single source of truth for the blog reading view.
 * Rendered by BOTH the public `/blog/[slug]` page and the Studio live preview,
 * so the preview mirrors the published page by construction (cover, category,
 * reading-time, title, description, author/date, sanitized + interpolated body
 * with BLOG_CONTENT_PROSE_CLASSES). Server-compatible (no hooks) — the Studio
 * passes already-rendered HTML (`renderedHtml`), the public page computes it
 * server-side with the same pipeline.
 */
export default function BlogPostArticle({
  post,
  renderedHtml,
}: {
  post: Pick<ManagedBlogPost, "title" | "description" | "category" | "readingTime" | "author" | "date" | "image">;
  /** Sanitized + variable-interpolated article HTML (public pipeline output). */
  renderedHtml: string;
}) {
  const cover = resolveBlogImageUrl(post.image);
  return (
    <div>
      {/* Cover — resolved through the shared pipeline (fallback-safe). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={`Cover for ${post.title}`}
        className="w-full aspect-[16/9] object-cover rounded-xl border border-border bg-bg-elevated mb-6"
        loading="lazy"
      />
      <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
        <span className="px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary capitalize">
          {post.category}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {post.readingTime} min read
        </span>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">{post.title}</h1>
      {post.description ? (
        <p className="text-text-secondary text-sm mb-4">{post.description}</p>
      ) : null}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-8">
        <User size={12} />
        <span>{post.author}</span>
        <span className="mx-1">·</span>
        <span>{formatPostDate(post.date)}</span>
      </div>
      <div className={BLOG_CONTENT_PROSE_CLASSES} dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </div>
  );
}
