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
    const body = await request.json();
    const email = body.email as string | undefined;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
    if (user.verified) return NextResponse.json({ error: "Account already verified" }, { status: 400 });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await hashPassword(otp);
    const otpKey = `otp:${email}`;
    await setOtp(otpKey, otpHash, 900);

    // Non-blocking send
    void (async () => {
      try {
        const { sendOtpEmail } = await import("@/app/lib/services/emailService");
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("[OTP RESEND] failed", e);
        if (process.env.NODE_ENV !== "production") console.log(`[DEV] OTP for ${email}: ${otp}`);
      }
    })();

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
