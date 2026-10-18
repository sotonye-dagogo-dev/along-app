/**
 * Stale-chunk auto-recovery + stable error-report idempotency keys.
 * Covers the reported ChunkLoadError-on-/login class: deploys rotate hashed
 * chunks, an open tab then fails to fetch them, and the boundary should try
 * ONE silent reload per browser session before filing a report. Repeated
 * captures of the same error must present the SAME idempotency key (no
 * timestamp) so the server collapses them into one BugReport row.
 */
import {
  isChunkLoadError,
  attemptChunkLoadRecovery,
  buildStableErrorIdempotencyKey,
} from "@/app/lib/services/errorReportService";
import { ERROR_REPORTING_CONFIG } from "@/app/lib/config/errorReporting";
import { BUG_REPORT_DEDUP_CONFIG } from "@/app/lib/config/reportAttachments";

describe("isChunkLoadError", () => {
  it("matches the reported webpack ChunkLoadError shapes", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Loading chunk 72 failed. (error: https://www.alongng.com/_next/static/chunks/app/(auth)/login/page-ed6cf9a179b7ec0d.js)",
        ),
      ),
    ).toBe(true);
    const named = new Error("Loading chunk 72 failed.");
    named.name = "ChunkLoadError";
    expect(isChunkLoadError(named)).toBe(true);
    expect(
      isChunkLoadError(new Error("Loading CSS chunk 412 failed.")),
    ).toBe(true);
  });

  it("matches dynamic-import failures (module federation / code-splitting)", () => {
    expect(
      isChunkLoadError(
        new Error("Failed to fetch dynamically imported module: /_next/static/chunks/page.js"),
      ),
    ).toBe(true);
    expect(
      isChunkLoadError(new Error("error loading dynamically imported module")),
    ).toBe(true);
  });

  it("does not match ordinary errors", () => {
    expect(isChunkLoadError(new Error("boom"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
    expect(() => isChunkLoadError(Symbol("x"))).not.toThrow();
  });
});

describe("attemptChunkLoadRecovery", () => {
  const reload = jest.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
  });

  it("reloads once per browser session", () => {
    expect(attemptChunkLoadRecovery(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    // Second attempt in the same session is blocked (no reload loop).
    expect(attemptChunkLoadRecovery(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("writes the once-flag under the configured key", () => {
    expect(attemptChunkLoadRecovery(reload)).toBe(true);
    expect(
      sessionStorage.getItem(ERROR_REPORTING_CONFIG.chunkLoad.reloadGuardKey),
    ).toBeTruthy();
  });

  it("returns false (never throws) when storage is unavailable", () => {
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(attemptChunkLoadRecovery(reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe("buildStableErrorIdempotencyKey", () => {
  it("is stable for the same error identity across timestamps", () => {
    // Two captures of the same error differ only in the `When:` timestamp
    // (which never enters the key) — the key must be identical.
    const a = buildStableErrorIdempotencyKey(
      "Client error: ChunkLoadError on /login",
      "/login",
      undefined,
    );
    const b = buildStableErrorIdempotencyKey(
      "Client error: ChunkLoadError on /login",
      "/login",
      undefined,
    );
    expect(a).toBe(b);
  });

  it("differs across error title, path, or digest", () => {
    const base = buildStableErrorIdempotencyKey("Client error: A on /x", "/x", "d1");
    expect(
      buildStableErrorIdempotencyKey("Client error: B on /x", "/x", "d1"),
    ).not.toBe(base);
    expect(
      buildStableErrorIdempotencyKey("Client error: A on /y", "/y", "d1"),
    ).not.toBe(base);
    expect(
      buildStableErrorIdempotencyKey("Client error: A on /x", "/x", "d2"),
    ).not.toBe(base);
    expect(
      buildStableErrorIdempotencyKey("Client error: A on /x", "/x", undefined),
    ).not.toBe(base);
  });

  it("respects the server maxKeyLength cap and the eb: prefix", () => {
    const key = buildStableErrorIdempotencyKey("t".repeat(500), "/p".repeat(200), "d".repeat(100));
    expect(key.length).toBeLessThanOrEqual(BUG_REPORT_DEDUP_CONFIG.maxKeyLength);
    expect(key.startsWith("eb:")).toBe(true);
  });

  it("handles empty inputs without throwing", () => {
    expect(() => buildStableErrorIdempotencyKey("", "", undefined)).not.toThrow();
  });
});
