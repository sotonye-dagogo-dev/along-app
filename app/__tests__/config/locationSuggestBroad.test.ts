/**
 * @jest-environment node
 *
 * Broad location suggestions (directive 2026-10-13): suggestions must fire
 * for addresses, landmarks/buildings, roads, towns/cities, postal codes,
 * states/countries and coordinates in any order — not just exact address
 * starts — with nearby-first ranking when a position is shared.
 *
 * Covers: shared config sanity, coordinate parsing, token-reorder helper,
 * proxy URL builder, parallel fast-provider fan-out (Overpass NOT on the hot
 * path), Overpass-only-when-empty, token-reorder rescue, coordinate fast-path
 * and 2-char queries.
 */
import {
  LOCATION_SUGGESTIONS_CONFIG,
  parseCoordinateQuery,
  reorderQueryTokens,
  buildGeocodeUrl,
} from "@/app/lib/config/locationSuggestions";

jest.mock("@/app/lib/db/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
  },
}));

import { geocodeForward } from "@/app/lib/services/mapProxyService";

function mockFetch(impl: (url: string) => unknown): jest.SpyInstance {
  return jest
    .spyOn(global, "fetch")
    .mockImplementation(
      (async (url: string | URL | Request) => impl(String(url))) as unknown as typeof fetch
    );
}

describe("location suggestions config (broad, config-driven)", () => {
  it("fires from 2 chars with a sane debounce + limit", () => {
    expect(LOCATION_SUGGESTIONS_CONFIG.minQueryLength).toBe(2);
    expect(LOCATION_SUGGESTIONS_CONFIG.maxQueryLength).toBe(200);
    expect(LOCATION_SUGGESTIONS_CONFIG.debounceMs).toBeGreaterThanOrEqual(200);
    expect(LOCATION_SUGGESTIONS_CONFIG.debounceMs).toBeLessThanOrEqual(500);
    expect(LOCATION_SUGGESTIONS_CONFIG.limit).toBeGreaterThanOrEqual(5);
    expect(LOCATION_SUGGESTIONS_CONFIG.limit).toBeLessThanOrEqual(10);
  });
  it("keeps worst-case latency inside the serverless budget", () => {
    // Two rounds max (fast parallel + one fallback batch).
    expect(LOCATION_SUGGESTIONS_CONFIG.providerTimeoutMs).toBeLessThanOrEqual(4500);
    expect(LOCATION_SUGGESTIONS_CONFIG.overpassFallbackOnly).toBe(true);
    expect(LOCATION_SUGGESTIONS_CONFIG.emptyTtlSec).toBeGreaterThan(0);
  });
});

describe("parseCoordinateQuery (coordinate fast-path)", () => {
  it("parses comma/semicolon/space separated pairs", () => {
    expect(parseCoordinateQuery("6.5244, 3.3792")).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(parseCoordinateQuery("6.5244;3.3792")).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(parseCoordinateQuery("-1.5 36.8")).toEqual({ lat: -1.5, lng: 36.8 });
  });
  it("rejects place names, postal codes and fare ranges", () => {
    expect(parseCoordinateQuery("Lagos")).toBeNull();
    expect(parseCoordinateQuery("2 Pockock Street")).toBeNull();
    expect(parseCoordinateQuery("100001")).toBeNull();
    expect(parseCoordinateQuery("400-500")).toBeNull();
    expect(parseCoordinateQuery("")).toBeNull();
  });
  it("rejects out-of-range pairs", () => {
    expect(parseCoordinateQuery("200, 300")).toBeNull();
    expect(parseCoordinateQuery("95, 10")).toBeNull();
    expect(parseCoordinateQuery("10, 200")).toBeNull();
  });
});

describe("reorderQueryTokens (order-tolerant fallback)", () => {
  it("reverses multi-token queries", () => {
    expect(reorderQueryTokens("Nigeria Lagos")).toBe("Lagos, Nigeria");
    expect(reorderQueryTokens("Nigeria Lagos Ikeja")).toBe("Ikeja, Lagos, Nigeria");
  });
  it("returns null when there is nothing to reorder", () => {
    expect(reorderQueryTokens("Lagos")).toBeNull();
    expect(reorderQueryTokens("")).toBeNull();
    expect(reorderQueryTokens("  ")).toBeNull();
  });
});

describe("buildGeocodeUrl (proxy-only, never upstream)", () => {
  it("builds an encoded internal URL with a clamped limit", () => {
    expect(buildGeocodeUrl("Ikeja")).toBe(
      `/api/maps/geocode?q=Ikeja&limit=${LOCATION_SUGGESTIONS_CONFIG.limit}`
    );
    expect(buildGeocodeUrl("Lagos, Nigeria", 99)).toContain("limit=10");
    expect(buildGeocodeUrl("Lagos, Nigeria", 0)).toContain(
      `limit=${LOCATION_SUGGESTIONS_CONFIG.limit}`
    );
    expect(buildGeocodeUrl("a&b")).toContain("q=a%26b");
  });
  it("never points at an upstream host", () => {
    expect(buildGeocodeUrl("Lagos")).not.toMatch("nominatim");
    expect(buildGeocodeUrl("Lagos")).not.toMatch("photon");
    expect(buildGeocodeUrl("Lagos")).not.toMatch("open-meteo");
    expect(buildGeocodeUrl("Lagos")).not.toMatch("overpass");
  });
});

describe("geocodeForward broad behaviour (parallel fan-out)", () => {
  it("merges fast providers in parallel without touching overpass", async () => {
    const seen: string[] = [];
    const spy = mockFetch((u) => {
      seen.push(u);
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return { ok: true, json: async () => [{ display_name: "Ikeja, Lagos, Nigeria", lat: "6.6018", lon: "3.3515" }] };
      }
      if (u.includes("photon.komoot.io/api")) {
        return {
          ok: true,
          json: async () => ({
            features: [
              { properties: { name: "Ikeja", country: "Nigeria" }, geometry: { coordinates: [3.3515, 6.6018] } },
            ],
          }),
        };
      }
      if (u.includes("geocoding-api.open-meteo.com")) {
        return {
          ok: true,
          json: async () => ({
            results: [{ name: "Ikeja", admin1: "Lagos", country: "Nigeria", latitude: 6.6018, longitude: 3.3515 }],
          }),
        };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Ikeja", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.length).toBeLessThanOrEqual(6);
      // Overpass is last-resort only — a healthy fast merge never calls it.
      expect(seen.some((u) => u.includes("overpass-api.de"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("answers 2-char broad queries (towns/cities)", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return { ok: true, json: async () => [{ display_name: "Ibadan, Oyo, Nigeria", lat: "7.3775", lon: "3.947" }] };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Ib", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].display_name).toMatch("Ibadan");
    } finally {
      spy.mockRestore();
    }
  });

  it("resolves coordinate queries to an exact pin first", async () => {
    const spy = mockFetch(() => ({ ok: false, json: async () => null }));
    try {
      const hits = await geocodeForward("6.5244, 3.3792", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].provider).toBe(LOCATION_SUGGESTIONS_CONFIG.coordinateProviderName);
      expect(hits[0].lat).toBe("6.5244");
      expect(hits[0].lon).toBe("3.3792");
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to overpass only when the fast merge is empty", async () => {
    const seen: string[] = [];
    const spy = mockFetch((u) => {
      seen.push(u);
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
        return {
          ok: true,
          json: async () => ({
            elements: [
              { type: "node", lat: 6.45, lon: 3.39, tags: { name: "Obscure Hall", "addr:city": "Lagos" } },
            ],
          }),
        };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Obscure Hall Lagos", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].provider).toBe("overpass");
      expect(seen.some((u) => u.includes("overpass-api.de"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("rescues reversed token order via the reorder retry", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("nominatim.openstreetmap.org/search")) {
        // Only the conventional order hits; the reversed input misses.
        if (u.includes(encodeURIComponent("Lagos, Nigeria"))) {
          return { ok: true, json: async () => [{ display_name: "Lagos, Nigeria", lat: "6.5244", lon: "3.3792" }] };
        }
        return { ok: true, json: async () => [] };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Nigeria Lagos", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].display_name).toMatch("Lagos");
    } finally {
      spy.mockRestore();
    }
  });

  it("forwards the viewer position as upstream bias params (rank-only)", async () => {
    const seen: string[] = [];
    const spy = mockFetch((u) => {
      seen.push(u);
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return { ok: true, json: async () => [{ display_name: "Yaba, Lagos", lat: "6.51", lon: "3.37" }] };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("Yaba", 6, { lat: 6.5244, lng: 3.3792 });
      expect(hits.length).toBeGreaterThan(0);
      expect(seen.some((u) => u.includes("viewbox=") && u.includes("bounded=0"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
