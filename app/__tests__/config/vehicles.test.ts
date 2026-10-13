/**
 * Boat vehicle option (execute-feature 2026-10-13): water-vessel transport
 * mode end to end — registry entry, validation acceptance, landing-chip
 * parity. Config/metadata-driven: surfaces read VEHICLE_REGISTRY
 * dynamically, so these assertions pin the contract, not each consumer.
 */
import { VEHICLE_REGISTRY } from "@/app/lib/config/vehicles";
import { validateRouteComposer } from "@/app/lib/config/routeValidation";

describe("VEHICLE_REGISTRY boat option", () => {
  it("exposes all 8 transport modes including boat", () => {
    expect(Object.keys(VEHICLE_REGISTRY).sort()).toEqual(
      ["bike", "boat", "bolt", "bus", "car", "keke", "taxi", "trekking"].sort()
    );
  });

  it("boat entry carries the boat label, icon, and water-associated color", () => {
    const boat = VEHICLE_REGISTRY.boat;
    expect(boat.label).toBe("Boat");
    // Lucide icon component (Ship) — named function, never an emoji string.
    expect(typeof boat.icon).toBe("function");
    expect(boat.color).toBe("#0E7490");
    expect(boat.bgClass).toContain("bg-cyan-50");
    expect(boat.textClass).toContain("text-cyan-800");
  });

  it("every registry entry has label + icon + token classes (UI-safe)", () => {
    for (const [key, entry] of Object.entries(VEHICLE_REGISTRY)) {
      expect(typeof entry.label, `${key}.label`).toBe("string");
      expect(typeof entry.icon, `${key}.icon`).toBe("function");
      expect(entry.bgClass, `${key}.bgClass`).toMatch(/bg-\S+/);
      expect(entry.textClass, `${key}.textClass`).toMatch(/text-\S+/);
    }
  });
});

describe("boat validation acceptance", () => {
  it("accepts boat as a vehicle on a non-destination step", () => {
    const v = validateRouteComposer({
      title: "Marina to Tarkwa Bay by ferry",
      steps: [
        { location: "Marina Jetty", vehicle: "boat", fareRaw: "500", fare: 500 },
        { location: "Tarkwa Bay" },
      ],
    });
    expect(v.valid).toBe(true);
  });

  it("still rejects unknown vehicles", () => {
    const v = validateRouteComposer({
      title: "Marina to Yaba somehow",
      steps: [
        { location: "Marina", vehicle: "spaceship" },
        { location: "Yaba" },
      ],
    });
    expect(v.valid).toBe(false);
    expect(v.steps[0]?.vehicle).toBeTruthy();
  });
});
