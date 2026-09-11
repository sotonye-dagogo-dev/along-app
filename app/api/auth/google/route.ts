import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: Request) {
  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!googleClientId) {
      return NextResponse.json(
        { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID environment variable." },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const state = url.searchParams.get("state") ?? "";

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      ...(state ? { state } : {}),
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    return NextResponse.redirect(googleAuthUrl, { status: 307 });
  } catch (error) {
    console.error("Google auth error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
