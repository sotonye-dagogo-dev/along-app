import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { UPDATE_POST_SCHEMA } from "@/app/lib/schemas/post";
import { MODERATION_CONFIG } from "@/app/lib/config";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any -- P2022-tolerant casts: isArchived may be absent on DBs where the moderation migration has not applied yet */

function isMissingColumnError(error: unknown): boolean {
  return error instanceof Error && ((error as any).code === "P2022" || (error as any).code === "P2010");
}

function isAdmin(user: { role?: string } | null): boolean {
  return !!user && (user.role === "ADMIN" || (user as any).role === "MODERATOR");
}

/** Archive intent is parsed separately so CREATE_POST_SCHEMA stays untouched. */
const ARCHIVE_SCHEMA = z.object({ isArchived: z.boolean() });

const AUTHOR_SELECT = {
  id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true,
} as const;

const AUTHOR_SELECT_FALLBACK = {
  id: true, userName: true, firstName: true, lastName: true, avatar: true,
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest();

    let post: any;
    try {
      post = await (prisma.post.findUnique as any)({
        where: { id },
        include: {
          user: { select: { ...AUTHOR_SELECT } },
          quotedPost: {
            select: {
              id: true,
              title: true,
              type: true,
              createdAt: true,
              user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true } },
            },
          },
        },
      });
    } catch (e) {
      if (!isMissingColumnError(e)) throw e;
      post = await (prisma.post.findUnique as any)({
        where: { id },
        include: {
          user: { select: { ...AUTHOR_SELECT_FALLBACK } },
          quotedPost: {
            select: {
              id: true,
              title: true,
              type: true,
              createdAt: true,
              user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true } },
            },
          },
        },
      });
    }

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Archived posts stay viewable by direct link for owner/admin; other
    // viewers get a tombstone so feeds stay clean but links don't 404.
    const viewerIsOwnerOrAdmin = !!user && (post.userId === (user as any).id || isAdmin(user as any));
    if ((post as any).isArchived && !viewerIsOwnerOrAdmin) {
      return NextResponse.json({ post: { ...post, _archived: true }, archived: true }, { status: 200 });
    }

    // Increment views (best-effort, never blocks the read)
    try {
      await prisma.post.update({ where: { id }, data: { views: { increment: 1 } } });
    } catch { /* ignore */ }

    let _isLiked = false;
    let _isBookmarked = false;

    if (user) {
      const [like, bookmark] = await Promise.all([
        prisma.like.findUnique({ where: { postId_userId: { postId: id, userId: user.id as string } } }),
        prisma.bookmark.findUnique({ where: { postId_userId: { postId: id, userId: user.id as string } } }),
      ]);
      _isLiked = like?.type === "LIKE";
      _isBookmarked = !!bookmark;
    }

    // Responses to a ROUTE_REQUEST (linked via quotedPostId) — shown as
    // comment-like entries with links when the request is viewed expanded.
    let responses: any[] = [];
    try {
      responses = await (prisma.post.findMany as any)({
        where: { quotedPostId: id },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
          likes: true,
          comments: true,
          validityScore: true,
          validityTier: true,
          user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    } catch { responses = []; }

    return NextResponse.json(
      { post: { ...post, _isLiked, _isBookmarked, responses, responsesCount: responses.length } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const owner = post.userId === (user as any).id;
    const admin = isAdmin(user as any);
    if (!owner && !admin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();

    // Archive / unarchive path (owner + admin). Single atomic update (ACID).
    const archiveParsed = ARCHIVE_SCHEMA.safeParse(body);
    if (archiveParsed.success && Object.keys(body).length === 1) {
      try {
        const updated = await (prisma.post.update as any)({
          where: { id },
          data: { isArchived: archiveParsed.data.isArchived, archivedAt: archiveParsed.data.isArchived ? new Date() : null },
          include: { user: { select: { ...AUTHOR_SELECT_FALLBACK } } },
        });
        return NextResponse.json({ post: updated }, { status: 200 });
      } catch (e) {
        if (isMissingColumnError(e)) {
          return NextResponse.json(
            { error: "Archiving is not available yet. Please try again shortly." },
            { status: 503 }
          );
        }
        throw e;
      }
    }

    // Content edit path (owner edits own; admin may correct any post).
    // Post nature is immutable: `type`/`quotedPostId` (see
    // MODERATION_CONFIG.immutablePostFields) are stripped so an edit can
    // never morph a ROUTE into a ROUTE_REQUEST (or re-parent a response).
    // Archive state is equally untouched here — archiving has its own path
    // above and never alters content or type.
    const parsed = UPDATE_POST_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }
    const { ...editable } = parsed.data as Record<string, unknown>;
    for (const field of MODERATION_CONFIG.immutablePostFields) {
      delete editable[field];
    }

    const updated = await prisma.post.update({
      where: { id },
      data: editable as any,
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
    });

    return NextResponse.json({ post: updated }, { status: 200 });
  } catch (error) {
    console.error("Update post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const post = await prisma.post.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    // Owner or admin (admin identity is never revealed to the author).
    if (post.userId !== (user as any).id && !isAdmin(user as any)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Single atomic delete — cascades (likes/bookmarks/comments/notifications)
    // are enforced by the Prisma relations, so no partial state survives.
    await prisma.post.delete({ where: { id } });
    return NextResponse.json({ message: "Post deleted" }, { status: 200 });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
