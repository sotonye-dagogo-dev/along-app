import { cookies } from "next/headers";
import {
  accessCookieMaxAge,
  refreshCookieMaxAge,
} from "@/app/lib/config/authSession";

export interface SetAuthCookiesOptions {
  /**
   * Rewrite the refresh cookie too. `/api/auth/refresh` passes `false` for
   * legacy refresh tokens (issued before the remember-me claim existed) so
   * the already-issued refresh cookie keeps its original lifetime instead of
   * being silently shortened on every refresh. Default: true.
   */
  includeRefresh?: boolean;
}

/** Shared httpOnly auth-cookie attributes (single source of truth). */
function authCookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  rememberMe?: boolean,
  options?: SetAuthCookiesOptions
): Promise<void> {
  const cookieStore = await cookies();
  const includeRefresh = options?.includeRefresh !== false;

  cookieStore.set("access_token", accessToken, {
    ...authCookieBase(),
    maxAge: accessCookieMaxAge(rememberMe === true),
  });

  if (includeRefresh) {
    cookieStore.set("refresh_token", refreshToken, {
      ...authCookieBase(),
      maxAge: refreshCookieMaxAge(rememberMe === true),
    });
  }
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set("access_token", "", {
    ...authCookieBase(),
    maxAge: 0,
  });

  cookieStore.set("refresh_token", "", {
    ...authCookieBase(),
    maxAge: 0,
  });
}
