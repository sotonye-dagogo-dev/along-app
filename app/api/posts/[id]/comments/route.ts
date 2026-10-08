import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { COMMENT_SCHEMA } from "@/app/lib/schemas/post";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    const comments = await prisma.comment.findMany({
      where: { postId: id },
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = comments.length > limit;
    const resultComments = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore ? resultComments[resultComments.length - 1].id : null;

    return NextResponse.json({ comments: resultComments, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("List comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = COMMENT_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const userId = user.id as string;

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: { postId: id, userId, text: parsed.data.text },
        include: {
          user: {
            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
          },
        },
      });

      await tx.post.update({ where: { id }, data: { comments: { increment: 1 } } });

      return c;
    });

    // Post-commit notifications (non-blocking, never fail the comment):
    // COMMENT to the post author + MENTION to every @username referenced.
    try {
      const { createNotification } = await import("@/app/lib/services/notificationService");
      const { extractMentionedUsernames, resolveMentionedUserIds } = await import(
        "@/app/lib/services/mentionService"
      );
      const actorName =
        `${(user as { firstName?: string }).firstName ?? ""} ${(user as { lastName?: string }).lastName ?? ""}`.trim() ||
        "Someone";
      const post = await prisma.post.findUnique({ where: { id }, select: { userId: true, title: true } });
      if (post && post.userId !== userId) {
        void createNotification({
          type: "COMMENT",
          actorId: userId,
          message: `${actorName} commented on your post`,
          postId: id,
          commentId: comment.id,
          recipientIds: [post.userId],
        });
      }
      const mentioned = extractMentionedUsernames(parsed.data.text).filter(
        (u) => u !== ((user as { userName?: string }).userName ?? "").toLowerCase()
      );
      if (mentioned.length > 0) {
        const mentionedIds = (await resolveMentionedUserIds(mentioned)).filter(
          (mid) => mid !== userId && mid !== post?.userId
        );
        if (mentionedIds.length > 0) {
          void createNotification({
            type: "MENTION",
            actorId: userId,
            message: `${actorName} mentioned you in a comment`,
            postId: id,
            commentId: comment.id,
            recipientIds: mentionedIds,
          });
        }
      }
    } catch { /* notifications are non-critical */ }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
