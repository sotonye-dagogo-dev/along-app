import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import {
  getOtp,
  setOtp,
  delOtp,
  setSendCooldown,
  getSendCooldownRemaining,
  recordVerifyAttempt,
  clearVerifyAttempts,
} from "@/app/lib/services/otpStore";
import { getAppUrl } from "@/app/lib/config/env";
import {
  AUTH_VERIFICATION_CONFIG,
  cooldownKeyFor,
  attemptsKeyFor,
} from "@/app/lib/config/authVerification";
import { z } from "zod";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Change-email flow (authed only):
 * POST — { newEmail } → validates uniqueness, stores OTP under
 *   `change-email:{userId}`, mails the NEW address (changeEmail template).
 * PUT — { otp } → confirms, flips User.email, resets verified=false→ then
 *   marks verified=true for the confirmed address (single-step confirm),
 *   notifies in-app. Old address keeps no lingering verification.
 */
const RequestSchema = z.object({ newEmail: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit(request, "auth");
    if (!rate.allowed) return rate.response;
    const user = await getUserFromRequest() as { id: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
    const parsed = RequestSchema.safeParse({ newEmail });
    if (!parsed.success) return NextResponse.json({ error: "A valid new email is required." }, { status: 400 });

    const db = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, firstName: true, googleId: true } });
    if (!db) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (db.email.trim().toLowerCase() === parsed.data.newEmail) {
      return NextResponse.json({ error: "This is already your email address." }, { status: 400 });
    }
    const taken = await prisma.user.findFirst({ where: { email: { equals: parsed.data.newEmail, mode: "insensitive" } }, select: { id: true } });
    if (taken && taken.id !== db.id) return NextResponse.json({ error: "This email is already in use." }, { status: 409 });

    // Per-user resend cooldown (same window as OTP resends): previously rapid
    // taps stacked overlapping codes and burned mail quota silently. The
    // client adopts the returned cooldown for its timer.
    const cooldownKey = cooldownKeyFor(`change:${db.id}`);
    const remaining = await getSendCooldownRemaining(cooldownKey);
    if (remaining > 0) {
      return NextResponse.json(
        {
          error: AUTH_VERIFICATION_CONFIG.copy.resendCooldown(remaining),
          retryAfter: remaining,
        },
        { status: 429, headers: { "Retry-After": String(remaining) } }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await hashPassword(`${parsed.data.newEmail}::${otp}`);
    await Promise.all([
      setOtp(`change-email:${db.id}`, otpHash, AUTH_VERIFICATION_CONFIG.otpTtlSeconds),
      setSendCooldown(cooldownKey, AUTH_VERIFICATION_CONFIG.resendCooldownSeconds),
      // Durable Postgres mirror (see verify-email): Redis/memory alone is
      // per-instance and read as "expired" after an instance hop.
      // Best-effort — never fails the request.
      (async () => {
        try {
          const { storeEmailOtpDb, EMAIL_OTP_PURPOSES } = await import(
            "@/app/lib/services/emailOtpStore"
          );
          await storeEmailOtpDb(
            parsed.data.newEmail,
            otpHash,
            EMAIL_OTP_PURPOSES.change,
            AUTH_VERIFICATION_CONFIG.otpTtlSeconds,
            db.id
          );
        } catch { /* fallback path covers */ }
      })(),
    ]);
    const appUrl = getAppUrl();
    let delivered = true;
    let sendReason: string | undefined;
    try {
      const { sendChangeEmailConfirmation } = await import("@/app/lib/services/emailService");
      const r = await sendChangeEmailConfirmation(parsed.data.newEmail, db.firstName || "traveller", parsed.data.newEmail, otp, `${appUrl}/profile?emailConfirmed=1`);
      delivered = r.sent;
      if (!r.sent) {
        sendReason = r.reason;
        console.warn(`[change-email] send failed: ${r.reason}`);
      }
    } catch (e) {
      console.error("[change-email] send error", e);
      Sentry.captureException(e);
      delivered = false;
      sendReason = "Email service error — code saved, delivery uncertain.";
    }
    return NextResponse.json(
      {
        message: delivered
          ? "Confirmation code sent to your new address"
          : AUTH_VERIFICATION_CONFIG.copy.sendFailed,
        sent: delivered,
        ...(sendReason ? { reason: sendReason } : {}),
        expiresIn: AUTH_VERIFICATION_CONFIG.otpTtlSeconds,
        cooldown: AUTH_VERIFICATION_CONFIG.resendCooldownSeconds,
      },
      { status: 200 }
    );
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

const ConfirmSchema = z.object({ otp: z.string().min(4).max(12), newEmail: z.string().email() });

export async function PUT(request: NextRequest) {
  try {
    // Brute-force guard (previously unlimited) — shares the auth bucket like
    // verify-email PUT; the client surfaces retryAfter as a wait timer.
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
    const user = await getUserFromRequest() as { id: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse({
      otp: typeof body.otp === "string" ? body.otp.trim() : body.otp,
      newEmail: typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : body.newEmail,
    });
    if (!parsed.success) return NextResponse.json({ error: "New email and code are required." }, { status: 400 });
    const attemptKey = attemptsKeyFor(`change:${user.id}`);
    const storedHash = await getOtp(`change-email:${user.id}`);
    // Durable fallback when Redis/memory holds no hash (instance hop, slow
    // Upstash): the Postgres row was bound to this user + new address at
    // issuance, so a fresh code never reads as "expired".
    let validViaDb = false;
    if (!storedHash) {
      try {
        const { verifyEmailOtpDb, EMAIL_OTP_PURPOSES } = await import(
          "@/app/lib/services/emailOtpStore"
        );
        validViaDb = await verifyEmailOtpDb(
          parsed.data.newEmail,
          parsed.data.otp,
          EMAIL_OTP_PURPOSES.change,
          {
            userId: user.id,
            candidate: `${parsed.data.newEmail}::${parsed.data.otp}`,
          }
        );
      } catch { validViaDb = false; }
    }
    if (!storedHash && !validViaDb) {
      await clearVerifyAttempts(attemptKey);
      return NextResponse.json({ error: "Code expired. Request a new one.", expired: true }, { status: 400 });
    }
    const ok = storedHash
      ? await verifyPassword(`${parsed.data.newEmail}::${parsed.data.otp}`, storedHash)
      : validViaDb;
    if (!ok) {
      const attempts = await recordVerifyAttempt(
        attemptKey,
        AUTH_VERIFICATION_CONFIG.otpTtlSeconds
      );
      const attemptsLeft = AUTH_VERIFICATION_CONFIG.maxVerifyAttempts - attempts;
      if (attempts >= AUTH_VERIFICATION_CONFIG.maxVerifyAttempts) {
        await delOtp(`change-email:${user.id}`);
        await clearVerifyAttempts(attemptKey);
        try {
          const { consumeEmailOtpsDb, EMAIL_OTP_PURPOSES } = await import(
            "@/app/lib/services/emailOtpStore"
          );
          await consumeEmailOtpsDb(parsed.data.newEmail, EMAIL_OTP_PURPOSES.change, user.id);
        } catch { /* non-critical */ }
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
    const taken = await prisma.user.findFirst({ where: { email: { equals: parsed.data.newEmail, mode: "insensitive" } }, select: { id: true } });
    if (taken && taken.id !== user.id) return NextResponse.json({ error: "This email was just taken. Try another." }, { status: 409 });
    await prisma.user.update({ where: { id: user.id }, data: { email: parsed.data.newEmail, verified: true } });
    await delOtp(`change-email:${user.id}`);
    await clearVerifyAttempts(attemptKey);
    try {
      const { consumeEmailOtpsDb, EMAIL_OTP_PURPOSES } = await import(
        "@/app/lib/services/emailOtpStore"
      );
      await consumeEmailOtpsDb(parsed.data.newEmail, EMAIL_OTP_PURPOSES.change, user.id);
    } catch { /* non-critical */ }
    try {
      const { createNotification } = await import("@/app/lib/services/notificationService");
      void createNotification({ type: "VERIFIED", actorId: user.id, message: `Your email is now ${parsed.data.newEmail}.`, recipientIds: [user.id], allowSelf: true });
    } catch { /* non-critical */ }
    return NextResponse.json({ message: "Email updated", email: parsed.data.newEmail }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
