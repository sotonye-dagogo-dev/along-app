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
