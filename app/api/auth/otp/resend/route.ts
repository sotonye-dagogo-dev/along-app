import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { setOtp, setSendCooldown, getSendCooldownRemaining } from "@/app/lib/services/otpStore";
import { AUTH_VERIFICATION_CONFIG, cooldownKeyFor } from "@/app/lib/config/authVerification";

export const maxDuration = 30;
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
    const rawEmail = (body as Record<string, unknown>).email;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    // Case-insensitive lookup for legacy mixed-case rows.
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!user) return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
    if (user.verified) return NextResponse.json({ error: "Account already verified" }, { status: 400 });

    // Per-email resend cooldown — surfaced honestly so the client timer and
    // the server agree (previously the UI counted 45s while the shared auth
    // bucket silently dropped sends, reading as "wasn't sent any").
    // Fail-fast: cooldown read + bcrypt hash run concurrently; writes run in
    // parallel — total Redis worst-case ~1.6s (800ms/op), inside maxDuration.
    const cooldownKey = cooldownKeyFor(email);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const [remaining, otpHash] = await Promise.all([
      getSendCooldownRemaining(cooldownKey),
      hashPassword(otp),
    ]);
    if (remaining > 0) {
      return NextResponse.json(
        {
          error: AUTH_VERIFICATION_CONFIG.copy.resendCooldown(remaining),
          retryAfter: remaining,
        },
        { status: 429, headers: { "Retry-After": String(remaining) } }
      );
    }

    const otpKey = `otp:${email}`;
    // Cooldown starts at issuance (not at delivery) so rapid taps can't stack
    // overlapping codes — and each resend invalidates the previous code.
    await Promise.all([
      setOtp(otpKey, otpHash, AUTH_VERIFICATION_CONFIG.otpTtlSeconds),
      setSendCooldown(cooldownKey, AUTH_VERIFICATION_CONFIG.resendCooldownSeconds),
    ]);

    // Non-blocking send — tightly observed, never a false-positive:
    // the response reports the real delivery outcome once known.
    let delivered = false;
    let sendReason: string | undefined;
    try {
      const { sendOtpEmail } = await import("@/app/lib/services/emailService");
      const result = await sendOtpEmail(email, otp);
      delivered = result.sent;
      sendReason = result.sent ? undefined : result.reason;
      if (!result.sent) {
        console.error(`[OTP RESEND] failed for ${email}: ${result.reason}`);
        Sentry.captureMessage(`OTP resend failed for ${email}: ${result.reason}`, "warning");
      }
      if (process.env.NODE_ENV !== "production") console.log(`[DEV] OTP for ${email}: ${otp}`);
    } catch (e) {
      console.error("[OTP RESEND] failed", e);
      Sentry.captureException(e);
      sendReason = "Email service error — code saved, delivery uncertain.";
      if (process.env.NODE_ENV !== "production") console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    // 200 either way (the code IS valid) but the payload is honest about
    // delivery so the UI can say "check spam / wait for the timer".
    return NextResponse.json(
      {
        message: delivered ? "Code sent — use the newest email." : AUTH_VERIFICATION_CONFIG.copy.sendFailed,
        sent: delivered,
        ...(sendReason ? { reason: sendReason } : {}),
        expiresIn: AUTH_VERIFICATION_CONFIG.otpTtlSeconds,
        cooldown: AUTH_VERIFICATION_CONFIG.resendCooldownSeconds,
        invalidatesPrevious: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("OTP resend error:", error);
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
