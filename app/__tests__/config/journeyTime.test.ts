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
  journeyOverheadMins,
  calibrateProviderDurationMins,
  estimateJourneyDurationMins,
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
    expect(resolveJourneyDuration(10, 20, null, "car")).toBe(26);
  });

  it("falls back gracefully when every input is missing", () => {
    expect(resolveJourneyDuration(null, null, 33, "car")).toBe(33);
    expect(resolveJourneyDuration(null, null, null, "car")).toBe(0);
    expect(estimateDurationMins(NaN, "car")).toBe(0);
  });
});

describe("local journey overhead calibration", () => {
  it("calibrates provider free-flow time and adds local overhead once", () => {
    expect(Math.round(calibrateProviderDurationMins(20, "car"))).toBe(24);
    expect(journeyOverheadMins("car", 0)).toBe(2);
    expect(resolveJourneyDuration(10, 20, null, "car")).toBe(26);
    expect(resolveJourneyDuration(10, 20, null, "car", { calibrateProvider: false })).toBe(22);
    expect(resolveJourneyDuration(10, 20, null, "car", { includeOverhead: false })).toBe(24);
  });

  it("adds boarding and per-stop dwell for public transport", () => {
    const bus = JOURNEY_TIME_CONFIG.vehicles.bus;
    expect(journeyOverheadMins("bus", 3)).toBe(
      bus.boardingWaitMins + bus.perStopDwellMins * 3 + bus.checkpointDelayMins,
    );
    expect(resolveJourneyDuration(10, 20, null, "bus", { intermediateStops: 3 })).toBe(
      Math.round(calibrateProviderDurationMins(20, "bus")) + Math.round(journeyOverheadMins("bus", 3)),
    );
    // More pick-ups/drops always cost more time (up to the defensive cap).
    expect(resolveJourneyDuration(10, 20, null, "bus", { intermediateStops: 6 })).toBeGreaterThan(
      resolveJourneyDuration(10, 20, null, "bus", { intermediateStops: 1 }),
    );
  });

  it("caps corrupt stop counts and never double-adds fallback overhead", () => {
    const capped = journeyOverheadMins("bus", 9999);
    expect(capped).toBeLessThanOrEqual(JOURNEY_TIME_CONFIG.maxOverheadMins);
    expect(journeyOverheadMins("bus", 9999)).toBe(
      journeyOverheadMins("bus", JOURNEY_TIME_CONFIG.maxStopsCounted),
    );
    expect(journeyOverheadMins("bus", -4)).toBe(journeyOverheadMins("bus", 0));
    // The client fallback already includes overhead.
    expect(resolveJourneyDuration(null, null, estimateJourneyDurationMins(10, "bus", 2), "bus", {
      intermediateStops: 2,
    })).toBe(estimateJourneyDurationMins(10, "bus", 2));
  });

  it("keeps immune modes free of road/toll overhead", () => {
    expect(journeyOverheadMins("trekking", 8)).toBe(0);
    expect(resolveJourneyDuration(10, 12, null, "trekking", { intermediateStops: 8 })).toBe(
      estimateDurationMins(10, "trekking"),
    );
    expect(resolveJourneyDuration(null, null, null, "boat")).toBe(0);
  });

  it("estimates distance-based journeys with road factor + overhead", () => {
    expect(estimateJourneyDurationMins(10, "car", 2)).toBe(
      estimateDurationMins(10, "car") + journeyOverheadMins("car", 2),
    );
    expect(estimateJourneyDurationMins(10, "bus", 4)).toBeGreaterThan(
      estimateJourneyDurationMins(10, "car", 4),
    );
    expect(estimateJourneyDurationMins(0, "bus", 4)).toBe(0);
    expect(estimateJourneyDurationMins(10, null, 4)).toBe(
      estimateJourneyDurationMins(10, JOURNEY_TIME_CONFIG.defaultVehicle, 4),
    );
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
