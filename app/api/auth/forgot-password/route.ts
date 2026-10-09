import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { setResetToken } from "@/app/lib/services/otpStore";
import {
  normalizeResetEmail,
  storeResetTokenDb,
  deleteResetTokensForEmail,
} from "@/app/lib/services/resetTokenStore";
import crypto from "crypto";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

const GENERIC_OK = { message: "If an account exists, reset instructions will be sent." };

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
    const normalizedEmail = normalizeResetEmail(email);
    if (!normalizedEmail) {
      // Keep generic vs specific: invalid format is a client error worth flagging,
      // missing account stays generic to avoid enumeration.
      if (!email || typeof email !== "string" || !email.trim()) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Case-insensitive lookup: accounts created before normalization may have mixed-case emails.
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json(GENERIC_OK, { status: 200 });
    }
    // Canonical email = stored value lowercased, so issuance and verification use the same key.
    const canonicalEmail = user.email.trim().toLowerCase();

    const token = crypto.randomBytes(32).toString("hex");

    // Primary: durable Postgres store (survives serverless instance hops).
    // Fallback: legacy Redis/memory single-key store (pre-migration tokens).
    let dbAvailable = true;
    try {
      await storeResetTokenDb(canonicalEmail, token, 3600);
    } catch (e) {
      dbAvailable = false;
      console.warn("[forgot-password] DB store unavailable, using legacy Redis fallback", (e as Error)?.message);
    }
    try {
      const tokenHashLegacy = await hashPassword(token);
      await setResetToken(`reset:${canonicalEmail}`, tokenHashLegacy, 3600);
    } catch (e) {
      console.warn("[forgot-password] legacy Redis store failed", (e as Error)?.message);
      if (!dbAvailable) {
        return NextResponse.json(
          { error: "We're experiencing high demand. Please try again in a moment." },
          { status: 503 }
        );
      }
    }

    const { getAppUrl } = await import("@/app/lib/config/env");
    const appUrl = getAppUrl();
    const resetLink = `${appUrl}/reset-password/${token}?email=${encodeURIComponent(canonicalEmail)}`;

    // Tightened: await email with timeout. Never return success if mail didn't actually send.
    // Total budget: db/redis ~2s + email ~6s = <9s within 15s maxDuration, avoids stale false-positive.
    try {
      const { sendPasswordResetEmail } = await import("@/app/lib/services/emailService");
      const emailTimeoutMs = 6000;
      const result = await Promise.race([
        sendPasswordResetEmail(canonicalEmail, resetLink),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Email send timeout after ${emailTimeoutMs}ms`)), emailTimeoutMs)
        ),
      ]);

      if (!result.sent) {
        // Clean up stale token so user can retry immediately without waiting for TTL
        await deleteResetTokensForEmail(canonicalEmail).catch(() => {});
        const { delResetToken } = await import("@/app/lib/services/otpStore");
        await delResetToken(`reset:${canonicalEmail}`).catch(() => {});
        const reason = result.reason ?? "unknown";
        console.error(`[forgot-password] email delivery failed for ${canonicalEmail}: ${reason}`);
        Sentry.captureMessage(`Password reset email failed for ${canonicalEmail}: ${reason}`, "error");
        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] Password reset link for ${canonicalEmail}: ${resetLink}`);
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
      await deleteResetTokensForEmail(canonicalEmail).catch(() => {});
      const { delResetToken } = await import("@/app/lib/services/otpStore");
      await delResetToken(`reset:${canonicalEmail}`).catch(() => {});
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[forgot-password] email send exception for ${canonicalEmail}:`, errMsg);
      Sentry.captureException(e);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Password reset link for ${canonicalEmail}: ${resetLink}`);
      }
      return NextResponse.json(
        { error: "We couldn't send the reset email. Please try again in a moment. If this persists, contact support." },
        { status: 503 }
      );
    }

    return NextResponse.json(GENERIC_OK, { status: 200 });
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
