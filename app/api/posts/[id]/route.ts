import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { UPDATE_POST_SCHEMA } from "@/app/lib/schemas/post";
import { MODERATION_CONFIG, MEDIA_CLEANUP_CONFIG } from "@/app/lib/config";
import { qstashService } from "@/app/lib/services/qstashService";
import { normalizeRouteSteps } from "@/app/lib/config/routeSteps";
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

    // Live trust breakdown via the canonical service shared with every list
    // surface (feed/search/profile/suggestions). Same inputs, same engine,
    // same numbers — so the feed card and the detail view can never disagree
    // on corroboration (or any other row). Best-effort, never fails the read.
    let validityBreakdown: Record<string, number> | undefined;
    let liveScore: number | undefined;
    let liveTier: string | undefined;
    try {
      const { getLiveBreakdownForPost } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      const live = await getLiveBreakdownForPost(prisma, post);
      if (live) {
        validityBreakdown = {
          community: live.community,
          detail: live.detail,
          corroboration: live.corroboration,
          recency: live.recency,
          reputation: live.reputation,
          engagement: live.engagement,
          score: live.score,
        };
        liveScore = live.score;
        liveTier = live.tier;
      }
    } catch { validityBreakdown = undefined; }

    return NextResponse.json(
      {
        post: {
          ...post,
          // Live score/tier overwrite the stored row so the badge NUMBER
          // matches the breakdown on every surface (feed card == detail).
          ...(liveScore !== undefined ? { validityScore: liveScore } : {}),
          ...(liveTier !== undefined ? { validityTier: liveTier } : {}),
          _isLiked,
          _isBookmarked,
          responses,
          responsesCount: responses.length,
          validityBreakdown,
        },
      },
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
      const flattened = parsed.error.flatten();
      const { firstRouteServerMessage } = await import("@/app/lib/config/routeValidation");
      const friendly = firstRouteServerMessage(flattened, "Validation failed");
      console.warn("[PATCH /api/posts/:id] validation failed", JSON.stringify(flattened));
      return NextResponse.json({ error: "Validation failed", ...(friendly ? { message: friendly } : {}), details: flattened }, { status: 400 });
    }
    const { ...editable } = parsed.data as Record<string, unknown>;
    for (const field of MODERATION_CONFIG.immutablePostFields) {
      delete editable[field];
    }
    // Destination is the final stop — strip any fare/vehicle it carries so
    // an edit can never attach a leg beyond the destination.
    if (Array.isArray(editable.routes)) {
      editable.routes = normalizeRouteSteps(
        editable.routes as { location: string; description?: string; vehicle?: string; fare?: number }[]
      );
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

    // Edited content can change the detail leg — recompute (fire-and-forget).
    try {
      void qstashService.publishValidityRecompute({ postId: id });
    } catch { /* non-critical */ }

    // Updated-assets hygiene (ACID-safe): DB committed above; removed
    // Cloudinary images are destroyed best-effort and never fail the edit.
    try {
      if (MEDIA_CLEANUP_CONFIG.enabled && MEDIA_CLEANUP_CONFIG.postEditCleanupEnabled) {
        const { diffRemovedUrls } = await import("@/app/lib/utils/cloudinaryUrls");
        const removed = diffRemovedUrls(
          (post as { images?: unknown }).images,
          (updated as { images?: unknown }).images
        );
        if (removed.length > 0) {
          const { cleanupImagesInBackground } = await import(
            "@/app/lib/services/mediaCleanupService"
          );
          cleanupImagesInBackground(removed, { source: "post-edit", postId: id });
        }
      }
    } catch { /* non-critical */ }

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

    const post = await prisma.post.findUnique({ where: { id }, select: { id: true, userId: true, images: true } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    // Owner or admin (admin identity is never revealed to the author).
    if (post.userId !== (user as any).id && !isAdmin(user as any)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Single atomic delete — cascades (likes/bookmarks/comments/notifications)
    // are enforced by the Prisma relations, so no partial state survives.
    // Asset images are captured BEFORE the delete; Cloudinary cleanup runs
    // AFTER the commit (best-effort, never fails the delete).
    const orphanCandidates: string[] = Array.isArray(post.images) ? [...post.images] : [];
    await prisma.post.delete({ where: { id } });
    try {
      if (MEDIA_CLEANUP_CONFIG.enabled && MEDIA_CLEANUP_CONFIG.postDeleteCleanupEnabled && orphanCandidates.length > 0) {
        const { cleanupImagesInBackground } = await import(
          "@/app/lib/services/mediaCleanupService"
        );
        cleanupImagesInBackground(orphanCandidates, { source: "post-delete", postId: id });
      }
    } catch { /* non-critical */ }
    return NextResponse.json({ message: "Post deleted" }, { status: 200 });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
