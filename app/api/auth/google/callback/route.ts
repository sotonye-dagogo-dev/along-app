import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { signAccessToken, signRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies } from "@/app/lib/utils/cookies";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!googleClientId || !googleClientSecret) {
      return NextResponse.json(
        { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
        { status: 500 }
      );
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: "Failed to exchange authorization code", details: tokenData },
        { status: 400 }
      );
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo.id || !userInfo.email) {
      return NextResponse.json({ error: "Failed to fetch Google user info" }, { status: 400 });
    }

    const googleId = userInfo.id;
    const email = userInfo.email;
    const firstName = userInfo.given_name || "";
    const lastName = userInfo.family_name || "";
    const state = request.nextUrl.searchParams.get("state");

    // Handle "link" flow: if state=link and user already authenticated, link Google to existing account
    if (state === "link") {
      const { verifyAccessToken } = await import("@/app/lib/utils/auth");
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const token = cookieStore.get("access_token")?.value;
      if (token) {
        try {
          const payload = verifyAccessToken(token);
          const existingUser = await prisma.user.findUnique({ where: { id: payload.userId } });
          if (existingUser) {
            // Check if googleId already taken by another user
            const taken = await prisma.user.findUnique({ where: { googleId } });
            if (taken && taken.id !== existingUser.id) {
              return NextResponse.redirect(`${appUrl}/profile?error=google_already_linked`, { status: 307 });
            }
            await prisma.user.update({ where: { id: existingUser.id }, data: { googleId } });
            return NextResponse.redirect(`${appUrl}/profile?success=google_linked`, { status: 307 });
          }
        } catch {
          // fall through to normal flow
        }
      }
    }

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (user) {
      const accessToken = signAccessToken({ userId: user.id, role: user.role });
      const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

      await setAuthCookies(accessToken, refreshToken);

      return NextResponse.redirect(`${appUrl}/home`, { status: 307 });
    }

    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Prevent overwriting an already linked googleId
      if (user.googleId && user.googleId !== googleId) {
        return NextResponse.redirect(`${appUrl}/login?error=account_exists`, { status: 307 });
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });

      const accessToken = signAccessToken({ userId: user.id, role: user.role });
      const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

      await setAuthCookies(accessToken, refreshToken);

      return NextResponse.redirect(`${appUrl}/home`, { status: 307 });
    }

    const baseUserName = email.split("@")[0];
    let userName = baseUserName;
    let suffix = 1;

    while (await prisma.user.findUnique({ where: { userName } })) {
      userName = `${baseUserName}_${suffix}`;
      suffix++;
    }

    user = await prisma.user.create({
      data: {
        userName,
        firstName,
        lastName,
        email,
        password: "",
        googleId,
        verified: true,
        inviteCode: crypto.randomUUID(),
      },
    });

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.redirect(`${appUrl}/home`, { status: 307 });
  } catch (error) {
    console.error("Google callback error:", error);
    Sentry.captureException(error);
    if (error instanceof Error && (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError")) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
