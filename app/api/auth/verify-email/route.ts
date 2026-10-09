import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import {
  getOtp,
  delOtp,
  setOtp,
  setSendCooldown,
  getSendCooldownRemaining,
  recordVerifyAttempt,
  clearVerifyAttempts,
} from "@/app/lib/services/otpStore";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getAppUrl } from "@/app/lib/config/env";
import { AUTH_VERIFICATION_CONFIG, cooldownKeyFor, attemptsKeyFor } from "@/app/lib/config/authVerification";
import { z } from "zod";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

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
    if (!rate.allowed) {
      const retryAfter = Number(rate.response.headers.get("Retry-After") ?? "900");
      return NextResponse.json(
        {
          error: AUTH_VERIFICATION_CONFIG.copy.rateLimited(retryAfter),
          retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
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

    // Same per-email cooldown as OTP resend — both write `otp:{email}`, so
    // both honour the same timer and the client never sees "wasn't sent any".
    // Fail-fast budget: cooldown check + bcrypt hash run concurrently so a
    // slow/deprovisioned Upstash host costs ~800ms (otpStore timeout), not
    // 2.5s+ sequential per op. Writes below are parallel for the same reason
    // — total Redis worst-case ~1.6s, well inside maxDuration=30.
    const cooldownKey = cooldownKeyFor(email);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const [remainingAfter, otpHash] = await Promise.all([
      getSendCooldownRemaining(cooldownKey),
      hashPassword(otp),
    ]);
    if (remainingAfter > 0) {
      return NextResponse.json(
        {
          error: AUTH_VERIFICATION_CONFIG.copy.resendCooldown(remainingAfter),
          retryAfter: remainingAfter,
        },
        { status: 429, headers: { "Retry-After": String(remainingAfter) } }
      );
    }
    await Promise.all([
      setOtp(`otp:${email}`, otpHash, AUTH_VERIFICATION_CONFIG.otpTtlSeconds),
      setSendCooldown(cooldownKey, AUTH_VERIFICATION_CONFIG.resendCooldownSeconds),
    ]);
    const appUrl = getAppUrl();
    let delivered = false;
    let sendReason: string | undefined;
    try {
      const { sendVerifyEmail } = await import("@/app/lib/services/emailService");
      const r = await sendVerifyEmail(email, firstName, otp, `${appUrl}/verify-email?email=${encodeURIComponent(email)}`);
      delivered = r.sent;
      sendReason = r.sent ? undefined : r.reason;
      if (!r.sent) console.warn(`[verify-email] send failed for ${email}: ${r.reason}`);
    } catch (e) {
      console.error("[verify-email] send error", e);
      Sentry.captureException(e);
      sendReason = "Email service error — code saved, delivery uncertain.";
    }
    return NextResponse.json(
      {
        message: delivered ? "Verification code sent — use the newest email." : AUTH_VERIFICATION_CONFIG.copy.sendFailed,
        sent: delivered,
        ...(sendReason ? { reason: sendReason } : {}),
        expiresIn: AUTH_VERIFICATION_CONFIG.otpTtlSeconds,
        cooldown: AUTH_VERIFICATION_CONFIG.resendCooldownSeconds,
        invalidatesPrevious: true,
      },
      { status: 200 }
    );
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** PUT /api/auth/verify-email — confirm OTP (delegates to the same store as /api/auth/otp). */
const ConfirmSchema = z.object({ email: z.string().email(), otp: z.string().min(4).max(12) });

export async function PUT(request: NextRequest) {
  try {
    // Brute-force guard (previously unlimited). Shares the auth bucket; the
    // client surfaces retryAfter as a wait timer, not a dead end.
    const rate = checkRateLimit(request, "auth");
    if (!rate.allowed) {
      const retryAfter = Number(rate.response.headers.get("Retry-After") ?? "900");
      return NextResponse.json(
        {
          error: AUTH_VERIFICATION_CONFIG.copy.rateLimited(retryAfter),
          retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse({ email: typeof body.email === "string" ? body.email.trim().toLowerCase() : body.email, otp: typeof body.otp === "string" ? body.otp.trim() : body.otp });
    if (!parsed.success) return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
    const { email, otp } = parsed.data;
    const storedHash = await getOtp(`otp:${email}`);
    if (!storedHash) {
      await clearVerifyAttempts(attemptsKeyFor(email));
      return NextResponse.json(
        { error: AUTH_VERIFICATION_CONFIG.copy.expired, expired: true },
        { status: 400 }
      );
    }
    const ok = await verifyPassword(otp, storedHash);
    if (!ok) {
      const attempts = await recordVerifyAttempt(
        attemptsKeyFor(email),
        AUTH_VERIFICATION_CONFIG.otpTtlSeconds
      );
      const attemptsLeft = AUTH_VERIFICATION_CONFIG.maxVerifyAttempts - attempts;
      if (attempts >= AUTH_VERIFICATION_CONFIG.maxVerifyAttempts) {
        await delOtp(`otp:${email}`);
        await clearVerifyAttempts(attemptsKeyFor(email));
        return NextResponse.json(
          { error: AUTH_VERIFICATION_CONFIG.copy.attemptsExhausted, expired: true },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: AUTH_VERIFICATION_CONFIG.copy.incorrect(Math.max(0, attemptsLeft)),
          attemptsLeft: Math.max(0, attemptsLeft),
        },
        { status: 400 }
      );
    }
    await delOtp(`otp:${email}`);
    await clearVerifyAttempts(attemptsKeyFor(email));
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
