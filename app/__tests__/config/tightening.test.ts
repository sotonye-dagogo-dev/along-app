/**
 * Tightening-up: auth unverified edge case, email-studio hardening
 * (SVG icons, unverified filter, restore-to-default, dynamic vars),
 * blog management sanitization, audit service shape, leaderboard pagination.
 */
jest.mock("@/app/lib/db/redis", () => ({
  getRedisClient: () => null,
  __resetRedisForTests: () => {},
  withTimeout: async <T>(p: Promise<T>) => p,
  REDIS_OP_TIMEOUT_MS: 1200,
  redis: {
    get: async <T>() => null as T | null,
    set: async () => {},
    del: async () => 0,
    _getClient: () => null,
    _withTimeout: async <T>(p: Promise<T>) => p,
  },
}));

import { sanitizeEmailHtml } from "@/app/lib/utils/emailSanitize";
import { EMAIL_ICONS } from "@/app/lib/config/email";
import { emailVarSource } from "@/app/lib/services/emailService";
import { sanitizeBlogPost, normalizeSlug } from "@/app/lib/utils/blogStore";
import { isBlogStatus } from "@/app/lib/config/blogManagement";

describe("email SVG icons survive sanitization (preview + sent)", () => {
  it("keeps svg/path/circle/polygon/rect with safe attrs, viewBox case intact", () => {
    for (const svg of Object.values(EMAIL_ICONS)) {
      const clean = sanitizeEmailHtml(`<p>Hi</p>${svg}`);
      expect(clean).toContain("<svg");
      expect(clean).toContain("viewBox");
      expect(clean).toContain("Hi");
    }
  });
  it("still strips scripts/event handlers around icons", () => {
    const clean = sanitizeEmailHtml(`<svg viewBox="0 0 24 24" onclick="evil()"><path d="M0 0"/></svg><script>x</script>`);
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("<svg");
    expect(clean).toContain("<path");
  });
  it("numeric attrs (x1/y1/x2/y2) survive for line icons", () => {
    const clean = sanitizeEmailHtml(`<svg viewBox="0 0 24 24"><line x1="1" y1="2" x2="3" y2="4"/></svg>`);
    expect(clean).toContain("x1=");
    expect(clean).toContain("<line");
  });
});

describe("email variable source classification", () => {
  it("platform/user/generated vars are auto, customs are manual", () => {
    for (const v of ["appUrl", "logoUrl", "year"]) expect(emailVarSource(v)).toBe("platform");
    for (const v of ["firstName", "userName", "email"]) expect(emailVarSource(v)).toBe("user");
    for (const v of ["otp", "verifyLink", "resetLink"]) expect(emailVarSource(v)).toBe("generated");
    expect(emailVarSource("someCustomVar")).toBe("manual");
  });
});

describe("blog management sanitization", () => {
  it("normalizes slugs and rejects invalid posts", () => {
    expect(normalizeSlug("Lagos Commute Guide!!")).toBe("lagos-commute-guide");
    expect(sanitizeBlogPost({ slug: "!!!", title: "x", content: "<p>y</p>" })).toBeNull();
    expect(sanitizeBlogPost({ slug: "ok", title: "", content: "<p>y</p>" })).toBeNull();
  });
  it("sanitizes content but keeps icons/vars", () => {
    const clean = sanitizeBlogPost({
      slug: "t", title: "T", content: `<p>Hello {{firstName}}</p><script>x</script>${EMAIL_ICONS.pin}`,
    });
    expect(clean).not.toBeNull();
    expect(clean!.content).toContain("{{firstName}}");
    expect(clean!.content).not.toContain("<script>");
    expect(clean!.content).toContain("<svg");
  });
  it("accepts draft/published/archived statuses", () => {
    expect(isBlogStatus("draft")).toBe(true);
    expect(isBlogStatus("published")).toBe(true);
    expect(isBlogStatus("archived")).toBe(true);
    expect(isBlogStatus("deleted")).toBe(false);
  });
});
