import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { qstashService } from "@/app/lib/services/qstashService";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = user.id as string;
    const existing = await prisma.bookmark.findUnique({
      where: { postId_userId: { postId: id, userId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.bookmark.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id }, data: { bookmarks: { decrement: 1 } } }),
      ]);
      // Bookmarks feed the engagement leg of trust (fire-and-forget).
      void qstashService.publishValidityRecompute({ postId: id });
      return NextResponse.json({ bookmarked: false }, { status: 200 });
    }

    await prisma.$transaction([
      prisma.bookmark.create({ data: { postId: id, userId } }),
      prisma.post.update({ where: { id }, data: { bookmarks: { increment: 1 } } }),
    ]);
    void qstashService.publishValidityRecompute({ postId: id });

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true } });
    if (post && post.userId !== userId) {
      qstashService.publishRewardsAward({ userId: post.userId, actionKey: "RECEIVE_BOOKMARK" });
      qstashService.publishFeedInvalidation({ userIds: [post.userId] });
    }

    return NextResponse.json({ bookmarked: true }, { status: 200 });
  } catch (error) {
    console.error("Bookmark toggle error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
