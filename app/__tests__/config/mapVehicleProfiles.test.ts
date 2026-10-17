/**
 * @jest-environment node
 *
 * Sprint 72 — vehicle-aware route tracing:
 * profile resolution (road vehicles = legacy chain, keyed walking/cycling),
 * cache-slug gating (legacy keys never invalidate), URL parity between
 * routingBases + legacy upstreams, and the mode-aware traceRoute pass.
 */
import {
  MAP_STACK_CONFIG,
  resolveRoutingProfiles,
  isDefaultRoutingProfiles,
  routingProfileSlug,
} from "@/app/lib/config/mapStack";
import { traceCacheKey } from "@/app/lib/utils/geo";

jest.mock("@/app/lib/db/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
  },
}));

import { mapProxyService, routeCacheKey } from "@/app/lib/services/mapProxyService";
import { redis } from "@/app/lib/db/redis";

const PINS = [
  { lat: 6.5244, lng: 3.3792 },
  { lat: 6.6018, lng: 3.3515 },
];

describe("Sprint 72: vehicle routing profile resolution", () => {
  it("road vehicles, unknown keys and no-vehicle inherit the default driving chain", () => {
    const cases = ["taxi", "car", "bolt", "bus", "keke", "TAXI", "", "spaceship", null, undefined];
    for (const vehicle of cases) {
      const profiles = resolveRoutingProfiles(vehicle as string | null | undefined);
      expect(profiles).toEqual(MAP_STACK_CONFIG.defaultRoutingProfiles);
      expect(isDefaultRoutingProfiles(profiles)).toBe(true);
      // Legacy cache key — existing driving traces keep their entries.
      expect(routingProfileSlug(profiles)).toBeNull();
    }
  });

  it("walking/cycling vehicles map to keyed mode profiles (OSRM demo is driving-only)", () => {
    const trek = resolveRoutingProfiles("trekking");
    expect(trek.osrm).toBeNull();
    expect(trek.ors).toBe("foot-walking");
    expect(trek.mapbox).toBe("walking");

    const bike = resolveRoutingProfiles("bike");
    expect(bike.osrm).toBeNull();
    expect(bike.ors).toBe("cycling-regular");
    expect(bike.mapbox).toBe("cycling");

    for (const profiles of [trek, bike]) {
      expect(isDefaultRoutingProfiles(profiles)).toBe(false);
      expect(routingProfileSlug(profiles)).toMatch(/^p-/);
    }
  });

  it("water/rail have no stack profiles → legacy driving fallback (never a bare line)", () => {
    for (const vehicle of ["boat", "train"]) {
      const profiles = resolveRoutingProfiles(vehicle);
      expect(profiles.osrm).toBeNull();
      expect(profiles.ors).toBeNull();
      expect(profiles.mapbox).toBeNull();
      // No mode-aware provider at all: the legacy chain runs either way, so
      // it shares the legacy cache key instead of forking a duplicate entry.
      expect(isDefaultRoutingProfiles(profiles)).toBe(true);
      expect(routingProfileSlug(profiles)).toBeNull();
    }
  });

  it("routingBases + default profiles reproduce the legacy upstream URLs byte-for-byte", () => {
    const { routingBases, upstreams, defaultRoutingProfiles } = MAP_STACK_CONFIG;
    expect(`${routingBases.osrm}/${defaultRoutingProfiles.osrm}`).toBe(upstreams.osrm);
    expect(`${routingBases.ors}/${defaultRoutingProfiles.ors}`).toBe(upstreams.ors);
    expect(`${routingBases.mapbox}/${defaultRoutingProfiles.mapbox}`).toBe(upstreams.mapbox);
  });

  it("profile slugs are stable and cache-key safe", () => {
    const a = routingProfileSlug(resolveRoutingProfiles("trekking"));
    const b = routingProfileSlug({ osrm: null, ors: "foot-walking", mapbox: "walking" });
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-z0-9_.-]+$/);
  });
});

describe("Sprint 72: client trace cache keys are vehicle-aware", () => {
  it("keeps the legacy key without a vehicle and joins the mode with one", () => {
    expect(traceCacheKey("abc")).toBe("route-trace:abc");
    expect(traceCacheKey("abc", null)).toBe("route-trace:abc");
    expect(traceCacheKey("abc", "Trekking")).toBe("route-trace:abc:trekking");
    expect(traceCacheKey("abc", " bike ")).toBe("route-trace:abc:bike");
  });
});

describe("Sprint 72: traceRoute mode-aware pass", () => {
  const savedOrs = process.env.OPEN_ROUTE_SERVICE_KEY;

  afterEach(() => {
    if (savedOrs === undefined) delete process.env.OPEN_ROUTE_SERVICE_KEY;
    else process.env.OPEN_ROUTE_SERVICE_KEY = savedOrs;
    jest.restoreAllMocks();
    // restoreAllMocks can strip the factory implementations — re-arm them
    // so later tests still hit the (miss → fetch → write) path.
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.set as jest.Mock).mockResolvedValue(undefined);
    (redis.set as jest.Mock).mockClear();
    (redis.get as jest.Mock).mockClear();
  });

  const lastCacheKey = (): string => {
    const calls = (redis.set as jest.Mock).mock.calls;
    return calls[calls.length - 1]?.[0] as string;
  };

  it("no vehicle → legacy chain only (no mode URLs, legacy cache key)", async () => {
    process.env.OPEN_ROUTE_SERVICE_KEY = "test-key";
    const urls: string[] = [];
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        urls.push(String(input));
        throw new Error("offline");
      });
    const result = await mapProxyService.traceRoute(PINS);
    expect(result.provider).toBe("straight");
    expect(urls.some((u) => u.includes("foot-walking") || u.includes("cycling-"))).toBe(false);
    expect(lastCacheKey()).toBe(routeCacheKey(PINS));
  });

  it("walking vehicle → ORS foot-walking first, then the legacy driving chain", async () => {
    process.env.OPEN_ROUTE_SERVICE_KEY = "test-key";
    const urls: string[] = [];
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        urls.push(String(input));
        throw new Error("offline");
      });
    const result = await mapProxyService.traceRoute(PINS, { vehicle: "trekking" });
    // Mode pass ran the walking profile…
    const modeIdx = urls.findIndex((u) => u.includes("/foot-walking"));
    expect(modeIdx).toBeGreaterThanOrEqual(0);
    // …and the failed pass fell back through the LEGACY driving chain
    // (keyless OSRM driving → keyed ORS driving-car → straight).
    expect(urls.some((u) => u.includes("router.project-osrm.org/route/v1/driving"))).toBe(true);
    expect(urls.some((u) => u.includes("/driving-car"))).toBe(true);
    expect(result.provider).toBe("straight");
    // Non-default profile → slug-suffixed cache key; legacy keys stay intact.
    expect(lastCacheKey()).toMatch(/:p-x_foot-walking_walking$/);
  });
});
