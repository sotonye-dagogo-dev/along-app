import type { FeedAlgorithmConfig } from "@/app/lib/types";

export const DEFAULT_FEED_CONFIG: FeedAlgorithmConfig = {
  followingWeight: 0.7,
  matchingTagsWeight: 0.2,
  trendingWeight: 0.1,
  /**
   * Own-posts inclusion weight (Sprint 59): the viewer's own posts are
   * fetched as an explicit pool and scored here (following-level) so the
   * feed never buries — let alone excludes — self posts or non-followed
   * users' posts (those arrive via trending/tag/recent pools). Stored
   * SiteConfig `feedAlgorithm` rows merge by spread, so rows written before
   * this knob existed keep working (default applies for the missing key).
   */
  ownPostsWeight: 0.7,
  /**
   * Out-of-network discovery weight (Sprint 60): recent posts from users
   * the viewer doesn't follow are fetched as an explicit pool (no 7-day
   * window, no engagement ordering, no tag prerequisite) and scored here.
   * Below followingWeight (follow affinity preserved), well above trending
   * (0.1) so discovery actually surfaces. Stored SiteConfig
   * `feedAlgorithm` rows merge by spread, so rows written before this knob
   * existed keep working (feedService guards non-finite to this default).
   */
  discoveryWeight: 0.5,
  /**
   * Open-request boost (Sprint 60): open route requests from non-followed
   * users earn this on top of discoveryWeight, keeping feed parity with the
   * suggestions carousel (which always shows recent open requests). Same
   * spread-merge / non-finite-guard contract as discoveryWeight.
   */
  openRequestWeight: 0.6,
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
 * First-load readiness registry (config-driven, metadata-driven).
 *
 * The feed paints in one settled snapshot instead of flashing a stale order
 * and reshuffling it once or twice while the user scrolls: the home page
 * holds the loading skeleton until the single geo-aware initial fetch
 * resolves. The passive geolocation fix arrives asynchronously after mount,
 * so the first load waits for it up to `geoWaitMs` — one scored order ever
 * paints, instead of a non-geo list followed by a silent geo re-rank.
 */
export const FEED_FIRST_LOAD_CONFIG = {
  /** Max wait for the passive geolocation fix before the first fetch (ms). */
  geoWaitMs: 1500,
  /** Skeleton cards rendered while the first snapshot settles. */
  skeletonCount: 3,
} as const;

export type FeedFirstLoadConfig = typeof FEED_FIRST_LOAD_CONFIG;

/**
 * Deterministic seeded PRNG (mulberry32 over a string hash). Feeds the
 * diversity jitter so identical score sets produce identical near-tie
 * orders across cached / fresh / geo fetches within the same seed window —
 * without it, `Math.random()` reshuffles near-ties on every fetch and the
 * list visibly reorganizes after paint even when nothing changed.
 * Pure and never throws; falls back to a fixed stream on bad input.
 */

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

/** SiteConfig key + admin card metadata for the feed-diversity knobs. */
export const FEED_DIVERSITY_CONFIG_KEY = "feedDiversity" as const;

export const FEED_DIVERSITY_CONFIG_META = {
  title: "Feed Diversity",
  description:
    "Breaks same-author runs and adds a breath of shuffle without dropping rows. Worst case degrades to relevance order.",
  fields: [
    {
      id: "maxConsecutiveFromSameAuthor",
      label: "Max consecutive from same author",
      hint: "Whole number, 1 or more. 1 breaks every back-to-back run.",
      min: 1,
      max: 10,
      step: 1,
    },
    {
      id: "lookaheadWindow",
      label: "Lookahead window",
      hint: "Whole number, 1 or more. How far ahead to look for a swap candidate.",
      min: 1,
      max: 30,
      step: 1,
    },
    {
      id: "jitterWeight",
      label: "Jitter weight",
      hint: "0 or more (0 = off). Only near-ties reorder; keep small (e.g. 0.02).",
      min: 0,
      max: 1,
      step: 0.005,
    },
  ],
} as const;

/**
 * Normalize a stored `feedDiversity` value to valid knobs (never throws —
 * bad shapes degrade to defaults, never to a crash). Shared by the feed
 * resolver and the admin Studio card so both read the same truth.
 */
export function normalizeFeedDiversityConfig(raw: unknown): FeedDiversityConfig {
  try {
    const stored = (raw ?? {}) as Partial<FeedDiversityConfig>;
    const pick = (v: unknown, fallback: number): number =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
    return {
      maxConsecutiveFromSameAuthor: Math.max(
        1,
        Math.floor(pick(stored.maxConsecutiveFromSameAuthor, FEED_DIVERSITY_CONFIG.maxConsecutiveFromSameAuthor)),
      ),
      lookaheadWindow: Math.max(
        1,
        Math.floor(pick(stored.lookaheadWindow, FEED_DIVERSITY_CONFIG.lookaheadWindow)),
      ),
      jitterWeight: pick(stored.jitterWeight, FEED_DIVERSITY_CONFIG.jitterWeight),
    };
  } catch {
    return { ...FEED_DIVERSITY_CONFIG };
  }
}

/**
 * Validate a candidate `feedDiversity` value for admin writes. Returns an
 * error message string when invalid, null when acceptable. Pure, never
 * throws — the API maps non-null to a 400 with this message.
 */
export function validateFeedDiversityConfigValue(raw: unknown): string | null {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return "feedDiversity must be an object with maxConsecutiveFromSameAuthor, lookaheadWindow, jitterWeight";
    }
    const v = raw as Record<string, unknown>;
    const maxC = v.maxConsecutiveFromSameAuthor;
    const look = v.lookaheadWindow;
    const jit = v.jitterWeight;
    if (maxC !== undefined && (typeof maxC !== "number" || !Number.isFinite(maxC) || maxC < 1)) {
      return "maxConsecutiveFromSameAuthor must be a number >= 1";
    }
    if (look !== undefined && (typeof look !== "number" || !Number.isFinite(look) || look < 1)) {
      return "lookaheadWindow must be a number >= 1";
    }
    if (jit !== undefined && (typeof jit !== "number" || !Number.isFinite(jit) || jit < 0)) {
      return "jitterWeight must be a number >= 0";
    }
    return null;
  } catch {
    return "Invalid feedDiversity value";
  }
}

export type FeedDiversityConfig = FeedDiversityKnobs;

export interface DiversityScoredRow {
  score: number;
  authorId: string;
}

export function hashSeedString(seed: unknown): number {
  try {
    const s = typeof seed === "string" ? seed : String(seed ?? "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  } catch {
    return 0;
  }
}

export function seededRand(seed: unknown): () => number {
  let state = hashSeedString(seed);
  // mulberry32; fixed stream when the hash collapses to 0.
  if (state === 0) state = 0x9e3779b9;
  return () => {
    try {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    } catch {
      return 0.5;
    }
  };
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
