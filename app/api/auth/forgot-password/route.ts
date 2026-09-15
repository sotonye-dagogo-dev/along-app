import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { setResetToken } from "@/app/lib/services/otpStore";
import crypto from "crypto";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateCheck = checkRateLimit(request, "auth");
    if (!rateCheck.allowed) return rateCheck.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch (e) {
      if (e instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
      }
      throw e;
    }
    const { email } = body as { email?: unknown };
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ message: "If an account exists, reset instructions will be sent." }, { status: 200 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hashPassword(token);
    const key = `reset:${normalizedEmail}`;
    // Never let Redis block the response — falls back to memory in <1.5s
    await setResetToken(key, tokenHash, 3600);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${appUrl}/reset-password/${token}?email=${encodeURIComponent(normalizedEmail)}`;

    // Non-blocking email send — never hold request waiting for Resend/SMTP
    const sendInBackground = async () => {
      try {
        const { sendPasswordResetEmail } = await import("@/app/lib/services/emailService");
        const result = await sendPasswordResetEmail(normalizedEmail, resetLink);
        if (!result.sent && process.env.NODE_ENV !== "production") {
          console.log(`[DEV] Password reset link for ${normalizedEmail}: ${resetLink}`);
        }
      } catch (e) {
        console.error("[forgot-password] background email failed", e);
        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] Password reset link for ${normalizedEmail}: ${resetLink}`);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeWaitUntil = (globalThis as any)?.waitUntil as ((p: Promise<void>) => void) | undefined;
    if (maybeWaitUntil) {
      maybeWaitUntil(sendInBackground());
    } else {
      void sendInBackground();
    }

    return NextResponse.json({ message: "If an account exists, reset instructions will be sent." }, { status: 200 });
  } catch (error) {
    console.error("Forgot password error:", error);
    Sentry.captureException(error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
    }
    if (error instanceof Error && (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError")) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
