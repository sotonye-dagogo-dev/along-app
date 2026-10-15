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

/**
 * GET /api/users/[id]/follow — lightweight follow-status check.
 * Returns `{ following: boolean }` for the viewer → target pair.
 * Additive (Sprint 59): powers the inline post-card follow affordance so
 * cards can hide the button when the viewer already follows. Guest-safe:
 * unauthenticated callers get `{ following: false }` (never a 401 that
 * would surface as an error on cards); unknown users get 404.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getUserFromRequest();

    if (!currentUser) {
      return NextResponse.json({ following: false }, { status: 200 });
    }

    if (currentUser.id === id) {
      return NextResponse.json({ following: false, self: true }, { status: 200 });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUser.id as string, followingId: id } },
    });

    return NextResponse.json({ following: !!existing }, { status: 200 });
  } catch (error) {
    console.error("Follow-status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    // Deleted or archived (pending-deletion) accounts cannot gain followers
    // until restored — 410 signals "gone, possibly temporary" (vs 404).
    try {
      const { DELETED_USER_COPY } = await import("@/app/lib/config/userVisibility");
      const t = targetUser as unknown as { isDeleted?: boolean; deletionScheduledFor?: Date | null };
      if (t.isDeleted === true || t.deletionScheduledFor != null) {
        return NextResponse.json({ error: DELETED_USER_COPY.followUnavailable }, { status: 410 });
      }
    } catch {
      /* visibility check is best-effort — a legacy row without the columns stays followable */
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

    // FOLLOW writes bypass createNotification (lifecycle-coupled cleanup lives
    // in this transaction), so mirror its side-effects here: cache
    // invalidation + Web Push fan-out. Both fire-and-forget, never fail follow.
    void import("@/app/lib/services/notificationService")
      .then(({ invalidateNotificationCaches }) => invalidateNotificationCaches([id]))
      .catch(() => {});
    void import("@/app/lib/services/pushSender")
      .then(({ fanOutPush }) =>
        fanOutPush({
          type: "FOLLOW",
          message: `${currentUser.firstName} ${currentUser.lastName} started following you`,
          recipientIds: [id],
        }),
      )
      .catch(() => {});

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
