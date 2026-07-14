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
    const body = await request.json();
    const parsed = LOGIN_SCHEMA.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

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
    if (error instanceof Error) {
      if (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError") {
        const prismaError = error as { code?: string; message: string };
        return NextResponse.json({
          error: "Database error. Please try again.",
          ...(process.env.NODE_ENV !== "production" && { detail: prismaError.message, code: prismaError.code }),
        }, { status: 500 });
      }
      if (error.name === "JsonWebTokenError") {
        return NextResponse.json({ error: "Authentication error. Please try again." }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
