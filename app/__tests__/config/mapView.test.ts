/**
 * Sprint 72 — deferred baseline recenter: pure fit-gate + config sanity for
 * the post-card / post-detail map (GPS ticks must never yank a pan).
 */
import { MAP_VIEW_CONFIG, shouldDeferFit } from "@/app/lib/config/mapView";

describe("Sprint 72: shouldDeferFit (pure baseline-fit gate)", () => {
  it("never interacted → the first fit runs immediately (pre-72 behaviour)", () => {
    expect(shouldDeferFit({ interacting: false, lastInteractionAt: null, now: 1_000 })).toBe(false);
  });

  it("defers while a gesture is actively down", () => {
    expect(shouldDeferFit({ interacting: true, lastInteractionAt: null, now: 1_000 })).toBe(true);
    expect(shouldDeferFit({ interacting: true, lastInteractionAt: 1_000, now: 1_000 })).toBe(true);
  });

  it("defers inside the idle window after the last interaction, runs at/after it", () => {
    const last = 10_000;
    const delay = MAP_VIEW_CONFIG.recenterIdleDelayMs;
    expect(shouldDeferFit({ interacting: false, lastInteractionAt: last, now: last })).toBe(true);
    expect(
      shouldDeferFit({ interacting: false, lastInteractionAt: last, now: last + delay - 1 })
    ).toBe(true);
    expect(
      shouldDeferFit({ interacting: false, lastInteractionAt: last, now: last + delay })
    ).toBe(false);
    expect(
      shouldDeferFit({ interacting: false, lastInteractionAt: last, now: last + delay + 60_000 })
    ).toBe(false);
  });

  it("honours a custom delay (tests/tuning)", () => {
    expect(
      shouldDeferFit({ interacting: false, lastInteractionAt: 100, now: 150, idleDelayMs: 100 })
    ).toBe(true);
    expect(
      shouldDeferFit({ interacting: false, lastInteractionAt: 100, now: 200, idleDelayMs: 100 })
    ).toBe(false);
  });

  it("config: a human idle window with a cheap watcher loop", () => {
    expect(MAP_VIEW_CONFIG.recenterIdleDelayMs).toBeGreaterThanOrEqual(1_000);
    expect(MAP_VIEW_CONFIG.interactionPollMs).toBeGreaterThan(0);
    expect(MAP_VIEW_CONFIG.interactionPollMs).toBeLessThan(MAP_VIEW_CONFIG.recenterIdleDelayMs);
  });
});
