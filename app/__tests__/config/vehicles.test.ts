/**
 * Boat + train vehicle options (execute-feature 2026-10-13): water-vessel and
 * rail transport modes end to end — registry entries, validation acceptance,
 * landing-chip parity. Config/metadata-driven: surfaces read VEHICLE_REGISTRY
 * dynamically, so these assertions pin the contract, not each consumer.
 */
import { VEHICLE_REGISTRY } from "@/app/lib/config/vehicles";
import { validateRouteComposer } from "@/app/lib/config/routeValidation";

describe("VEHICLE_REGISTRY boat + train options", () => {
  it("exposes all 9 transport modes including boat and train", () => {
    expect(Object.keys(VEHICLE_REGISTRY).sort()).toEqual(
      ["bike", "boat", "bolt", "bus", "car", "keke", "taxi", "train", "trekking"].sort()
    );
  });

  it("boat entry carries the boat label, icon, and water-associated color", () => {
    const boat = VEHICLE_REGISTRY.boat;
    expect(boat.label).toBe("Boat");
    // Lucide icon component (Ship) — React component (function or memo object), never an emoji string.
    expect(boat.icon).toBeTruthy();
    expect(["function", "object"]).toContain(typeof boat.icon);
    expect(boat.color).toBe("#0E7490");
    // Saturated light wash (route-request-flag grade: -200, never the
    // near-white -50 that dissolved into the white card nor the still-pale
    // -100) + dark text + deepened border (light-theme visibility).
    expect(boat.bgClass).toContain("bg-cyan-200");
    expect(boat.textClass).toMatch(/text-cyan-900/);
    expect(boat.borderClass).toContain("border-cyan-400");
  });

  it("train entry carries the train label, icon, and rail-associated color", () => {
    const train = VEHICLE_REGISTRY.train;
    expect(train.label).toBe("Train");
    // Lucide icon component (Train) — React component (function or memo object), never an emoji string.
    expect(train.icon).toBeTruthy();
    expect(["function", "object"]).toContain(typeof train.icon);
    expect(train.color).toBe("#6D28D9");
    expect(train.bgClass).toContain("bg-violet-200");
    expect(train.textClass).toMatch(/text-violet-900/);
    expect(train.borderClass).toContain("border-violet-400");
  });

  it("every registry entry has label + icon + token classes (UI-safe)", () => {
    for (const [key, entry] of Object.entries(VEHICLE_REGISTRY)) {
      expect(typeof entry.label).toBe("string");
      expect(entry.icon).toBeTruthy();
      expect(["function", "object"]).toContain(typeof entry.icon);
      expect(entry.bgClass).toMatch(/bg-\S+/);
      expect(entry.textClass).toMatch(/text-\S+/);
    }
  });

  it("every flag meets the light-theme visibility contract (saturated wash + border)", () => {
    for (const [key, entry] of Object.entries(VEHICLE_REGISTRY)) {
      // No near-white -50 wash (invisible on the white card in light theme)
      // and no still-pale -100 wash (reads as plain text on the card —
      // route-request-flag grade is -200, e.g. bg-warning depth).
      expect(entry.bgClass).not.toMatch(/-(50|100)(\s|$)/);
      // Dark-grade label (-800 or darker -900 for max light-theme contrast)
      // + a deepened border pairing (-400) with a dark variant.
      expect(entry.textClass).toMatch(/text-\S+-(800|900)/);
      expect(entry.borderClass ?? "").toMatch(/border-\S+-400/);
      expect(entry.borderClass ?? "").toContain("dark:");
    }
  });
});

describe("boat + train validation acceptance", () => {
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

  it("accepts train as a vehicle on a non-destination step", () => {
    const v = validateRouteComposer({
      title: "Ikeja to Ibadan by rail",
      steps: [
        { location: "Mobolaji Johnson Station", vehicle: "train", fareRaw: "1500", fare: 1500 },
        { location: "Obafemi Awolowo Station, Ibadan" },
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
