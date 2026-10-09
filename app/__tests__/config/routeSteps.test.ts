/**
 * Destination-step rule: the final route step IS the destination, so it
 * carries no fare and no vehicle — hidden in every UI surface and stripped
 * from payloads before insert/update.
 */
import {
  ROUTE_STEPS_CONFIG,
  isDestinationStep,
  showStepFare,
  showStepVehicle,
  normalizeRouteSteps,
} from "@/app/lib/config/routeSteps";

describe("route destination step (no fare/vehicle at the final stop)", () => {
  it("is config-driven", () => {
    expect(ROUTE_STEPS_CONFIG.destinationHidesFare).toBe(true);
    expect(ROUTE_STEPS_CONFIG.destinationHidesVehicle).toBe(true);
    expect(ROUTE_STEPS_CONFIG.destinationHint.length).toBeGreaterThan(0);
  });

  it("detects the destination as the last step only", () => {
    expect(isDestinationStep(0, 2)).toBe(false);
    expect(isDestinationStep(1, 2)).toBe(true);
    expect(isDestinationStep(2, 3)).toBe(true);
    expect(isDestinationStep(0, 1)).toBe(true);
    expect(isDestinationStep(0, 0)).toBe(false);
  });

  it("hides fare + vehicle on the destination, shows them elsewhere", () => {
    expect(showStepFare(0, 2)).toBe(true);
    expect(showStepFare(1, 2)).toBe(false);
    expect(showStepVehicle(0, 2)).toBe(true);
    expect(showStepVehicle(1, 2)).toBe(false);
  });

  it("strips fare/vehicle from the destination, keeps other legs intact", () => {
    const steps = [
      { location: "Marina", description: "", vehicle: "bus", fare: 500 },
      { location: "Obalende", description: "", vehicle: "keke", fare: 300 },
      { location: "Yaba", description: "", vehicle: "bus", fare: 700 },
    ];
    const out = normalizeRouteSteps(steps);
    expect(out[0]).toEqual(steps[0]);
    expect(out[1]).toEqual(steps[1]);
    expect(out[2].vehicle).toBeUndefined();
    expect(out[2].fare).toBeUndefined();
    expect(out[2].location).toBe("Yaba");
    // Input is not mutated.
    expect(steps[2].fare).toBe(700);
  });

  it("passes through empty and single-step arrays untouched", () => {
    expect(normalizeRouteSteps([])).toEqual([]);
    const single = [{ location: "Only", vehicle: "bus", fare: 100 }];
    const out = normalizeRouteSteps(single);
    // A lone step is trivially the destination — still stripped.
    expect(out[0].vehicle).toBeUndefined();
    expect(out[0].fare).toBeUndefined();
  });
});
