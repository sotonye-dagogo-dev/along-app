import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { getOtp, delOtp, setOtp } from "@/app/lib/services/otpStore";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getAppUrl } from "@/app/lib/config/env";
import { z } from "zod";

/**
 * POST /api/auth/verify-email — triggerable verification.
 * Body: { email? } — for authed users defaults to their own address.
 * Sends OTP via the verifyEmail template (OTP + link), toggle-respecting.
 * Availability: only when the account's email is unverified OR the caller
 * explicitly passes a different pending address (change-email uses its own
 * route; this one never flips verified on its own).
 */
const TriggerSchema = z.object({ email: z.string().email().optional() });

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit(request, "auth");
    if (!rate.allowed) return rate.response;
    const body = await request.json().catch(() => ({}));
    const parsed = TriggerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request format." }, { status: 400 });

    const authed = await getUserFromRequest().catch(() => null) as { id: string } | null;
    let email = parsed.data.email?.trim().toLowerCase() ?? null;
    let firstName = "traveller";
    if (authed) {
      const db = await prisma.user.findUnique({ where: { id: authed.id }, select: { email: true, firstName: true, verified: true } });
      if (!db) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (!email) { email = db.email.trim().toLowerCase(); firstName = db.firstName || firstName; }
      if (db.verified && email === db.email.trim().toLowerCase()) {
        return NextResponse.json({ message: "Email already verified", alreadyVerified: true }, { status: 200 });
      }
    }
    if (!email) return NextResponse.json({ error: "Sign in or provide an email address." }, { status: 400 });

    const target = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, firstName: true, verified: true } });
    if (!target) return NextResponse.json({ error: "No account found for this email." }, { status: 404 });
    if (target.verified && (!authed || target.id === authed.id)) {
      return NextResponse.json({ message: "Email already verified", alreadyVerified: true }, { status: 200 });
    }
    firstName = target.firstName || firstName;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setOtp(`otp:${email}`, await hashPassword(otp), 900);
    const appUrl = getAppUrl();
    try {
      const { sendVerifyEmail } = await import("@/app/lib/services/emailService");
      const r = await sendVerifyEmail(email, firstName, otp, `${appUrl}/verify-email?email=${encodeURIComponent(email)}`);
      if (!r.sent) console.warn(`[verify-email] send failed for ${email}: ${r.reason}`);
    } catch (e) {
      console.error("[verify-email] send error", e);
      Sentry.captureException(e);
    }
    return NextResponse.json({ message: "Verification code sent" }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** PUT /api/auth/verify-email — confirm OTP (delegates to the same store as /api/auth/otp). */
const ConfirmSchema = z.object({ email: z.string().email(), otp: z.string().min(4).max(12) });

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse({ email: typeof body.email === "string" ? body.email.trim().toLowerCase() : body.email, otp: body.otp });
    if (!parsed.success) return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
    const { email, otp } = parsed.data;
    const storedHash = await getOtp(`otp:${email}`);
    if (!storedHash) return NextResponse.json({ error: "Code expired or invalid. Request a new one." }, { status: 400 });
    const ok = await verifyPassword(otp, storedHash);
    if (!ok) return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
    await delOtp(`otp:${email}`);
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!user) return NextResponse.json({ error: "No account found for this email." }, { status: 404 });
    await prisma.user.update({ where: { id: user.id }, data: { verified: true } });
    try {
      const { createNotification } = await import("@/app/lib/services/notificationService");
      void createNotification({ type: "VERIFIED", actorId: user.id, message: "Your email is verified. Welcome aboard!", recipientIds: [user.id], allowSelf: true });
    } catch { /* non-critical */ }
    return NextResponse.json({ message: "Email verified", verified: true }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
