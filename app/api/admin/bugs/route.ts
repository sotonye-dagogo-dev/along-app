import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { MEDIA_CLEANUP_CONFIG, clampPageLimit } from "@/app/lib/config";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const cursor = searchParams.get("cursor");
    const limit = clampPageLimit(searchParams.get("limit"), "admin");
    // Config-driven sort (?sort=&dir= validated against allow-list;
    // default preserves legacy newest-first, non-breaking).
    const sortParam = (searchParams.get("sort") ?? "createdAt").trim();
    const dirParam = (searchParams.get("dir") ?? "desc").trim().toLowerCase();
    const allowedSort = ["createdAt", "title", "status", "category"] as const;
    const sortField = (allowedSort as readonly string[]).includes(sortParam) ? sortParam : "createdAt";
    const sortDir = dirParam === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const bugs = await prisma.bugReport.findMany({
      where: where as never,
      include: {
        // Email rides along for the admin modal's reporter-identification
        // block (admin-only surface — never serialized to end users).
        reporter: { select: { id: true, firstName: true, lastName: true, userName: true, avatar: true, email: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true, userName: true } },
        post: { select: { id: true, title: true, userId: true } },
      },
      orderBy: [{ [sortField]: sortDir } as never, { id: sortDir } as never],
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
    const { bugId, bugIds, status, reviewerId, action, statusNote } = body as {
      bugId?: string; bugIds?: string[]; status?: string; reviewerId?: string; action?: string;
      /** Optional admin-entered reporter note (sanitized + capped server-side). */
      statusNote?: string;
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

      const updated = await prisma.bugReport.updateMany({
        where: { id: { in: targets } },
        data: data as never,
      });

      // Audit trail (non-critical): status-only triage transitions.
      try {
        const { logAudit } = await import("@/app/lib/services/auditService");
        void logAudit({
          actorId: user.id as string,
          action: "report.status",
          entity: "report",
          metadata: { targets, status },
        });
      } catch {
        /* audit writes are non-critical */
      }

      // User-facing lifecycle emails + in-app ping for status transitions the
      // reporter cares about (IN_PROGRESS / RESOLVED / CLOSED). Best-effort,
      // never fails the PATCH — keeps admin UX snappy. An admin-entered
      // `statusNote` overrides the default copy (sanitized + capped here so
      // the modal input can never inject HTML or blow up email layout).
      const customNote = typeof statusNote === "string" && statusNote.trim()
        ? statusNote.trim().slice(0, 1000)
        : null;
      if (["IN_PROGRESS", "RESOLVED", "CLOSED"].includes(String(status))) {
        void (async () => {
          try {
            const reports = await prisma.bugReport.findMany({
              where: { id: { in: targets } },
              select: {
                id: true, title: true, status: true, reporterId: true,
                reporter: { select: { email: true, firstName: true } },
              },
              take: 50,
            });
            const { sendBugReportStatusEmail } = await import("@/app/lib/services/emailService");
            const { createNotification } = await import("@/app/lib/services/notificationService");
            const { BUG_REPORT_STATUS_COPY } = await import("@/app/lib/config/bugReports");
            const { stripTags } = await import("@/app/lib/utils/emailSanitize");
            for (const r of reports) {
              if (!r.reporterId) continue;
              const fallback = (BUG_REPORT_STATUS_COPY as Record<string, string>)[String(r.status)] ?? (BUG_REPORT_STATUS_COPY as Record<string, string>).DEFAULT;
              const note = customNote ? stripTags(customNote).slice(0, 1000) || fallback : fallback;
              void createNotification({
                type: "REPORT",
                actorId: (user.id as string) ?? r.reporterId,
                message: `Your bug report "${r.title.slice(0, 100)}" is now ${String(r.status).replace("_", " ")}. ${note.slice(0, 200)}`,
                recipientIds: [r.reporterId],
                allowSelf: true,
              });
              const email = (r as { reporter?: { email?: string | null; firstName?: string | null } | null }).reporter?.email;
              if (email) {
                void sendBugReportStatusEmail(email, {
                  firstName: (r as { reporter?: { firstName?: string | null } | null }).reporter?.firstName ?? "there",
                  title: r.title.slice(0, 200),
                  status: String(r.status).replace("_", " "),
                  statusNote: note,
                  reportId: r.id,
                });
              }
            }
          } catch { /* lifecycle fan-out is non-critical */ }
        })();
      }

      return NextResponse.json({ success: true, updated: updated.count ?? targets.length }, { status: 200 });
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
    // message carries no admin or author identity). Admin-entered note
    // overrides the canned outcome copy when provided.
    try {
      if (report.reporterId) {
        const { createNotification } = await import("@/app/lib/services/notificationService");
        const { stripTags } = await import("@/app/lib/utils/emailSanitize");
        const outcomeDefault = OUTCOME_COPY[action as string] ?? OUTCOME_COPY.DISMISS;
        const outcome = typeof statusNote === "string" && statusNote.trim()
          ? stripTags(statusNote.trim()).slice(0, 1000) || outcomeDefault
          : outcomeDefault;
        await createNotification({
          type: "MODERATION",
          actorId: user.id as string,
          postId: report.postId ?? undefined,
          message: outcome,
          recipientIds: [report.reporterId],
        });
      }
    } catch (e) {
      console.error("[admin/bugs] outcome notification failed (non-critical):", e);
    }

    // Audit trail (non-critical): moderation outcome on a report.
    try {
      const { logAudit } = await import("@/app/lib/services/auditService");
      void logAudit({
        actorId: user.id as string,
        action: "report.moderate",
        entity: "report",
        entityId: targetBugId,
        metadata: { action, status, postId: report.postId ?? null },
      });
    } catch {
      /* audit writes are non-critical */
    }

    return NextResponse.json({ success: true, action }, { status: 200 });
  } catch (error) {
    console.error("Admin bug update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
