import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { OTP_SCHEMA } from "@/app/lib/schemas/auth";
import { verifyPassword } from "@/app/lib/utils/security";
import { signAccessToken, signRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies } from "@/app/lib/utils/cookies";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { getOtp, delOtp, recordVerifyAttempt, clearVerifyAttempts } from "@/app/lib/services/otpStore";
import { AUTH_VERIFICATION_CONFIG, attemptsKeyFor } from "@/app/lib/config/authVerification";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateCheck = checkRateLimit(request, "auth");
    if (!rateCheck.allowed) {
      const retryAfter = Number(rateCheck.response.headers.get("Retry-After") ?? "900");
      return NextResponse.json(
        {
          error: AUTH_VERIFICATION_CONFIG.copy.rateLimited(retryAfter),
          retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch (e) {
      if (e instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
      }
      throw e;
    }
    // Same normalization as register/login/reset: the OTP key is derived
    // from the email, so any case/whitespace drift between issuance and
    // verification would read a different key and report "expired".
    const raw = (body ?? {}) as Record<string, unknown>;
    const parsed = OTP_SCHEMA.safeParse({
      email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
      otp: typeof raw.otp === "string" ? raw.otp.trim() : raw.otp,
      rememberMe: raw.rememberMe,
    });

    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstMessage =
        Object.values(flat.fieldErrors).flat()[0] ??
        flat.formErrors[0] ??
        "Please check the code and try again.";
      return NextResponse.json(
        { error: firstMessage, details: flat },
        { status: 400 }
      );
    }

    const { email, otp, rememberMe } = parsed.data;

    const otpKey = `otp:${email}`;
    const storedHash = await getOtp(otpKey);

    // Durable fallback (same class as verify-email PUT): Redis/memory is
    // per-instance, so when it holds no hash the Postgres mirror decides —
    // a just-received code must not read as "expired". A present-but-
    // mismatched hash is still a wrong code (attempts below, unchanged).
    let validViaDb = false;
    if (!storedHash) {
      try {
        const { verifyEmailOtpDb, EMAIL_OTP_PURPOSES } = await import(
          "@/app/lib/services/emailOtpStore"
        );
        validViaDb = await verifyEmailOtpDb(email, otp, EMAIL_OTP_PURPOSES.verify);
      } catch { validViaDb = false; }
    }

    if (!storedHash && !validViaDb) {
      // Covers two real cases now: never issued, or TTL elapsed on every
      // store. A newer resend still replaces the single-active row, so the
      // copy stays honest.
      await clearVerifyAttempts(attemptsKeyFor(email));
      return NextResponse.json(
        { error: AUTH_VERIFICATION_CONFIG.copy.expired, expired: true },
        { status: 400 }
      );
    }

    const valid = storedHash ? await verifyPassword(otp, storedHash) : validViaDb;

    if (!valid) {
      const attempts = await recordVerifyAttempt(
        attemptsKeyFor(email),
        AUTH_VERIFICATION_CONFIG.otpTtlSeconds
      );
      const attemptsLeft = AUTH_VERIFICATION_CONFIG.maxVerifyAttempts - attempts;
      if (attempts >= AUTH_VERIFICATION_CONFIG.maxVerifyAttempts) {
        // Revoke: brute-force cap reached — a fresh code is required.
        await delOtp(otpKey);
        await clearVerifyAttempts(attemptsKeyFor(email));
        try {
          const { consumeEmailOtpsDb, EMAIL_OTP_PURPOSES } = await import(
            "@/app/lib/services/emailOtpStore"
          );
          await consumeEmailOtpsDb(email, EMAIL_OTP_PURPOSES.verify);
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
    await clearVerifyAttempts(attemptsKeyFor(email));

    // Case-insensitive lookup for legacy mixed-case rows; update by id.
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Account not found. Please register again." }, { status: 404 });
    }
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { verified: true },
    });

    await delOtp(otpKey);
    try {
      const { consumeEmailOtpsDb, EMAIL_OTP_PURPOSES } = await import(
        "@/app/lib/services/emailOtpStore"
      );
      await consumeEmailOtpsDb(email, EMAIL_OTP_PURPOSES.verify);
    } catch { /* non-critical */ }

    const accessToken = signAccessToken({ userId: user.id, role: user.role }, rememberMe);
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role }, rememberMe);

    await setAuthCookies(accessToken, refreshToken, rememberMe);

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword }, { status: 200 });
  } catch (error) {
    console.error("OTP verification error:", error);
    Sentry.captureException(error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError") {
        return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
      }
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
