import fs from "fs";
import path from "path";

/**
 * Verify-email/OTP not sent on register: the signup route previously
 * fire-and-forgot its mails (`void sendInBackground()` / globalThis.waitUntil,
 * which does not exist on the Vercel/Next runtime), so serverless froze the
 * function on response and the OTP mail was silently dropped while awaited
 * flows delivered fine. Static (file-presence) level so it runs without
 * node_modules/DB in CI runners.
 */
const ROOT = path.resolve(__dirname, "..", "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("register awaits verification email (no fire-and-forget)", () => {
  const src = read("app/api/auth/register/route.ts");

  it("does not use void background / globalThis.waitUntil for dispatch", () => {
    expect(src).not.toContain("sendInBackground");
    expect(src).not.toContain("globalThis");
    expect(src).not.toContain("void send");
  });

  it("sends the verifyEmail template (OTP + link) with a bounded timeout", () => {
    expect(src).toContain("sendVerifyEmail");
    expect(src).toContain("verify-email?email=");
    expect(src).toContain("REGISTER_EMAIL_DISPATCH_CONFIG");
    expect(src).toContain("Promise.allSettled");
  });

  it("returns an honest sent flag instead of a false-positive message", () => {
    expect(src).toContain("sent: otpSent");
    expect(src).toContain("AUTH_VERIFICATION_CONFIG.copy.sendFailed");
  });

  it("dispatch config is config-driven in authVerification", () => {
    const cfg = read("app/lib/config/authVerification.ts");
    expect(cfg).toContain("REGISTER_EMAIL_DISPATCH_CONFIG");
    expect(cfg).toContain("otpTimeoutMs");
    expect(cfg).toContain("useVerifyTemplate");
    expect(cfg).toContain("GOOGLE_WELCOME_DISPATCH_CONFIG");
  });

  it("google callback welcome is awaited (same freeze class fixed)", () => {
    const g = read("app/api/auth/google/callback/route.ts");
    expect(g).not.toContain("void sendWelcomeEmail");
    expect(g).toContain("GOOGLE_WELCOME_DISPATCH_CONFIG");
  });

  it("register page surfaces delivery failure but still advances to OTP", () => {
    const page = read("app/(auth)/register/page.tsx");
    expect(page).toContain("sent === false");
    expect(page).toContain("/otp?email=");
  });
});
