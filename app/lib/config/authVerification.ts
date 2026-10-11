/**
 * Email-verification (OTP) registry — single source of truth for code
 * lifetime, resend throttling, attempt limits, and user-facing copy.
 * Zero app deps (config layer only) so API routes, client hooks, and tests
 * all share the same numbers.
 *
 * Why this exists: the register → OTP → resend → verify-email chain shares
 * one `otp:{email}` key. A resend therefore invalidates older codes, the
 * auth rate bucket (10/15min, shared) can silently swallow repeat sends,
 * and serverless memory-fallback is per-instance (non-durable). The copy
 * below is written to make all three behaviours visible to the user instead
 * of surfacing as "invalid/expired" confusion.
 */

export interface AuthVerificationConfig {
  /** Seconds a freshly issued code stays valid. */
  otpTtlSeconds: number;
  /** Seconds a client must wait before requesting another code. */
  resendCooldownSeconds: number;
  /** Wrong-code attempts before the code is revoked and a new one required. */
  maxVerifyAttempts: number;
  /** Redis/memory key prefixes (never change without a migration note). */
  keys: {
    otpPrefix: string;
    cooldownPrefix: string;
    attemptsPrefix: string;
  };
  copy: {
    codeExpiryNote: (minutes: number) => string;
    resendCooldown: (seconds: number) => string;
    previousInvalidated: string;
    rateLimited: (seconds: number) => string;
    sendFailed: string;
    expired: string;
    incorrect: (attemptsLeft: number) => string;
    attemptsExhausted: string;
  };
}

export const AUTH_VERIFICATION_CONFIG: AuthVerificationConfig = {
  otpTtlSeconds: 900, // 15 minutes — matches setOtp TTLs in auth routes
  resendCooldownSeconds: 60,
  maxVerifyAttempts: 5,
  keys: {
    otpPrefix: "otp:",
    cooldownPrefix: "otp-cooldown:",
    attemptsPrefix: "otp-attempts:",
  },
  copy: {
    codeExpiryNote: (minutes) => `Code expires in ${minutes} minutes.`,
    resendCooldown: (seconds) => `Please wait ${seconds}s before requesting another code.`,
    previousInvalidated: "Requesting a new code invalidates older ones — use the newest email.",
    rateLimited: (seconds) =>
      `Too many attempts. Please wait ${seconds}s and try again — your newest code stays valid while you wait.`,
    sendFailed:
      "We saved a fresh code but the email could not be delivered. Check spam, then try again after the timer.",
    expired: "That code expired or was replaced by a newer one. Request a new code and use the newest email.",
    incorrect: (attemptsLeft) =>
      attemptsLeft > 0
        ? `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left before a new code is needed.`
        : "Incorrect code.",
    attemptsExhausted: "Too many wrong attempts — that code is revoked. Request a new code.",
  },
};

/**
 * Register-path email dispatch registry — single source of truth for how the
 * signup route delivers its verification + welcome mails.
 *
 * Why this exists: register previously fire-and-forgot its mails
 * (`void sendInBackground()` / `globalThis.waitUntil`, which does not exist
 * on the Vercel/Next runtime). Serverless freezes the function the moment
 * the response is returned, so the OTP mail was silently dropped while
 * awaited flows (forgot-password, resend, verify-email trigger) delivered
 * fine. Register now AWAITS both mails inside bounded timeouts (same pattern
 * as forgot-password) and reports an honest `sent` flag instead of a
 * false-positive "OTP sent to email".
 *
 * - `useVerifyTemplate`: register sends the `verifyEmail` template (OTP +
 *   one-tap link + firstName) so the signup mail matches the resend/trigger
 *   mails. `sendVerifyEmail` already falls back to the `otp` template when
 *   the verify template is missing/disabled — non-breaking.
 * - Timeouts keep total worst-case well inside the route's maxDuration=30.
 */
export interface RegisterEmailDispatchConfig {
  /** Per-mail timeout for the verification mail. */
  otpTimeoutMs: number;
  /** Per-mail timeout for the welcome mail (independent, non-fatal). */
  welcomeTimeoutMs: number;
  /** Send the verifyEmail template (OTP + link) instead of the otp-only one. */
  useVerifyTemplate: boolean;
  /**
   * When true, code-send routes clear the per-email cooldown when delivery
   * FAILS (provider timeout / disabled template) so the user can retry
   * immediately. The saved code stays valid; abuse stays capped by the
   * shared auth rate bucket. Success still starts the normal cooldown.
   */
  clearCooldownOnFailure: boolean;
  /**
   * The OTP-screen resend endpoint (`/api/auth/otp/resend`) sends the same
   * verifyEmail template (OTP + one-tap link) as register and the profile
   * trigger, so every verify mail the user ever sees shares one shape.
   * `sendVerifyEmail` falls back to the otp-only template when verifyEmail
   * is missing/disabled — non-breaking.
   */
  resendUseVerifyTemplate: boolean;
}

export const REGISTER_EMAIL_DISPATCH_CONFIG: RegisterEmailDispatchConfig = {
  // Patient budgets: the profile verify-email trigger (single send, no outer
  // race, maxDuration=30) consistently delivered while register's 6s/5s
  // double-race timed out on cold starts — matching the "signup gets nothing,
  // profile resend works" report. Parallel wall-time max(15,10)=15s < 30s.
  otpTimeoutMs: 15000,
  welcomeTimeoutMs: 10000,
  useVerifyTemplate: true,
  clearCooldownOnFailure: true,
  resendUseVerifyTemplate: true,
};

/** Welcome-mail dispatch budget for the Google OAuth callback (redirect path). */
export const GOOGLE_WELCOME_DISPATCH_CONFIG = {
  timeoutMs: 5000,
} as const;

/** "048291" stays 6 digits; TTL minutes for expiry notes. */
export const OTP_TTL_MINUTES = Math.round(AUTH_VERIFICATION_CONFIG.otpTtlSeconds / 60);

/** Cooldown key for an email address (lowercased by callers). */
export function cooldownKeyFor(email: string): string {
  return `${AUTH_VERIFICATION_CONFIG.keys.cooldownPrefix}${email}`;
}

/** Attempt-counter key for an email address (lowercased by callers). */
export function attemptsKeyFor(email: string): string {
  return `${AUTH_VERIFICATION_CONFIG.keys.attemptsPrefix}${email}`;
}

/** "adaobi@example.com" → "a***@example.com" (never leaks the full address). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = (local ?? "").slice(0, 1) || "*";
  return `${head}***@${domain}`;
}
