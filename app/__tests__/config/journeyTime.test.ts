/**
 * Vehicle-aware journey times + persistent traffic overlay:
 * - per-vehicle speeds differ (trekking ≠ car) with logical fallbacks
 * - immune modes (trekking/boat/train) shrug off road-traffic delays
 * - destination legs never vote for the dominant vehicle
 * - traffic chunks remap proportionally across tracing updates so colors
 *   persist when the pins-line swaps for the road-snapped trace
 */
import {
  JOURNEY_TIME_CONFIG,
  speedForVehicle,
  trafficSensitivityForVehicle,
  shouldRecomputeFromDistance,
  estimateDurationMins,
  adjustDurationForVehicleAndTraffic,
  dominantVehicleForSteps,
  resolveJourneyDuration,
} from "@/app/lib/config/journeyTime";
import { remapTrafficSegments } from "@/app/lib/config/traffic";

describe("journey-time vehicle speeds", () => {
  it("times trekking far slower than cars", () => {
    expect(speedForVehicle("trekking")).toBe(5);
    expect(speedForVehicle("car")).toBe(30);
    expect(estimateDurationMins(10, "trekking")).toBeGreaterThan(
      estimateDurationMins(10, "car")
    );
  });

  it("falls back to the default road speed for unknown modes", () => {
    const fallback = JOURNEY_TIME_CONFIG.vehicles[JOURNEY_TIME_CONFIG.defaultVehicle].avgSpeedKmh;
    expect(speedForVehicle("spaceship")).toBe(fallback);
    expect(speedForVehicle(null)).toBe(fallback);
    expect(speedForVehicle("")).toBe(fallback);
  });

  it("recomputes slow/rail/water modes from distance, trusts road modes", () => {
    for (const mode of JOURNEY_TIME_CONFIG.recomputeFromDistance) {
      expect(shouldRecomputeFromDistance(mode)).toBe(true);
    }
    expect(shouldRecomputeFromDistance("car")).toBe(false);
    expect(shouldRecomputeFromDistance("bus")).toBe(false);
    expect(resolveJourneyDuration(10, 20, null, "trekking")).toBe(
      estimateDurationMins(10, "trekking")
    );
    expect(resolveJourneyDuration(10, 20, null, "car")).toBe(20);
  });

  it("falls back gracefully when every input is missing", () => {
    expect(resolveJourneyDuration(null, null, 33, "car")).toBe(33);
    expect(resolveJourneyDuration(null, null, null, "car")).toBe(0);
    expect(estimateDurationMins(NaN, "car")).toBe(0);
  });
});

describe("traffic sensitivity by vehicle", () => {
  const counts = { low: 5, moderate: 3, heavy: 2 };

  it("keeps immune modes at base while road modes lift with traffic", () => {
    expect(trafficSensitivityForVehicle("boat")).toBe(0);
    expect(trafficSensitivityForVehicle("train")).toBe(0);
    expect(trafficSensitivityForVehicle("car")).toBe(1);
    expect(adjustDurationForVehicleAndTraffic(20, counts, 10, "train")).toBe(20);
    expect(adjustDurationForVehicleAndTraffic(20, counts, 10, "boat")).toBe(20);
    expect(adjustDurationForVehicleAndTraffic(20, counts, 10, "car")).toBeGreaterThan(20);
  });

  it("dampens (not zeroes) bike traffic and nearly zeroes trekking", () => {
    const bike = adjustDurationForVehicleAndTraffic(20, counts, 10, "bike");
    const car = adjustDurationForVehicleAndTraffic(20, counts, 10, "car");
    const trek = adjustDurationForVehicleAndTraffic(20, counts, 10, "trekking");
    expect(bike).toBeGreaterThan(20);
    expect(bike).toBeLessThan(car);
    expect(trek).toBeGreaterThanOrEqual(20);
    expect(trek).toBeLessThanOrEqual(bike);
  });

  it("treats unknown vehicles as fully exposed (safe fallback)", () => {
    expect(trafficSensitivityForVehicle("spaceship")).toBe(1);
    expect(adjustDurationForVehicleAndTraffic(20, counts, 10, "spaceship")).toBe(
      adjustDurationForVehicleAndTraffic(20, counts, 10, "car")
    );
  });
});

describe("dominant vehicle skips the destination leg", () => {
  it("ignores the final stop's vehicle (it describes no onward leg)", () => {
    expect(dominantVehicleForSteps([{ vehicle: "car" }, { vehicle: "trekking" }])).toBe("car");
  });

  it("picks the majority across travelling legs", () => {
    expect(
      dominantVehicleForSteps([{ vehicle: "car" }, { vehicle: "car" }, { vehicle: "bus" }])
    ).toBe("car");
  });

  it("returns null when no travelling leg carries a known vehicle", () => {
    expect(dominantVehicleForSteps([])).toBeNull();
    expect(dominantVehicleForSteps([{ vehicle: "spaceship" }, { location: "x" }])).toBeNull();
  });
});

describe("traffic persistence across tracing updates", () => {
  it("remaps a full-route chunk onto the longer road trace", () => {
    const remapped = remapTrafficSegments([{ from: 0, to: 1, level: "heavy" }], 100);
    expect(remapped).toHaveLength(1);
    expect(remapped[0].from).toBe(0);
    expect(remapped[0].to).toBe(99);
  });

  it("keeps each chunk's share when the geometry grows", () => {
    const remapped = remapTrafficSegments(
      [
        { from: 0, to: 4, level: "moderate" },
        { from: 5, to: 9, level: "heavy" },
      ],
      100
    );
    expect(remapped[0]).toMatchObject({ from: 0, to: 49 });
    expect(remapped[1]).toMatchObject({ from: 50, to: 99 });
  });

  it("returns identity for matching geometry and [] for degenerate input", () => {
    const segs = [{ from: 0, to: 4, level: "moderate" as const }];
    expect(remapTrafficSegments(segs, 5)).toBe(segs);
    expect(remapTrafficSegments([], 100)).toEqual([]);
    expect(remapTrafficSegments(segs, 1)).toEqual([]);
  });
});
