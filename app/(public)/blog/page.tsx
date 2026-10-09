import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, User } from "lucide-react";
import { PAGE_META, BLOG_LAYOUT_CONFIG, DEFAULT_BLOG_CATEGORIES } from "@/app/lib/config";
import { buildPublicMetadata } from "@/app/lib/utils/metadata";
import { getPublicBlogPosts } from "@/app/lib/utils/blogStore";
import type { ManagedBlogPost } from "@/app/lib/utils/blogStore";

export const metadata: Metadata = buildPublicMetadata(
  PAGE_META.blog.title,
  PAGE_META.blog.description,
  "/blog",
);

function PostCard({ post }: { post: ManagedBlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all duration-200"
    >
      <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
        <span className="px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary capitalize">
          {post.category}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {post.readingTime} min read
        </span>
      </div>
      <h2 className="text-base font-semibold text-text-primary mb-2 group-hover:text-primary transition-colors">
        {post.title}
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-3 line-clamp-2">
        {post.description}
      </p>
      <div className="flex items-center gap-1 text-xs text-text-muted">
        <User size={12} />
        <span>{post.author}</span>
        <span className="mx-1">·</span>
        <span>{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
    </Link>
  );
}

interface Props {
  searchParams: Promise<{ page?: string; category?: string }>;
}

export default async function BlogPage({ searchParams }: Props) {
  const { page: pageRaw, category: categoryRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const category = (categoryRaw ?? "all").toLowerCase();
  // Managed (admin-published) posts first, filesystem seeds as fallback —
  // sanitized + styled at render like the config examples.
  const all = await getPublicBlogPosts();
  const filtered = category === "all" ? all : all.filter((p) => p.category.toLowerCase() === category);
  const perPage = BLOG_LAYOUT_CONFIG.postsPerPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const posts = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const featured = safePage === 1 && category === "all" ? posts.slice(0, BLOG_LAYOUT_CONFIG.featuredCount) : [];
  const remaining = safePage === 1 && category === "all" ? posts.slice(BLOG_LAYOUT_CONFIG.featuredCount) : posts;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-3">Blog</h1>
        <p className="text-text-secondary max-w-lg mx-auto">
          Route tips, platform updates, and stories from the Along community.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap justify-center mb-8">
        {DEFAULT_BLOG_CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={c.id === "all" ? "/blog" : `/blog?category=${c.id}`}
            className={`px-3 py-1.5 radius-pill text-xs font-medium border transition-colors ${category === c.id ? "bg-primary text-white border-primary" : "bg-bg-card text-text-secondary border-border"}`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="text-center text-text-muted py-16">No posts yet. Check back soon!</p>
      ) : (
        <>
          {featured.map((post) => (
            <div key={post.slug} className="mb-8">
              <Link
                href={`/blog/${post.slug}`}
                className="group block bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6 md:p-8 hover:shadow-lg transition-all duration-200"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 block">Featured</span>
                <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-text-secondary mb-4 max-w-2xl line-clamp-2">
                  {post.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1"><User size={12} />{post.author}</span>
                  <span className="flex items-center gap-1"><Clock size={12} />{post.readingTime} min read</span>
                  <span>{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              </Link>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {remaining.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {safePage > 1 && (
                <Link
                  href={safePage === 2 && category === "all" ? "/blog" : `/blog?page=${safePage - 1}${category !== "all" ? `&category=${category}` : ""}`}
                  className="px-3 py-1.5 radius-md text-xs font-semibold border border-border bg-bg-card"
                >
                  Prev
                </Link>
              )}
              <span className="text-xs text-text-muted">Page {safePage} of {totalPages}</span>
              {safePage < totalPages && (
                <Link
                  href={`/blog?page=${safePage + 1}${category !== "all" ? `&category=${category}` : ""}`}
                  className="px-3 py-1.5 radius-md text-xs font-semibold border border-border bg-bg-card"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}

      <div className="text-center mt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
        >
          Back to Home <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
