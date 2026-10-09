import {
  AUTH_VERIFICATION_CONFIG,
  OTP_TTL_MINUTES,
  cooldownKeyFor,
  attemptsKeyFor,
  maskEmail,
} from "@/app/lib/config/authVerification";
import { PUSH_PROMPT_CONFIG, isLikelyIos } from "@/app/lib/config/pushPrompt";

describe("execute-feature: auth verification registry (config-driven OTP)", () => {
  it("carries TTL, cooldown, attempt cap, and key prefixes", () => {
    expect(AUTH_VERIFICATION_CONFIG.otpTtlSeconds).toBe(900);
    expect(AUTH_VERIFICATION_CONFIG.resendCooldownSeconds).toBeGreaterThan(0);
    expect(AUTH_VERIFICATION_CONFIG.maxVerifyAttempts).toBeGreaterThan(0);
    expect(AUTH_VERIFICATION_CONFIG.keys.otpPrefix).toBe("otp:");
    expect(OTP_TTL_MINUTES).toBe(15);
  });

  it("builds per-email cooldown/attempt keys", () => {
    expect(cooldownKeyFor("a@b.co")).toMatch(/^otp-cooldown:a@b\.co$/);
    expect(attemptsKeyFor("a@b.co")).toMatch(/^otp-attempts:a@b\.co$/);
  });

  it("masks emails without leaking the full address", () => {
    expect(maskEmail("adaobi@example.com")).toBe("a***@example.com");
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("adaobi@example.com")).not.toContain("adaobi");
  });

  it("copy explains expiry, invalidation, cooldown, and rate limits", () => {
    const c = AUTH_VERIFICATION_CONFIG.copy;
    expect(c.codeExpiryNote(15)).toMatch("15");
    expect(c.previousInvalidated.length).toBeGreaterThan(0);
    expect(c.resendCooldown(60)).toMatch("60");
    expect(c.rateLimited(30)).toMatch("30");
    expect(c.expired.length).toBeGreaterThan(0);
    expect(c.incorrect(3)).toMatch("3");
    expect(c.attemptsExhausted.length).toBeGreaterThan(0);
  });
});

describe("execute-feature: push prompt registry (config-driven notice)", () => {
  it("carries storage keys, dismiss TTL, and outcome copy", () => {
    expect(PUSH_PROMPT_CONFIG.storage.enabledKey).toBe("along-push-enabled");
    expect(PUSH_PROMPT_CONFIG.storage.dismissedAtKey).toBe("along-push-dismissed-at");
    expect(PUSH_PROMPT_CONFIG.storage.dismissTtlMs).toBeGreaterThan(0);
    for (const k of ["prompt", "enable", "offline", "denied", "deniedHelp", "unsupported", "failed", "iosHelp"] as const) {
      expect(PUSH_PROMPT_CONFIG.copy[k].length).toBeGreaterThan(0);
    }
  });

  it("detects likely-iOS user agents for install guidance", () => {
    expect(isLikelyIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isLikelyIos("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });
});
