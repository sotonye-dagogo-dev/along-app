import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: { role: { not: "banned" } },
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

    return NextResponse.json({ leaderboard }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
