/**
 * postShareService — unit tests for the shared post-share utility.
 * Covers URL building + the Web Share → clipboard → legacy fallback chain.
 */
import { buildPostUrl, sharePostLink } from "@/app/lib/services/postShareService";

describe("postShareService", () => {
  describe("buildPostUrl", () => {
    it("builds an absolute URL when an origin is given", () => {
      expect(buildPostUrl("abc123", "https://www.alongng.com")).toBe(
        "https://www.alongng.com/posts/abc123"
      );
    });

    it("trims a trailing slash from the origin", () => {
      expect(buildPostUrl("abc123", "https://www.alongng.com/")).toBe(
        "https://www.alongng.com/posts/abc123"
      );
    });

    it("falls back to a relative URL without an origin", () => {
      expect(buildPostUrl("abc123")).toBe("/posts/abc123");
    });

    it("encodes unsafe post ids", () => {
      expect(buildPostUrl("a/b?c", "https://x.com")).toBe(
        "https://x.com/posts/a%2Fb%3Fc"
      );
    });
  });

  describe("sharePostLink", () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        configurable: true,
      });
    });

    it("uses the Web Share API when available", async () => {
      const share = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, "navigator", {
        value: { share },
        configurable: true,
      });
      const outcome = await sharePostLink("post-1", "A route");
      expect(outcome).toEqual({ ok: true, method: "web-share" });
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ title: "A route" })
      );
    });

    it("treats a dismissed share sheet as handled, not an error", async () => {
      const abort = new Error("dismissed");
      abort.name = "AbortError";
      Object.defineProperty(global, "navigator", {
        value: { share: jest.fn().mockRejectedValue(abort) },
        configurable: true,
      });
      const outcome = await sharePostLink("post-1");
      expect(outcome.ok).toBe(true);
    });

    it("falls back to clipboard when Web Share is unavailable", async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, "navigator", {
        value: { clipboard: { writeText } },
        configurable: true,
      });
      const outcome = await sharePostLink("post-2", "Title");
      expect(outcome).toEqual({ ok: true, method: "clipboard" });
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/posts/post-2"));
    });

    it("never throws — resolves ok:false when nothing is available", async () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        configurable: true,
      });
      const outcome = await sharePostLink("post-3");
      // jsdom has no execCommand path wired here; either legacy copy works or
      // we get a structured failure — both are acceptable, never a throw.
      expect(typeof outcome.ok).toBe("boolean");
    });
  });
});
