import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, User } from "lucide-react";
import { remark } from "remark";
import html from "remark-html";
import { getPostBySlug, getAllPosts } from "@/app/lib/utils/blog";
import { buildPublicMetadata } from "@/app/lib/utils/metadata";
import {
  blogPostingSchema,
  breadcrumbSchema,
} from "@/app/lib/utils/structuredData";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return buildPublicMetadata(
      "Post Not Found",
      "This blog post could not be found.",
      `/blog/${slug}`,
    );
  }
  return buildPublicMetadata(post.title, post.description, `/blog/${slug}`);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

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

  const result = await remark().use(html).process(post.content);
  const contentHtml = result.toString();

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
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-6">
          <ArrowLeft size={14} /> Back to Blog
        </Link>

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
          className="prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-primary prose-strong:text-text-primary prose-code:text-text-primary prose-code:bg-bg-elevated prose-code:px-1 prose-code:rounded"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </article>
    </>
  );
}
