"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { EndlessCarousel } from "@/app/components/features/suggestions/EndlessCarousel";
import {
  FEATURED_BLOGS_CONFIG,
  pickFeaturedBlogs,
  featuredBlogHref,
  type FeaturedBlogItem,
} from "@/app/lib/config";
import { useTranslation } from "@/app/providers/I18nProvider";
import { resolveBlogImageUrl } from "@/app/lib/utils/blogImages";

interface Props {
  /** Server-fetched posts (landing page). When set, no client fetch runs. */
  initialPosts?: FeaturedBlogItem[];
  /** Max posts in the tape. Defaults from config. */
  limit?: number;
  /** Compact spacing for tight pages (invite). */
  compact?: boolean;
}

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    // Fixed UTC so the server-rendered text and every client timezone agree
    // (hydration #418 — locale/timezone-dependent text nodes).
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

function BlogCard({ post, readLabel }: { post: FeaturedBlogItem; readLabel: string }) {
  return (
    <Link
      href={featuredBlogHref(post.slug)}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-bg-card transition-all duration-200 hover:shadow-md ${FEATURED_BLOGS_CONFIG.cardWidthClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveBlogImageUrl(post.image)}
        alt={`Cover for ${post.title}`}
        className="h-28 w-full object-cover bg-bg-elevated"
        loading="lazy"
      />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="w-fit rounded-full bg-bg-elevated px-2 py-0.5 text-[11px] font-medium capitalize text-text-secondary">
            {post.category}
          </span>
          {post.featured === true && (
            <span className="w-fit rounded-full bg-primary-muted px-2 py-0.5 text-[11px] font-semibold text-primary">
              Featured
            </span>
          )}
        </span>
        <span className="text-sm font-semibold leading-snug text-text-primary group-hover:text-primary">
          {post.title}
        </span>
        <span className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
          {post.description}
        </span>
        <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-[11px] text-text-muted">
          <span>{formatDate(post.date)}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            {readLabel} <ArrowRight size={12} />
          </span>
        </span>
      </div>
    </Link>
  );
}

/**
 * Featured blogs tape. One reusable section for landing, about, and invite.
 * Copy is dictionary-driven with config fallbacks (never raw keys offline).
 * Renders nothing when no published posts exist (empty state kept minimal so
 * host pages control their own layout).
 */
export function FeaturedBlogsSection({ initialPosts, limit, compact = false }: Props) {
  const { tf } = useTranslation();
  const [posts, setPosts] = useState<FeaturedBlogItem[] | null>(initialPosts ?? null);

  useEffect(() => {
    if (initialPosts) return;
    let cancelled = false;
    const cap = limit ?? FEATURED_BLOGS_CONFIG.maxItems;
    fetch(`/api/blog?limit=${cap}`)
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => {
        if (!cancelled) setPosts(pickFeaturedBlogs(Array.isArray(data.posts) ? data.posts : [], cap));
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [initialPosts, limit]);

  const items = pickFeaturedBlogs(posts ?? [], limit ?? FEATURED_BLOGS_CONFIG.maxItems);
  if (posts !== null && items.length === 0) return null;

  const title = tf("blog.featured.title", FEATURED_BLOGS_CONFIG.sectionTitle);
  const subtitle = tf("blog.featured.subtitle", FEATURED_BLOGS_CONFIG.sectionSubtitle);
  const readLabel = tf("blog.featured.read", FEATURED_BLOGS_CONFIG.readPostLabel);
  const viewAllLabel = tf("blog.featured.viewAll", FEATURED_BLOGS_CONFIG.viewAllLabel);

  return (
    <section aria-label={title} className={`w-full min-w-0 max-w-full overflow-x-clip ${compact ? "py-2" : "py-6 sm:py-8"}`}>
      <div className="mb-4 flex min-w-0 items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{title}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
            <Clock size={13} aria-hidden /> {subtitle}
          </p>
        </div>
        <Link
          href="/blog"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary no-underline hover:underline"
        >
          {viewAllLabel} <ArrowRight size={13} />
        </Link>
      </div>
      {posts === null ? (
        <div className="flex w-full min-w-0 max-w-full gap-4 overflow-hidden" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-[240px] shrink-0 animate-pulse rounded-xl bg-bg-card/60 ${FEATURED_BLOGS_CONFIG.cardWidthClass}`} />
          ))}
        </div>
      ) : (
        <EndlessCarousel
          items={items.map((p) => (
            <BlogCard key={p.slug} post={p} readLabel={readLabel} />
          ))}
          label={title}
          durationSec={FEATURED_BLOGS_CONFIG.carouselDurationSec}
        />
      )}
    </section>
  );
}
