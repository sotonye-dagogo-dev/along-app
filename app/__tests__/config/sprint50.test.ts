/**
 * @jest-environment node
 *
 * Sprint 50 tightening — report attachments, pagination UI, merged keyless
 * geocode (+near ranking), floating lanes, bias helper.
 */
import {
  REPORT_ATTACHMENTS_CONFIG,
  reportMaxSizeLabel,
  sanitizeReportImageUrls,
} from "@/app/lib/config/reportAttachments";
import { PAGINATION_UI_CONFIG } from "@/app/lib/config/paginationUi";
import { FLOATING_UI_CONFIG, laneBottom } from "@/app/lib/config/floatingUi";
import { MAP_STACK_CONFIG } from "@/app/lib/config/mapStack";
import { biasQuerySuffix } from "@/app/lib/utils/geoBias";

jest.mock("@/app/lib/db/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(0),
  },
}));

import {
  mapProxyService,
  geocodeForward,
  geocodeDedupKey,
  rankGeocodeHits,
} from "@/app/lib/services/mapProxyService";

describe("Sprint 50: report attachments config", () => {
  it("caps at 3 images / 2MB in along/reports", () => {
    expect(REPORT_ATTACHMENTS_CONFIG.maxImages).toBe(3);
    expect(REPORT_ATTACHMENTS_CONFIG.maxBytesPerImage).toBe(2 * 1024 * 1024);
    expect(REPORT_ATTACHMENTS_CONFIG.folder).toBe("along/reports");
    expect(reportMaxSizeLabel()).toBe("2MB");
  });

  it("sanitize keeps only Cloudinary along/reports URLs, capped at max", () => {
    const good = "https://res.cloudinary.com/demo/image/upload/along/reports/abc.jpg";
    const post = "https://res.cloudinary.com/demo/image/upload/along/posts/abc.jpg";
    expect(sanitizeReportImageUrls([good, post, "https://evil.com/x.jpg", 42])).toEqual([good]);
    expect(sanitizeReportImageUrls([good, good, good, good])).toHaveLength(3);
    expect(sanitizeReportImageUrls("nope")).toEqual([]);
    expect(sanitizeReportImageUrls(undefined)).toEqual([]);
  });
});

describe("Sprint 50: pagination UI config", () => {
  it("view-more + navigator copy are present and shaped", () => {
    expect(PAGINATION_UI_CONFIG.viewMore.label).toBe("View more");
    expect(PAGINATION_UI_CONFIG.viewMore.countLine(20, null)).toMatch("20");
    expect(PAGINATION_UI_CONFIG.viewMore.countLine(20, 100)).toMatch("20 of 100");
    expect(PAGINATION_UI_CONFIG.navigator.pageLabel(2, 9)).toBe("Page 2 of 9");
  });
});

describe("Sprint 50: floating lanes clear the mobile tab bar", () => {
  it("offline/install/transient lanes sit above the 64px navbar", () => {
    expect(FLOATING_UI_CONFIG.mobileNavbarHeightPx).toBe(64);
    expect(FLOATING_UI_CONFIG.lanes.offlineBottomPx).toBeGreaterThan(64);
    expect(FLOATING_UI_CONFIG.lanes.installBottomOnlinePx).toBeGreaterThan(64);
    expect(FLOATING_UI_CONFIG.lanes.installBottomOfflinePx).toBeGreaterThan(
      FLOATING_UI_CONFIG.lanes.installBottomOnlinePx
    );
    expect(FLOATING_UI_CONFIG.lanes.transientBottomPx).toBeGreaterThan(
      FLOATING_UI_CONFIG.lanes.installBottomOfflinePx
    );
    expect(FLOATING_UI_CONFIG.mobileDockSide).toBe("right");
    expect(laneBottom(76)).toMatch("76px");
    expect(laneBottom(76)).toMatch("safe-area-inset-bottom");
  });
});

describe("Sprint 50: merged keyless geocode", () => {
  it("geocode order keeps nominatim first and adds keyless openmeteo", () => {
    expect(MAP_STACK_CONFIG.geocodeOrder[0]).toBe("nominatim");
    expect(MAP_STACK_CONFIG.geocodeOrder).toContain("openmeteo");
    expect(MAP_STACK_CONFIG.upstreams.openmeteo).toMatch("open-meteo.com");
    expect(MAP_STACK_CONFIG.upstreams.openmeteo).not.toMatch("key");
  });

  it("dedup key collapses same-place hits across providers", () => {
    const a = { display_name: "Lagos, Nigeria", lat: "6.5244", lon: "3.3792", provider: "nominatim" };
    const b = { display_name: "lagos, nigeria ", lat: "6.52441", lon: "3.37921", provider: "photon" };
    const c = { display_name: "Ikeja, Lagos", lat: "6.6018", lon: "3.3515", provider: "openmeteo" };
    expect(geocodeDedupKey(a)).toBe(geocodeDedupKey(b));
    expect(geocodeDedupKey(a)).not.toBe(geocodeDedupKey(c));
  });

  it("near ranking puts closer hits first without dropping any", () => {
    const far = { display_name: "Far", lat: "7.5", lon: "4.5", provider: "nominatim" };
    const nearHit = { display_name: "Near", lat: "6.53", lon: "3.38", provider: "photon" };
    const ranked = rankGeocodeHits([far, nearHit], { lat: 6.5244, lng: 3.3792 });
    expect(ranked).toHaveLength(2);
    expect(ranked[0].display_name).toBe("Near");
    // No bias → order preserved.
    expect(rankGeocodeHits([far, nearHit], null).map((h) => h.display_name)).toEqual(["Far", "Near"]);
  });

  it("forward geocode merges providers and caps at limit", async () => {
    const spy = jest.spyOn(global, "fetch").mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("nominatim.openstreetmap.org/search")) {
        return { ok: true, json: async () => [{ display_name: "Lagos, Nigeria", lat: "6.5244", lon: "3.3792" }] } as Response;
      }
      if (u.includes("photon.komoot.io/api")) {
        return {
          ok: true,
          json: async () => ({
            features: [
              { properties: { name: "Ikeja", country: "Nigeria" }, geometry: { coordinates: [3.3515, 6.6018] } },
            ],
          }),
        } as Response;
      }
      if (u.includes("geocoding-api.open-meteo.com")) {
        return {
          ok: true,
          json: async () => ({
            results: [{ name: "Lekki", admin1: "Lagos", country: "Nigeria", latitude: 6.45, longitude: 3.4 }],
          }),
        } as Response;
      }
      return { ok: false, json: async () => null } as Response;
    });
    try {
      const hits = await geocodeForward("Lag", 5);
      const names = hits.map((h) => h.display_name);
      expect(names.some((n) => n.includes("Lagos"))).toBe(true);
      expect(names.some((n) => n.includes("Ikeja"))).toBe(true);
      expect(names.some((n) => n.includes("Lekki"))).toBe(true);
      expect(hits.length).toBeLessThanOrEqual(5);
      // Same query with a viewer bias still resolves (re-ranked, never filtered).
      const biased = await mapProxyService.geocodeForward("Lag", 5, { lat: 6.45, lng: 3.4 });
      expect(biased.length).toBe(hits.length);
      expect(biased[0].display_name).toMatch("Lekki");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("Sprint 50: bias query suffix", () => {
  it("renders &lat=&lng= only when coords exist", () => {
    expect(biasQuerySuffix(null)).toBe("");
    expect(biasQuerySuffix({ lat: 6.5, lng: 3.3 })).toBe("&lat=6.5&lng=3.3");
  });
});
