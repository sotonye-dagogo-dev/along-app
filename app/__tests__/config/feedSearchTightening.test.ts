/**
 * Tightening-up: feed diversity + loose search + scrollbar + trust tooltip.
 *
 * - FEED_DIVERSITY_CONFIG / applyFeedDiversity: relevance-first shuffle with
 *   no same-poster back-to-back runs (pure, deterministic via injected rand).
 * - SEARCH_CONFIG / tokenizeSearchQuery / levenshteinDistance /
 *   termCoverage / scoreTextRelevance: Spotify-style looseness — tokenized,
 *   order-free, typo-tolerant, exact-first.
 * - SCROLLBAR_CONFIG: canonical scrollbar class names.
 * - TRUST_DISPLAY_CONFIG tooltip knobs: portal geometry + hover bridge.
 */
import {
  FEED_DIVERSITY_CONFIG,
  applyFeedDiversity,
} from "@/app/lib/config/feedAlgorithm";
import {
  SEARCH_CONFIG,
  tokenizeSearchQuery,
  levenshteinDistance,
  termCoverage,
  scoreTextRelevance,
} from "@/app/lib/config/search";
import { SCROLLBAR_CONFIG } from "@/app/lib/config/scrollbar";
import { TRUST_DISPLAY_CONFIG } from "@/app/lib/config/trustDisplay";

describe("feed diversity config", () => {
  it("declares sane anti-cluster defaults", () => {
    expect(FEED_DIVERSITY_CONFIG.maxConsecutiveFromSameAuthor).toBe(1);
    expect(FEED_DIVERSITY_CONFIG.lookaheadWindow).toBeGreaterThanOrEqual(1);
    expect(FEED_DIVERSITY_CONFIG.jitterWeight).toBeGreaterThanOrEqual(0);
  });

  it("breaks same-poster back-to-back runs without dropping rows", () => {
    const rows = [
      { id: "a1", score: 5, authorId: "alice" },
      { id: "a2", score: 4, authorId: "alice" },
      { id: "b1", score: 3, authorId: "bob" },
      { id: "b2", score: 2, authorId: "bob" },
    ];
    const out = applyFeedDiversity(rows, { jitterWeight: 0 }, () => 0.5);
    expect(out.map((r) => r.id).sort()).toEqual(["a1", "a2", "b1", "b2"]);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]?.authorId === out[i - 1]?.authorId).toBe(false);
    }
    // Highest relevance still leads.
    expect(out[0]?.id).toBe("a1");
  });

  it("degrades gracefully when separation is mathematically impossible", () => {
    // 3 alice + 1 bob: some adjacency is unavoidable — assert best effort
    // (the head run is broken) with zero drops.
    const rows = [
      { id: "a1", score: 5, authorId: "alice" },
      { id: "a2", score: 4, authorId: "alice" },
      { id: "b1", score: 3, authorId: "bob" },
      { id: "a3", score: 2, authorId: "alice" },
    ];
    const out = applyFeedDiversity(rows, { jitterWeight: 0 }, () => 0.5);
    expect(out.map((r) => r.id).sort()).toEqual(["a1", "a2", "a3", "b1"]);
    expect(out[0]?.id).toBe("a1");
    expect(out[1]?.authorId).toBe("bob");
  });

  it("leaves an already-diverse order untouched", () => {
    const rows = [
      { id: "a", score: 3, authorId: "alice" },
      { id: "b", score: 2, authorId: "bob" },
      { id: "c", score: 1, authorId: "cara" },
    ];
    expect(applyFeedDiversity(rows, { jitterWeight: 0 }, () => 0.5).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("degrades to relevance order when one author owns the window", () => {
    const rows = [
      { id: "a1", score: 3, authorId: "alice" },
      { id: "a2", score: 2, authorId: "alice" },
    ];
    expect(applyFeedDiversity(rows, { jitterWeight: 0 }, () => 0.5).map((r) => r.id)).toEqual([
      "a1",
      "a2",
    ]);
  });

  it("jitters near-ties for variety while tiers stay dominant", () => {
    const rows = [
      { id: "low", score: 1.0, authorId: "alice" },
      { id: "high", score: 1.05, authorId: "bob" },
    ];
    const seq = [1, 0];
    let i = 0;
    const rand = () => seq[i++ % seq.length] as number;
    // +jitter on low (1.5) vs -jitter on high (0.55): near-tie flips…
    const flipped = applyFeedDiversity(rows, { jitterWeight: 0.5 }, rand);
    expect(flipped[0]?.id).toBe("low");
    // …but a full tier gap never flips.
    const stable = applyFeedDiversity(
      [
        { id: "low", score: 1.0, authorId: "alice" },
        { id: "high", score: 9.0, authorId: "bob" },
      ],
      { jitterWeight: 0.5 },
      rand,
    );
    expect(stable[0]?.id).toBe("high");
  });

  it("never throws on garbage input", () => {
    expect(applyFeedDiversity([])).toEqual([]);
    expect(applyFeedDiversity(null as never)).toEqual([]);
  });
});

describe("loose search config", () => {
  it("declares connector stopwords and sane bounds", () => {
    expect(SEARCH_CONFIG.stopwords).toEqual(expect.arrayContaining(["to", "from", "a", "the"]));
    expect(SEARCH_CONFIG.minTermLength).toBe(2);
    expect(SEARCH_CONFIG.candidateCap).toBeGreaterThanOrEqual(50);
    expect(SEARCH_CONFIG.fuzzyMaxDistance).toBeGreaterThanOrEqual(1);
  });

  it("tokenizes route queries order-free, dropping connectors", () => {
    expect(tokenizeSearchQuery("Lekki to Ajah").terms).toEqual(["lekki", "ajah"]);
    expect(tokenizeSearchQuery("Ajah from Lekki").terms).toEqual(["ajah", "lekki"]);
    expect(tokenizeSearchQuery("  YABA! ").terms).toEqual(["yaba"]);
  });

  it("falls back to phrase-only for connector-only queries", () => {
    const q = tokenizeSearchQuery("A to B");
    expect(q.terms).toEqual([]);
    expect(q.phrase).toBe("a to b");
  });

  it("derives typo-recall head prefixes", () => {
    expect(SEARCH_CONFIG.typoRecallPrefix("lekki")).toBe("lek");
    expect(SEARCH_CONFIG.typoRecallPrefix("ajah")).toBe("aj");
    expect(SEARCH_CONFIG.typoRecallPrefix("yaba")).toBe("ya");
  });

  it("computes Levenshtein distance with early exit", () => {
    expect(levenshteinDistance("lekki", "lekki")).toBe(0);
    expect(levenshteinDistance("leki", "lekki")).toBe(1);
    expect(levenshteinDistance("abc", "xyz")).toBeGreaterThan(SEARCH_CONFIG.fuzzyMaxDistance);
  });

  it("covers terms exactly, fuzzily, or not at all", () => {
    const bag = { title: "Lekki Phase 1", tags: ["lekki"] };
    expect(termCoverage("lekki", bag).exact).toBe(true);
    const fuzzy = termCoverage("leki", bag);
    expect(fuzzy.exact).toBe(false);
    expect(fuzzy.fuzzySimilarity).toBeGreaterThanOrEqual(SEARCH_CONFIG.fuzzyMinSimilarity);
    expect(termCoverage("oshodi", bag).fuzzySimilarity).toBe(0);
  });

  it("ranks whole-phrase hits above partial term hits", () => {
    const q = tokenizeSearchQuery("Lekki to Ajah");
    const exact = scoreTextRelevance({ title: "Lekki to Ajah Express" }, q).total;
    const partial = scoreTextRelevance({ title: "Lekki market gist" }, q).total;
    expect(exact).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(0);
  });

  it("covers reversed phrasing equally (B from A == A to B)", () => {
    const q = tokenizeSearchQuery("Lekki to Ajah");
    const reversed = scoreTextRelevance({ title: "Ajah from Lekki" }, q);
    expect(reversed.coveredTerms).toBe(2);
    expect(reversed.total).toBeGreaterThan(0);
  });

  it("rewards typo tolerance while keeping exact on top", () => {
    const exact = scoreTextRelevance({ title: "Lekki Phase 1" }, tokenizeSearchQuery("Lekki Phase 1"));
    const typo = scoreTextRelevance({ title: "Lekki Phase 1" }, tokenizeSearchQuery("Leki Phase 1"));
    expect(typo.coveredTerms).toBe(2);
    expect(typo.total).toBeGreaterThan(0);
    expect(typo.total).toBeLessThan(exact.total);
  });
});

describe("scrollbar + trust tooltip registries", () => {
  it("declares canonical scrollbar class names", () => {
    expect(SCROLLBAR_CONFIG.classes.thin).toBe("scroll-thin");
    expect(SCROLLBAR_CONFIG.classes.stable).toBe("scroll-stable");
    expect(SCROLLBAR_CONFIG.geometry.thinWidthPx).toBeLessThan(
      SCROLLBAR_CONFIG.geometry.baseWidthPx,
    );
  });

  it("declares portal-safe tooltip geometry", () => {
    expect(TRUST_DISPLAY_CONFIG.tooltipWidth).toBe(240);
    expect(TRUST_DISPLAY_CONFIG.tooltipViewportMargin).toBeGreaterThanOrEqual(0);
    expect(TRUST_DISPLAY_CONFIG.tooltipMaxHeight).toBeGreaterThanOrEqual(120);
    expect(TRUST_DISPLAY_CONFIG.hoverCloseDelayMs).toBeGreaterThan(0);
  });
});
