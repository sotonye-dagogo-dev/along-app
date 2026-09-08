import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function isExactPath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + "/");
}

// Use same secret as app/lib/utils/auth.ts — fallback order must match server auth
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "dev-jwt-secret"
);

async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  const localeCookie = request.cookies.get("along-locale")?.value;
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Set locale cookie if not present, based on Accept-Language
  const response = NextResponse.next();
  if (!localeCookie) {
    const acceptLang = request.headers.get("accept-language") ?? "";
    const detected = acceptLang.startsWith("pcm") || acceptLang.startsWith("en-pcm") ? "pcm" : "en";
    response.cookies.set("along-locale", detected, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  // Guest-accessible: public pages + feed, explore, profiles, posts, faq, blog
  const guestRoutes = [
    "/", "/about", "/contact", "/privacy", "/terms", "/report-bug",
    "/faq", "/blog", "/home", "/explore", "/forgot-password",
  ];
  if (guestRoutes.some((r) => isExactPath(pathname, r))) {
    return response;
  }
  // Profile sub-routes (e.g. /profile/username) are guest-accessible but /profile (own) is protected
  if (pathname.startsWith("/profile/") && pathname !== "/profile") {
    return response;
  }
  // Post detail pages are guest-accessible
  if (pathname.startsWith("/posts/")) {
    return response;
  }

  // Auth routes: redirect to home if already logged in with valid token
  if (["/login", "/register", "/otp"].some((r) => pathname.startsWith(r))) {
    if (accessToken) {
      const valid = await verifyToken(accessToken);
      if (valid) {
        return NextResponse.redirect(new URL("/home", request.url));
      }
    }
    return response;
  }

  // Protected routes: require valid auth
  const protectedRoutes = [
    "/bookmarks", "/notifications", "/analytics", "/invite", "/marketplace", "/admin", "/profile", "/leaderboard",
  ];
  if (protectedRoutes.some((r) => isExactPath(pathname, r))) {
    if (!accessToken || !(await verifyToken(accessToken))) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
