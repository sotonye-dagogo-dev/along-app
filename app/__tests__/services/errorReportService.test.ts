import {
  sanitizeErrorText,
  reportClientError,
} from "@/app/lib/services/errorReportService";

describe("sanitizeErrorText", () => {
  it("redacts email addresses", () => {
    const out = sanitizeErrorText("failed for jane.doe@example.com today", 500);
    expect(out).not.toContain("jane.doe@example.com");
    expect(out).toContain("[redacted]");
  });

  it("redacts bearer tokens and password/token assignments", () => {
    const out = sanitizeErrorText(
      "Bearer abc123XYZ and password: hunter2 token=secret-otp-1",
      500,
    );
    expect(out).not.toContain("abc123XYZ");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("secret-otp-1");
  });

  it("truncates to maxLength", () => {
    expect(sanitizeErrorText("x".repeat(100), 10)).toHaveLength(10);
  });

  it("handles non-string input without throwing", () => {
    expect(() => sanitizeErrorText(null, 50)).not.toThrow();
    expect(() => sanitizeErrorText(undefined, 50)).not.toThrow();
    expect(sanitizeErrorText(42, 50)).toBe("42");
  });
});

describe("reportClientError", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("resolves reported:true when the API persists the row", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
    const result = await reportClientError(new Error("boom"), { digest: "d1" });
    expect(result).toEqual({ reported: true });
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse((opts as { body: string }).body);
    expect(body.category).toBe("OTHER");
    expect(typeof body.title).toBe("string");
    expect(typeof body.description).toBe("string");
  });

  it("resolves reported:false when the API rejects the payload", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;
    const result = await reportClientError(new Error("boom"));
    expect(result).toEqual({ reported: false });
  });

  it("resolves reported:false when the network throws (never rejects)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as never;
    await expect(reportClientError(new Error("boom"))).resolves.toEqual({
      reported: false,
    });
  });

  it("never leaks emails from the error into the payload", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
    await reportClientError(new Error("failed for jane@example.com"));
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse((opts as { body: string }).body);
    expect(JSON.stringify(body)).not.toContain("jane@example.com");
  });

  it("sends a stable timestamp-free idempotency key (header + body)", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
    await reportClientError(new Error("Loading chunk 72 failed."), {
      digest: "d1",
      path: "/login",
    });
    await reportClientError(new Error("Loading chunk 72 failed."), {
      digest: "d1",
      path: "/login",
    });
    const optsAt = (i: number) =>
      (global.fetch as jest.Mock).mock.calls[i][1] as {
        headers: Record<string, string>;
        body: string;
      };
    const key0 = optsAt(0).headers["x-idempotency-key"];
    const key1 = optsAt(1).headers["x-idempotency-key"];
    expect(key0).toBeTruthy();
    expect(key0).toBe(key1);
    expect(JSON.parse(optsAt(0).body).clientToken).toBe(key0);
    // Different error → different key (never collapses distinct reports).
    await reportClientError(new Error("Something else"), { path: "/feed" });
    expect(optsAt(2).headers["x-idempotency-key"]).not.toBe(key0);
  });
});
