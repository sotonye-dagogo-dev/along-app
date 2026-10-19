import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { sendBugReportNotification } from "@/app/lib/services/emailService";
import { sanitizeReportImageUrls, BUG_REPORT_DEDUP_CONFIG } from "@/app/lib/config/reportAttachments";
import type { IncomingBugReport } from "@/app/lib/services/bugReportDedupService";

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

    // ACID dedup + create, single-writer per reporter: the per-reporter
    // advisory lock (bugReportDedupService) spans find + insert inside ONE
    // transaction, closing the read-then-write race that let a double-fire
    // insert TWO rows which were then handed to two DIFFERENT admins.
    // Match order (title deliberately not required for identity matches):
    //   1. idempotency key (clientToken / header) — strongest signal;
    //   2. same error identity (metadata.path + metadata.digest);
    //   3. exact description (legacy content match).
    // Scoped to the same reporter (or both-anonymous) so two different users
    // filing similar reports never collapse into one row.
    const { assignAdminForIssue } = await import("@/app/lib/services/adminAssignmentService");
    const dedup = await import("@/app/lib/services/bugReportDedupService");
    // Single assignment pick, resolved BEFORE the transaction (load reads
    // never sit inside the write tx) and reused for the create or the
    // duplicate self-heal — either way exactly ONE admin ends up on the row.
    const assignee = await assignAdminForIssue().catch(() => null);
    const clientMeta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
    const incoming: IncomingBugReport = {
      reporterId,
      description,
      idempotencyKey,
      clientPath: typeof clientMeta.path === "string" ? clientMeta.path : null,
      clientDigest: typeof clientMeta.digest === "string" ? clientMeta.digest : null,
    };
    const windowStart = dedup.dedupWindowStart();

    type Outcome =
      | { kind: "duplicate"; id: string; healed: boolean }
      | { kind: "created"; id: string };
    const outcome: Outcome = await prisma.$transaction(
      async (tx) => {
        await dedup.acquireBugReportDedupLock(tx, reporterId);
        const dup = await dedup.findDuplicateBugReport(tx, incoming, windowStart);
        if (dup) {
          if (dup.reviewerId || !assignee) {
            return { kind: "duplicate" as const, id: dup.id, healed: false };
          }
          // Self-heal: the original row survived without an assignee (crash
          // window / no admin resolved at insert time). Assign exactly one
          // admin here — the row can never stay unowned again.
          await tx.bugReport.update({ where: { id: dup.id }, data: { reviewerId: assignee.id } });
          return { kind: "duplicate" as const, id: dup.id, healed: true };
        }
        const created = await tx.bugReport.create({
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
        return { kind: "created" as const, id: created.id };
      },
      { maxWait: 10_000, timeout: 15_000 }
    );

    if (outcome.kind === "duplicate") {
      // Self-healed rows never received their assignment fan-out — deliver it
      // now. Plain duplicates (assignee already set) were notified by the
      // winning request; re-notifying would double-ping the same admin.
      if (outcome.healed && assignee) {
        try {
          const emailResult = await sendBugReportNotification(
            title,
            category,
            description,
            assignee.email,
            outcome.id,
          );
          if (!emailResult.sent) {
            console.warn(`[bug-report] healed-assignment email failed: ${emailResult.reason}`);
          }
          const { createNotification } = await import("@/app/lib/services/notificationService");
          void createNotification({
            type: "REPORT",
            actorId: reporterId ?? assignee.id,
            message: `New ${category} report assigned to you: ${title.slice(0, 120)}`,
            recipientIds: [assignee.id],
            allowSelf: true,
            metadata: { bugId: outcome.id },
          });
        } catch (e) {
          console.error("[bug-report] healed-assignment fan-out failed", e);
          Sentry.captureException(e);
        }
      }
      return NextResponse.json({ success: true, id: outcome.id, deduped: true }, { status: 200 });
    }

    // Single-admin assignment already resolved above; fan-out is
    // best-effort (never fails the 201). Reporter also gets the new
    // bugReportReceived user email (template-gated) plus in-app receipt.
    try {
      const emailResult = await sendBugReportNotification(
        title,
        category,
        description,
        assignee?.email ?? undefined,
        outcome.id,
      );
      if (!emailResult.sent) {
        console.warn(`[bug-report] notification failed: ${emailResult.reason}`);
        Sentry.captureMessage(`Bug report notification failed: ${emailResult.reason}`, "warning");
      }
      const { createNotification } = await import("@/app/lib/services/notificationService");
      const actorId = reporterId ?? assignee?.id;
      if (actorId && assignee) {
        // Assignee ping (in-app). allowSelf covers the anonymous-reporter
        // case where the assignee doubles as the notification actor.
        // metadata.bugId deep-links the click to THIS queue entry.
        void createNotification({
          type: "REPORT",
          actorId,
          message: `New ${category} report assigned to you: ${title.slice(0, 120)}`,
          recipientIds: [assignee.id],
          allowSelf: true,
          metadata: { bugId: outcome.id },
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
              reportId: outcome.id,
            });
          }
        } catch { /* receipt email is non-critical */ }
      }
    } catch (e) {
      // Assignment fan-out is best-effort; fall back to the platform inbox.
      console.error("[bug-report] assignment exception", e);
      Sentry.captureException(e);
      try {
        const emailResult = await sendBugReportNotification(
          title,
          category,
          description,
          undefined,
          outcome.id,
        );
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
        entityId: outcome.id,
        metadata: { kind: "bug-report", category, ...(linkedPostId ? { postId: linkedPostId } : {}) },
      });
    } catch {
      /* audit writes are non-critical */
    }

    return NextResponse.json({ success: true, id: outcome.id }, { status: 201 });
  } catch (error) {
    console.error("Bug report submission error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
