import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { redis } from "@/app/lib/db/redis";
import { CACHE_KEYS } from "@/app/lib/config/cache";
import {
  SITE_NOTICE_CONFIG,
  isBlockedMutationMethod,
  isMaintenanceExemptPath,
  maintenancePayload,
  normalizeMaintenanceFlag,
} from "@/app/lib/config/siteNotice";
import {
  AUTH_SESSION_CONFIG,
  REFRESH_REMEMBER_CLAIM,
} from "@/app/lib/config/authSession";

function isExactPath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + "/");
}

function resolveJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      console.error("JWT_SECRET missing in production — auth will fail. Set JWT_SECRET env var.");
    }
    return new TextEncoder().encode("dev-jwt-secret");
  }
  return new TextEncoder().encode(raw);
}
const JWT_SECRET = resolveJwtSecret();

/**
 * Refresh-token secret — mirrors `utils/auth.ts` resolution order exactly
 * (JWT_REFRESH_SECRET → JWT_SECRET → JWT_ACCESS_SECRET → dev default) so a
 * token minted by a route handler always verifies here in Edge.
 */
function resolveRefreshSecret(): Uint8Array {
  const raw =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      console.error("JWT_REFRESH_SECRET missing in production — session grace disabled. Set JWT_REFRESH_SECRET env var.");
    }
    return new TextEncoder().encode("dev-refresh-secret");
  }
  return new TextEncoder().encode(raw);
}
const REFRESH_SECRET = resolveRefreshSecret();

type JwtPayload = { userId: string; role: string };

async function verifyTokenPayload(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: String(payload.userId ?? ""), role: String(payload.role ?? "") };
  } catch {
    return null;
  }
}

async function verifyToken(token: string): Promise<boolean> {
  return (await verifyTokenPayload(token)) !== null;
}

type RefreshGrace = { token: string; rememberMe: boolean };

/**
 * Refresh-grace: the access cookie is expired/missing but the refresh cookie
 * still verifies → mint a fresh access token in Edge and let the request
 * through. Without this, an installed PWA relaunched after the 1h access TTL
 * bounced straight to /login even though a valid 7d/30d refresh session
 * existed — the "sessions expiring too quickly" symptom. Falls back to
 * `null` (caller falls through to the legacy redirect/401) on ANY error, and
 * never touches the refresh cookie itself.
 */
async function refreshAccessGrace(request: NextRequest): Promise<RefreshGrace | null> {
  if (!AUTH_SESSION_CONFIG.middleware.refreshGraceEnabled) return null;
  const refreshToken = request.cookies.get("refresh_token")?.value;
  if (!refreshToken) return null;
  try {
    const { payload } = await jwtVerify(refreshToken, REFRESH_SECRET);
    const userId = String(payload.userId ?? "");
    if (!userId) return null;
    const role = String(payload.role ?? "");
    const rememberMe = payload[REFRESH_REMEMBER_CLAIM] === true;
    const token = await new SignJWT({ userId, role })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(
        rememberMe
          ? AUTH_SESSION_CONFIG.accessTtl.remember
          : AUTH_SESSION_CONFIG.accessTtl.default,
      )
      .sign(JWT_SECRET);
    return { token, rememberMe };
  } catch {
    // Expired/invalid refresh cookie — legacy behaviour (redirect/401) applies.
    return null;
  }
}

/** Cookie flags — mirror `utils/cookies.ts` (Edge-safe, no next/headers). */
function setAccessCookie(response: NextResponse, grace: RefreshGrace): void {
  response.cookies.set("access_token", grace.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: grace.rememberMe
      ? AUTH_SESSION_CONFIG.cookieMaxAgeSec.accessRemember
      : AUTH_SESSION_CONFIG.cookieMaxAgeSec.accessDefault,
  });
}

/**
 * Continue the request with the re-issued access token FORWARDED downstream
 * (replacing only `access_token`, preserving every other cookie). Set-Cookie
 * alone only reaches the browser AFTER this response — without forwarding,
 * the route handler / RSC render in the SAME request would still read the
 * expired token and 401 (defeating the grace for this hop).
 */
function nextWithAccessCookie(request: NextRequest, token: string): NextResponse {
  const headers = new Headers(request.headers);
  const cookieParts = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith("access_token="));
  cookieParts.push(`access_token=${token}`);
  headers.set("cookie", cookieParts.join("; "));
  return NextResponse.next({ request: { headers } });
}

/** Stale auth cookies dropped alongside a login bounce (clean re-auth). */
function clearStaleAuthCookies(response: NextResponse): void {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("access_token", "", base);
  response.cookies.set("refresh_token", "", base);
}


/**
 * Maintenance flag, Redis-only (never prisma — Edge runtime). Module-scope
 * memo bounds staleness after an admin toggle; any failure fails open so a
 * broken cache or unreadable value can never block traffic.
 */
let maintenanceMemo: { value: boolean; at: number } | null = null;

async function maintenanceEnabled(): Promise<boolean> {
  const now = Date.now();
  if (
    maintenanceMemo &&
    now - maintenanceMemo.at < SITE_NOTICE_CONFIG.enforcement.memoTtlMs
  ) {
    return maintenanceMemo.value;
  }
  try {
    const raw = await redis.get<string | boolean | number>(
      CACHE_KEYS.siteConfig(SITE_NOTICE_CONFIG.siteConfigKeys.maintenance),
    );
    const value = normalizeMaintenanceFlag(raw);
    maintenanceMemo = { value, at: now };
    return value;
  } catch {
    // Fail open — never block mutating traffic on a cache error.
    return false;
  }
}

/**
 * Soft maintenance gate: block mutating API requests while the admin
 * `maintenanceMode` flag is on. GETs and pages always pass (the notice is a
 * banner, not a wall); admins and the auth/cron surfaces stay exempt so the
 * platform can always be managed back online. Fail-open on every error.
 */
async function maintenanceBlocksMutation(
  pathname: string,
  accessToken: string | undefined,
): Promise<boolean> {
  const cfg = SITE_NOTICE_CONFIG.enforcement;
  if (!cfg.enabled) return false;
  if (isMaintenanceExemptPath(pathname)) return false;
  try {
    if (!(await maintenanceEnabled())) return false;
    if (accessToken) {
      const payload = await verifyTokenPayload(accessToken);
      if (payload?.role === "ADMIN") return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  const localeCookie = request.cookies.get("along-locale")?.value;
  const { pathname } = request.nextUrl;

  // Maintenance enforcement — mutating /api traffic only, fail-open, admin +
  // auth/cron exempt. Runs before the /api short-circuit below.
  if (pathname.startsWith("/api") && isBlockedMutationMethod(request.method)) {
    if (await maintenanceBlocksMutation(pathname, accessToken)) {
      return NextResponse.json(maintenancePayload(), {
        status: SITE_NOTICE_CONFIG.enforcement.status,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": SITE_NOTICE_CONFIG.enforcement.retryAfterSeconds,
        },
      });
    }
  }

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    // Session grace for API traffic: an expired access cookie silently
    // re-issues before the route handler runs (routes stay the source of
    // truth — they still 401 on their own when BOTH tokens are dead).
    // The auth surface itself is excluded: refresh/login must see the raw
    // cookie state it is trying to repair.
    if (!pathname.startsWith("/api/auth") && AUTH_SESSION_CONFIG.middleware.refreshGraceEnabled) {
      const accessValid = accessToken ? await verifyToken(accessToken) : false;
      if (!accessValid) {
        const grace = await refreshAccessGrace(request);
        if (grace) {
          const response = nextWithAccessCookie(request, grace.token);
          setAccessCookie(response, grace);
          return response;
        }
      }
    }
    return NextResponse.next();
  }

  // Set locale cookie if not present, based on Accept-Language
  const applyLocale = (target: NextResponse): NextResponse => {
    if (!localeCookie) {
      const acceptLang = request.headers.get("accept-language") ?? "";
      const detected = acceptLang.startsWith("pcm") || acceptLang.startsWith("en-pcm") ? "pcm" : "en";
      target.cookies.set("along-locale", detected, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return target;
  };
  const response = applyLocale(NextResponse.next());

  // Guest-accessible: public pages + feed, explore, profiles, posts, faq, blog
  const guestRoutes = [
    "/", "/about", "/contact", "/privacy", "/terms", "/report-bug",
    "/faq", "/blog", "/home", "/explore", "/search", "/forgot-password",
    "/verify-email",
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
    const accessValid = accessToken ? await verifyToken(accessToken) : false;
    if (accessValid) {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    // Access expired but refresh session alive → restore it instead of
    // showing the login form to a user who is still signed in.
    const grace = await refreshAccessGrace(request);
    if (grace) {
      const response = NextResponse.redirect(new URL("/home", request.url));
      setAccessCookie(response, grace);
      return response;
    }
    return response;
  }

  // Protected routes: require valid auth
  const protectedRoutes = [
    "/bookmarks", "/notifications", "/analytics", "/invite", "/marketplace", "/admin", "/profile", "/leaderboard",
  ];
  if (protectedRoutes.some((r) => isExactPath(pathname, r))) {
    const accessValid = accessToken ? await verifyToken(accessToken) : false;
    if (!accessValid) {
      const grace = await refreshAccessGrace(request);
      if (grace) {
        const graceResponse = applyLocale(nextWithAccessCookie(request, grace.token));
        setAccessCookie(graceResponse, grace);
        return graceResponse;
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const loginResponse = NextResponse.redirect(loginUrl);
      clearStaleAuthCookies(loginResponse);
      return loginResponse;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
