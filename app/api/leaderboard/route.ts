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
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit")) || 20));
    const wantMe = searchParams.get("me") === "1";

    // Global ranking — safe to share across viewers, 10 min TTL.
    // Paginated slices are derived from the cached full board when present.
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const cached = await redis.get<{ leaderboard: Array<Record<string, unknown>> }>(CACHE_KEYS.leaderboard());
      if (cached?.leaderboard) {
        const total = cached.leaderboard.length;
        const slice = cached.leaderboard.slice((page - 1) * limit, page * limit);
        const me = wantMe || true ? cached.leaderboard.find((e) => (e as { id?: string }).id === (user as { id: string }).id) ?? null : null;
        return NextResponse.json({ leaderboard: slice, page, totalPages: Math.max(1, Math.ceil(total / limit)), total, me }, { status: 200 });
      }
    } catch { /* fall through to DB */ }

    const users = await prisma.user.findMany({
      where: { isDeleted: false },
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
      orderBy: [{ rewardPoints: "desc" }, { createdAt: "asc" }],
      take: 500,
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

    const total = leaderboard.length;
    const me = leaderboard.find((e) => e.id === (user as { id: string }).id) ?? null;
    return NextResponse.json({
      leaderboard: leaderboard.slice((page - 1) * limit, page * limit),
      page, totalPages: Math.max(1, Math.ceil(total / limit)), total, me,
    }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
