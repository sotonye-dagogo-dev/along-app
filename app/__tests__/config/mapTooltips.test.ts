/**
 * @jest-environment jsdom
 *
 * Map tracing tooltips: config-driven detailed (per-stretch traffic level +
 * est. time/distance) and mini (quick-link prompt, rate-limit friendly).
 */
import {
  MAP_TOOLTIPS_CONFIG,
  resolveTooltipMode,
  segmentMidpoint,
  segmentShare,
  segmentEstMins,
  segmentDistanceKm,
  nearestCoordIndex,
  segmentForIndex,
  parseTrafficLayerId,
} from "@/app/lib/config/mapTooltips";
import { MAP_EXPAND_CONFIG } from "@/app/lib/config/mapStack";

const coords = [
  { lat: 6.5, lng: 3.3 },
  { lat: 6.51, lng: 3.31 },
  { lat: 6.52, lng: 3.32 },
  { lat: 6.53, lng: 3.33 },
  { lat: 6.54, lng: 3.34 },
];

describe("tooltip mode resolution (rate-limit friendly minis)", () => {
  it("auto follows traffic depth: traffic maps are detailed, feed minis are mini", () => {
    expect(resolveTooltipMode("auto", true)).toBe("detailed");
    expect(resolveTooltipMode("auto", false)).toBe("mini");
    expect(resolveTooltipMode(undefined, true)).toBe("detailed");
    expect(resolveTooltipMode(undefined, false)).toBe("mini");
  });

  it("explicit preference wins over auto", () => {
    expect(resolveTooltipMode("detailed", false)).toBe("detailed");
    expect(resolveTooltipMode("mini", true)).toBe("mini");
  });
});

describe("segment math (pure, never throws)", () => {
  it("midpoint lands inside the slice", () => {
    const mid = segmentMidpoint(coords, 0, 4);
    expect(mid).toEqual({ lat: 6.52, lng: 3.32 });
  });

  it("midpoint falls back safely on degenerate input", () => {
    expect(segmentMidpoint([], 0, 2)).toBeNull();
    expect(segmentMidpoint(coords, 99, 120)).not.toBeNull();
  });

  it("share is clamped 0..1", () => {
    expect(segmentShare(5, 0, 4)).toBeCloseTo(1);
    expect(segmentShare(5, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(segmentShare(1, 0, 4)).toBe(0);
  });

  it("stretch estimate scales base share by the level delay factor", () => {
    // 20-min base over 5 coords (4 legs): first-half slice ≈ 10 min free-flow.
    const free = segmentEstMins(20, 0, 2, 5, "low", 1);
    const heavy = segmentEstMins(20, 0, 2, 5, "heavy", 1.35);
    expect(free).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(free);
  });

  it("zero base duration yields zero stretch estimate (no phantom minutes)", () => {
    expect(segmentEstMins(0, 0, 2, 5, "heavy", 1.35)).toBe(0);
  });

  it("distance share rounds to 1 decimal", () => {
    expect(segmentDistanceKm(10, 0, 4, 5)).toBe(10);
    expect(segmentDistanceKm(0, 0, 2, 5)).toBe(0);
  });
});

describe("tap resolution (pure, never throws)", () => {
  const segments = [
    { from: 0, to: 1, level: "low" as const },
    { from: 2, to: 4, level: "heavy" as const },
  ];

  it("nearest coord index tracks the tap", () => {
    expect(nearestCoordIndex(coords, 6.54, 3.34)).toBe(4);
    expect(nearestCoordIndex([], 0, 0)).toBe(-1);
  });

  it("segment lookup contains the index", () => {
    expect(segmentForIndex(segments, 3)?.level).toBe("heavy");
    expect(segmentForIndex(segments, 9)).toBeNull();
  });

  it("traffic layer ids parse back to bounds (ignores base/hit layers)", () => {
    expect(parseTrafficLayerId("traffic-line-2-7")).toEqual({ from: 2, to: 7 });
    expect(parseTrafficLayerId("route-line")).toBeNull();
    expect(parseTrafficLayerId("route-hit-line")).toBeNull();
    expect(parseTrafficLayerId("traffic-line-9-2")).toBeNull();
    expect(parseTrafficLayerId(null)).toBeNull();
  });
});

describe("tooltip copy + expanded-map layering", () => {
  it("mini tooltip links out instead of fetching traffic", () => {
    expect(MAP_TOOLTIPS_CONFIG.mini.body.length).toBeGreaterThan(0);
    expect(MAP_TOOLTIPS_CONFIG.mini.viewPostLabel.length).toBeGreaterThan(0);
    expect(MAP_TOOLTIPS_CONFIG.mini.navigateLabel.length).toBeGreaterThan(0);
  });

  it("detailed tooltip carries stretch + provider copy", () => {
    expect(MAP_TOOLTIPS_CONFIG.detailed.stretchTimeLabel.length).toBeGreaterThan(0);
    expect(MAP_TOOLTIPS_CONFIG.detailed.estimatedNote.length).toBeGreaterThan(0);
    expect(MAP_TOOLTIPS_CONFIG.detailed.liveNote.length).toBeGreaterThan(0);
  });

  it("hit line is wider than the visible tracing for reliable taps", () => {
    expect(MAP_TOOLTIPS_CONFIG.hitLineWidth).toBeGreaterThan(4.5);
  });

  it("expanded map layers above the live-navigation modal (no vanish)", () => {
    // LiveNavigationModal is z-[60]; the expand dialog must sit above it.
    expect(MAP_EXPAND_CONFIG.overlayClass).toMatch(/z-\[70\]/);
  });
});
