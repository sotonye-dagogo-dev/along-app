import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signAccessToken, verifyRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies, clearAuthCookies } from "@/app/lib/utils/cookies";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const rateCheck = checkRateLimit(request, "auth");
    if (!rateCheck.allowed) return rateCheck.response;
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    let payload: { userId: string; role: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      clearAuthCookies();
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    const newAccessToken = signAccessToken({ userId: payload.userId, role: payload.role });

    await setAuthCookies(newAccessToken, refreshToken);

    return NextResponse.json({ accessToken: newAccessToken }, { status: 200 });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
