import { NextRequest, NextResponse } from "next/server";
import { getPublicBlogPosts } from "@/app/lib/utils/blogStore";
import { BLOG_LAYOUT_CONFIG } from "@/app/lib/config/blog";

/**
 * Public blog feed — published managed posts + filesystem seeds.
 * GET ?page=&limit=&category= — paginated, cache-friendly.
 * (Also satisfies the PWA precache reference to /api/blog.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || BLOG_LAYOUT_CONFIG.postsPerPage));
    const category = (searchParams.get("category") ?? "all").toLowerCase();
    const all = await getPublicBlogPosts();
    const filtered = category === "all" ? all : all.filter((p) => p.category.toLowerCase() === category);
    const total = filtered.length;
    const posts = filtered.slice((page - 1) * limit, page * limit);
    return NextResponse.json(
      {
        posts: posts.map((p) => ({
          slug: p.slug,
          title: p.title,
          description: p.description,
          date: p.date,
          author: p.author,
          category: p.category,
          image: p.image,
          readingTime: p.readingTime,
        })),
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        total,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error("blog feed error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
