/**
 * @jest-environment jsdom
 *
 * Leg-aware stretch tooltips: taps resolve to the route leg
 * (origin→stop→destination) with distinct per-leg data, anchored at the tap.
 */
import {
  legBounds,
  legCounterLabel,
  legDistanceKm,
  legEstMins,
  legIndexForCoord,
  legLengthShare,
  legRangeLabel,
  pinBordersOnRoute,
  worstLevelInRange,
} from "@/app/lib/config/mapTooltips";
import { totalFareForSteps } from "@/app/lib/config/routeSteps";

const straight = [
  { lat: 6.5, lng: 3.3 },
  { lat: 6.51, lng: 3.31 },
  { lat: 6.52, lng: 3.32 },
  { lat: 6.53, lng: 3.33 },
  { lat: 6.54, lng: 3.34 },
];

const pins = [
  { lat: 6.5, lng: 3.3, label: "Origin" },
  { lat: 6.52, lng: 3.32, label: "Mid stop" },
  { lat: 6.54, lng: 3.34, label: "Destination" },
];

describe("leg borders + tap resolution", () => {
  it("pins pin the trace ends and stay monotonic", () => {
    const borders = pinBordersOnRoute(straight, pins);
    expect(borders[0]).toBe(0);
    expect(borders[borders.length - 1]).toBe(straight.length - 1);
    for (let i = 1; i < borders.length; i++) {
      expect(borders[i]).toBeGreaterThanOrEqual(borders[i - 1]);
    }
  });

  it("different stretches resolve to different legs", () => {
    const borders = pinBordersOnRoute(straight, pins);
    const first = legIndexForCoord(borders, 0);
    const last = legIndexForCoord(borders, 4);
    expect(first).toBe(0);
    expect(last).toBe(1);
    expect(first).not.toBe(last);
  });

  it("leg bounds + labels reflect the stretch considered", () => {
    const borders = pinBordersOnRoute(straight, pins);
    expect(legBounds(borders, 0)).toEqual({ from: 0, to: 2 });
    expect(legBounds(borders, 1)).toEqual({ from: 2, to: 4 });
    expect(legRangeLabel(0, pins)).toContain("Origin");
    expect(legRangeLabel(1, pins)).toContain("Destination");
    expect(legCounterLabel(0, 2)).toBe("Stretch 1 of 2");
    expect(legCounterLabel(1, 2)).toBe("Stretch 2 of 2");
  });

  it("degenerate inputs never throw", () => {
    expect(pinBordersOnRoute([], pins)).toEqual([]);
    expect(pinBordersOnRoute(straight, [])).toEqual([]);
    expect(legIndexForCoord([], 2)).toBe(-1);
    expect(legBounds([], 0)).toBeNull();
    expect(legRangeLabel(0, null)).toBe("");
    expect(legCounterLabel(-1, 2)).toBe("");
  });
});

describe("leg traffic + shares", () => {
  const segments = [
    { from: 0, to: 1, level: "low" as const },
    { from: 2, to: 4, level: "heavy" as const },
  ];

  it("worst level in range picks heavy over free flow", () => {
    expect(worstLevelInRange(segments, 0, 1)).toBe("low");
    expect(worstLevelInRange(segments, 2, 4)).toBe("heavy");
    expect(worstLevelInRange(segments, 0, 4)).toBe("heavy");
    expect(worstLevelInRange([], 0, 4)).toBe("low");
  });

  it("leg shares differ per stretch and sum sanely", () => {
    const a = legLengthShare(straight, 0, 2);
    const b = legLengthShare(straight, 2, 4);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(a + b).toBeLessThanOrEqual(1.01);
  });

  it("leg time/distance scale with the leg, not a fixed chunk", () => {
    const d0 = legDistanceKm(20, straight, 0, 2);
    const d1 = legDistanceKm(20, straight, 2, 4);
    expect(d0).toBeGreaterThan(0);
    expect(d1).toBeGreaterThan(0);
    expect(legEstMins(0, straight, 0, 2, 1)).toBe(0);
    expect(legEstMins(20, straight, 0, 2, 1.35)).toBeGreaterThanOrEqual(
      legEstMins(20, straight, 0, 2, 1)
    );
  });
});

describe("total fare (destination excluded)", () => {
  it("sums travelling legs only", () => {
    expect(
      totalFareForSteps([{ fare: 500 }, { fare: 700 }, { fare: 9999 }])
    ).toBe(1200);
    expect(totalFareForSteps([])).toBe(0);
    expect(totalFareForSteps(null)).toBe(0);
    expect(totalFareForSteps([{ fare: NaN }, { fare: -5 }])).toBe(0);
  });
});
