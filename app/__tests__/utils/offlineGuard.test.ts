/**
 * @jest-environment jsdom
 */
import { requireOnline, isOfflineError, offlineFriendlyError } from "@/app/lib/utils/offlineGuard";

describe("offlineGuard", () => {
  it("blocks network-dependent ops while offline with sanitized feedback", () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    expect(requireOnline("post a route")).toBe(false);
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    expect(requireOnline("post a route")).toBe(true);
  });

  it("detects offline errors (TypeError / failed to fetch)", () => {
    expect(isOfflineError(new TypeError("fetch failed"))).toBe(true);
    expect(isOfflineError(new Error("failed to fetch dynamically imported module"))).toBe(true);
    expect(isOfflineError(new Error("Unexpected token '<'"))).toBe(false);
  });

  it("never leaks raw HTML/JSON errors to the user", () => {
    const msg = offlineFriendlyError(new Error("Unexpected token 'A', \"An error o... is not valid JSON"), "load posts");
    expect(msg).not.toMatch(/unexpected token|an error o/i);
    expect(msg).toMatch(/try again/i);
  });
});
