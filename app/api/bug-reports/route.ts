import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { sendBugReportNotification } from "@/app/lib/services/emailService";

const VALID_CATEGORIES = ["UI", "ROUTING", "AUTH", "PERFORMANCE", "DATA", "NOTIFICATIONS", "OTHER"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, category, description, postId, metadata } = body;

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

    const created = await prisma.bugReport.create({
      data: {
        title,
        category: category as never,
        description,
        reporterId,
        ...(linkedPostId ? { postId: linkedPostId } : {}),
        ...(metadata && typeof metadata === "object" ? { metadata } : {}),
      },
      select: { id: true },
    });

    // Single-admin assignment (load-balanced + randomized among equals):
    // exactly one admin owns the issue and gets the mail + in-app ping.
    // The reporter gets a confirmation that names the assignment state, so
    // "our team has been notified" is an actualised fact, not a platitude.
    try {
      const { assignAdminForIssue } = await import("@/app/lib/services/adminAssignmentService");
      const assignee = await assignAdminForIssue();
      if (assignee) {
        await prisma.bugReport.update({
          where: { id: created.id },
          data: { reviewerId: assignee.id },
        });
      }
      const emailResult = await sendBugReportNotification(title, category, description, assignee?.email);
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

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Bug report submission error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
