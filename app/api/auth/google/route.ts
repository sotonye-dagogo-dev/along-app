import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAppUrl } from "@/app/lib/config/env";
import { AUTH_SESSION_CONFIG } from "@/app/lib/config/authSession";

/** httpOnly handshake cookie flags — mirrored by the callback reader. */
function prefsCookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

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
    // Remember-me preference travels via a short-lived httpOnly cookie rather
    // than `state`, so the existing ref:/link state parsing stays untouched.
    // Absent param → OAuth default (persistent session — see authSession config).
    const rememberMeParam = url.searchParams.get("rememberMe");
    const rememberMe =
      rememberMeParam === null
        ? AUTH_SESSION_CONFIG.oauth.defaultRememberMe
        : rememberMeParam === "true";

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      // Force Google's account-chooser. Without it Google reuses whatever
      // session its webview already holds — inside an installed PWA that
      // meant no chooser screen at all (silent single/wrong account).
      prompt: AUTH_SESSION_CONFIG.oauth.prompt,
      ...(state ? { state } : {}),
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    const response = NextResponse.redirect(googleAuthUrl, { status: 307 });
    response.cookies.set(
      AUTH_SESSION_CONFIG.oauth.prefsCookieName,
      JSON.stringify({ rememberMe }),
      {
        ...prefsCookieBase(),
        maxAge: AUTH_SESSION_CONFIG.oauth.prefsCookieMaxAgeSec,
      }
    );
    return response;
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
