/**
 * @jest-environment node
 *
 * Session tightening — right-docked round buttons, bug-report upload before
 * submit, landmark/building/address geocode power-up (Photon street-level
 * labels + keyless Overpass fallback, config-driven, non-breaking).
 */
import { FLOATING_UI_CONFIG } from "@/app/lib/config/floatingUi";
import {
  MAP_STACK_CONFIG,
  LANDMARK_GEOCODE_CONFIG,
} from "@/app/lib/config/mapStack";

jest.mock("@/app/lib/db/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
  },
}));

import { geocodeForward } from "@/app/lib/services/mapProxyService";

describe("session: round buttons dock right, other lanes unchanged", () => {
  it("mobileDockSide is right and lanes still clear the 64px tab bar", () => {
    expect(FLOATING_UI_CONFIG.mobileDockSide).toBe("right");
    expect(FLOATING_UI_CONFIG.lanes.offlineBottomPx).toBeGreaterThan(
      FLOATING_UI_CONFIG.mobileNavbarHeightPx
    );
    expect(FLOATING_UI_CONFIG.roundButtons.secondBottomPx).toBeGreaterThan(
      FLOATING_UI_CONFIG.roundButtons.firstBottomPx
    );
  });
});

describe("session: landmark geocode config is keyless + ordered", () => {
  it("nominatim stays first, openmeteo + overpass present, overpass last", () => {
    expect(MAP_STACK_CONFIG.geocodeOrder[0]).toBe("nominatim");
    expect(MAP_STACK_CONFIG.geocodeOrder).toContain("openmeteo");
    expect(MAP_STACK_CONFIG.geocodeOrder).toContain("overpass");
    expect(
      MAP_STACK_CONFIG.geocodeOrder[MAP_STACK_CONFIG.geocodeOrder.length - 1]
    ).toBe("overpass");
  });

  it("overpass upstream is keyless with sane landmark tuning", () => {
    expect(MAP_STACK_CONFIG.upstreams.overpass).toMatch("overpass-api.de");
    expect(MAP_STACK_CONFIG.upstreams.overpass).not.toMatch("key");
    expect(LANDMARK_GEOCODE_CONFIG.overpassMinQueryLength).toBeGreaterThanOrEqual(3);
    expect(LANDMARK_GEOCODE_CONFIG.overpassMaxElements).toBeGreaterThan(0);
    expect(LANDMARK_GEOCODE_CONFIG.overpassTimeoutSec).toBeGreaterThan(0);
  });
});

function mockFetch(impl: (url: string) => unknown): jest.SpyInstance {
  return jest
    .spyOn(global, "fetch")
    .mockImplementation(
      (async (url: string | URL | Request) => impl(String(url))) as unknown as typeof fetch
    );
}

describe("session: photon street-level labels survive", () => {
  it("house number / street / district render in the suggestion label", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return { ok: false, json: async () => null };
      }
      if (u.includes("photon.komoot.io/api")) {
        return {
          ok: true,
          json: async () => ({
            features: [
              {
                properties: {
                  name: "Lagos Mall",
                  street: "Admiralty Way",
                  housenumber: "12",
                  district: "Lekki Phase 1",
                  city: "Lagos",
                  country: "Nigeria",
                },
                geometry: { coordinates: [3.47, 6.44] },
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Lagos Mall Adm", 5);
      expect(hits.length).toBeGreaterThan(0);
      const label = hits[0].display_name;
      expect(label).toMatch("Lagos Mall");
      expect(label).toMatch("Admiralty Way");
      expect(label).toMatch("12");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("session: overpass landmark fallback is safe + gated", () => {
  const overpassElement = {
    type: "node",
    lat: 6.4501,
    lon: 3.3951,
    tags: {
      name: "National Theatre",
      "addr:suburb": "Iganmu",
      "addr:city": "Lagos",
      "addr:country": "Nigeria",
      tourism: "attraction",
    },
  };

  it("surfaces a landmark missed by the index providers", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return { ok: true, json: async () => [] };
      }
      if (u.includes("photon.komoot.io/api")) {
        return { ok: true, json: async () => ({ features: [] }) };
      }
      if (u.includes("geocoding-api.open-meteo.com")) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (u.includes("overpass-api.de/api/interpreter")) {
        return { ok: true, json: async () => ({ elements: [overpassElement] }) };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("National Theatre Lag", 5);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].provider).toBe("overpass");
      expect(hits[0].display_name).toMatch("National Theatre");
    } finally {
      spy.mockRestore();
    }
  });

  it("skips overpass for short queries (bounded global scans)", async () => {
    let overpassCalls = 0;
    const spy = mockFetch((u) => {
      if (u.includes("overpass-api.de/api/interpreter")) {
        overpassCalls += 1;
        return { ok: true, json: async () => ({ elements: [overpassElement] }) };
      }
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return { ok: true, json: async () => [] };
      }
      if (u.includes("photon.komoot.io/api")) {
        return { ok: true, json: async () => ({ features: [] }) };
      }
      if (u.includes("geocoding-api.open-meteo.com")) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Lag", 5);
      expect(hits).toEqual([]);
      expect(overpassCalls).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("overpass failure never breaks the merged hits (never-throw)", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return {
          ok: true,
          json: async () => [{ display_name: "Lagos, Nigeria", lat: "6.5244", lon: "3.3792" }],
        };
      }
      if (u.includes("overpass-api.de/api/interpreter")) {
        throw new Error("overpass down");
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Lagos Nigeria", 5);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].display_name).toMatch("Lagos");
    } finally {
      spy.mockRestore();
    }
  });
});
