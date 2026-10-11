import {
  computeRouteDetailScore,
  computePostDetailScore,
  detailContextFromPost,
} from "@/app/lib/services/ValidityEngine";
import { DETAIL_SCORING_CONFIG } from "@/app/lib/config/validityConfig";

// Regression suite for the static-42 detail bug: composer legs never carry
// distance/steps, so the leg-only scorer returned 30 × 1.4 = 42 for EVERY
// post. The post-level scorer must keep legacy parity without context while
// differentiating rich posts once context is supplied.
describe("post detail scoring (richness-aware)", () => {
  const textLegs = [
    { location: "Ikeja Bus Stop", description: "Take a BRT bus heading towards CMS." },
    { location: "Obalende", description: "Hop on a danfo to VI." },
    { location: "Adeola Odeku", description: "Final stop." },
  ];

  it("returns the legacy base when no context is supplied (backward compatible)", () => {
    expect(computePostDetailScore(textLegs)).toBe(computeRouteDetailScore(textLegs));
    expect(computePostDetailScore(textLegs, {})).toBe(computeRouteDetailScore(textLegs));
  });

  it("scores the legacy text-legs case at the historic 42 (documents the bug shape)", () => {
    expect(computeRouteDetailScore(textLegs)).toBe(42);
  });

  it("lifts rich posts above the legacy base (photos + tags + description + fares/vehicles)", () => {
    const base = computeRouteDetailScore(textLegs);
    const rich = computePostDetailScore(textLegs, {
      imageCount: 5,
      tagCount: 4,
      descriptionLength: 250,
      vehicleLegs: 2,
      fareLegs: 2,
      transitLegs: 2,
      stopCount: 3,
      locationLegs: 3,
    });
    expect(rich).toBeGreaterThan(base);
  });

  it("keeps thin posts (no photos/tags/description) near the legacy base", () => {
    const base = computeRouteDetailScore([{ location: "A" }]);
    const thin = computePostDetailScore([{ location: "A" }], detailContextFromPost({
      routes: [{ location: "A" }],
      images: [],
      tags: [],
      description: null,
    }));
    // Only the location-coverage bonus applies (+5: the single leg names a
    // place); every other richness leg stays 0.
    expect(thin).toBe(base + DETAIL_SCORING_CONFIG.maxLocationBonus);
    // A leg naming nothing at all keeps exact legacy parity.
    const bare = computePostDetailScore([{}], detailContextFromPost({ routes: [{}] }));
    expect(bare).toBe(computeRouteDetailScore([{}]));
  });

  it("caps the total at 100 no matter how rich the post is", () => {
    const score = computePostDetailScore(
      [{ location: "A", description: "x".repeat(500), distance: 9, steps: [1, 2, 3, 4, 5, 6, 7] }],
      { imageCount: 99, tagCount: 99, descriptionLength: 9999, vehicleLegs: 9, fareLegs: 9, transitLegs: 9, stopCount: 99, locationLegs: 99 },
    );
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("derives context from a stored post shape (routes + images + tags + description)", () => {
    const ctx = detailContextFromPost({
      routes: [
        { location: "A", description: "start", vehicle: "bus", fare: 300 },
        { location: "B", description: "mid", vehicle: "keke", fare: 200 },
        { location: "C", description: "end" },
      ],
      images: ["u1", "u2"],
      tags: ["lagos", "danfo"],
      description: "A detailed trip across town with landmarks.",
    });
    expect(ctx.imageCount).toBe(2);
    expect(ctx.tagCount).toBe(2);
    expect(ctx.descriptionLength).toBeGreaterThan(0);
    // Destination leg excluded from vehicle/fare coverage.
    expect(ctx.transitLegs).toBe(2);
    expect(ctx.vehicleLegs).toBe(2);
    expect(ctx.fareLegs).toBe(2);
    expect(ctx.stopCount).toBe(3);
    expect(ctx.locationLegs).toBe(3);
  });

  it("tolerates legacy rows with missing fields (each absent leg scores 0)", () => {
    const ctx = detailContextFromPost({});
    expect(computePostDetailScore([], ctx)).toBe(0);
    expect(computePostDetailScore([{ location: "A" }], ctx)).toBe(
      computeRouteDetailScore([{ location: "A" }]),
    );
  });

  it("config bonuses stay internally consistent (caps reachable, tiers ordered)", () => {
    const c = DETAIL_SCORING_CONFIG;
    expect(c.maxImageBonus).toBeGreaterThan(0);
    expect(c.maxTagBonus).toBeGreaterThan(0);
    const tiers = [...c.descriptionTiers].sort((a, b) => b.minLength - a.minLength);
    expect(tiers[0].bonus).toBeGreaterThanOrEqual(tiers[tiers.length - 1].bonus);
  });
});
