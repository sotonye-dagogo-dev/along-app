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
