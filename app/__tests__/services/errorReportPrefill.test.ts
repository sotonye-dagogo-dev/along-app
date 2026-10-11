import {
  buildErrorReportPrefill,
  buildBugReportUrl,
  sanitizeErrorText,
} from "@/app/lib/services/errorReportService";
import { ERROR_REPORTING_CONFIG } from "@/app/lib/config/errorReporting";

describe("error-report prefill (sanitized bug-report CTA)", () => {
  it("builds a titled, hinted prefill that invites edits above or below", () => {
    const prefill = buildErrorReportPrefill(new Error("Boom"), { path: "/home" });
    expect(prefill.title).toContain("/home");
    expect(prefill.description).toContain(ERROR_REPORTING_CONFIG.prefillHeader);
    expect(prefill.description).toContain("Boom");
    expect(prefill.title.length).toBeLessThanOrEqual(
      ERROR_REPORTING_CONFIG.maxPrefillTitleLength,
    );
    expect(prefill.description.length).toBeLessThanOrEqual(
      ERROR_REPORTING_CONFIG.maxPrefillDescriptionLength,
    );
  });

  it("redacts emails, tokens and passwords from the prefill", () => {
    const err = new Error("failed for jane@example.com with token: abc123 password: hunter2");
    (err as Error).stack = "at fn (bearer xyz access_token=secret123)";
    const prefill = buildErrorReportPrefill(err, { path: "/profile?token=abc" });
    expect(prefill.description).not.toContain("jane@example.com");
    expect(prefill.description).not.toContain("hunter2");
    expect(prefill.description).not.toContain("secret123");
    expect(prefill.description).toContain("[redacted]");
  });

  it("never throws for non-Error inputs (strings, null, undefined)", () => {
    for (const bad of ["oops", null, undefined, 42, {}]) {
      const prefill = buildErrorReportPrefill(bad, {});
      expect(typeof prefill.title).toBe("string");
      expect(typeof prefill.description).toBe("string");
      expect(buildBugReportUrl(prefill).startsWith(ERROR_REPORTING_CONFIG.bugReportPath)).toBe(true);
    }
  });

  it("encodes the prefill into a round-trippable bug-report URL", () => {
    const prefill = buildErrorReportPrefill(new Error("Map failed & crashed?"), {
      path: "/explore",
      digest: "abc123",
    });
    const url = buildBugReportUrl(prefill);
    expect(url.startsWith(`${ERROR_REPORTING_CONFIG.bugReportPath}?`)).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("title")).toBe(prefill.title);
    expect(params.get("description")).toBe(prefill.description);
  });

  it("falls back to the bare bug-report path when the draft is empty", () => {
    expect(buildBugReportUrl({ title: "", description: "" })).toBe(
      ERROR_REPORTING_CONFIG.bugReportPath,
    );
  });

  it("sanitizeErrorText caps length and coerces non-strings", () => {
    expect(sanitizeErrorText("x".repeat(9999), 100).length).toBe(100);
    expect(sanitizeErrorText(null, 100)).toBe("");
    expect(sanitizeErrorText(123, 100)).toBe("123");
  });
});
