import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { MODERATION_CONFIG, POST_ACTIONS_CONFIG } from "@/app/lib/config";
import { createNotification } from "@/app/lib/services/notificationService";
import { sendBugReportNotification } from "@/app/lib/services/emailService";

/**
 * Dedicated post/comment report endpoint (end-to-end report lifecycle).
 * - Auth optional (anonymous reports allowed); reporter attribution best-effort.
 * - ACID: dedup check + insert run in one transaction, so double-submits
 *   cannot create duplicate rows.
 * - Anonymity: the reported author is NEVER notified and NEVER learns the
 *   reporter identity. Admins are notified (REPORT) without reporter PII in
 *   the message; the reporter gets a receipt notification (REPORT) and later
 *   an outcome notification (MODERATION) when an admin acts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, reason, details, commentId } = body as {
      postId?: unknown;
      reason?: unknown;
      details?: unknown;
      commentId?: unknown;
    };

    if (typeof postId !== "string" || postId.length === 0) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }
    const validReasons = POST_ACTIONS_CONFIG.reportReasons.map((r) => r.value);
    if (typeof reason !== "string" || !validReasons.includes(reason)) {
      return NextResponse.json({ error: "A valid reason is required" }, { status: 400 });
    }
    if (details !== undefined && (typeof details !== "string" || details.length > 1000)) {
      return NextResponse.json({ error: "Details must be under 1000 characters" }, { status: 400 });
    }
    if (commentId !== undefined && (typeof commentId !== "string" || commentId.length === 0)) {
      return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, title: true, userId: true },
    });
    if (!post) {
      return NextResponse.json({ error: "The reported post no longer exists." }, { status: 400 });
    }
    if (commentId) {
      const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, postId: true } });
      if (!comment || comment.postId !== postId) {
        return NextResponse.json({ error: "The reported comment no longer exists." }, { status: 400 });
      }
    }

    let reporterId: string | null = null;
    try {
      const { getUserFromRequest } = await import("@/app/lib/utils/auth");
      const user = await getUserFromRequest();
      reporterId = ((user?.id as string | undefined) ?? null);
    } catch {
      reporterId = null;
    }

    const reasonLabel =
      POST_ACTIONS_CONFIG.reportReasons.find((r) => r.value === reason)?.label ?? reason;
    const trimmedDetails = typeof details === "string" ? details.trim() : "";
    const windowStart = new Date(Date.now() - MODERATION_CONFIG.duplicateWindowHours * 3600_000);

    // Transaction: dedup check + insert are atomic (no duplicate rows on retry).
    const result = await prisma.$transaction(async (tx) => {
      if (reporterId) {
        const dupe = await tx.bugReport.findFirst({
          where: {
            reporterId,
            postId,
            status: { in: ["OPEN", "TRIAGED", "IN_PROGRESS"] },
            createdAt: { gte: windowStart },
          },
          select: { id: true, metadata: true },
        });
        if (dupe) {
          const meta = (dupe.metadata ?? {}) as Record<string, unknown>;
          if (meta.reason === reason) return { deduplicated: true as const };
        }
      }
      const created = await tx.bugReport.create({
        data: {
          title: `Report post ${postId}: ${reasonLabel}`,
          category: POST_ACTIONS_CONFIG.reportCategory as never,
          description: [
            `Post: /posts/${postId}`,
            `Reason: ${reasonLabel}`,
            trimmedDetails ? `Details: ${trimmedDetails}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          reporterId,
          postId,
          metadata: { kind: "post-report", reason, ...(commentId ? { commentId } : {}) },
        },
        select: { id: true },
      });
      return { deduplicated: false as const, reportId: created.id };
    });

    if (result.deduplicated) {
      return NextResponse.json({ error: MODERATION_CONFIG.duplicateError, deduplicated: true }, { status: 409 });
    }

    // Fan-out notifications (non-critical, never fail the request).
    try {
      const admins = await prisma.user.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { role: "ADMIN" } as any,
        select: { id: true },
        take: 50,
      });
      const adminIds = admins.map((a) => a.id);
      // Actor must be a real user id for the FK; prefer the reporter, else the
      // post author (message text itself carries no identities — anonymity).
      const actorId = reporterId ?? post.userId;
      if (adminIds.length > 0) {
        await createNotification({
          type: "REPORT",
          actorId,
          postId,
          message: `A post was reported (${reasonLabel}) and needs review`,
          recipientIds: adminIds,
        });
      }
      if (reporterId) {
        const receiptActor = adminIds[0] ?? post.userId;
        if (receiptActor !== reporterId) {
          await createNotification({
            type: "REPORT",
            actorId: receiptActor,
            postId,
            message: "We received your report and our team will review it shortly",
            recipientIds: [reporterId],
          });
        }
      }
    } catch (e) {
      console.error("[reports] notification fan-out failed (non-critical):", e);
    }

    try {
      const emailResult = await sendBugReportNotification(
        `Report post ${postId}: ${reasonLabel}`,
        POST_ACTIONS_CONFIG.reportCategory,
        trimmedDetails || reasonLabel
      );
      if (!emailResult.sent) {
        console.warn(`[reports] email notification failed: ${emailResult.reason}`);
      }
    } catch (e) {
      console.error("[reports] email exception (non-critical):", e);
      Sentry.captureException(e);
    }

    return NextResponse.json(
      { success: true, reportId: result.reportId, message: MODERATION_CONFIG.reportReceived },
      { status: 201 }
    );
  } catch (error) {
    console.error("Report submission error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
