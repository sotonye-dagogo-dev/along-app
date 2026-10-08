import { POST_SUBMIT_CONFIG } from "@/app/lib/config/postSubmit";
import { ENDLESS_CAROUSEL_CONFIG } from "@/app/lib/config/carousel";
import { idempotencyService } from "@/app/lib/services/idempotencyService";

describe("execute-feature: posting hardening + viewer/carousel configs", () => {
  it("post-submit config carries idempotency header + submit labels", () => {
    expect(POST_SUBMIT_CONFIG.idempotencyHeader).toBe("x-idempotency-key");
    expect(POST_SUBMIT_CONFIG.idempotencyTtlMs).toBeGreaterThan(0);
    expect(POST_SUBMIT_CONFIG.shareLabel.length).toBeGreaterThan(0);
    expect(POST_SUBMIT_CONFIG.sharingLabel).not.toBe(POST_SUBMIT_CONFIG.shareLabel);
    expect(POST_SUBMIT_CONFIG.responseShareLabel.length).toBeGreaterThan(0);
    expect(POST_SUBMIT_CONFIG.responseSharingLabel).not.toBe(POST_SUBMIT_CONFIG.responseShareLabel);
  });

  it("idempotency: first claim wins, replay returns the post id", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(idempotencyService.claim(key)).toBe(true);
    // Concurrent duplicate while in flight is rejected…
    expect(idempotencyService.claim(key)).toBe(false);
    // …no completed post yet, so no replay…
    expect(idempotencyService.replayOf(key)).toBeNull();
    // …after completion the replay resolves to the original post id.
    idempotencyService.complete(key, "post-123");
    expect(idempotencyService.claim(key)).toBe(false);
    expect(idempotencyService.replayOf(key)).toBe("post-123");
  });

  it("idempotency: release lets a failed mutation retry", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(idempotencyService.claim(key)).toBe(true);
    idempotencyService.release(key);
    expect(idempotencyService.claim(key)).toBe(true);
    expect(idempotencyService.replayOf(key)).toBeNull();
    idempotencyService.release(key);
  });

  it("idempotency: blank keys never block a post", () => {
    expect(idempotencyService.claim("")).toBe(true);
    expect(idempotencyService.claim("   ")).toBe(true);
    expect(idempotencyService.replayOf("")).toBeNull();
  });

  it("carousel repeats the tape until it overflows (autoplay stays visible)", () => {
    expect(ENDLESS_CAROUSEL_CONFIG.maxRepeat).toBeGreaterThanOrEqual(1);
  });
});
