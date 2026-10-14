import type { FeedAlgorithmConfig } from "@/app/lib/types";

export const DEFAULT_FEED_CONFIG: FeedAlgorithmConfig = {
  followingWeight: 0.7,
  matchingTagsWeight: 0.2,
  trendingWeight: 0.1,
  locationBonus: 0.15,
  cacheTtlSeconds: 300,
  pageSize: 10,
};

/**
 * Feed stream hardening knobs (client pagination + polling + dedup).
 * Config-driven so arrangement/rendering policy lives in one place rather
 * than scattered magic numbers in feedStream.ts / home/page.tsx.
 * Admin-overridable via SiteConfig key "feedStream" (shallow-merged).
 */
export const FEED_STREAM_CONFIG = {
  /** Page size for /api/posts/feed requests issued by the stream. */
  pageSize: 10,
  /** Background poll interval (ms) for new-post detection. */
  pollIntervalMs: 30000,
  /** Cached feed younger than this serves without a network request. */
  freshSec: 45,
  /** How long a stale feed stays available for instant paint. */
  retentionSec: 1800,
  /** Cap on ids sent as `exclude` for stable score-order pagination. */
  maxExcludeIds: 200,
} as const;

export type FeedStreamConfig = typeof FEED_STREAM_CONFIG;

/**
 * "New posts" floating prompt registry (config-driven, metadata-driven).
 *
 * Single source of truth for the feed's refresh pill so behaviour is
 * consistent and tunable without touching components: visibility
 * thresholds, auto-dismiss window (30–60s per spec), and re-prompt
 * throttling after a click.
 */
export const FEED_NEW_POSTS_PROMPT_CONFIG = {
  /** Show the pill when scrolled past this Y (px) or reading depth. */
  nearTopPx: 80,
  /** Fraction of page scrolled that counts as "reading deep". */
  deepDepth: 0.12,
  /** Auto-dismiss a stale pill after this many seconds (30–60s band). */
  autoDismissSec: 45,
  /** Suppress re-prompt for this long after the pill is clicked. */
  throttleAfterClickSec: 45,
  /** Pill copy builders (count-aware, no hardcoding in components). */
  label: (count: number) => `${count} new ${count === 1 ? "post" : "posts"}`,
} as const;

export type FeedNewPostsPromptConfig = typeof FEED_NEW_POSTS_PROMPT_CONFIG;

/**
 * Feed diversity registry — keeps relevance priority while breaking
 * same-poster back-to-back runs and adding a breath of shuffle.
 *
 * Pipeline (see `applyFeedDiversity` + feedService wiring): a tiny symmetric
 * jitter re-orders near-ties for variety, then a bounded lookahead pass
 * swaps in the nearest different-author post whenever placing the next row
 * would extend a same-author run. Worst case (one author owns the whole
 * window) degrades gracefully to relevance order — never drops rows.
 * Admin-overridable via SiteConfig key "feedDiversity" (shallow-merged,
 * validated, never throws).
 */
export interface FeedDiversityKnobs {
  /** Max consecutive rows from the same author before a swap is attempted. */
  maxConsecutiveFromSameAuthor: number;
  /** How far ahead to look for a different-author swap candidate. */
  lookaheadWindow: number;
  /** Shuffle amplitude: each score gets ±jitterWeight uniform noise. */
  jitterWeight: number;
}

export const FEED_DIVERSITY_CONFIG: FeedDiversityKnobs = {
  /** Max consecutive rows from the same author before a swap is attempted. */
  maxConsecutiveFromSameAuthor: 1,
  /** How far ahead to look for a different-author swap candidate. */
  lookaheadWindow: 8,
  /**
   * Shuffle amplitude: each score gets ±jitterWeight uniform noise, so only
   * near-ties reorder while follow/tag/trending tiers stay dominant.
   */
  jitterWeight: 0.02,
};

export type FeedDiversityConfig = FeedDiversityKnobs;

export interface DiversityScoredRow {
  score: number;
  authorId: string;
}

/**
 * Pure relevance-preserving diversifier: jitter near-ties, then greedily
 * place rows so no more than `maxConsecutiveFromSameAuthor` adjacent rows
 * share an author (lookahead-bounded swap; original order wins ties).
 * `rand` is injectable so tests stay deterministic. Never throws and never
 * drops or duplicates rows — worst case returns the input order.
 */
export function applyFeedDiversity<T extends DiversityScoredRow>(
  rows: readonly T[],
  overrides?: Partial<FeedDiversityConfig>,
  rand: () => number = Math.random,
): T[] {
  try {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (list.length < 2) return list;
    const maxConsecutive =
      Number.isFinite(overrides?.maxConsecutiveFromSameAuthor) &&
      (overrides?.maxConsecutiveFromSameAuthor as number) >= 1
        ? Math.floor(overrides?.maxConsecutiveFromSameAuthor as number)
        : FEED_DIVERSITY_CONFIG.maxConsecutiveFromSameAuthor;
    const window =
      Number.isFinite(overrides?.lookaheadWindow) &&
      (overrides?.lookaheadWindow as number) >= 1
        ? Math.floor(overrides?.lookaheadWindow as number)
        : FEED_DIVERSITY_CONFIG.lookaheadWindow;
    const jitter =
      Number.isFinite(overrides?.jitterWeight) &&
      (overrides?.jitterWeight as number) >= 0
        ? (overrides?.jitterWeight as number)
        : FEED_DIVERSITY_CONFIG.jitterWeight;

    // Jittered copy (stable: original index breaks jitter ties).
    const jittered = list.map((row, index) => {
      let noise = 0;
      try {
        noise = (rand() * 2 - 1) * jitter;
      } catch {
        noise = 0;
      }
      const score = typeof row.score === "number" && Number.isFinite(row.score) ? row.score : 0;
      return { row, score: score + noise, index };
    });
    jittered.sort((a, b) => b.score - a.score || a.index - b.index);

    // Greedy anti-cluster placement with bounded lookahead swap.
    const placed: typeof jittered = [];
    const pool = [...jittered];
    let runAuthor: string | null = null;
    let runLength = 0;
    while (pool.length > 0) {
      let pick = 0;
      const headAuthor = String(pool[0]?.row.authorId ?? "");
      if (runAuthor !== null && headAuthor === runAuthor && runLength >= maxConsecutive) {
        const horizon = Math.min(pool.length, window + 1);
        for (let i = 1; i < horizon; i++) {
          if (String(pool[i]?.row.authorId ?? "") !== runAuthor) {
            pick = i;
            break;
          }
        }
      }
      const [next] = pool.splice(pick, 1);
      if (!next) break;
      const author = String(next.row.authorId ?? "");
      if (author === runAuthor) {
        runLength += 1;
      } else {
        runAuthor = author;
        runLength = 1;
      }
      placed.push(next);
    }
    return placed.map((p) => p.row);
  } catch {
    return Array.isArray(rows) ? [...rows] : [];
  }
}
