import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { delResetToken, setResetToken } from "@/app/lib/services/otpStore";
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

    // Tightened: await email with timeout. Never return success if mail didn't actually send.
    // Total budget: redis ~1.5s + email ~5s = <7s within 15s maxDuration, avoids stale false-positive.
    try {
      const { sendPasswordResetEmail } = await import("@/app/lib/services/emailService");
      const emailTimeoutMs = 6000;
      const result = await Promise.race([
        sendPasswordResetEmail(normalizedEmail, resetLink),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Email send timeout after ${emailTimeoutMs}ms`)), emailTimeoutMs)
        ),
      ]);

      if (!result.sent) {
        // Clean up stale token so user can retry immediately without waiting for TTL
        await delResetToken(key).catch(() => {});
        const reason = result.reason ?? "unknown";
        console.error(`[forgot-password] email delivery failed for ${normalizedEmail}: ${reason}`);
        Sentry.captureMessage(`Password reset email failed for ${normalizedEmail}: ${reason}`, "error");
        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] Password reset link for ${normalizedEmail}: ${resetLink}`);
        }
        // Return actionable error instead of false-positive success
        const isConfigError = reason.includes("not configured") || reason.includes("Template not found");
        return NextResponse.json(
          {
            error: isConfigError
              ? "Email service is temporarily unavailable. Please try again later or contact support."
              : "We couldn't send the reset email. Please try again in a moment. If this persists, contact support.",
          },
          { status: 503 }
        );
      }
    } catch (e) {
      await delResetToken(key).catch(() => {});
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[forgot-password] email send exception for ${normalizedEmail}:`, errMsg);
      Sentry.captureException(e);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Password reset link for ${normalizedEmail}: ${resetLink}`);
      }
      return NextResponse.json(
        { error: "We couldn't send the reset email. Please try again in a moment. If this persists, contact support." },
        { status: 503 }
      );
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
