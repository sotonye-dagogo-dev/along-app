import fs from "fs";
import path from "path";

/**
 * Signup verify-email gap: register timed out its mails (6s/5s double-race)
 * while the profile trigger awaited a single send (maxDuration=30), so cold
 * starts dropped the signup mail and delivered the profile one. Failed sends
 * then stranded users behind a 60s cooldown for a mail that never left.
 * Static (file-presence) level so it runs without node_modules/DB.
 */
const ROOT = path.resolve(__dirname, "..", "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("signup verify-email delivery parity + failure fallback", () => {
  it("otpStore exposes clearSendCooldown (redis + memory)", () => {
    const src = read("app/lib/services/otpStore.ts");
    expect(src).toContain("export async function clearSendCooldown");
    expect(src).toContain("cooldownMemoryStore.delete(key)");
  });

  it("dispatch config carries patient budgets + failure/template flags", () => {
    const cfg = read("app/lib/config/authVerification.ts");
    expect(cfg).toContain("clearCooldownOnFailure");
    expect(cfg).toContain("resendUseVerifyTemplate");
    expect(cfg).toContain("otpTimeoutMs: 15000");
  });

  it("emailService threads a per-send timeout (default unchanged)", () => {
    const src = read("app/lib/services/emailService.ts");
    expect(src).toContain("timeoutMs?: number");
    expect(src).toContain("timeoutMs ?? EMAIL_SEND_TIMEOUT_MS");
    expect(src).toContain("sendVerifyEmail(to: string, firstName: string, otp: string, verifyLink: string, timeoutMs?: number)");
  });

  it("register passes patient budgets and lifts cooldown on failure", () => {
    const src = read("app/api/auth/register/route.ts");
    expect(src).toContain("clearSendCooldown");
    expect(src).toContain("REGISTER_EMAIL_DISPATCH_CONFIG.otpTimeoutMs");
    expect(src).toContain("cooldown: otpSent ? AUTH_VERIFICATION_CONFIG.resendCooldownSeconds : 0");
  });

  it("otp resend sends the verifyEmail template (parity) with failure fallback", () => {
    const src = read("app/api/auth/otp/resend/route.ts");
    expect(src).toContain("sendVerifyEmail");
    expect(src).toContain("resendUseVerifyTemplate");
    expect(src).toContain("clearSendCooldown");
    expect(src).toContain("cooldown: delivered ? AUTH_VERIFICATION_CONFIG.resendCooldownSeconds : 0");
  });

  it("verify-email trigger shares the patient budget + failure fallback", () => {
    const src = read("app/api/auth/verify-email/route.ts");
    expect(src).toContain("REGISTER_EMAIL_DISPATCH_CONFIG.otpTimeoutMs");
    expect(src).toContain("clearSendCooldown");
    expect(src).toContain("cooldown: delivered ? AUTH_VERIFICATION_CONFIG.resendCooldownSeconds : 0");
  });

  it("audit: no unverified-recipient gate on the signup verify path", () => {
    // Transactional verify sends must never refuse to send BECAUSE the
    // address is unverified — the unverified address cannot block its own
    // verification mail. (The legitimate `if (user.verified) return
    // already-verified` short-circuit skips redundant sends; that is
    // correct and not what this guards against.)
    for (const rel of [
      "app/api/auth/register/route.ts",
      "app/api/auth/otp/resend/route.ts",
      "app/api/auth/verify-email/route.ts",
      "app/lib/services/emailService.ts",
    ]) {
      const src = read(rel);
      expect(src).not.toMatch(/if\s*\([^)]*!\s*\w*\.?verified[^)]*\)\s*(return|throw)/);
      expect(src).not.toMatch(/if\s*\(\s*!verified/);
    }
  });
});
