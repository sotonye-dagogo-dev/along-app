/**
 * Central pagination registry — SINGLE source of truth for list page sizes.
 *
 * Every API route parses `limit` through `clampPageLimit(raw, surface)` and
 * every client builds its page-size query param from this config, so a page
 * size is tuned in exactly one place instead of drifting across `|| 10` /
 * `|| 20` literals and hardcoded `"limit=20"` strings.
 *
 * Contract:
 * - `defaultLimit` — used when the param is absent or garbage (never throws).
 * - `maxLimit` — hard clamp; callers may request more but always receive ≤ max.
 * - Values are intentionally conservative: first pages must stay cheap on
 *   serverless (Prisma take) and on mobile data.
 */

export interface PaginationSurfaceConfig {
  /** Page size when the caller omits the param (or sends garbage). */
  defaultLimit: number;
  /** Hard upper clamp for this surface. */
  maxLimit: number;
}

export const PAGINATION_CONFIG = {
  /** Fallback surface for any list not named below. */
  default: { defaultLimit: 20, maxLimit: 50 },
  /** Scored feed (`/api/posts/feed`) — guest path + client stream default. */
  feed: { defaultLimit: 20, maxLimit: 50 },
  /** Post lists (`/api/posts`) — profile tabs, lists, explore pin fetches. */
  posts: { defaultLimit: 20, maxLimit: 50 },
  /** Typeahead-sized search pages (`/api/search`). */
  search: { defaultLimit: 10, maxLimit: 50 },
  /** Notifications list (badge poller asks for 1 — see `badge`). */
  notifications: { defaultLimit: 20, maxLimit: 50 },
  /** Comment threads (`/api/posts/[id]/comments`). */
  comments: { defaultLimit: 20, maxLimit: 50 },
  /** Bookmark list (`/api/bookmarks`). */
  bookmarks: { defaultLimit: 20, maxLimit: 50 },
  /** Public reviews (`/api/reviews`). */
  reviews: { defaultLimit: 20, maxLimit: 50 },
  /** Explore map pin fetch — wants the most pins the posts surface allows. */
  explore: { defaultLimit: 50, maxLimit: 50 },
  /** Admin cursor tables (posts/users/bugs/reviews/audit/deletions). */
  admin: { defaultLimit: 20, maxLimit: 100 },
  /** Unread-count poller (`/api/notifications?limit=1`). */
  badge: { defaultLimit: 1, maxLimit: 1 },
  /** Follower/following lists (`/api/users/[id]/followers|following`). */
  userLists: { defaultLimit: 20, maxLimit: 50 },
} as const satisfies Record<string, PaginationSurfaceConfig>;

export type PaginationSurface = keyof typeof PAGINATION_CONFIG;

/**
 * Clamp a raw `limit` query param for a surface. Never throws; absent,
 * non-numeric, zero or negative input falls back to the surface default.
 *
 *   clampPageLimit(searchParams.get("limit"), "feed")  // "10" → 10 (honored), "999" → 50
 *   clampPageLimit(null, "feed")                       // 20 (surface default)
 *   clampPageLimit("9999", "admin")                    // 100
 */
export function clampPageLimit(
  raw: string | null | undefined | number,
  surface: PaginationSurface = "default",
): number {
  const { defaultLimit, maxLimit } = PAGINATION_CONFIG[surface];
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return defaultLimit;
  return Math.min(Math.floor(n), maxLimit);
}
