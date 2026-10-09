import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getManagedPosts, sanitizeBlogPost } from "@/app/lib/utils/blogStore";
import { logAudit } from "@/app/lib/services/auditService";

/**
 * Admin blog management — draft / publish / archive / edit lifecycle.
 * SiteConfig-backed (no migration); public pages merge with filesystem seeds.
 * Body PUT: { post: ManagedBlogPost } (upsert, sanitized).
 * Body PUT: { status, slugs: string[] } (bulk status change).
 * DELETE ?slug= — removes a managed post (seeds are read-only).
 */
export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const posts = await getManagedPosts();
    return NextResponse.json({ posts }, { status: 200 });
  } catch (e) {
    console.error("admin blog GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const posts = await getManagedPosts();

    // Bulk status change.
    if (Array.isArray((body as { slugs?: unknown }).slugs)) {
      const { slugs, status } = body as { slugs: string[]; status: string };
      const { isBlogStatus } = await import("@/app/lib/config/blogManagement");
      if (!isBlogStatus(status))
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      const set = new Set(slugs.map(String));
      const next = posts.map((p) =>
        set.has(p.slug) ? { ...p, status, updatedAt: new Date().toISOString() } : p,
      );
      await prisma.siteConfig.upsert({
        where: { key: "blogPosts" },
        create: { key: "blogPosts", value: next as never },
        update: { value: next as never },
      });
      await logAudit({ actorId: (user as { id: string }).id, action: `blog.bulk.${status}`, entity: "blog", metadata: { slugs: [...set], status } });
      return NextResponse.json({ success: true, updated: set.size }, { status: 200 });
    }

    const incoming = (body as { post?: unknown }).post as Parameters<typeof sanitizeBlogPost>[0] | undefined;
    if (!incoming)
      return NextResponse.json({ error: "post required" }, { status: 400 });
    const clean = sanitizeBlogPost({ ...incoming, updatedAt: new Date().toISOString() });
    if (!clean)
      return NextResponse.json({ error: "Invalid post (slug/title/content required)" }, { status: 400 });
    const idx = posts.findIndex((p) => p.slug === clean.slug);
    if (idx >= 0) posts[idx] = clean;
    else posts.push(clean);
    await prisma.siteConfig.upsert({
      where: { key: "blogPosts" },
      create: { key: "blogPosts", value: posts as never },
      update: { value: posts as never },
    });
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const { CACHE_KEYS } = await import("@/app/lib/config/cache");
      await redis.del(CACHE_KEYS.siteConfig("blogPosts"));
    } catch { /* ignore */ }
    await logAudit({ actorId: (user as { id: string }).id, action: "blog.upsert", entity: "blog", entityId: clean.slug, metadata: { status: clean.status, title: clean.title } });
    return NextResponse.json({ success: true, post: clean }, { status: 200 });
  } catch (e) {
    console.error("admin blog PUT error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get("slug") ?? "").trim();
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
    const posts = (await getManagedPosts()).filter((p) => p.slug !== slug);
    await prisma.siteConfig.upsert({
      where: { key: "blogPosts" },
      create: { key: "blogPosts", value: posts as never },
      update: { value: posts as never },
    });
    await logAudit({ actorId: (user as { id: string }).id, action: "blog.delete", entity: "blog", entityId: slug });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("admin blog DELETE error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
