import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { signAccessToken, verifyRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies, clearAuthCookies } from "@/app/lib/utils/cookies";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { REFRESH_REMEMBER_CLAIM } from "@/app/lib/config/authSession";

export async function POST(request: NextRequest) {
  try {
    // Dedicated bucket: refresh shares no budget with login/OTP/register, so
    // a PWA resuming after idle can never starve (or be starved by) the
    // interactive auth flows. Config-driven in `rateLimits.ts`.
    const rateCheck = checkRateLimit(request, "authRefresh");
    if (!rateCheck.allowed) return rateCheck.response;
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    let payload: { userId: string; role: string; [REFRESH_REMEMBER_CLAIM]?: boolean };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      await clearAuthCookies();
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    // Remember-me survives refresh (claim-embedded). Legacy tokens issued
    // before the claim existed report `undefined`: keep their CURRENT
    // refresh cookie lifetime untouched (includeRefresh: false) instead of
    // silently downgrading it the way the old code did.
    const rememberMe = payload[REFRESH_REMEMBER_CLAIM] === true;
    const legacyToken = payload[REFRESH_REMEMBER_CLAIM] === undefined;

    const newAccessToken = signAccessToken(
      { userId: payload.userId, role: payload.role },
      rememberMe
    );

    await setAuthCookies(newAccessToken, refreshToken, rememberMe, {
      includeRefresh: !legacyToken,
    });

    return NextResponse.json({ accessToken: newAccessToken }, { status: 200 });
  } catch (error) {
    console.error("Token refresh error:", error);
    Sentry.captureException(error);
    if (error instanceof Error && (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError")) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
