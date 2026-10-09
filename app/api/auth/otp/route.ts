import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { OTP_SCHEMA } from "@/app/lib/schemas/auth";
import { verifyPassword } from "@/app/lib/utils/security";
import { signAccessToken, signRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies } from "@/app/lib/utils/cookies";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { getOtp, delOtp } from "@/app/lib/services/otpStore";

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

    if (!storedHash) {
      return NextResponse.json({ error: "OTP expired or invalid" }, { status: 400 });
    }

    const valid = await verifyPassword(otp, storedHash);

    if (!valid) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

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
