import {
  normalizeCorroborationToken,
  tagSimilarityScore,
  geoCorridorScore,
  routeContentScore,
  pairSimilarityScore,
  endorsementScore,
  computeCorroborationScore,
} from "@/app/lib/services/ValidityEngine";
import { CORROBORATION_CONFIG } from "@/app/lib/config/validityConfig";

const LEKKI_ROUTE = [
  { location: "CMS", description: "start", vehicle: "bus", fare: 500 },
  { location: "Lekki Phase 1", description: "stop", vehicle: "bus", fare: 300 },
  { location: "Ajah", description: "destination", vehicle: "bus", fare: 999 },
];

describe("corroboration scorers", () => {
  it("normalizes tokens (case/whitespace)", () => {
    expect(normalizeCorroborationToken("  Lagos ")).toBe("lagos");
    expect(normalizeCorroborationToken(null)).toBe("");
  });

  it("tag similarity is case-insensitive Jaccard", () => {
    expect(tagSimilarityScore(["Lagos", "bus"], ["lagos", "BUS"])).toBe(100);
    expect(tagSimilarityScore(["a", "b"], ["c", "d"])).toBe(0);
    expect(tagSimilarityScore([], ["a"])).toBe(0);
    // 1 shared of 3 unique → 33.
    expect(tagSimilarityScore(["a", "b"], ["b", "c"])).toBe(33);
  });

  it("geo corridor scores same start/end + region at 100", () => {
    const a = { startLat: 6.45, startLng: 3.39, endLat: 6.46, endLng: 3.47, region: "Lagos" };
    expect(geoCorridorScore(a, { ...a })).toBe(100);
    // Far apart, different region → 0.
    expect(
      geoCorridorScore(a, { startLat: 9.06, startLng: 7.48, endLat: 9.07, endLng: 7.49, region: "Abuja" })
    ).toBe(0);
    // Missing coords degrade the leg instead of throwing.
    expect(geoCorridorScore({}, {})).toBe(0);
  });

  it("route content ignores destination fare/vehicle", () => {
    expect(routeContentScore(LEKKI_ROUTE, LEKKI_ROUTE)).toBe(100);
    // Only the destination leg differs → still 100 (destination carries no
    // onward fare/vehicle by platform convention).
    const altered = [
      ...LEKKI_ROUTE.slice(0, -1),
      { location: "Ajah", description: "destination", vehicle: "helicopter", fare: 1 },
    ];
    expect(routeContentScore(LEKKI_ROUTE, altered)).toBe(100);
    // Completely different routes score low.
    expect(
      routeContentScore(LEKKI_ROUTE, [
        { location: "Wuse", vehicle: "taxi", fare: 200 },
        { location: "Garki", vehicle: "taxi", fare: 200 },
      ])
    ).toBeLessThan(50);
  });

  it("identical posts pair at 100; empty posts at 0", () => {
    const post = {
      tags: ["lekki", "bus"],
      routes: LEKKI_ROUTE,
      startLat: 6.45,
      startLng: 3.39,
      endLat: 6.46,
      endLng: 3.47,
      region: "lagos",
    };
    expect(pairSimilarityScore(post, { ...post, region: "Lagos" })).toBe(100);
    // Empty posts carry no signal — below the match threshold (unspecified
    // vehicle/fare is neutral, not agreement).
    expect(pairSimilarityScore({}, {})).toBeLessThan(CORROBORATION_CONFIG.matchThreshold);
  });

  it("endorsement reflects likes/dislikes relative to views", () => {
    expect(endorsementScore({ likes: 0, dislikes: 0, views: 100 })).toBe(0);
    const fewLikes = endorsementScore({ likes: 2, dislikes: 0, views: 50 });
    // A couple of likes already register — no more permanent zero.
    expect(fewLikes).toBeGreaterThan(0);
    // Same votes with far more views → lower confidence.
    expect(endorsementScore({ likes: 2, dislikes: 0, views: 2000 })).toBeLessThan(fewLikes);
    // Dislikes drag approval down.
    expect(endorsementScore({ likes: 1, dislikes: 9, views: 50 })).toBeLessThan(fewLikes);
    // Saturates at 100, never exceeds.
    expect(endorsementScore({ likes: 500, dislikes: 0, views: 500 })).toBe(100);
  });

  it("final blend is weighted, covered, and clamped", () => {
    expect(
      computeCorroborationScore({ bestSimilarity: 0, matchCount: 0, endorsement: 0, responseCount: 0 })
    ).toBe(0);
    // Single match counts partially; full coverage counts fully.
    const one = computeCorroborationScore({ bestSimilarity: 100, matchCount: 1, endorsement: 0, responseCount: 0 });
    const three = computeCorroborationScore({ bestSimilarity: 100, matchCount: 3, endorsement: 0, responseCount: 0 });
    expect(one).toBeGreaterThan(0);
    expect(three).toBeGreaterThan(one);
    expect(three).toBe(Math.round(100 * CORROBORATION_CONFIG.routeEvidenceWeight));
    // Explicit responses lift the score (capped).
    const withResponses = computeCorroborationScore({
      bestSimilarity: 0,
      matchCount: 0,
      endorsement: 0,
      responseCount: 10,
    });
    expect(withResponses).toBe(
      Math.round(CORROBORATION_CONFIG.responseMaxPoints * CORROBORATION_CONFIG.responseWeight)
    );
    // Hostile inputs clamp instead of throwing.
    expect(
      computeCorroborationScore({ bestSimilarity: 999, matchCount: -5, endorsement: NaN, responseCount: 3 })
    ).toBeGreaterThanOrEqual(0);
  });
});
