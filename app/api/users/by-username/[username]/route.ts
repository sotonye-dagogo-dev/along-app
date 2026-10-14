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
        isDeleted: true,
        _count: { select: { posts: true, followers: true, following: true } },
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Deleted users render as a generic profile: no PII, no personalized
    // tabs (likes/bookmarks empty), posts stay attributed for integrity.
    if ((user as { isDeleted?: boolean }).isDeleted) {
      return NextResponse.json({
        user: {
          ...user,
          firstName: "Deleted",
          lastName: "User",
          avatar: null,
          avatarConfig: null,
          bio: "This account has been deleted.",
          verified: false,
          rewardPoints: 0,
        },
        isFollowing: false,
        earlyAdopter: null,
        isDeleted: true,
      });
    }

    const currentUser = await getUserFromRequest();
    let isFollowing = false;
    if (currentUser && currentUser.id !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: currentUser.id as string, followingId: user.id } },
      });
      isFollowing = !!follow;
    }

    // Best-effort early-adopter badge (config-driven; never fails the request).
    let earlyAdopter: unknown = null;
    try {
      const { getEarlyAdopterStatus } = await import(
        "@/app/lib/services/earlyAdopterService"
      );
      earlyAdopter = await getEarlyAdopterStatus(user.id);
    } catch {
      earlyAdopter = null;
    }

    // Avg validity score — same aggregate as GET /api/users/[id] so other
    // profiles show the AVERAGE (not rewardPoints/postCount total). Never
    // fails the request; falls back to 0 and the client prefers this value.
    let avgValidityScore = 0;
    try {
      const avg = await prisma.post.aggregate({
        where: { userId: user.id },
        _avg: { validityScore: true },
      });
      avgValidityScore = Math.round(avg._avg.validityScore ?? 0);
    } catch {
      avgValidityScore = 0;
    }

    return NextResponse.json({
      user: { ...user, avgValidityScore },
      isFollowing,
      earlyAdopter,
    });
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
