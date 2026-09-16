import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { sendContactNotification } from "@/app/lib/services/emailService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: "name, email, and message are required" }, { status: 400 });
    }

    if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid field types" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (name.length < 1 || name.length > 100) {
      return NextResponse.json({ error: "Name must be between 1 and 100 characters" }, { status: 400 });
    }

    if (message.length < 1 || message.length > 5000) {
      return NextResponse.json({ error: "Message must be between 1 and 5000 characters" }, { status: 400 });
    }

    await prisma.contactSubmission.create({
      data: { name, email, message },
    });

    // Email notification is best-effort — DB write already succeeded; log failure but don't fail user request
    try {
      const emailResult = await sendContactNotification(name, email, message);
      if (!emailResult.sent) {
        console.warn(`[contact] notification failed: ${emailResult.reason}`);
        Sentry.captureMessage(`Contact notification failed: ${emailResult.reason}`, "warning");
      }
    } catch (e) {
      console.error("[contact] notification exception", e);
      Sentry.captureException(e);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Contact submission error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
