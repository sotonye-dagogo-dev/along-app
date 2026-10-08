import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { COMMENT_SCHEMA } from "@/app/lib/schemas/post";

/* eslint-disable @typescript-eslint/no-explicit-any */
function isAdmin(user: { role?: string } | null): boolean {
  return !!user && (user.role === "ADMIN" || (user as any).role === "MODERATOR");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const COMMENT_USER_SELECT = {
  id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true,
} as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const { commentId } = await params;
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    // Owner edits own; admin may correct any comment (identity not revealed).
    if (comment.userId !== (user.id as string) && !isAdmin(user)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = COMMENT_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { text: parsed.data.text },
      include: { user: { select: { ...COMMENT_USER_SELECT } } },
    });

    return NextResponse.json({ comment: updated }, { status: 200 });
  } catch (error) {
    console.error("Update comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const { id, commentId } = await params;
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    // Owner or admin. Admin identity is never revealed to the author.
    if (comment.userId !== (user.id as string) && !isAdmin(user)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Atomic: delete + counter decrement in one transaction (ACID).
    await prisma.$transaction([
      prisma.comment.delete({ where: { id: commentId } }),
      prisma.post.update({ where: { id }, data: { comments: { decrement: 1 } } }),
    ]);

    return NextResponse.json({ message: "Comment deleted" }, { status: 200 });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
