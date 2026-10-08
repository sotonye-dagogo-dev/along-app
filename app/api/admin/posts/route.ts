import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

/* eslint-disable @typescript-eslint/no-explicit-any -- P2022-tolerant casts for the additive archive columns */
function isMissingColumnError(error: unknown): boolean {
  return error instanceof Error && ((error as any).code === "P2022" || (error as any).code === "P2010");
}

function isPrivileged(user: { role?: string } | null): boolean {
  return !!user && (user.role === "ADMIN" || (user as any).role === "MODERATOR");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!isPrivileged(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

    let posts: unknown[];
    try {
      posts = await (prisma.post.findMany as (...a: never[]) => Promise<unknown[]>)({
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          user: {
            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
          },
          _count: { select: { bugReports: true } },
        },
        orderBy: { createdAt: "desc" },
      } as never);
    } catch (e) {
      if (!isMissingColumnError(e)) throw e;
      posts = await prisma.post.findMany({
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          user: {
            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const hasMore = posts.length > limit;
    const result = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? (result[result.length - 1] as { id: string }).id : null;

    return NextResponse.json({ posts: result, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("Admin posts list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!isPrivileged(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { postId, postIds, isArchived } = body as {
      postId?: string; postIds?: string[]; isArchived?: boolean;
    };
    const targets: string[] = postIds?.length ? postIds : postId ? [postId] : [];

    if (targets.length === 0 || typeof isArchived !== "boolean") {
      return NextResponse.json({ error: "postId(s) and isArchived required" }, { status: 400 });
    }

    try {
      const updated = await (prisma.post.updateMany as (...a: never[]) => Promise<unknown>)({
        where: { id: { in: targets } },
        data: { isArchived, archivedAt: isArchived ? new Date() : null },
      } as never);
      return NextResponse.json({ success: true, updated: targets.length, post: updated }, { status: 200 });
    } catch (e) {
      if (isMissingColumnError(e)) {
        return NextResponse.json(
          { error: "Archiving is not available yet. Please try again shortly." },
          { status: 503 }
        );
      }
      throw e;
    }
  } catch (error) {
    console.error("Admin post archive error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { postId, postIds } = body as { postId?: string; postIds?: string[] };
    const targets: string[] = postIds?.length ? postIds : postId ? [postId] : [];

    if (targets.length === 0) {
      return NextResponse.json({ error: "postId(s) required" }, { status: 400 });
    }

    // Read-then-delete in one transaction: returns snapshots so the admin UI
    // can offer global undo (restore replays each snapshot as one POST).
    const snapshots = await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findMany({ where: { id: { in: targets } } });
      if (existing.length === 0) return [];
      await tx.post.deleteMany({ where: { id: { in: targets } } });
      return existing;
    });

    if (snapshots.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: snapshots.length, snapshots, snapshot: snapshots[0] }, { status: 200 });
  } catch (error) {
    console.error("Admin post delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
