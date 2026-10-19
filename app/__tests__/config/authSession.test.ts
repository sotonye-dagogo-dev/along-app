/**
 * @jest-environment node
 *
 * Session policy (Sprint 80 / issue #25 — fast-expiring sessions):
 * - AUTH_SESSION_CONFIG is the single source of truth (mirror of the
 *   historical hard-coded 1h/7d access, 7d/30d refresh values),
 * - the remember-me flag survives refresh via the `rm` claim on the refresh
 *   JWT (it was previously dropped → silent downgrade to 1h/7d),
 * - /api/auth/refresh has its own rate bucket (shared auth bucket starved
 *   PWA resumes),
 * - cookie maxAge mirrors the token TTLs one-to-one,
 * - legacy refresh tokens (no `rm`) can be re-issued WITHOUT rewriting the
 *   refresh cookie (includeRefresh: false).
 */
import {
  AUTH_SESSION_CONFIG,
  REFRESH_REMEMBER_CLAIM,
  accessCookieMaxAge,
  refreshCookieMaxAge,
} from "@/app/lib/config/authSession";
import { RATE_LIMITS } from "@/app/lib/config/rateLimits";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies, clearAuthCookies } from "@/app/lib/utils/cookies";
import { cookies } from "next/headers";

describe("AUTH_SESSION_CONFIG", () => {
  it("mirrors the historical lifetimes exactly (non-breaking default)", () => {
    expect(AUTH_SESSION_CONFIG.accessTtl).toEqual({ default: "1h", remember: "7d" });
    expect(AUTH_SESSION_CONFIG.refreshTtl).toEqual({ default: "7d", remember: "30d" });
    expect(AUTH_SESSION_CONFIG.cookieMaxAgeSec).toEqual({
      accessDefault: 3600,
      accessRemember: 604800,
      refreshDefault: 604800,
      refreshRemember: 2592000,
    });
    // Cookie maxAge must mirror the JWT TTLs one-to-one.
    expect(accessCookieMaxAge(false)).toBe(3600);
    expect(accessCookieMaxAge(true)).toBe(604800);
    expect(refreshCookieMaxAge(false)).toBe(604800);
    expect(refreshCookieMaxAge(true)).toBe(2592000);
  });

  it("forces the Google account chooser and remembers the handshake cookie", () => {
    expect(AUTH_SESSION_CONFIG.oauth.prompt).toBe("select_account");
    expect(AUTH_SESSION_CONFIG.oauth.prefsCookieName).toBe("oauth_session_prefs");
    expect(AUTH_SESSION_CONFIG.oauth.prefsCookieMaxAgeSec).toBeGreaterThan(0);
  });

  it("keeps the middleware refresh grace + client revalidation cadence enabled", () => {
    expect(AUTH_SESSION_CONFIG.middleware.refreshGraceEnabled).toBe(true);
    expect(AUTH_SESSION_CONFIG.client.revalidateMinIntervalMs).toBeGreaterThan(0);
    expect(AUTH_SESSION_CONFIG.client.refreshRetryDelayMs).toBeGreaterThan(0);
  });

  it("refresh has its OWN rate bucket (not the shared login/OTP auth bucket)", () => {
    expect(RATE_LIMITS.authRefresh).toBeDefined();
    // Generous enough for a PWA resume fan-out, far below abuse.
    expect(RATE_LIMITS.authRefresh.maxRequests).toBeGreaterThanOrEqual(30);
    expect(RATE_LIMITS.authRefresh.windowMs).toBeGreaterThanOrEqual(60_000);
    expect(RATE_LIMITS.authRefresh.maxRequests).toBeLessThan(
      RATE_LIMITS.auth.maxRequests * 10,
    );
  });
});

describe("remember-me claim survives the refresh JWT", () => {
  const payload = { userId: "u1", role: "USER" };

  it("reflected as an explicit boolean on sign", () => {
    expect(REFRESH_REMEMBER_CLAIM).toBe("rm");
    const remember = verifyRefreshToken(signRefreshToken(payload, true));
    const fresh = verifyRefreshToken(signRefreshToken(payload, false));
    expect(remember[REFRESH_REMEMBER_CLAIM]).toBe(true);
    expect(fresh[REFRESH_REMEMBER_CLAIM]).toBe(false);
  });

  it("drives the refresh token lifetime (7d vs 30d)", () => {
    const seconds = (token: string) => {
      const { iat, exp } = verifyRefreshToken(token) as unknown as { iat: number; exp: number };
      return exp - iat;
    };
    expect(seconds(signRefreshToken(payload, false))).toBe(7 * 24 * 3600);
    expect(seconds(signRefreshToken(payload, true))).toBe(30 * 24 * 3600);
  });

  it("drives the access token lifetime (1h vs 7d) and stays off the access token", () => {
    const seconds = (token: string) => {
      const { iat, exp } = verifyAccessToken(token) as unknown as { iat: number; exp: number };
      return exp - iat;
    };
    expect(seconds(signAccessToken(payload, false))).toBe(3600);
    expect(seconds(signAccessToken(payload, true))).toBe(7 * 24 * 3600);
    // The claim lives on the REFRESH token only.
    const access = signAccessToken(payload, true);
    const decoded = JSON.parse(Buffer.from(access.split(".")[1], "base64").toString()) as Record<
      string,
      unknown
    >;
    expect(decoded[REFRESH_REMEMBER_CLAIM]).toBeUndefined();
  });

  it("round-trips through both verifiers", () => {
    expect(verifyRefreshToken(signRefreshToken(payload, true)).userId).toBe("u1");
    expect(verifyAccessToken(signAccessToken(payload, false)).role).toBe("USER");
  });
});

describe("setAuthCookies", () => {
  function mockStore() {
    const set = jest.fn();
    (cookies as unknown as jest.Mock).mockReturnValue({ get: jest.fn(), set, delete: jest.fn() });
    return set;
  }

  it("writes both cookies with maxAge mirroring the flag (default: remember)", async () => {
    const set = mockStore();
    await setAuthCookies("acc", "ref", true);
    expect(set).toHaveBeenCalledTimes(2);
    const [accessName, , accessOpts] = set.mock.calls[0];
    const [refreshName, , refreshOpts] = set.mock.calls[1];
    expect(accessName).toBe("access_token");
    expect(refreshName).toBe("refresh_token");
    expect(accessOpts.maxAge).toBe(604800);
    expect(refreshOpts.maxAge).toBe(2592000);
    expect(accessOpts.httpOnly).toBe(true);
    expect(accessOpts.sameSite).toBe("lax");
  });

  it("non-remember sessions get the short 1h/7d lifetimes", async () => {
    const set = mockStore();
    await setAuthCookies("acc", "ref", false);
    expect(set.mock.calls[0][2].maxAge).toBe(3600);
    expect(set.mock.calls[1][2].maxAge).toBe(604800);
  });

  it("includeRefresh:false (legacy token path) leaves the refresh cookie untouched", async () => {
    const set = mockStore();
    await setAuthCookies("acc", "ref", true, { includeRefresh: false });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toBe("access_token");
  });

  it("clearAuthCookies expires both cookies", async () => {
    const set = mockStore();
    await clearAuthCookies();
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[0][2].maxAge).toBe(0);
    expect(set.mock.calls[1][2].maxAge).toBe(0);
  });
});
