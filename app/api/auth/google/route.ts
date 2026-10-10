import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAppUrl } from "@/app/lib/config/env";

export async function GET(request: Request) {
  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = getAppUrl();

    if (!googleClientId) {
      // Browser-visible navigation (never a JSON api-route page): send the
      // user back to a real page with a sanitized error flag.
      return NextResponse.redirect(`${appUrl}/login?error=oauth_unconfigured`, { status: 307 });
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
    try {
      return NextResponse.redirect(`${getAppUrl()}/login?error=oauth_failed`, { status: 307 });
    } catch {
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }
}
