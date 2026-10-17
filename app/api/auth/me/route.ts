import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { verifyAccessToken } from "@/app/lib/utils/auth";
import { clearAuthCookies } from "@/app/lib/utils/cookies";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      // Guest — no session cookie. 200 with a null user (not a 401) so
      // signed-out browsing never logs console errors or burns the auth
      // rate-limit bucket on pointless /auth/refresh retries. Invalid /
      // unknown-user tokens still 401 below (and clear the stale cookies).
      return NextResponse.json({ user: null }, { status: 200 });
    }

    let payload: { userId: string; role: string };
    try {
      payload = verifyAccessToken(token);
    } catch {
      await clearAuthCookies();
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        bio: true,
        location: true,
        verified: true,
        role: true,
        rewardPoints: true,
        rewardTier: true,
        inviteCode: true,
        avatarConfig: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      await clearAuthCookies();
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Me error:", error);
    Sentry.captureException(error);
    if (error instanceof Error && (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError")) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
