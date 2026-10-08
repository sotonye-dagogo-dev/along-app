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

    await prisma.bugReport.create({
      data: {
        title,
        category: category as never,
        description,
        reporterId,
        ...(linkedPostId ? { postId: linkedPostId } : {}),
        ...(metadata && typeof metadata === "object" ? { metadata } : {}),
      },
    });

    try {
      const emailResult = await sendBugReportNotification(title, category, description);
      if (!emailResult.sent) {
        console.warn(`[bug-report] notification failed: ${emailResult.reason}`);
        Sentry.captureMessage(`Bug report notification failed: ${emailResult.reason}`, "warning");
      }
    } catch (e) {
      console.error("[bug-report] notification exception", e);
      Sentry.captureException(e);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Bug report submission error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
