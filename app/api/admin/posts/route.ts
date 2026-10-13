import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { MEDIA_CLEANUP_CONFIG } from "@/app/lib/config";
import { logAudit } from "@/app/lib/services/auditService";

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
    // Config-driven sort (?sort=&dir= validated; default preserves legacy
    // newest-first, non-breaking).
    const postSortParam = (searchParams.get("sort") ?? "createdAt").trim();
    const postDirParam = (searchParams.get("dir") ?? "desc").trim().toLowerCase();
    const allowedPostSort = ["createdAt", "validityScore", "likes", "views", "title"] as const;
    const postSortField = (allowedPostSort as readonly string[]).includes(postSortParam) ? postSortParam : "createdAt";
    const postSortDir = postDirParam === "asc" ? "asc" : "desc";
    const postOrderBy = [{ [postSortField]: postSortDir }, { id: postSortDir }] as never;

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
        orderBy: postOrderBy,
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
        orderBy: postOrderBy,
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
      // Audit every admin archive/restore (fire-and-forget, never fails the op).
      void logAudit({
        actorId: (user as { id?: string }).id ?? null,
        action: isArchived ? "post.archive" : "post.restore",
        entity: "post",
        metadata: { postIds: targets.slice(0, 50), count: targets.length },
      });
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

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!isPrivileged(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { postId, title, description, tags } = body as {
      postId?: unknown; title?: unknown; description?: unknown; tags?: unknown;
    };
    if (typeof postId !== "string" || postId.length === 0) {
      return NextResponse.json({ error: "postId required" }, { status: 400 });
    }
    // Admin edit is intentionally narrow: title / description / tags only.
    // Post nature (type/quotedPostId), route legs, and archive state are
    // never touched here, so an admin correction can never morph a ROUTE
    // into a ROUTE_REQUEST or unhide an archived post by accident.
    const data: { title?: string; description?: string | null; tags?: string[] } = {};
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 200) {
        return NextResponse.json({ error: "Title must be 3–200 characters" }, { status: 400 });
      }
      data.title = title.trim();
    }
    if (description !== undefined) {
      if (typeof description !== "string" || description.length > 5000) {
        return NextResponse.json({ error: "Description must be under 5000 characters" }, { status: 400 });
      }
      data.description = description.trim().length === 0 ? null : description.trim();
    }
    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.length > 10 || tags.some((t) => typeof t !== "string")) {
        return NextResponse.json({ error: "Tags must be a list of up to 10 strings" }, { status: 400 });
      }
      data.tags = tags.map((t) => (t as string).trim().slice(0, 40)).filter(Boolean);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const updated = await prisma.post.update({ where: { id: postId }, data });
    // Audit every admin edit (fire-and-forget, never fails the op).
    void logAudit({
      actorId: (user as { id?: string }).id ?? null,
      action: "post.edit",
      entity: "post",
      entityId: postId,
      metadata: {
        title: typeof updated.title === "string" ? updated.title.slice(0, 120) : "",
        fields: Object.keys(data),
      },
    });
    return NextResponse.json({ success: true, post: updated }, { status: 200 });
  } catch (error) {
    console.error("Admin post edit error:", error);
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

    // Audit every admin delete (fire-and-forget, never fails the op).
    void logAudit({
      actorId: (user as { id?: string }).id ?? null,
      action: "post.delete",
      entity: "post",
      metadata: {
        postIds: targets.slice(0, 50),
        count: snapshots.length,
        titles: (snapshots as { title?: unknown }[]).slice(0, 10).map((s) =>
          typeof s.title === "string" ? s.title.slice(0, 120) : ""
        ),
      },
    });

    // ACID-safe media hygiene: tx committed above; destroy orphaned
    // Cloudinary assets best-effort (never fails the admin delete).
    try {
      if (MEDIA_CLEANUP_CONFIG.enabled && MEDIA_CLEANUP_CONFIG.postDeleteCleanupEnabled) {
        const urls = (snapshots as { images?: unknown }[]).flatMap((s) =>
          Array.isArray(s.images) ? (s.images as string[]) : []
        );
        if (urls.length > 0) {
          const { cleanupImagesInBackground } = await import(
            "@/app/lib/services/mediaCleanupService"
          );
          cleanupImagesInBackground(urls, { source: "admin-post-delete" });
        }
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, deleted: snapshots.length, snapshots, snapshot: snapshots[0] }, { status: 200 });
  } catch (error) {
    console.error("Admin post delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
