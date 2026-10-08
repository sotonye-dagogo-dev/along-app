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

    // Global ranking — safe to share across viewers, 10 min TTL
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const cached = await redis.get<Record<string, unknown>>(CACHE_KEYS.leaderboard());
      if (cached) return NextResponse.json(cached, { status: 200 });
    } catch { /* fall through to DB */ }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userName: true,
        avatar: true,
        rewardPoints: true,
        rewardTier: true,
        _count: { select: { posts: true, followers: true } },
      },
      orderBy: { rewardPoints: "desc" },
      take: 100,
    });

    const leaderboard = users.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      userName: u.userName,
      avatar: u.avatar,
      rewardPoints: u.rewardPoints,
      rewardTier: u.rewardTier,
      postCount: u._count.posts,
      followerCount: u._count.followers,
    }));

    try {
      const { redis } = await import("@/app/lib/db/redis");
      await redis.set(CACHE_KEYS.leaderboard(), { leaderboard }, { ex: CACHE_TTL.leaderboard });
    } catch { /* non-critical */ }

    return NextResponse.json({ leaderboard }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
