import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { redis } from "@/app/lib/db/redis";
import { CACHE_KEYS } from "@/app/lib/config/cache";
import {
  SITE_NOTICE_CONFIG,
  isBlockedMutationMethod,
  isMaintenanceExemptPath,
  maintenancePayload,
  normalizeMaintenanceFlag,
} from "@/app/lib/config/siteNotice";

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
