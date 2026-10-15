/**
 * Sprint 60 — feed out-of-network discovery guarantee.
 *
 * Regression: a route request from a user outside the viewer's network
 * appeared in the suggestions carousel (which surfaces recent open requests
 * regardless of follow graph) but never in the feed (trending is 7-day +
 * engagement-ordered, tag needs activity overlap, recent is a tiny window).
 *
 * - DEFAULT_FEED_CONFIG carries discoveryWeight + openRequestWeight so the
 *   ordering policy stays config-driven (admin-tunable via SiteConfig
 *   `feedAlgorithm`, spread-merge safe for legacy rows).
 * - Weights sit below followingWeight (affinity preserved) and above
 *   trendingWeight (discovery actually surfaces).
 * - feedService resolves non-finite stored values to the hardcoded
 *   defaults — never to zero, which would silently re-exclude strangers.
 */
import { DEFAULT_FEED_CONFIG } from "@/app/lib/config/feedAlgorithm";

/** Mirrors the feedService fallback (legacy SiteConfig rows lack the keys). */
function resolveDiscoveryWeights(stored: Record<string, unknown>): {
  discoveryWeight: number;
  openRequestWeight: number;
} {
  const d = stored.discoveryWeight;
  const o = stored.openRequestWeight;
  return {
    discoveryWeight:
      typeof d === "number" && Number.isFinite(d) ? d : DEFAULT_FEED_CONFIG.discoveryWeight,
    openRequestWeight:
      typeof o === "number" && Number.isFinite(o) ? o : DEFAULT_FEED_CONFIG.openRequestWeight,
  };
}

describe("feed discovery weights (out-of-network inclusion)", () => {
  it("declares finite positive discovery + open-request weights", () => {
    expect(Number.isFinite(DEFAULT_FEED_CONFIG.discoveryWeight)).toBe(true);
    expect(Number.isFinite(DEFAULT_FEED_CONFIG.openRequestWeight)).toBe(true);
    expect(DEFAULT_FEED_CONFIG.discoveryWeight).toBeGreaterThan(0);
    expect(DEFAULT_FEED_CONFIG.openRequestWeight).toBeGreaterThan(0);
  });

  it("keeps follow affinity dominant while letting discovery beat trending", () => {
    expect(DEFAULT_FEED_CONFIG.discoveryWeight).toBeLessThan(
      DEFAULT_FEED_CONFIG.followingWeight,
    );
    expect(DEFAULT_FEED_CONFIG.openRequestWeight).toBeLessThanOrEqual(
      DEFAULT_FEED_CONFIG.followingWeight,
    );
    expect(DEFAULT_FEED_CONFIG.discoveryWeight).toBeGreaterThan(
      DEFAULT_FEED_CONFIG.trendingWeight,
    );
    expect(DEFAULT_FEED_CONFIG.openRequestWeight).toBeGreaterThan(
      DEFAULT_FEED_CONFIG.trendingWeight,
    );
  });

  it("prioritises open requests at or above general discovery", () => {
    expect(DEFAULT_FEED_CONFIG.openRequestWeight).toBeGreaterThanOrEqual(
      DEFAULT_FEED_CONFIG.discoveryWeight,
    );
  });

  it("falls back to defaults (never zero) for legacy stored rows", () => {
    const legacy = resolveDiscoveryWeights({});
    expect(legacy.discoveryWeight).toBe(DEFAULT_FEED_CONFIG.discoveryWeight);
    expect(legacy.openRequestWeight).toBe(DEFAULT_FEED_CONFIG.openRequestWeight);
    expect(legacy.discoveryWeight).toBeGreaterThan(0);

    const junk = resolveDiscoveryWeights({ discoveryWeight: NaN, openRequestWeight: "x" });
    expect(junk.discoveryWeight).toBe(DEFAULT_FEED_CONFIG.discoveryWeight);
    expect(junk.openRequestWeight).toBe(DEFAULT_FEED_CONFIG.openRequestWeight);
  });

  it("honours admin-tuned stored values", () => {
    const tuned = resolveDiscoveryWeights({ discoveryWeight: 0.42, openRequestWeight: 0.55 });
    expect(tuned.discoveryWeight).toBe(0.42);
    expect(tuned.openRequestWeight).toBe(0.55);
  });
});
