/**
 * Push-banner opacity + keyless traffic overlay:
 * - banner surface is opaque token-driven (dark-mode wash-out fix)
 * - traffic provider order keeps heuristic last, thresholds sane,
 *   yellow = medium / red = heavy, durations blend by level share
 */
import {
  TRAFFIC_CONFIG,
  adjustDurationForLevels,
  heuristicCongestion,
  levelForCongestion,
} from "@/app/lib/config/traffic";
// NOTE: same ESM-stub discipline as emailStudio/mapStack suites —
// `@upstash/redis → uncrypto` cannot be parsed by the jest transform, so
// `trafficService`'s redis import is stubbed (get → null, set → no-op).
jest.mock("@/app/lib/db/redis", () => ({
  getRedisClient: () => null,
  __resetRedisForTests: () => {},
  withTimeout: async <T>(p: Promise<T>) => p,
  REDIS_OP_TIMEOUT_MS: 1200,
  redis: {
    get: async <T>() => null as T | null,
    set: async () => {},
    del: async () => 0,
    _getClient: () => null,
    _withTimeout: async <T>(p: Promise<T>) => p,
  },
}));
import { chunkCoords } from "@/app/lib/services/trafficService";
import { PUSH_PROMPT_CONFIG } from "@/app/lib/config/pushPrompt";
import { API_REGISTRY } from "@/app/lib/config/apiRegistry";
import { DEFAULT_FAQ_ITEMS, FAQ_PCM } from "@/app/lib/config/faq";

describe("push banner surface (opaque, token-driven)", () => {
  it("uses an opaque card fill — never the translucent info wash", () => {
    expect(PUSH_PROMPT_CONFIG.surface.background).toMatch(/--color-bg-card/);
    expect(PUSH_PROMPT_CONFIG.surface.background).not.toMatch(/rgba|0\.15/);
    expect(PUSH_PROMPT_CONFIG.surface.border).toMatch(/--color-info-border/);
    expect(PUSH_PROMPT_CONFIG.surface.text).toMatch(/--color-text-primary/);
    expect(PUSH_PROMPT_CONFIG.surface.icon).toMatch(/--color-info-text/);
  });
});

describe("traffic config", () => {
  it("tries keyed live providers first with the keyless heuristic last", () => {
    expect(TRAFFIC_CONFIG.providerOrder[TRAFFIC_CONFIG.providerOrder.length - 1]).toBe("heuristic");
    expect(TRAFFIC_CONFIG.providerOrder).toContain("mapbox");
    expect(TRAFFIC_CONFIG.providerOrder).toContain("tomtom");
  });

  it("paints medium traffic yellow and heavy traffic red", () => {
    expect(TRAFFIC_CONFIG.levels.moderate.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(TRAFFIC_CONFIG.levels.heavy.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    // Yellow family vs red family — swatch and line share these constants.
    expect(TRAFFIC_CONFIG.levels.moderate.color.toLowerCase()).toBe("#eab308");
    expect(TRAFFIC_CONFIG.levels.heavy.color.toLowerCase()).toBe("#dc2626");
  });

  it("legend copy explains colors + estimate honesty", () => {
    expect(TRAFFIC_CONFIG.legend.title.length).toBeGreaterThan(0);
    expect(TRAFFIC_CONFIG.legend.openLabel.length).toBeGreaterThan(0);
    expect(TRAFFIC_CONFIG.legend.estimatedNote).toMatch(/stimat/);
    expect(TRAFFIC_CONFIG.legend.durationSuffix).toMatch(/traffic/i);
  });

  it("maps numeric congestion through config thresholds", () => {
    expect(levelForCongestion(0)).toBe("low");
    expect(levelForCongestion(TRAFFIC_CONFIG.thresholds.moderateAt)).toBe("moderate");
    expect(levelForCongestion(TRAFFIC_CONFIG.thresholds.heavyAt)).toBe("heavy");
    expect(levelForCongestion(NaN)).toBe("low");
  });

  it("heuristic is deterministic and bounded (no flicker between renders)", () => {
    const at = new Date("2026-10-14T08:30:00+01:00"); // weekday rush
    expect(heuristicCongestion(3, 10, at)).toBe(heuristicCongestion(3, 10, at));
    for (let i = 0; i < 10; i++) {
      const v = heuristicCongestion(i, 10, at);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("rush-hour averages heavier than weekend nights", () => {
    const rush = new Date("2026-10-14T08:30:00+01:00"); // Wed morning peak
    const calm = new Date("2026-10-17T02:00:00+01:00"); // Sat night
    const avg = (d: Date) =>
      Array.from({ length: 12 }, (_, i) => heuristicCongestion(i, 12, d)).reduce((a, b) => a + b, 0) / 12;
    expect(avg(rush)).toBeGreaterThan(avg(calm));
  });

  it("blends durations by level share (low keeps base, heavy lifts it)", () => {
    expect(adjustDurationForLevels(20, { low: 10, moderate: 0, heavy: 0 }, 10)).toBe(20);
    const mixed = adjustDurationForLevels(20, { low: 5, moderate: 3, heavy: 2 }, 10);
    const worse = adjustDurationForLevels(20, { low: 0, moderate: 2, heavy: 8 }, 10);
    expect(mixed).toBeGreaterThan(20);
    expect(worse).toBeGreaterThan(mixed);
    expect(adjustDurationForLevels(20, { low: 0, moderate: 0, heavy: 0 }, 0)).toBe(20);
  });
});

describe("traffic chunking (service pure helper)", () => {
  it("splits coords into contiguous chunks covering the full line", () => {
    const coords = Array.from({ length: 50 }, (_, i) => ({ lat: 6.5 + i * 0.001, lng: 3.3 }));
    const chunks = chunkCoords(coords);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(12);
    expect(chunks[0].from).toBe(0);
    expect(chunks[chunks.length - 1].to).toBe(coords.length - 1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].from).toBeLessThanOrEqual(chunks[i].to);
    }
  });

  it("returns empty for degenerate input", () => {
    expect(chunkCoords([])).toEqual([]);
    expect(chunkCoords([{ lat: 1, lng: 2 }])).toEqual([]);
  });
});

describe("traffic wiring (registry + docs)", () => {
  it("registers the guest-open traffic endpoint on the maps bucket", () => {
    expect(API_REGISTRY.mapsTraffic.path).toBe("/api/maps/traffic");
    expect(API_REGISTRY.mapsTraffic.methods).toContain("POST");
    expect(API_REGISTRY.mapsTraffic.auth).toBe(false);
    expect(API_REGISTRY.mapsTraffic.rateLimit).toBe("maps");
  });

  it("FAQ documents traffic colors + durations (en + pidgin)", () => {
    const maps = DEFAULT_FAQ_ITEMS.find((c) => c.id === "maps");
    const ids = (maps?.items ?? []).map((i) => i.id);
    expect(ids).toContain("map-traffic-legend");
    expect(ids).toContain("map-traffic-duration");
    const legend = maps?.items.find((i) => i.id === "map-traffic-legend");
    expect(legend?.answer).toMatch(/yellow/i);
    expect(legend?.answer).toMatch(/red/i);
    expect(FAQ_PCM["map-traffic-legend"]?.answer).toBeTruthy();
    expect(FAQ_PCM["map-traffic-duration"]?.answer).toBeTruthy();
  });
});
