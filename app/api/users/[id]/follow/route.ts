import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { qstashService } from "@/app/lib/services/qstashService";

/**
 * Enqueue trust recomputes for the followed/unfollowed author's most recent
 * posts (bounded — follower count feeds the reputation leg, and queuing the
 * whole back-catalogue would spam the worker on popular authors).
 * Fire-and-forget; never fails the follow itself.
 */
async function enqueueAuthorTrustRefresh(authorId: string): Promise<void> {
  try {
    const recent = await prisma.post.findMany({
      where: { userId: authorId, isArchived: false },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }).catch(() => [] as { id: string }[]);
    for (const p of recent) {
      void qstashService.publishValidityRecompute({ postId: p.id });
    }
  } catch {
    /* non-critical */
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getUserFromRequest();

    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (currentUser.id === id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id as string, followingId: id } },
    });

    if (existing) {
      return NextResponse.json({ error: "Already following this user" }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.follow.create({
        data: { followerId: currentUser.id as string, followingId: id },
      }),
      prisma.notification.create({
        data: {
          type: "FOLLOW",
          actorId: currentUser.id as string,
          message: `${currentUser.firstName} ${currentUser.lastName} followed you`,
          recipients: { create: { userId: id } },
        },
      }),
    ]);

    void enqueueAuthorTrustRefresh(id);

    return NextResponse.json({ followed: true }, { status: 201 });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getUserFromRequest();

    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id as string, followingId: id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not following this user" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.follow.delete({
        where: { followerId_followingId: { followerId: currentUser.id as string, followingId: id } },
      }),
      prisma.notification.deleteMany({
        where: {
          type: "FOLLOW",
          actorId: currentUser.id as string,
          postId: null,
        },
      }),
    ]);

    void enqueueAuthorTrustRefresh(id);

    return NextResponse.json({ followed: false }, { status: 200 });
  } catch (error) {
    console.error("Unfollow error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
