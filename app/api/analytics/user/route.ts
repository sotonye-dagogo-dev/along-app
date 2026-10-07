import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "30";
    const daysAgo = Math.min(parseInt(period) || 30, 365);
    const since = new Date(Date.now() - daysAgo * 86400000);

    const userId = user.id as string;

    // Aggregates are expensive — cache for 1h (TTL-only invalidation)
    const cacheKey = CACHE_KEYS.analytics(userId, String(daysAgo));
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const cached = await redis.get<Record<string, unknown>>(cacheKey);
      if (cached) return NextResponse.json(cached, { status: 200 });
    } catch { /* fall through to DB */ }

    const [posts, likes, bookmarks, followers] = await Promise.all([
      prisma.post.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { id: true, title: true, validityScore: true, likes: true, views: true, bookmarks: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.like.findMany({
        where: { post: { userId }, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.bookmark.findMany({
        where: { post: { userId }, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.follow.findMany({
        where: { followingId: userId, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const dailyAgg = (items: { createdAt: Date }[], days: number) => {
      const map = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const d = new Date(since.getTime() + i * 86400000);
        map.set(d.toISOString().slice(0, 10), 0);
      }
      for (const item of items) {
        const key = new Date(item.createdAt).toISOString().slice(0, 10);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
    };

    const days = Math.ceil((Date.now() - since.getTime()) / 86400000);

    const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
    const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
    const totalBookmarks = posts.reduce((sum, p) => sum + p.bookmarks, 0);
    const avgValidity = posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + p.validityScore, 0) / posts.length) : 0;

    const topPosts = [...posts].sort((a, b) => b.validityScore - a.validityScore).slice(0, 5);

    const engagementData = days > 0 ? [
      { label: "Views", data: dailyAgg(posts.map(p => ({ createdAt: p.createdAt })), days) },
      { label: "Likes", data: dailyAgg(likes, days) },
      { label: "Bookmarks", data: dailyAgg(bookmarks, days) },
    ] : [];

    const followerGrowth = days > 0 ? dailyAgg(followers, days) : [];

    const payload = {
      kpi: { totalViews, totalLikes, totalBookmarks, avgValidity, totalPosts: posts.length },
      topPosts: topPosts.map(p => ({ id: p.id, title: p.title, validityScore: p.validityScore, likes: p.likes, views: p.views })),
      engagementData,
      followerGrowth,
    };

    try {
      const { redis } = await import("@/app/lib/db/redis");
      await redis.set(cacheKey, payload, { ex: CACHE_TTL.analytics });
    } catch { /* non-critical */ }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
