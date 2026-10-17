/**
 * @jest-environment node
 *
 * Location intent power-ups (2026-10-17): paren-aware coordinate parsing,
 * Plus Code (Open Location Code) offline decode + short-code recovery, and
 * house-numbered address recall. Algorithm validated against
 * google/open-location-code test_data vectors.
 */
import {
  LOCATION_SUGGESTIONS_CONFIG,
  parseCoordinateQuery,
  classifyPlusCode,
  decodePlusCode,
  encodePlusCode,
  recoverNearestPlusCode,
  parsePlusCodeQuery,
  stripLeadingHouseNumber,
  extractPlusCodeToken,
} from "@/app/lib/config/locationSuggestions";

jest.mock("@/app/lib/db/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
  },
}));

import { geocodeForward } from "@/app/lib/services/mapProxyService";

function mockFetch(impl: (url: string, init?: { method?: string; body?: string }) => unknown): jest.SpyInstance {
  return jest
    .spyOn(global, "fetch")
    .mockImplementation((async (url: string | URL | Request, init?: RequestInit) =>
      impl(String(url), init as { method?: string; body?: string })) as unknown as typeof fetch);
}

describe("parseCoordinateQuery (paren/bracket aware)", () => {
  it("parses pairs with or without enclosing wrappers", () => {
    expect(parseCoordinateQuery("6.5244, 3.3792")).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(parseCoordinateQuery("(6.5244, 3.3792)")).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(parseCoordinateQuery("[6.5244, 3.3792]")).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(parseCoordinateQuery(" (6.5244;3.3792) ")).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(parseCoordinateQuery("[-1.5 36.8]")).toEqual({ lat: -1.5, lng: 36.8 });
    expect(parseCoordinateQuery("(6.5244 3.3792)")).toEqual({ lat: 6.5244, lng: 3.3792 });
  });
  it("still rejects non-coordinates and out-of-range pairs", () => {
    expect(parseCoordinateQuery("(Lagos)")).toBeNull();
    expect(parseCoordinateQuery("(100001)")).toBeNull();
    expect(parseCoordinateQuery("(400-500)")).toBeNull();
    expect(parseCoordinateQuery("(200, 300)")).toBeNull();
    expect(parseCoordinateQuery("95, 10")).toBeNull();
  });
});

describe("stripLeadingHouseNumber (numeric-address recall)", () => {
  it("strips a leading house number", () => {
    expect(stripLeadingHouseNumber("2 Pockock Street")).toBe("Pockock Street");
    expect(stripLeadingHouseNumber("  15  Ozumba Mbadiwe Ave")).toBe("Ozumba Mbadiwe Ave");
  });
  it("leaves non-addresses alone", () => {
    expect(stripLeadingHouseNumber("Lagos")).toBeNull();
    expect(stripLeadingHouseNumber("100001")).toBeNull();
    expect(stripLeadingHouseNumber("")).toBeNull();
    expect(stripLeadingHouseNumber("400 500")).toBeNull();
  });
});

describe("Plus Code classify (validity vectors)", () => {
  it("classifies full and short codes from official validity tests", () => {
    expect(classifyPlusCode("8FWC2345+G6")).toBe("full");
    expect(classifyPlusCode("8fwc2345+")).toBe("full");
    expect(classifyPlusCode("84000000+")).toBe("full");
    expect(classifyPlusCode("WC2345+G6g")).toBe("short");
    expect(classifyPlusCode("2345+G6")).toBe("short");
    expect(classifyPlusCode("45+G6")).toBe("short");
    expect(classifyPlusCode("+G6")).toBe("short");
    expect(classifyPlusCode("849VGJQF+VX7QR3J")).toBe("full");
  });
  it("rejects invalid codes and false positives", () => {
    expect(classifyPlusCode("G+")).toBeNull();
    expect(classifyPlusCode("+")).toBeNull();
    expect(classifyPlusCode("8FWC2345+G")).toBeNull();
    expect(classifyPlusCode("8FWC2300+G6")).toBeNull();
    expect(classifyPlusCode("WC2300+")).toBeNull();
    expect(classifyPlusCode("84900000+")).toBeNull();
    expect(classifyPlusCode("849VGJQF+VX7QR3U")).toBeNull();
    expect(classifyPlusCode("Lagos")).toBeNull();
    expect(classifyPlusCode("2 Pockock")).toBeNull();
    expect(classifyPlusCode("400-500")).toBeNull();
  });
  it("accepts bare 8/10-char codes without the separator", () => {
    expect(classifyPlusCode("849VCWC8")).toBe("full");
    expect(classifyPlusCode("849VCWC8R6")).toBe("full");
    expect(classifyPlusCode("849VCWC8+R6")).toBe("full");
  });
});

describe("decodePlusCode / encodePlusCode (decoding.csv vectors)", () => {
  it("decodes official sample codes to their cell centers", () => {
    const samples: Array<[string, number, number]> = [
      ["7FG49Q00+", 20.375, 2.775],
      ["7FG49QCJ+2V", 20.3700625, 2.7821875],
      ["7FG49QCJ+2VX", 20.3701125, 2.782234375],
      ["8FVC2222+22", 47.0000625, 8.0000625],
      ["4VCPPQGP+Q9", -41.2730625, 174.7859375],
      ["62G20000+", 0.5, -179.5],
      ["22220000+", -89.5, -179.5],
      ["7FG40000+", 20.5, 2.5],
      ["22222222+22", -89.9999375, -179.9999375],
      ["6VGX0000+", 0.5, 179.5],
      ["6FH32222+222", 1.0000125, 1.000015625],
      ["CFX30000+", 89.5, 1.5],
      ["84000000+", 40, -130],
      ["957W3H38+QV87WJ", 55.0544097, -101.43280053710937],
    ];
    for (const [code, lat, lng] of samples) {
      const area = decodePlusCode(code);
      expect(area).not.toBeNull();
      expect(Math.abs((area as NonNullable<typeof area>).centerLat - lat)).toBeLessThan(1e-6);
      expect(Math.abs((area as NonNullable<typeof area>).centerLng - lng)).toBeLessThan(1e-6);
    }
  });
  it("encodes cell centers back to the same code", () => {
    expect(encodePlusCode(37.4220625, -122.0844375, 10)).toBe("849VCWC8+R6");
    expect(encodePlusCode(47.36559, 8.524997, 10)).toBe("8FVC9G8F+6X");
  });
  it("returns null for non-finite input", () => {
    expect(encodePlusCode(NaN, 0, 10)).toBeNull();
    expect(encodePlusCode(0, Infinity, 10)).toBeNull();
  });
});

describe("recoverNearestPlusCode (shortCodeTests.csv vectors)", () => {
  it("recovers full codes from short codes against a reference", () => {
    const cases: Array<[string, number, number, string]> = [
      ["+2VX", 51.3701125, -1.217765625, "9C3W9QCJ+2VX"],
      ["CJ+2VX", 51.3708675, -1.217765625, "9C3W9QCJ+2VX"],
      ["CJ+2VX", 51.3693575, -1.217765625, "9C3W9QCJ+2VX"],
      ["CJ+2VX", 51.3701125, -1.218520625, "9C3W9QCJ+2VX"],
      ["CJ+2VX", 51.3701125, -1.217010625, "9C3W9QCJ+2VX"],
      ["9QCJ+2VX", 51.3852125, -1.217765625, "9C3W9QCJ+2VX"],
      ["9QCJ+2VX", 51.3550125, -1.217765625, "9C3W9QCJ+2VX"],
      ["9QCJ+2VX", 51.3701125, -1.232865625, "9C3W9QCJ+2VX"],
      ["9QCJ+2VX", 51.3701125, -1.202665625, "9C3W9QCJ+2VX"],
      ["22+", 42.899, 9.012, "8FJFW222+"],
      ["22+", 14.95125, -23.5001, "796RXG22+"],
      ["2GGG+GG", 46.976, 8.526, "8FVC2GGG+GG"],
      ["XGGG+GG", 47.026, 8.526, "8FRCXGGG+GG"],
      ["GXGG+GG", 46.526, 8.026, "8FR9GXGG+GG"],
      ["G2GG+GG", 46.526, 7.976, "8FRCG2GG+GG"],
      ["2222+22", 89.6, 0.0, "CFX22222+22"],
      ["XXXXXX+XX", -81.0, 0.0, "2CXXXXXX+XX"],
      ["8FRCG2GG+GG", 46.526, 7.976, "8FRCG2GG+GG"],
      ["8frcg2gg+gG", 46.526, 7.976, "8FRCG2GG+GG"],
    ];
    for (const [short, lat, lng, expected] of cases) {
      expect(recoverNearestPlusCode(short, lat, lng)).toBe(expected);
    }
  });
  it("passes full codes through (canonicalized)", () => {
    expect(recoverNearestPlusCode("849vcwc8+r6", 0, 0)).toBe("849VCWC8+R6");
    expect(recoverNearestPlusCode("849VCWC8R6", 0, 0)).toBe("849VCWC8+R6");
  });
});

describe("extractPlusCodeToken (code + locality split)", () => {
  it("splits a plus code from trailing locality text", () => {
    expect(extractPlusCodeToken("CGQC+HQ2 Lekki")).toEqual({ code: "CGQC+HQ2", remainder: "Lekki" });
    expect(extractPlusCodeToken("Lekki, CGQC+HQ2")).toEqual({ code: "CGQC+HQ2", remainder: "Lekki" });
    expect(extractPlusCodeToken("CGQC+HQ2  Lekki Phase1")).toEqual({
      code: "CGQC+HQ2",
      remainder: "Lekki Phase1",
    });
    expect(extractPlusCodeToken("(CGQC+HQ2), Ikeja")).toEqual({ code: "CGQC+HQ2", remainder: "Ikeja" });
  });
  it("keeps legacy whole-query classification for bare and spaced codes", () => {
    expect(extractPlusCodeToken("849VCWC8+R6")).toEqual({ code: "849VCWC8+R6", remainder: "" });
    expect(extractPlusCodeToken("8FWC 2345+G6")).toEqual({ code: "8FWC2345+G6", remainder: "" });
    expect(extractPlusCodeToken("CJ+ 2VX")).toEqual({ code: "CJ+2VX", remainder: "" });
  });
  it("never mistakes place names or coords for codes", () => {
    expect(extractPlusCodeToken("Lekki")).toBeNull();
    expect(extractPlusCodeToken("CGPQRVWX Lekki")).toBeNull(); // bare alphabet word + locality
    expect(extractPlusCodeToken("6.5244, 3.3792")).toBeNull();
    expect(extractPlusCodeToken("")).toBeNull();
  });
});

describe("parsePlusCodeQuery", () => {
  it("resolves full codes without a reference", () => {
    const pin = parsePlusCodeQuery("849VCWC8+R6");
    expect(pin).not.toBeNull();
    expect(pin?.isShort).toBe(false);
    expect(pin?.code).toBe("849VCWC8+R6");
    expect(Math.abs((pin as { lat: number }).lat - 37.4220625)).toBeLessThan(1e-6);
    expect(Math.abs((pin as { lng: number }).lng - -122.0844375)).toBeLessThan(1e-6);
  });
  it("recovers short codes when a reference is supplied", () => {
    const pin = parsePlusCodeQuery("CJ+2VX", { lat: 51.3701125, lng: -1.217765625 });
    expect(pin?.isShort).toBe(true);
    expect(pin?.code).toBe("9C3W9QCJ+2VX");
  });
  it("returns null for short codes without a reference", () => {
    expect(parsePlusCodeQuery("CJ+2VX")).toBeNull();
    expect(parsePlusCodeQuery("CJ+2VX", null)).toBeNull();
  });
  it("returns null for non-codes", () => {
    expect(parsePlusCodeQuery("Lagos")).toBeNull();
    expect(parsePlusCodeQuery("2 Pockock Street")).toBeNull();
  });
});

describe("geocodeForward intent pinning + numeric-address recall", () => {
  it("pins parenthesised coordinate queries as an exact pin", async () => {
    const spy = mockFetch(() => ({ ok: false, json: async () => null }));
    try {
      const hits = await geocodeForward("(6.5244, 3.3792)", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].provider).toBe(LOCATION_SUGGESTIONS_CONFIG.coordinateProviderName);
      expect(hits[0].lat).toBe("6.5244");
      expect(hits[0].lon).toBe("3.3792");
    } finally {
      spy.mockRestore();
    }
  });

  it("pins full plus codes offline (no provider hit required)", async () => {
    const spy = mockFetch(() => ({ ok: false, json: async () => null }));
    try {
      const hits = await geocodeForward("849VCWC8+R6", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].provider).toBe(LOCATION_SUGGESTIONS_CONFIG.plusCodeProviderName);
      expect(hits[0].display_name).toBe("849VCWC8+R6");
      expect(Math.abs(Number(hits[0].lat) - 37.4220625)).toBeLessThan(1e-6);
      expect(Math.abs(Number(hits[0].lon) - -122.0844375)).toBeLessThan(1e-6);
    } finally {
      spy.mockRestore();
    }
  });

  it("recovers short plus codes against the viewer bias", async () => {
    const spy = mockFetch(() => ({ ok: false, json: async () => null }));
    try {
      const hits = await geocodeForward("CJ+2VX", 6, { lat: 51.3701125, lng: -1.217765625 });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].provider).toBe(LOCATION_SUGGESTIONS_CONFIG.plusCodeProviderName);
      expect(hits[0].display_name).toBe("9C3W9QCJ+2VX");
    } finally {
      spy.mockRestore();
    }
  });

  it("resolves 'CGQC+HQ2 Lekki' via its locality reference with a friendly label", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("/reverse")) {
        return { ok: true, json: async () => ({ display_name: "Admiralty Way, Lekki, Nigeria" }) };
      }
      if (u.includes("nominatim.openstreetmap.org/search") && u.includes(encodeURIComponent("Lekki"))) {
        // Reference lookup for the short code (+ the remainder's own round-1 hit).
        return {
          ok: true,
          json: async () => [{ display_name: "Lekki, Lagos, Nigeria", lat: "6.4478", lon: "3.4723" }],
        };
      }
      if (u.includes("nominatim.openstreetmap.org/search")) return { ok: true, json: async () => [] };
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("CGQC+HQ2 Lekki", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].provider).toBe(LOCATION_SUGGESTIONS_CONFIG.plusCodeProviderName);
      expect(hits[0].display_name).toBe("Admiralty Way, Lekki, Nigeria");
      const expected = parsePlusCodeQuery("CGQC+HQ2", { lat: 6.4478, lng: 3.4723 });
      if (!expected) throw new Error("expected the short code to parse against the reference");
      expect(Math.abs(Number(hits[0].lat) - expected.lat)).toBeLessThan(1e-6);
      expect(Math.abs(Number(hits[0].lon) - expected.lng)).toBeLessThan(1e-6);
      // The locality remainder surfaces as its own suggestion too.
      expect(hits.some((h) => h.display_name === "Lekki, Lagos, Nigeria")).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("falls through (no pin) when a short code has no reference at all", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("nominatim.openstreetmap.org/search")) return { ok: true, json: async () => [] };
      if (u.includes("photon.komoot.io")) return { ok: true, json: async () => ({ features: [] }) };
      if (u.includes("open-meteo")) return { ok: true, json: async () => ({ results: [] }) };
      if (u.includes("overpass")) return { ok: true, json: async () => ({ elements: [] }) };
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("CGQC+HQ2 Lekki", 6);
      expect(hits.every((h) => h.provider !== LOCATION_SUGGESTIONS_CONFIG.plusCodeProviderName)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("pins the friendly reverse label (not the raw coords) as THE coordinate hit", async () => {
    const spy = mockFetch((u) => {
      if (u.includes("/reverse")) {
        return { ok: true, json: async () => ({ display_name: "Ikeja, Lagos, Nigeria" }) };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("6.6018, 3.3515", 6);
      expect(hits[0].provider).toBe(LOCATION_SUGGESTIONS_CONFIG.coordinateProviderName);
      // Exact coords kept behind the hood; display shows the place name only.
      expect(hits[0].display_name).toBe("Ikeja, Lagos, Nigeria");
      expect(hits[0].lat).toBe("6.6018");
      expect(hits[0].lon).toBe("3.3515");
      // Single pinned hit — no duplicate raw-coordinate row when a label exists.
      expect(hits.filter((h) => h.provider === LOCATION_SUGGESTIONS_CONFIG.coordinateProviderName)).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to the raw query text only when the reverse label fails", async () => {
    const spy = mockFetch(() => ({ ok: false, json: async () => null }));
    try {
      const hits = await geocodeForward("6.6018, 3.3515", 6);
      expect(hits[0].display_name).toBe("6.6018, 3.3515");
      expect(hits[0].lat).toBe("6.6018");
      expect(hits[0].lon).toBe("3.3515");
    } finally {
      spy.mockRestore();
    }
  });

  it("rescues house-numbered addresses via stripped retry + overpass addr scan", async () => {
    const seen: string[] = [];
    const spy = mockFetch((u, init) => {
      seen.push(u + (init?.body ? ` BODY=${init.body}` : ""));
      if (u.includes("nominatim.openstreetmap.org/search")) {
        // Only the stripped (no house number) query hits.
        if (u.includes(encodeURIComponent("Pockock Street"))) {
          return {
            ok: true,
            json: async () => [{ display_name: "Pockock Street, Lagos, Nigeria", lat: "6.45", lon: "3.39" }],
          };
        }
        return { ok: true, json: async () => [] };
      }
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("2 Pockock Street", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].display_name).toMatch("Pockock Street");
      expect(seen.some((u) => u.includes(encodeURIComponent("Pockock Street")))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("queries overpass addr:housenumber on the numeric-address path", async () => {
    const bodies: string[] = [];
    const spy = mockFetch((u, init) => {
      if (u.includes("overpass-api.de") && init?.body) {
        bodies.push(init.body);
        return {
          ok: true,
          json: async () => ({
            elements: [
              {
                type: "node",
                lat: 6.45,
                lon: 3.39,
                tags: { "addr:housenumber": "2", "addr:street": "Pockock Street", "addr:city": "Lagos" },
              },
            ],
          }),
        };
      }
      if (u.includes("nominatim.openstreetmap.org/search")) return { ok: true, json: async () => [] };
      if (u.includes("photon.komoot.io/api")) return { ok: true, json: async () => ({ features: [] }) };
      if (u.includes("geocoding-api.open-meteo.com")) return { ok: true, json: async () => ({ results: [] }) };
      return { ok: false, json: async () => null };
    });
    try {
      const hits = await geocodeForward("2 Pockock Street", 6);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.provider === "overpass" && h.display_name.includes("Pockock"))).toBe(true);
      const decoded = bodies.map((b) => decodeURIComponent(b)).join("\n");
      expect(decoded).toContain("addr:housenumber");
      expect(decoded).toContain("Pockock");
    } finally {
      spy.mockRestore();
    }
  });
});
