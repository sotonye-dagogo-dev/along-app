import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { setOtp } from "@/app/lib/services/otpStore";

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
    const rawEmail = (body as Record<string, unknown>).email;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    // Case-insensitive lookup for legacy mixed-case rows.
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!user) return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
    if (user.verified) return NextResponse.json({ error: "Account already verified" }, { status: 400 });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await hashPassword(otp);
    const otpKey = `otp:${email}`;
    await setOtp(otpKey, otpHash, 900);

    // Non-blocking send — tightly observed, no false-positive
    const sendInBackground = async () => {
      try {
        const { sendOtpEmail } = await import("@/app/lib/services/emailService");
        const result = await sendOtpEmail(email, otp);
        if (!result.sent) {
          console.error(`[OTP RESEND] failed for ${email}: ${result.reason}`);
          Sentry.captureMessage(`OTP resend failed for ${email}: ${result.reason}`, "warning");
        }
        if (process.env.NODE_ENV !== "production") console.log(`[DEV] OTP for ${email}: ${otp}`);
      } catch (e) {
        console.error("[OTP RESEND] failed", e);
        Sentry.captureException(e);
        if (process.env.NODE_ENV !== "production") console.log(`[DEV] OTP for ${email}: ${otp}`);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeWaitUntil = (globalThis as any)?.waitUntil as ((p: Promise<void>) => void) | undefined;
    if (maybeWaitUntil) maybeWaitUntil(sendInBackground());
    else void sendInBackground();

    return NextResponse.json({ message: "OTP resent" }, { status: 200 });
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
