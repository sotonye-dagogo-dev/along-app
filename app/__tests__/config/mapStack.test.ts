/**
 * @jest-environment node
 *
 * Sprint 19 keyless map stack — config fallback order, dark mapping,
 * attribution, proxy cache keys, and never-throw degradation.
 */
import {
  MAP_STACK_CONFIG,
  vectorStyleUrl,
  rasterFallbackTile,
  rasterFallbackDepth,
  buildRasterMapStyle,
  getMapStyleStack,
} from "@/app/lib/config/mapStack";

jest.mock("@/app/lib/db/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
  },
}));

import {
  mapProxyService,
  straightLineTrace,
  routeCacheKey,
  geocodeCacheKey,
  reverseCacheKey,
} from "@/app/lib/services/mapProxyService";

describe("execute-feature Sprint 19: keyless map stack config", () => {
  it("vector styles are keyless OpenFreeMap URLs (no apiKey, no keys)", () => {
    for (const url of Object.values(MAP_STACK_CONFIG.vectorStyles)) {
      expect(url).toMatch("tiles.openfreemap.org");
      expect(url).not.toMatch("apiKey");
      expect(url).not.toMatch("key=");
    }
    expect(vectorStyleUrl(false)).toBe(MAP_STACK_CONFIG.vectorStyles.liberty);
    expect(vectorStyleUrl(true)).toBe(MAP_STACK_CONFIG.vectorStyles.liberty);
  });

  it("raster fallback chain is keyless (plain Carto, no ?apiKey=) then OSM then Esri", () => {
    const light = MAP_STACK_CONFIG.rasterFallbacks.light;
    expect(light[0]).toMatch("basemaps.cartocdn.com");
    expect(light[0]).not.toMatch("apiKey");
    expect(light[1]).toMatch("tile.openstreetmap.org");
    expect(light[2]).toMatch("arcgisonline");
    expect(rasterFallbackTile(false, 0)).toBe(light[0]);
    expect(rasterFallbackTile(true, 0)).toMatch("dark_all");
    expect(rasterFallbackDepth()).toBe(light.length);
  });

  it("routing order is keyless-first with straight-line last; geocode nominatim-first", () => {
    expect(MAP_STACK_CONFIG.routingOrder[0]).toBe("osrm");
    expect(MAP_STACK_CONFIG.routingOrder[MAP_STACK_CONFIG.routingOrder.length - 1]).toBe("straight");
    expect(MAP_STACK_CONFIG.routingOrder).toContain("ors");
    expect(MAP_STACK_CONFIG.routingOrder).toContain("mapbox");
    expect(MAP_STACK_CONFIG.geocodeOrder[0]).toBe("nominatim");
    expect(MAP_STACK_CONFIG.cacheTtlSec.route).toBeGreaterThan(0);
    expect(MAP_STACK_CONFIG.cacheTtlSec.geocode).toBeGreaterThan(0);
    expect(MAP_STACK_CONFIG.cacheTtlSec.reverse).toBeGreaterThan(0);
    expect(MAP_STACK_CONFIG.serverIdentity.userAgent.length).toBeGreaterThan(0);
    expect(MAP_STACK_CONFIG.attributions.openfreemap).toMatch("OpenStreetMap");
  });

  it("preconnect hosts are keyless-only (no mapbox, no keyed hosts)", () => {
    for (const h of MAP_STACK_CONFIG.preconnectHosts) {
      expect(h).not.toMatch("mapbox");
      expect(h).not.toMatch("carto");
    }
    expect(MAP_STACK_CONFIG.preconnectHosts.join(" ")).toMatch("openfreemap");
  });

  it("style stack is vector-first with one raster entry per fallback depth", () => {
    const stack = getMapStyleStack(false);
    expect(stack.length).toBe(1 + rasterFallbackDepth());
    expect(stack[0]).toBe(vectorStyleUrl(false));
    const raster = buildRasterMapStyle(false, 0);
    expect(raster.version).toBe(8);
    expect(raster.sources.basemap.tiles[0]).not.toMatch("apiKey");
    const darkRaster = buildRasterMapStyle(true, 0);
    expect(darkRaster.sources.basemap.tiles[0]).toMatch("dark_all");
  });
});

describe("execute-feature Sprint 19: proxy cache keys + straight-line fallback", () => {
  it("cache keys are deterministic per input", () => {
    const pins = [
      { lat: 6.5244, lng: 3.3792 },
      { lat: 6.6018, lng: 3.3515 },
    ];
    expect(routeCacheKey(pins)).toBe(routeCacheKey(pins));
    expect(routeCacheKey(pins)).not.toBe(
      routeCacheKey([
        { lat: 6.5244, lng: 3.3792 },
        { lat: 6.7, lng: 3.4 },
      ])
    );
    expect(geocodeCacheKey("Lagos", 5)).toBe(geocodeCacheKey("lagos", 5));
    expect(reverseCacheKey(6.52441, 3.37921)).toBe(reverseCacheKey(6.52444, 3.37924));
  });

  it("straight-line trace always resolves without keys (keyless proof unit)", () => {
    const pins = [
      { lat: 6.5244, lng: 3.3792 },
      { lat: 6.6018, lng: 3.3515 },
    ];
    const result = straightLineTrace(pins);
    expect(result.provider).toBe("straight");
    expect(result.polyline.length).toBeGreaterThan(0);
    expect(result.distance).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);
  });

  it("traceRoute degrades to straight-line when upstreams fail and no keys set", async () => {
    const spy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    try {
      const pins = [
        { lat: 6.5244, lng: 3.3792 },
        { lat: 6.6018, lng: 3.3515 },
      ];
      const result = await mapProxyService.traceRoute(pins);
      expect(result.provider).toBe("straight");
      expect(result.polyline.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("geocodeForward returns [] and geocodeReverse returns null when upstreams fail", async () => {
    const spy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    try {
      await expect(mapProxyService.geocodeForward("Lagos Nigeria", 5)).resolves.toEqual([]);
      await expect(mapProxyService.geocodeReverse(6.5244, 3.3792)).resolves.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("geocodeForward normalizes the Nominatim shape for clients", async () => {
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ display_name: "Lagos, Nigeria", lat: "6.5244", lon: "3.3792" }],
    } as Response);
    try {
      const hits = await mapProxyService.geocodeForward("Lagos", 5);
      expect(hits).toHaveLength(1);
      expect(hits[0].display_name).toMatch("Lagos");
      expect(hits[0].lat).toBe("6.5244");
      expect(hits[0].lon).toBe("3.3792");
    } finally {
      spy.mockRestore();
    }
  });
});
