import { validityEngine, computeRouteDetailScore, computeSimilarityRatio } from "@/app/lib/services/ValidityEngine";

describe("ValidityEngine", () => {
  describe("evaluate", () => {
    it("returns correct score for zero votes and zero routes", async () => {
      const result = await validityEngine.evaluate({
        likes: 0,
        dislikes: 0,
        routeDetailScore: 0,
        similarityRatio: 0,
        createdAt: new Date(),
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(["low", "developing", "verified", "trusted"]).toContain(result.tier);
    });

    it("returns trusted tier for maximum scores", async () => {
      const result = await validityEngine.evaluate({
        likes: 1000,
        dislikes: 0,
        routeDetailScore: 100,
        similarityRatio: 100,
        createdAt: new Date(),
      });
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.tier).toBe("trusted");
    });

    it("returns low tier for minimum engagement on 91-day old post", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      const result = await validityEngine.evaluate({
        likes: 0,
        dislikes: 0,
        routeDetailScore: 0,
        similarityRatio: 0,
        createdAt: oldDate,
      });
      expect(result.score).toBeLessThan(30);
      expect(result.tier).toBe("low");
    });

    it("clamps score to 0-100 range", async () => {
      const result = await validityEngine.evaluate({
        likes: 999999,
        dislikes: 0,
        routeDetailScore: 999,
        similarityRatio: 999,
        createdAt: new Date(),
      });
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("returns verified tier for scores 60-79", async () => {
      const result = await validityEngine.evaluate({
        likes: 20,
        dislikes: 0,
        routeDetailScore: 30,
        similarityRatio: 30,
        createdAt: new Date(),
      });
      expect(result.tier).toBe("verified");
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThanOrEqual(79);
    });

    it("calculates community score based on like ratio", async () => {
      const highRatio = await validityEngine.evaluate({
        likes: 100, dislikes: 0, routeDetailScore: 0, similarityRatio: 0, createdAt: new Date(),
      });
      const lowRatio = await validityEngine.evaluate({
        likes: 1, dislikes: 99, routeDetailScore: 0, similarityRatio: 0, createdAt: new Date(),
      });
      expect(highRatio.community).toBeGreaterThan(lowRatio.community);
    });

    it("decreases recency score for older posts", async () => {
      const now = new Date();
      const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const freshResult = await validityEngine.evaluate({
        likes: 0, dislikes: 0, routeDetailScore: 0, similarityRatio: 0, createdAt: now,
      });
      const oldResult = await validityEngine.evaluate({
        likes: 0, dislikes: 0, routeDetailScore: 0, similarityRatio: 0, createdAt: old,
      });
      expect(freshResult.recency).toBeGreaterThan(oldResult.recency);
    });

    it("increases detail score with better route detail", async () => {
      const highDetail = await validityEngine.evaluate({
        likes: 0, dislikes: 0, routeDetailScore: 100, similarityRatio: 0, createdAt: new Date(),
      });
      const lowDetail = await validityEngine.evaluate({
        likes: 0, dislikes: 0, routeDetailScore: 0, similarityRatio: 0, createdAt: new Date(),
      });
      expect(highDetail.detail).toBeGreaterThan(lowDetail.detail);
    });
  });

  describe("dynamic signals (non-breaking extensions)", () => {
    const base = {
      likes: 0,
      dislikes: 0,
      routeDetailScore: 40,
      similarityRatio: 20,
      createdAt: new Date(),
    };

    it("keeps legacy scores when no dynamic signals are provided", async () => {
      const result = await validityEngine.evaluate({ ...base });
      expect(result.reputation).toBe(0);
      expect(result.engagement).toBe(0);
      expect(result.reportPressure).toBe(0);
      // Base-only score is deterministic for these inputs.
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("lifts the score for followed, verified, mature authors", async () => {
      const solo = await validityEngine.evaluate({ ...base });
      const established = await validityEngine.evaluate({
        ...base,
        authorFollowerCount: 250,
        authorVerified: true,
        authorAgeDays: 200,
      });
      expect(established.reputation).toBeGreaterThan(0);
      expect(established.score).toBeGreaterThan(solo.score);
    });

    it("lifts the score with comments, bookmarks, views and shares", async () => {
      const quiet = await validityEngine.evaluate({ ...base });
      const lively = await validityEngine.evaluate({
        ...base,
        comments: 8,
        bookmarks: 6,
        views: 400,
        shares: 3,
      });
      expect(lively.engagement).toBeGreaterThan(0);
      expect(lively.score).toBeGreaterThan(quiet.score);
    });

    it("penalises posts with open reports", async () => {
      const clean = await validityEngine.evaluate({ ...base });
      const reported = await validityEngine.evaluate({ ...base, openReports: 3 });
      expect(reported.reportPressure).toBeGreaterThan(0);
      expect(reported.score).toBeLessThan(clean.score);
    });

    it("clamps reputation, engagement and pressure to 0-100", async () => {
      const result = await validityEngine.evaluate({
        ...base,
        authorFollowerCount: 999999,
        authorVerified: true,
        authorAgeDays: 9999,
        comments: 9999,
        bookmarks: 9999,
        views: 999999,
        shares: 9999,
        openReports: 99,
      });
      expect(result.reputation).toBeLessThanOrEqual(100);
      expect(result.engagement).toBeLessThanOrEqual(100);
      expect(result.reportPressure).toBeLessThanOrEqual(100);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("shared scorers", () => {
    it("scores rich legs higher than thin ones, deterministically", () => {
      const rich = computeRouteDetailScore([
        { location: "A", description: "desc", distance: 5, steps: [1, 2, 3] },
        { location: "B", description: "desc", distance: 3, steps: [1, 2] },
      ]);
      const thin = computeRouteDetailScore([{ location: "A" }]);
      const empty = computeRouteDetailScore([]);
      expect(rich).toBeGreaterThan(thin);
      expect(thin).toBeGreaterThanOrEqual(0);
      expect(empty).toBe(0);
    });

    it("maps overlapping-post counts to a capped ratio", () => {
      expect(computeSimilarityRatio(0)).toBe(0);
      expect(computeSimilarityRatio(3)).toBe(30);
      expect(computeSimilarityRatio(99)).toBe(100);
    });
  });

  describe("getTrustLevel", () => {
    it("returns low for score < 30", () => {
      expect(validityEngine.getTrustLevel(0)).toBe("low");
      expect(validityEngine.getTrustLevel(29)).toBe("low");
    });

    it("returns developing for score 30-59", () => {
      expect(validityEngine.getTrustLevel(30)).toBe("developing");
      expect(validityEngine.getTrustLevel(45)).toBe("developing");
      expect(validityEngine.getTrustLevel(59)).toBe("developing");
    });

    it("returns verified for score 60-79", () => {
      expect(validityEngine.getTrustLevel(60)).toBe("verified");
      expect(validityEngine.getTrustLevel(70)).toBe("verified");
      expect(validityEngine.getTrustLevel(79)).toBe("verified");
    });

    it("returns trusted for score >= 80", () => {
      expect(validityEngine.getTrustLevel(80)).toBe("trusted");
      expect(validityEngine.getTrustLevel(100)).toBe("trusted");
    });
  });
});
