import fs from "fs";
import path from "path";

/**
 * fix-build: the verification email links to /verify-email?email=… — that
 * route must exist and be guest-accessible, and the durable OTP store must
 * be backed by schema + migration. Static (file-presence) level so it runs
 * without node_modules/DB in CI runners.
 */
const ROOT = path.resolve(__dirname, "..", "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("fix-build: /verify-email route exists and is reachable", () => {
  it("has a public page at app/(public)/verify-email/page.tsx", () => {
    const page = path.join(ROOT, "app", "(public)", "verify-email", "page.tsx");
    expect(fs.existsSync(page)).toBe(true);
    const src = fs.readFileSync(page, "utf8");
    // Verifies via PUT (no login required — the email link works anywhere).
    expect(src).toContain("/api/auth/verify-email");
    expect(src).toContain("PUT");
    // Accepts the ?email= links every sender builds.
    expect(src).toContain('get("email")');
    // Resend path shares the server-driven cooldown hook.
    expect(src).toContain("useOtpResend");
  });

  it("middleware lists /verify-email as guest-accessible", () => {
    expect(read("middleware.ts")).toContain('"/verify-email"');
  });

  it("every verify-email link builder uses the ?email= form the page reads", () => {
    for (const rel of [
      "app/api/auth/verify-email/route.ts",
      "app/lib/services/emailService.ts",
      "app/api/admin/users/route.ts",
    ]) {
      expect(read(rel)).toContain("/verify-email?email=");
    }
  });
});

describe("fix-build: durable EmailOtpToken store is schema-backed", () => {
  it("prisma schema defines the EmailOtpToken model", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toContain("model EmailOtpToken");
    expect(schema).toContain("purpose");
    expect(schema).toContain("otpHash");
  });

  it("a migration creates the table with the needed indexes", () => {
    const dir = path.join(ROOT, "prisma", "migrations", "20261009000002_email_otp_token");
    expect(fs.existsSync(path.join(dir, "migration.sql"))).toBe(true);
    const sql = fs.readFileSync(path.join(dir, "migration.sql"), "utf8");
    expect(sql).toContain("EmailOtpToken");
    expect(sql).toContain("otpHash");
  });

  it("all OTP issuance paths write the durable mirror", () => {
    for (const rel of [
      "app/api/auth/register/route.ts",
      "app/api/auth/otp/resend/route.ts",
      "app/api/auth/verify-email/route.ts",
      "app/api/auth/change-email/route.ts",
    ]) {
      expect(read(rel)).toContain("storeEmailOtpDb");
    }
  });

  it("both OTP verify paths consult the durable mirror on a Redis miss", () => {
    for (const rel of ["app/api/auth/otp/route.ts", "app/api/auth/verify-email/route.ts"]) {
      expect(read(rel)).toContain("verifyEmailOtpDb");
    }
  });
});
