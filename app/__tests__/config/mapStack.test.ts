/**
 * @jest-environment node
 *
 * Sprint 19 keyless map stack — config fallback order, dark mapping,
 * attribution, proxy cache keys, and never-throw degradation.
 */
import {
  MAP_STACK_CONFIG,
  MAP_EXPAND_CONFIG,
  vectorStyleUrl,
  vectorStyleUpstreamUrl,
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
    // Renderers load through the same-origin sanitized proxy (Sprint 77) —
    // the browser never fetches the OpenFreeMap style document directly.
    expect(vectorStyleUrl(false)).toBe(`${MAP_STACK_CONFIG.styleProxyPath}?name=liberty`);
    expect(vectorStyleUrl(true)).toBe(`${MAP_STACK_CONFIG.styleProxyPath}?name=liberty`);
    expect(vectorStyleUpstreamUrl("liberty")).toMatch("tiles.openfreemap.org");
    expect(vectorStyleUpstreamUrl("nope")).toBeNull();
  });

  it("style proxy + numeric fallbacks are configured (Sprint 77 null hardening)", () => {
    expect(MAP_STACK_CONFIG.styleProxyPath).toBe("/api/maps/style");
    expect(MAP_STACK_CONFIG.cacheTtlSec.style).toBeGreaterThan(0);
    const fb = MAP_STACK_CONFIG.numericExpressionFallbacks;
    expect(typeof fb["text-size"]).toBe("number");
    expect(typeof fb["icon-size"]).toBe("number");
    expect(typeof fb["circle-radius"]).toBe("number");
  });

  it("raster fallback chain is keyless (plain Carto, no ?apiKey=) then OSM then Esri", () => {
    const light = MAP_STACK_CONFIG.rasterFallbacks.light;
    expect(light[0]).toMatch("basemaps.cartocdn.com");
    expect(light[0]).not.toMatch("apiKey");
    expect(light[1]).toMatch("tile.openstreetmap.org");
    expect(light[2]).toMatch("arcgisonline");
    expect(rasterFallbackTile(false, 0)).toBe(light[0]);
    // Dark keeps the light visual params verbatim (clearer tiles in both themes).
    expect(rasterFallbackTile(true, 0)).toBe(light[0]);
    expect(MAP_STACK_CONFIG.darkCanvasFilter).toBe("none");
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
    expect(darkRaster.sources.basemap.tiles[0]).toBe(
      MAP_STACK_CONFIG.rasterFallbacks.light[0]
    );
  });
});

describe("fix-build: expanded map is a contained dialog (never full-bleed)", () => {
  it("overlay centers a max-width panel instead of stretching 100vw past the column", () => {
    expect(MAP_EXPAND_CONFIG.overlayClass).toMatch("fixed");
    expect(MAP_EXPAND_CONFIG.overlayClass).toMatch("items-center");
    expect(MAP_EXPAND_CONFIG.overlayClass).toMatch("justify-center");
    expect(MAP_EXPAND_CONFIG.panelMaxWidthClass).toMatch("max-w-");
    expect(MAP_EXPAND_CONFIG.panelClass).toMatch("overflow-hidden");
    // No viewport-width bleed (100vw includes the scrollbar and spills into
    // the desktop suggestions rail); height is a bounded dialog height.
    expect(MAP_EXPAND_CONFIG.overlayClass).not.toMatch("100vw");
    expect(MAP_EXPAND_CONFIG.panelClass).not.toMatch("100vw");
    expect(MAP_EXPAND_CONFIG.panelHeight).not.toMatch("100vh");
    expect(MAP_EXPAND_CONFIG.panelHeight).toMatch("80vh");
  });

  it("dialog dismisses via backdrop + Escape with an accessible name", () => {
    expect(MAP_EXPAND_CONFIG.closeOnBackdropClick).toBe(true);
    expect(MAP_EXPAND_CONFIG.closeOnEscape).toBe(true);
    expect(MAP_EXPAND_CONFIG.backdropClass.length).toBeGreaterThan(0);
    expect(MAP_EXPAND_CONFIG.dialogLabel.length).toBeGreaterThan(0);
    expect(MAP_EXPAND_CONFIG.minimizeLabel.length).toBeGreaterThan(0);
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

describe("Sprint 77: sanitized style document proxy", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getMapStyleDocument rejects unknown names without touching upstream", async () => {
    const spy = jest.spyOn(global, "fetch");
    await expect(mapProxyService.getMapStyleDocument("evil")).resolves.toBeNull();
    await expect(mapProxyService.getMapStyleDocument("")).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("getMapStyleDocument fetches, sanitizes data-driven numeric props, and caches", async () => {
    const { redis } = jest.requireMock("@/app/lib/db/redis");
    const rawStyle = {
      version: 8,
      layers: [
        {
          id: "road",
          type: "line",
          layout: { "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 18, 4] },
          paint: { "line-color": "#fff" },
        },
        {
          id: "poi",
          type: "symbol",
          layout: { "text-size": ["interpolate", ["linear"], ["get", "siz"], 12] },
          paint: { "circle-radius": 5 },
        },
      ],
    };
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => rawStyle,
    } as Response);
    try {
      const doc = (await mapProxyService.getMapStyleDocument("liberty")) as {
        layers: { id: string; layout: Record<string, unknown>; paint: Record<string, unknown> }[];
      };
      expect(spy).toHaveBeenCalledTimes(1);
      expect(doc).toBeTruthy();
      const road = doc.layers[0];
      const poi = doc.layers[1];
      // Data-driven (reads feature data) props get coalesce-wrapped with the
      // config fallback — silences the MapLibre null-type warning class.
      const textSize = poi.layout["text-size"] as unknown[];
      expect(textSize[0]).toBe("coalesce");
      expect(textSize[2]).toBe(MAP_STACK_CONFIG.numericExpressionFallbacks["text-size"]);
      // Zoom-only expressions and static values stay untouched.
      expect(road.layout["line-width"]).toEqual([
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        1,
        18,
        4,
      ]);
      expect(poi.paint["circle-radius"]).toBe(5);
      expect(road.paint["line-color"]).toBe("#fff");
      // Sanitized doc (not raw upstream) is what lands in Redis.
      expect(redis.set).toHaveBeenCalledWith(
        mapProxyService.styleCacheKey("liberty"),
        expect.objectContaining({ version: 8 }),
        { ex: MAP_STACK_CONFIG.cacheTtlSec.style }
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("getMapStyleDocument serves the Redis cache without refetching", async () => {
    const { redis } = jest.requireMock("@/app/lib/db/redis");
    const cached = { version: 8, layers: [] };
    redis.get.mockResolvedValueOnce(cached);
    const spy = jest.spyOn(global, "fetch");
    try {
      const doc = await mapProxyService.getMapStyleDocument("liberty");
      expect(doc).toBe(cached);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("getMapStyleDocument degrades to null when upstream fails with no stale copy", async () => {
    const spy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    try {
      // Whitelisted name `bright` was never fetched earlier in this file, so
      // there is no in-memory stale copy — upstream failure must resolve null
      // (the route then answers 404/502 cleanly; never an open proxy).
      await expect(mapProxyService.getMapStyleDocument("bright")).resolves.toBeNull();
      expect(spy).toHaveBeenCalledWith(
        MAP_STACK_CONFIG.vectorStyles.bright,
        expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) })
      );
    } finally {
      spy.mockRestore();
    }
  });
});
