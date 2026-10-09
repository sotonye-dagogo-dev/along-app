import {
  REVIEWS_CONFIG,
  insertReviewCtaPanels,
  reviewAuthorName,
  type ReviewStreamEntry,
} from "@/app/lib/config/reviews";

const ids = (entries: ReviewStreamEntry<{ id: string }>[]): string[] =>
  entries.map((e) => (e.kind === "cta" ? "CTA" : e.review.id));

describe("reviews config", () => {
  it("bounds ratings and comment length", () => {
    expect(REVIEWS_CONFIG.minRating).toBe(1);
    expect(REVIEWS_CONFIG.maxRating).toBe(5);
    expect(REVIEWS_CONFIG.maxCommentLength).toBeGreaterThan(0);
    expect(REVIEWS_CONFIG.ctaEvery).toBe(10);
  });

  it("places a single CTA at the end when reviews <= 10", () => {
    const reviews = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}` }));
    expect(ids(insertReviewCtaPanels(reviews))).toEqual([
      "r0", "r1", "r2", "r3", "r4", "r5", "r6", "CTA",
    ]);
  });

  it("places a single CTA at the end for exactly 10", () => {
    const reviews = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` }));
    const stream = ids(insertReviewCtaPanels(reviews));
    expect(stream.filter((x) => x === "CTA")).toHaveLength(1);
    expect(stream[stream.length - 1]).toBe("CTA");
  });

  it("places a single CTA at the midpoint when 10 < n < 20 (14 → after 7)", () => {
    const reviews = Array.from({ length: 14 }, (_, i) => ({ id: `r${i}` }));
    const stream = ids(insertReviewCtaPanels(reviews));
    expect(stream.filter((x) => x === "CTA")).toHaveLength(1);
    expect(stream.indexOf("CTA")).toBe(7); // after the 7th review
  });

  it("places a single CTA at the midpoint for 11 (after 5)", () => {
    const reviews = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}` }));
    const stream = ids(insertReviewCtaPanels(reviews));
    expect(stream.filter((x) => x === "CTA")).toHaveLength(1);
    expect(stream.indexOf("CTA")).toBe(5);
  });

  it("places a CTA after every 10 reviews when n >= 20", () => {
    const reviews = Array.from({ length: 25 }, (_, i) => ({ id: `r${i}` }));
    const stream = ids(insertReviewCtaPanels(reviews));
    expect(stream.filter((x) => x === "CTA")).toHaveLength(2);
    expect(stream.indexOf("CTA")).toBe(10);
    expect(stream.lastIndexOf("CTA")).toBe(21);
  });

  it("renders a CTA-only stream when empty", () => {
    expect(insertReviewCtaPanels([])).toEqual([{ kind: "cta" }]);
  });

  it("never crashes on anonymized (deleted) authors", () => {
    expect(reviewAuthorName(null)).toBe("Deleted User");
    expect(reviewAuthorName(undefined)).toBe("Deleted User");
    expect(reviewAuthorName({ firstName: "Deleted", lastName: "User", userName: "deleted-abc" })).toBe("Deleted User");
    expect(reviewAuthorName({ firstName: "Ada", lastName: "Obi", userName: "ada" })).toBe("Ada Obi");
    expect(reviewAuthorName({ firstName: null, lastName: null, userName: "ada" })).toBe("@ada");
  });
});
