import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config";

const USER_SELECT = {
  id: true,
  userName: true,
  firstName: true,
  lastName: true,
  avatar: true,
  avatarConfig: true,
  verified: true,
} as const;

/**
 * Personalized suggestions, ordered: open route requests → recent routes →
 * accounts to follow. Cached per viewer for 30 min (TTL-only invalidation).
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = user.id as string;

    try {
      const { redis } = await import("@/app/lib/db/redis");
      const cached = await redis.get<Record<string, unknown>>(CACHE_KEYS.suggestions(userId));
      if (cached) return NextResponse.json(cached, { status: 200 });
    } catch { /* fall through to DB */ }

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    const excludeIds = [userId, ...followingIds];

    // Archived posts never surface as suggestions; P2022 fallback keeps the
    // route working if the moderation migration has not applied yet.
    const safePostList = async (args: Record<string, unknown>): Promise<Array<{ id: string } & Record<string, any>>> => {
      try {
        return await (prisma.post.findMany as any)({ ...args, where: { ...(args.where as object), isArchived: false } });
      } catch (e) {
        if (e instanceof Error && ((e as any).code === "P2022" || e.name === "PrismaClientKnownRequestError")) {
          return await (prisma.post.findMany as any)(args);
        }
        throw e;
      }
    };

    const [routeRequests, routes, suggestedUsers] = await Promise.all([
      // Open route requests from others, most recent first
      safePostList({
        where: { type: "ROUTE_REQUEST", userId: { not: userId } },
        include: {
          user: { select: USER_SELECT },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      // Recent community routes
      safePostList({
        where: { type: "ROUTE" },
        include: {
          user: { select: USER_SELECT },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      // Accounts to follow: active posters the viewer doesn't follow yet
      prisma.user.findMany({
        where: { id: { notIn: excludeIds } },
        select: {
          ...USER_SELECT,
          rewardPoints: true,
          _count: { select: { posts: true, followers: true } },
        },
        orderBy: [{ posts: { _count: "desc" } }, { rewardPoints: "desc" }],
        take: 5,
      }),
    ]);

    // Canonical live trust for suggested routes (same service as feed/detail)
    // so carousel scores never disagree with feed/detail. Best-effort.
    let liveRoutes = routes;
    try {
      const { attachLiveBreakdownsToPosts } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      liveRoutes = await attachLiveBreakdownsToPosts(prisma, routes);
    } catch { /* stored rows */ }

    const payload = {
      routeRequests: routeRequests.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        region: p.region,
        tags: p.tags,
        createdAt: p.createdAt,
        user: p.user,
      })),
      routes: liveRoutes.map((p) => ({
        id: p.id,
        title: p.title,
        region: p.region,
        tags: p.tags,
        totalDistanceKm: p.totalDistanceKm,
        estimatedMins: p.estimatedMins,
        validityScore: p.validityScore,
        validityTier: p.validityTier,
        validityBreakdown: (p as { validityBreakdown?: unknown }).validityBreakdown ?? null,
        images: p.images.slice(0, 1),
        createdAt: p.createdAt,
        user: p.user,
      })),
      users: suggestedUsers.map((u) => ({
        id: u.id,
        userName: u.userName,
        firstName: u.firstName,
        lastName: u.lastName,
        avatar: u.avatar,
        avatarConfig: u.avatarConfig,
        verified: u.verified,
        postCount: u._count.posts,
        followerCount: u._count.followers,
      })),
    };

    try {
      const { redis } = await import("@/app/lib/db/redis");
      await redis.set(CACHE_KEYS.suggestions(userId), payload, { ex: CACHE_TTL.suggestions });
    } catch { /* non-critical */ }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
