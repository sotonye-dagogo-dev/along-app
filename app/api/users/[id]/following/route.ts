import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { clampPageLimit } from "@/app/lib/config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    // Cursor is a Follow row id (the `orderBy` tiebreaker key), not a user id —
    // the window addresses follow rows so ties on createdAt stay deterministic.
    const cursor = searchParams.get("cursor");
    const limit = clampPageLimit(searchParams.get("limit"), "userLists");

    const follows = await prisma.follow.findMany({
      // Deleted/archived accounts never appear in user-facing lists; their
      // follows stay in the DB (restorable) but are hidden until then.
      where: { followerId: id, following: { isDeleted: false, deletionScheduledFor: null } },
      select: {
        id: true,
        following: {
          select: {
            id: true,
            userName: true,
            firstName: true,
            lastName: true,
            avatar: true,
            avatarConfig: true,
            verified: true,
          },
        },
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = follows.length > limit;
    const page = hasMore ? follows.slice(0, limit) : follows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({
      users: page.map((f) => ({
        ...f.following,
        followedAt: f.createdAt,
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
