/**
 * Journey-time consistency + traffic caching (config-driven, pure):
 * - header totals render as a range whose bounds the stretches sum to
 * - minute splits always sum exactly to the total (largest remainder)
 * - leg traffic factors respect vehicle sensitivity (immune modes stay ~1x)
 * - cached traffic re-bases onto a new base without refetching
 * - client cache keys are geometry-scoped (base changes never refetch)
 * - caching knobs stay sane (fresh TTL + stale window + refresh cadence)
 */
import {
  MAP_SUMMARY_CONFIG,
  formatDurationRange,
  splitMinsByWeights,
} from "@/app/lib/config/mapSummary";
import {
  TRAFFIC_CONFIG,
  rebaseTrafficResult,
  trafficClientKey,
  adjustDurationForLevels,
} from "@/app/lib/config/traffic";
import { legTrafficFactor } from "@/app/lib/config/journeyTime";

describe("duration range (header total)", () => {
  it("renders base–adjusted when traffic differs, single when equal", () => {
    expect(formatDurationRange(62, 75)).toBe(
      `1h 2m${MAP_SUMMARY_CONFIG.rangeSeparator}1h 15m`
    );
    expect(formatDurationRange(62, 62)).toBe("1h 2m");
    expect(formatDurationRange(62, 0)).toBe("1h 2m");
    expect(formatDurationRange(0, 75)).toBe(MAP_SUMMARY_CONFIG.emptyText);
  });
});

describe("minute splits (stretch sum == header)", () => {
  it("split parts always sum exactly to the total", () => {
    for (const total of [62, 75, 7, 1, 121]) {
      for (const shares of [[0.5, 0.5], [0.7, 0.2, 0.1], [1, 0, 0], [0, 0, 0]]) {
        const parts = splitMinsByWeights(total, shares);
        expect(parts).toHaveLength(shares.length);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
      }
    }
  });

  it("zero total yields zero parts (never NaN)", () => {
    expect(splitMinsByWeights(0, [0.5, 0.5])).toEqual([0, 0]);
    expect(splitMinsByWeights(null, [0.5, 0.5])).toEqual([0, 0]);
  });
});

describe("leg traffic factors (vehicle-aware)", () => {
  it("immune modes stay near 1x while road modes take the delay", () => {
    expect(legTrafficFactor("heavy", "train")).toBeCloseTo(1);
    expect(legTrafficFactor("heavy", "boat")).toBeCloseTo(1);
    expect(legTrafficFactor("heavy", "car")).toBeCloseTo(1.35);
    expect(legTrafficFactor("moderate", "car")).toBeCloseTo(1.15);
    expect(legTrafficFactor("low", "car")).toBeCloseTo(1);
  });

  it("unknown vehicles assume full exposure (safe fallback)", () => {
    expect(legTrafficFactor("heavy", "spaceship")).toBeCloseTo(1.35);
  });
});

describe("traffic rebase (no refetch on base change)", () => {
  const cached = {
    segments: [
      { from: 0, to: 4, level: "moderate" as const },
      { from: 5, to: 9, level: "low" as const },
    ],
    provider: "heuristic" as const,
    estimated: true,
    baseDurationMins: 60,
    adjustedDurationMins: 65,
  };

  it("rescales minutes when the base settles (pins → trace)", () => {
    const rebased = rebaseTrafficResult(cached, 74, adjustDurationForLevels);
    expect(rebased.baseDurationMins).toBe(74);
    expect(rebased.adjustedDurationMins).toBeGreaterThan(74);
    expect(rebased.segments).toEqual(cached.segments);
    expect(rebased.provider).toBe(cached.provider);
  });

  it("returns the same object when the base is unchanged", () => {
    expect(rebaseTrafficResult(cached, 60, adjustDurationForLevels)).toBe(cached);
  });

  it("never throws on degenerate input", () => {
    expect(rebaseTrafficResult(cached, 0, adjustDurationForLevels)).toBe(cached);
    expect(rebaseTrafficResult(cached, NaN, adjustDurationForLevels)).toBe(cached);
  });
});

describe("traffic client cache (persistent, geometry-scoped)", () => {
  it("keys scope to geometry + vehicle, never the base duration", () => {
    const a = trafficClientKey("1.0000,2.0000>3.0000,4.0000", "car");
    const b = trafficClientKey("1.0000,2.0000>3.0000,4.0000", "car");
    const c = trafficClientKey("1.0000,2.0000>9.0000,9.0000", "car");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toContain("along:traffic:v1");
  });

  it("caching knobs keep maps live without hammering the proxy", () => {
    expect(TRAFFIC_CONFIG.clientCacheTtlSec).toBeGreaterThanOrEqual(120);
    expect(TRAFFIC_CONFIG.clientStaleSec).toBeGreaterThan(TRAFFIC_CONFIG.clientCacheTtlSec);
    expect(TRAFFIC_CONFIG.refreshIntervalSec).toBeGreaterThan(0);
    expect(TRAFFIC_CONFIG.refreshIntervalSec).toBeLessThanOrEqual(TRAFFIC_CONFIG.clientCacheTtlSec);
  });
});
