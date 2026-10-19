/**
 * Session/auth policy — single source of truth for token lifetimes, auth
 * cookie attributes, the Google OAuth handshake, and the middleware refresh
 * grace. Consumed by `utils/auth.ts` (JWT signing), `utils/cookies.ts`
 * (cookie maxAge), `middleware.ts` (Edge re-issue), the auth API routes, and
 * the login page — so a lifetime change happens in exactly one place.
 *
 * Non-breaking by default: the values mirror the historical hard-coded
 * constants (1h/7d access, 7d/30d refresh) exactly.
 */

export const AUTH_SESSION_CONFIG = {
  /** JWT `expiresIn` for the access token. */
  accessTtl: {
    default: "1h",
    remember: "7d",
  },
  /** JWT `expiresIn` for the refresh token. */
  refreshTtl: {
    default: "7d",
    remember: "30d",
  },
  /** Cookie `maxAge` (seconds) — mirrors the JWT TTLs one-to-one. */
  cookieMaxAgeSec: {
    accessDefault: 3600,
    accessRemember: 604800,
    refreshDefault: 604800,
    refreshRemember: 2592000,
  },
  /**
   * Google OAuth. `prompt: "select_account"` forces Google's account-chooser
   * screen — without it Google silently reuses its last session, which is
   * exactly what happened inside an installed PWA's standalone webview (no
   * chooser, wrong/implicit account). `defaultRememberMe` applies when the
   * caller does not state a preference (the Google button carries the login
   * page's checkbox explicitly; register/link flows fall back to this).
   */
  oauth: {
    prompt: "select_account",
    defaultRememberMe: true,
    /** httpOnly handshake cookie: /api/auth/google writes, callback reads+clears. */
    prefsCookieName: "oauth_session_prefs",
    prefsCookieMaxAgeSec: 600,
  },
  /**
   * Middleware refresh-grace: when the access cookie is expired/missing but
   * the refresh cookie still verifies, Edge re-issues the access cookie and
   * lets the request through instead of bouncing to /login (the classic
   * installed-PWA relaunch-after-1h logout). Kill-switch without a deploy of
   * any other module.
   */
  middleware: {
    refreshGraceEnabled: true,
  },
  /**
   * Client revalidation cadence (AuthProvider): after `online` / tab-visible
   * events the identity is revalidated at most once per interval so a
   * PWA resume storm cannot turn into an /api/auth/me + refresh stampede.
   */
  client: {
    revalidateMinIntervalMs: 30_000,
    /** 429 from /api/auth/refresh → one delayed retry, session kept throughout. */
    refreshRetryDelayMs: 15_000,
  },
} as const;

/** `rm` (remember-me) claim name on the refresh JWT. Legacy tokens omit it. */
export const REFRESH_REMEMBER_CLAIM = "rm";

export type AuthSessionConfig = typeof AUTH_SESSION_CONFIG;

/** Cookie maxAge for the access cookie, from the remember-me flag. */
export function accessCookieMaxAge(rememberMe: boolean): number {
  return rememberMe
    ? AUTH_SESSION_CONFIG.cookieMaxAgeSec.accessRemember
    : AUTH_SESSION_CONFIG.cookieMaxAgeSec.accessDefault;
}

/** Cookie maxAge for the refresh cookie, from the remember-me flag. */
export function refreshCookieMaxAge(rememberMe: boolean): number {
  return rememberMe
    ? AUTH_SESSION_CONFIG.cookieMaxAgeSec.refreshRemember
    : AUTH_SESSION_CONFIG.cookieMaxAgeSec.refreshDefault;
}
