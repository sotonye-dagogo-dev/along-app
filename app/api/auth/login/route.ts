import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { LOGIN_SCHEMA } from "@/app/lib/schemas/auth";
import { verifyPassword } from "@/app/lib/utils/security";
import { signAccessToken, signRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies } from "@/app/lib/utils/cookies";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

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
    // Normalize before validation (trim + lowercase email) so mobile
    // keyboards and copy-paste whitespace can never cause a cryptic
    // "Validation failed" — same treatment as register/OTP/reset.
    const raw = (body ?? {}) as Record<string, unknown>;
    const parsed = LOGIN_SCHEMA.safeParse({
      email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
      password: raw.password,
      rememberMe: raw.rememberMe,
    });

    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstMessage =
        Object.values(flat.fieldErrors).flat()[0] ??
        flat.formErrors[0] ??
        "Please check your email and password and try again.";
      return NextResponse.json(
        { error: firstMessage, details: flat },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = parsed.data;

    // Case-insensitive lookup: legacy rows may hold mixed-case emails while
    // every auth write path now stores lowercase.
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);

    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.verified) {
      return NextResponse.json({ error: "Please verify your email first" }, { status: 403 });
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role }, rememberMe);
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role }, rememberMe);

    await setAuthCookies(accessToken, refreshToken, rememberMe);

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword }, { status: 200 });
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    Sentry.captureException(error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError") {
        return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
      }
      if (error.name === "JsonWebTokenError") {
        return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
