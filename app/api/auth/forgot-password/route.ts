import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
import { sendPasswordResetEmail } from "@/app/lib/services/emailService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { setResetToken } from "@/app/lib/services/otpStore";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const rateCheck = checkRateLimit(request, "auth");
    if (!rateCheck.allowed) return rateCheck.response;

    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: "If an account exists, reset instructions will be sent." }, { status: 200 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hashPassword(token);
    const key = `reset:${email}`;
    await setResetToken(key, tokenHash, 3600);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${appUrl}/reset-password/${token}?email=${encodeURIComponent(email)}`;

    await sendPasswordResetEmail(email, resetLink);

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
