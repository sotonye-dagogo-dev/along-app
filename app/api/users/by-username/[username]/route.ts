import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const user = await prisma.user.findUnique({
      where: { userName: username },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        avatar: true,
        avatarConfig: true,
        bio: true,
        verified: true,
        role: true,
        rewardPoints: true,
        rewardTier: true,
        _count: { select: { posts: true, followers: true, following: true } },
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUser = await getUserFromRequest();
    let isFollowing = false;
    if (currentUser && currentUser.id !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: currentUser.id as string, followingId: user.id } },
      });
      isFollowing = !!follow;
    }

    return NextResponse.json({ user, isFollowing });
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
