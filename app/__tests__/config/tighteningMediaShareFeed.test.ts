/**
 * Tightening sprint: media-cleanup cross-post guard, per-platform share
 * icons, feed first-load readiness + seeded diversity.
 *
 * - MEDIA_CLEANUP_CONFIG.guardLivePostReferences exists (service-level
 *   assertions live in mediaCleanup.test.ts).
 * - BLOG_SHARE_CONFIG.networks carry serializable icon keys (one per
 *   platform); ShareNetworkIcon renders a distinct glyph per key with a
 *   generic fallback for unknown keys.
 * - FEED_FIRST_LOAD_CONFIG carries geoWaitMs/skeletonCount; seededRand is
 *   deterministic per seed, bounded [0,1), and varies across seeds.
 */
import { MEDIA_CLEANUP_CONFIG } from "@/app/lib/config/mediaCleanup";
import { BLOG_SHARE_CONFIG } from "@/app/lib/config/blogManagement";
import {
  FEED_FIRST_LOAD_CONFIG,
  hashSeedString,
  seededRand,
} from "@/app/lib/config/feedAlgorithm";

describe("media cleanup guard flag", () => {
  it("is on by default (env kill-switch MEDIA_CLEANUP_GUARD_REFS)", () => {
    expect(MEDIA_CLEANUP_CONFIG.guardLivePostReferences).toBe(true);
  });
});

describe("blog share network icons", () => {
  it("every network carries a serializable icon key", () => {
    expect(BLOG_SHARE_CONFIG.networks.length).toBeGreaterThan(0);
    for (const n of BLOG_SHARE_CONFIG.networks) {
      expect(typeof n.icon).toBe("string");
      expect(n.icon.length).toBeGreaterThan(0);
    }
  });

  it("covers X, Facebook, and WhatsApp with distinct keys", () => {
    const byId = new Map(BLOG_SHARE_CONFIG.networks.map((n) => [n.id, n.icon]));
    expect(byId.get("x")).toBe("x");
    expect(byId.get("facebook")).toBe("facebook");
    expect(byId.get("whatsapp")).toBe("whatsapp");
    expect(new Set(byId.values()).size).toBe(BLOG_SHARE_CONFIG.networks.length);
  });
});

describe("feed first-load config", () => {
  it("declares a geo wait budget and skeleton count", () => {
    expect(FEED_FIRST_LOAD_CONFIG.geoWaitMs).toBeGreaterThan(0);
    expect(FEED_FIRST_LOAD_CONFIG.skeletonCount).toBeGreaterThan(0);
  });
});

describe("seededRand", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRand("user-1:2026-10-14");
    const b = seededRand("user-1:2026-10-14");
    expect(Array.from({ length: 5 }, () => a())).toEqual(
      Array.from({ length: 5 }, () => b())
    );
  });

  it("stays within [0, 1) and varies across seeds", () => {
    const a = Array.from({ length: 20 }, () => seededRand("anon:day-1")());
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const b = Array.from({ length: 20 }, () => seededRand("other:day-1")());
    expect(a).not.toEqual(b);
  });

  it("never throws on junk input and hashes stably", () => {
    expect(hashSeedString("abc")).toBe(hashSeedString("abc"));
    expect(() => seededRand(null as never)()).not.toThrow();
    expect(() => seededRand(undefined as never)()).not.toThrow();
  });
});
