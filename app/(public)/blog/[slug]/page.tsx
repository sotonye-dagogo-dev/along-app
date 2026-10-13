import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, User } from "lucide-react";
import { remark } from "remark";
import html from "remark-html";
import { getPublicBlogPosts, getPublicPostBySlug } from "@/app/lib/utils/blogStore";
import { BLOG_CONTENT_PROSE_CLASSES } from "@/app/lib/config/blog";
import { buildMetadata, resolveOgImage } from "@/app/lib/utils/metadata";
import { buildBlogVarContext, renderBlogContent } from "@/app/lib/utils/blogVariables";
import { sanitizeBlogHtml } from "@/app/lib/utils/emailSanitize";
import BlogShareButtons from "@/app/components/features/blog/BlogShareButtons";
import {
  blogPostingSchema,
  breadcrumbSchema,
} from "@/app/lib/utils/structuredData";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getPublicBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPostBySlug(slug);
  if (!post) {
    return buildMetadata({
      title: "Post Not Found",
      description: "This blog post could not be found.",
      path: `/blog/${slug}`,
      noIndex: true,
    });
  }
  // Dynamic SEO: per-post title + description + cover image (fallback-safe).
  let publishedTime: string | undefined;
  try {
    const d = new Date(post.date);
    if (!Number.isNaN(d.getTime())) publishedTime = d.toISOString();
  } catch {
    publishedTime = undefined;
  }
  return buildMetadata({
    title: post.title,
    description: (post.description || "").slice(0, 160) || `Read "${post.title}" on the Along blog.`,
    path: `/blog/${post.slug}`,
    ogImage: resolveOgImage(post.image),
    ogType: "article",
    ...(publishedTime ? { publishedTime } : {}),
    authorName: post.author,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublicPostBySlug(slug);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-4">
          Post Not Found
        </h1>
        <Link href="/blog" className="text-primary hover:opacity-80 text-sm">
          ← Back to Blog
        </Link>
      </div>
    );
  }

  // Managed posts store sanitized HTML fragments (visual-builder output);
  // filesystem seeds store markdown — render each accordingly, then strip any
  // legacy email-style inline styles (stored before the article pipeline) so
  // BLOG_CONTENT_PROSE_CLASSES actually applies like terms/privacy, then
  // interpolate {{variables}} with guest-safe fallbacks (never throws,
  // never leaks raw {{identifier}} to readers).
  const rawHtml = post.readonly === true || /<\w+/.test(post.content) === false
    ? String(await remark().use(html).process(post.content))
    : post.content;
  let contentHtml = sanitizeBlogHtml(rawHtml);
  try {
    contentHtml = renderBlogContent(
      contentHtml,
      buildBlogVarContext({ title: post.title, author: post.author, category: post.category }, null),
    );
  } catch {
    contentHtml = sanitizeBlogHtml(rawHtml);
  }

  const jsonLd = blogPostingSchema({
    headline: post.title,
    datePublished: post.date,
    author: { name: post.author },
    image: post.image,
    description: post.description,
  });

  const breadcrumb = breadcrumbSchema([
    { name: "Home", url: "https://alongng.com" },
    { name: "Blog", url: "https://alongng.com/blog" },
    { name: post.title, url: `https://alongng.com/blog/${post.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <BlogShareButtons slug={post.slug} title={post.title} />
        </div>

        <header className="mb-8">
          <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
            <span className="px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary capitalize">
              {post.category}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {post.readingTime} min read
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
            {post.title}
          </h1>
          <p className="text-text-secondary text-sm mb-4">{post.description}</p>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <User size={12} />
            <span>{post.author}</span>
            <span className="mx-1">·</span>
            <span>
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </header>

        <div
          className={BLOG_CONTENT_PROSE_CLASSES}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </article>
    </>
  );
}
