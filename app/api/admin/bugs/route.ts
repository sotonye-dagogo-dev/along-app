import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { MEDIA_CLEANUP_CONFIG } from "@/app/lib/config";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const bugs = await prisma.bugReport.findMany({
      where: where as never,
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, userName: true, avatar: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true, userName: true } },
        post: { select: { id: true, title: true, userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = bugs.length > limit;
    const resultBugs = hasMore ? bugs.slice(0, limit) : bugs;
    const nextCursor = hasMore ? resultBugs[resultBugs.length - 1].id : null;

    return NextResponse.json({ bugs: resultBugs, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("Admin bugs list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- P2022-tolerant casts for the additive archive columns */
function isMissingColumnError(error: unknown): boolean {
  return error instanceof Error && ((error as any).code === "P2022" || (error as any).code === "P2010");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const OUTCOME_COPY: Record<string, string> = {
  DISMISS: "Thanks for reporting — our team reviewed it and found no violation.",
  ARCHIVE_POST: "Thanks for reporting — the post was hidden from feeds while under review.",
  REMOVE_POST: "Thanks for reporting — the post was removed for violating community standards.",
};

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { bugId, bugIds, status, reviewerId, action } = body as {
      bugId?: string; bugIds?: string[]; status?: string; reviewerId?: string; action?: string;
    };
    const targets: string[] = bugIds?.length ? bugIds : bugId ? [bugId] : [];

    if (targets.length === 0 || !status) {
      return NextResponse.json({ error: "bugId(s) and status required" }, { status: 400 });
    }

    // Moderation action on the linked post (ACID: bug status + post change in
    // one transaction). Reporter gets an outcome notification (MODERATION);
    // neither the author nor the reporter ever learns the other's identity,
    // and the acting admin's identity is never exposed to either party.
    const validActions = ["DISMISS", "ARCHIVE_POST", "REMOVE_POST"] as const;
    const moderating =
      typeof action === "string" && (validActions as readonly string[]).includes(action);

    if (!moderating) {
      const data: Record<string, unknown> = { status };
      if (reviewerId) data.reviewerId = reviewerId;
      if (status === "RESOLVED" || status === "CLOSED") data.resolvedAt = new Date();

      await prisma.bugReport.updateMany({
        where: { id: { in: targets } },
        data: data as never,
      });

      return NextResponse.json({ success: true, updated: targets.length }, { status: 200 });
    }

    // Bulk moderation actions only support single-report flow (post linkage
    // differs per report); bulk callers loop single PATCH calls instead.
    const targetBugId = targets[0];

    const report = await prisma.bugReport.findUnique({
      where: { id: targetBugId },
      select: { id: true, postId: true, reporterId: true },
    });
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Capture asset URLs BEFORE the tx so post-commit Cloudinary cleanup can
    // run without a second read (and without blocking the moderation tx).
    let removedPostImages: string[] = [];
    if (action === "REMOVE_POST" && report.postId) {
      try {
        const doomed = await prisma.post.findUnique({
          where: { id: report.postId },
          select: { images: true },
        });
        if (doomed && Array.isArray(doomed.images)) removedPostImages = [...doomed.images];
      } catch { removedPostImages = []; }
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (action === "ARCHIVE_POST" && report.postId) {
          await (tx.post.update as (...a: never[]) => Promise<unknown>)({
            where: { id: report.postId },
            data: { isArchived: true, archivedAt: new Date() },
          } as never);
        } else if (action === "REMOVE_POST" && report.postId) {
          await tx.post.delete({ where: { id: report.postId } });
        }
        await tx.bugReport.update({
          where: { id: targetBugId },
          data: {
            status: status as never,
            reviewerId: (user.id as string) ?? undefined,
            resolvedAt: new Date(),
          },
        });
      });
    } catch (e) {
      if (isMissingColumnError(e) && action === "ARCHIVE_POST") {
        return NextResponse.json(
          { error: "Hiding posts is not available yet. Please try again shortly." },
          { status: 503 }
        );
      }
      throw e;
    }

    // ACID-safe media hygiene: tx committed; orphaned Cloudinary assets from
    // a REMOVE_POST are destroyed best-effort (never fails moderation).
    try {
      if (
        action === "REMOVE_POST" &&
        MEDIA_CLEANUP_CONFIG.enabled &&
        MEDIA_CLEANUP_CONFIG.moderationDeleteCleanupEnabled &&
        removedPostImages.length > 0
      ) {
        const { cleanupImagesInBackground } = await import(
          "@/app/lib/services/mediaCleanupService"
        );
        cleanupImagesInBackground(removedPostImages, {
          source: "bug-remove-post",
          postId: report.postId ?? undefined,
        });
      }
    } catch { /* non-critical */ }

    // Outcome notification to the reporter (non-critical; anonymity kept —
    // message carries no admin or author identity).
    try {
      if (report.reporterId) {
        const { createNotification } = await import("@/app/lib/services/notificationService");
        await createNotification({
          type: "MODERATION",
          actorId: user.id as string,
          postId: report.postId ?? undefined,
          message: OUTCOME_COPY[action as string] ?? OUTCOME_COPY.DISMISS,
          recipientIds: [report.reporterId],
        });
      }
    } catch (e) {
      console.error("[admin/bugs] outcome notification failed (non-critical):", e);
    }

    return NextResponse.json({ success: true, action }, { status: 200 });
  } catch (error) {
    console.error("Admin bug update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
