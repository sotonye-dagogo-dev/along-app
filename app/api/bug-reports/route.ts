import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { sendBugReportNotification } from "@/app/lib/services/emailService";

const VALID_CATEGORIES = ["UI", "ROUTING", "AUTH", "PERFORMANCE", "DATA", "NOTIFICATIONS", "OTHER"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, category, description } = body;

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

    await prisma.bugReport.create({
      data: {
        title,
        category: category as never,
        description,
        reporterId: null,
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
