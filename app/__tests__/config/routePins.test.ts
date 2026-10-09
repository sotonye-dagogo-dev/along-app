/**
 * Canonical route pins: post views must trace the SAME start → stop(s) →
 * destination sequence the share-preview traced. `waypoints` stores the
 * intermediate stops only; the builder composes origin + intermediates +
 * destination in step order so no stop is ever skipped.
 */
import {
  ROUTE_PINS_CONFIG,
  buildRoutePinsFromPost,
  buildTraceInputFromPins,
} from "@/app/lib/config/routePins";

describe("canonical route pins (preview-accurate post views)", () => {
  const routes = [
    { location: "Marina" },
    { location: "Obalende" },
    { location: "Yaba" },
  ];

  it("is config-driven", () => {
    expect(ROUTE_PINS_CONFIG.detailMapLiveTrace).toBe(true);
    expect(ROUTE_PINS_CONFIG.miniMapLiveTrace).toBe(false);
  });

  it("composes origin + intermediate waypoint + destination in order", () => {
    const pins = buildRoutePinsFromPost({
      routes,
      startLat: 6.45,
      startLng: 3.39,
      endLat: 6.51,
      endLng: 3.37,
      waypoints: [{ lat: 6.48, lng: 3.38 }],
    });
    expect(pins.map((p) => p.type)).toEqual(["origin", "waypoint", "destination"]);
    expect(pins.map((p) => p.label)).toEqual(["Marina", "Obalende", "Yaba"]);
    expect(pins[0]).toMatchObject({ lat: 6.45, lng: 3.39 });
    expect(pins[1]).toMatchObject({ lat: 6.48, lng: 3.38 });
    expect(pins[2]).toMatchObject({ lat: 6.51, lng: 3.37 });
  });

  it("falls back to start/end when waypoints are absent (legacy rows)", () => {
    const pins = buildRoutePinsFromPost({
      routes,
      startLat: 6.45,
      startLng: 3.39,
      endLat: 6.51,
      endLng: 3.37,
      waypoints: [],
    });
    expect(pins.map((p) => p.type)).toEqual(["origin", "destination"]);
  });

  it("filters (0,0) placeholders and unusable coords", () => {
    const pins = buildRoutePinsFromPost({
      routes,
      startLat: 0,
      startLng: 0,
      endLat: 6.51,
      endLng: 3.37,
      waypoints: [{ lat: 0, lng: 0 }, { lat: 6.48, lng: 3.38 }],
    });
    // (0,0) origin dropped; valid waypoint + destination remain.
    expect(pins).toHaveLength(2);
    expect(pins[0]).toMatchObject({ lat: 6.48, lng: 3.38 });
    expect(pins[1]).toMatchObject({ lat: 6.51, lng: 3.37 });
  });

  it("builds ordered trace input for the routing API", () => {
    const pins = buildRoutePinsFromPost({
      routes,
      startLat: 6.45,
      startLng: 3.39,
      endLat: 6.51,
      endLng: 3.37,
      waypoints: [{ lat: 6.48, lng: 3.38 }],
    });
    expect(buildTraceInputFromPins(pins)).toEqual([
      { lat: 6.45, lng: 3.39 },
      { lat: 6.48, lng: 3.38 },
      { lat: 6.51, lng: 3.37 },
    ]);
  });
});
