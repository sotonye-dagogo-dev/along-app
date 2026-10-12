import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const follows = await prisma.follow.findMany({
      // Deleted/archived accounts never appear in user-facing lists; their
      // follows stay in the DB (restorable) but are hidden until then.
      where: { followerId: id, following: { isDeleted: false, deletionScheduledFor: null } },
      select: {
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      users: follows.map((f) => ({
        ...f.following,
        followedAt: f.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
