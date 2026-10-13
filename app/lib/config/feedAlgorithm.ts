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
