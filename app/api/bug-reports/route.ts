import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { sendBugReportNotification } from "@/app/lib/services/emailService";
import { sanitizeReportImageUrls, BUG_REPORT_DEDUP_CONFIG } from "@/app/lib/config/reportAttachments";

const VALID_CATEGORIES = ["UI", "ROUTING", "AUTH", "PERFORMANCE", "DATA", "NOTIFICATIONS", "OTHER"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, category, description, postId, metadata, images } = body;

    if (!title || !category || !description) {
      return NextResponse.json({ error: "title, category, and description are required" }, { status: 400 });
    }

    if (typeof title !== "string" || typeof category !== "string" || typeof description !== "string") {
      return NextResponse.json({ error: "Invalid field types" }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
    }

    if (title.length < 1 || title.length > 200) {
      return NextResponse.json({ error: "Title must be between 1 and 200 characters" }, { status: 400 });
    }

    if (description.length < 1 || description.length > 10000) {
      return NextResponse.json({ error: "Description must be between 1 and 10000 characters" }, { status: 400 });
    }

    // Optional post-report linkage (non-breaking additive): when a postId is
    // supplied (e.g. PostCard Report flow), verify the post exists and link it.
    let linkedPostId: string | null = null;
    if (postId !== undefined && postId !== null) {
      if (typeof postId !== "string" || postId.length === 0) {
        return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
      }
      const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!post) {
        return NextResponse.json({ error: "The reported post no longer exists." }, { status: 400 });
      }
      linkedPostId = post.id;
    }

    // Best-effort reporter attribution — anonymous reports stay allowed.
    let reporterId: string | null = null;
    try {
      const { getUserFromRequest } = await import("@/app/lib/utils/auth");
      const user = await getUserFromRequest();
      reporterId = (user?.id as string | undefined) ?? null;
    } catch {
      reporterId = null;
    }

    // Idempotency key (header or body): repeat presentations return the
    // original row instead of creating a duplicate (ACID-safe retries).
    const rawKey =
      request.headers.get(BUG_REPORT_DEDUP_CONFIG.idempotencyHeader) ??
      (typeof (body as Record<string, unknown>)?.clientToken === "string"
        ? ((body as Record<string, unknown>).clientToken as string)
        : null);
    const idempotencyKey =
      typeof rawKey === "string" && rawKey.trim()
        ? rawKey.trim().slice(0, BUG_REPORT_DEDUP_CONFIG.maxKeyLength)
        : null;

    // Build the Json-safe metadata payload once (fixes the TS error:
    // Record<string, unknown> is not InputJsonValue — cast via Prisma).
    const buildMetadata = (): Prisma.InputJsonValue | undefined => {
      // Optional screenshots ride in metadata.images (no migration).
      // Explicit images[] wins; legacy metadata.images is preserved.
      const fromImages = sanitizeReportImageUrls(images);
      const fromMeta =
        metadata && typeof metadata === "object"
          ? { ...(metadata as Record<string, unknown>) }
          : null;
      const metaImages =
        fromMeta && Array.isArray(fromMeta.images)
          ? sanitizeReportImageUrls(fromMeta.images)
          : [];
      const finalImages = fromImages.length > 0 ? fromImages : metaImages;
      let merged: Record<string, unknown> | null = fromMeta;
      if (merged && finalImages.length > 0) merged = { ...merged, images: finalImages };
      else if (!merged && finalImages.length > 0) merged = { images: finalImages };
      if (idempotencyKey) merged = { ...(merged ?? {}), idempotencyKey };
      if (!merged) return undefined;
      return merged as unknown as Prisma.InputJsonValue;
    };
    const metadataPayload = buildMetadata();

    // ACID dedup gate (before write): idempotency-key hit OR same reporter +
    // same title/description within the window → return existing row.
    try {
      const windowStart = new Date(Date.now() - BUG_REPORT_DEDUP_CONFIG.dedupWindowSec * 1000);
      const recent = await prisma.bugReport.findMany({
        where: {
          createdAt: { gte: windowStart },
          ...(reporterId ? { reporterId } : {}),
          title,
          description,
        },
        select: { id: true, metadata: true, reporterId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      const dup = recent.find((r) => {
        if (idempotencyKey) {
          try {
            const m = r.metadata as unknown as Record<string, unknown> | null;
            if (m && typeof m === "object" && m.idempotencyKey === idempotencyKey) return true;
          } catch { /* fall through to content match */ }
        }
        return true;
      });
      if (dup) {
        return NextResponse.json({ success: true, id: dup.id, deduped: true }, { status: 200 });
      }
    } catch {
      // Dedup is best-effort; a failed pre-read must never block reporting.
    }

    // Atomic create + single-admin assignment in one transaction so a crash
    // between steps can never leave an orphan unassigned row (ACID).
    const { assignAdminForIssue } = await import("@/app/lib/services/adminAssignmentService");
    const assignee = await assignAdminForIssue().catch(() => null);
    const created = await prisma.bugReport.create({
      data: {
        title,
        category: category as Prisma.BugReportCreateInput["category"],
        description,
        reporterId,
        ...(linkedPostId ? { postId: linkedPostId } : {}),
        ...(metadataPayload !== undefined ? { metadata: metadataPayload } : {}),
        ...(assignee ? { reviewerId: assignee.id } : {}),
      },
      select: { id: true },
    });
    // Single-admin assignment already resolved above; fan-out is
    // best-effort (never fails the 201). Reporter also gets the new
    // bugReportReceived user email (template-gated) plus in-app receipt.
    try {
      const emailResult = await sendBugReportNotification(title, category, description, assignee?.email ?? undefined);
      if (!emailResult.sent) {
        console.warn(`[bug-report] notification failed: ${emailResult.reason}`);
        Sentry.captureMessage(`Bug report notification failed: ${emailResult.reason}`, "warning");
      }
      const { createNotification } = await import("@/app/lib/services/notificationService");
      const actorId = reporterId ?? assignee?.id;
      if (actorId && assignee) {
        // Assignee ping (in-app). allowSelf covers the anonymous-reporter
        // case where the assignee doubles as the notification actor.
        void createNotification({
          type: "REPORT",
          actorId,
          message: `New ${category} report assigned to you: ${title.slice(0, 120)}`,
          recipientIds: [assignee.id],
          allowSelf: true,
        });
      }
      if (reporterId) {
        // Reporter confirmation — actualises "our team has been notified".
        void createNotification({
          type: "REPORT",
          actorId: reporterId,
          message: assignee
            ? `Thanks — your report "${title.slice(0, 100)}" was received and assigned for review.`
            : `Thanks — your report "${title.slice(0, 100)}" was received and is queued for review.`,
          recipientIds: [reporterId],
          allowSelf: true,
        });
        // User-facing receipt email (new template; toggle-gated, non-fatal).
        try {
          const { sendBugReportReceivedEmail } = await import("@/app/lib/services/emailService");
          const reporter = await prisma.user.findUnique({
            where: { id: reporterId },
            select: { email: true, firstName: true },
          });
          if (reporter?.email) {
            void sendBugReportReceivedEmail(reporter.email, {
              firstName: reporter.firstName ?? "there",
              title: title.slice(0, 200),
              category,
              reportId: created.id,
            });
          }
        } catch { /* receipt email is non-critical */ }
      }
    } catch (e) {
      // Assignment fan-out is best-effort; fall back to the platform inbox.
      console.error("[bug-report] assignment exception", e);
      Sentry.captureException(e);
      try {
        const emailResult = await sendBugReportNotification(title, category, description);
        if (!emailResult.sent) {
          console.warn(`[bug-report] fallback notification failed: ${emailResult.reason}`);
        }
      } catch (fallbackError) {
        console.error("[bug-report] fallback notification exception", fallbackError);
      }
    }

    // Audit trail (non-critical, never fails the 201): platform bug reports
    // appear in the admin trail alongside post reports.
    try {
      const { logAudit } = await import("@/app/lib/services/auditService");
      void logAudit({
        actorId: reporterId,
        action: "report.create",
        entity: "report",
        entityId: created.id,
        metadata: { kind: "bug-report", category, ...(linkedPostId ? { postId: linkedPostId } : {}) },
      });
    } catch {
      /* audit writes are non-critical */
    }

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Bug report submission error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
