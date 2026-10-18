import { PAGINATION_CONFIG } from "./pagination";

export const CACHE_TTL = {
  feed: 300,
  post: 600,
  userProfile: 300,
  suggestions: 1800,
  validity: 1800,
  searchResults: 120,
  leaderboard: 600,
  siteConfig: 3600,
  notifications: 60,
  analytics: 3600,
  mapsRoute: 86400,
  mapsGeocode: 2592000,
  mapsReverse: 2592000,
} as const;

export const CACHE_KEYS = {
  feed: (userId: string, cursor?: string) => `feed:${userId}:${cursor ?? "start"}`,
  post: (postId: string) => `post:${postId}`,
  userProfile: (userId: string) => `user:${userId}:profile`,
  suggestions: (userId: string) => `suggestions:${userId}`,
  validity: (postId: string) => `validity:${postId}`,
  search: (query: string, type: string) => `search:${type}:${query.toLowerCase()}`,
  leaderboard: () => "leaderboard:invites",
  siteConfig: (key: string) => `siteConfig:${key}`,
  /**
   * Notification list cache is per filter variant AND effective page size —
   * the badge poller reads `?limit=1` (badge surface) while the page reads the
   * default, and a shared key would let the 1-item payload be served to the
   * page for the whole TTL. `limit` defaults to the notifications surface
   * default so the two real callers are page-default and badge.
   */
  notifications: (
    userId: string,
    filter: string = "all",
    limit: number = PAGINATION_CONFIG.notifications.defaultLimit,
  ) => `notifications:${userId}:${filter}:${limit}`,
  /** Every notifications cache key a user's list may be cached under (delete all on any write). */
  notificationsAll: (userId: string) =>
    NOTIFICATION_FILTERS.flatMap((filter) =>
      NOTIFICATION_CACHE_LIMITS.map((limit) => `notifications:${userId}:${filter}:${limit}`)
    ),
  analytics: (userId: string, period: string) => `analytics:${userId}:${period}`,
  /** Keyless map proxy caches (server-side read-through). */
  mapsRoute: (signature: string) => `maps:route:${signature}`,
  mapsGeocode: (query: string, limit: number) => `maps:geocode:${query.toLowerCase()}:${limit}`,
  mapsReverse: (lat: number, lng: number) => `maps:reverse:${lat.toFixed(4)},${lng.toFixed(4)}`,
} as const;

/** Filter values the notifications endpoint accepts (must match notificationsAll). */
export const NOTIFICATION_FILTERS = ["all", "unread", "rewards"] as const;

/**
 * Effective page sizes the notifications list may be cached under: the
 * notifications-page default and the badge poller's `?limit=1`. Every one of
 * these × every filter is enumerated by `CACHE_KEYS.notificationsAll`, so the
 * route only caches sizes this list covers and a write can never leave a
 * stale key behind.
 */
export const NOTIFICATION_CACHE_LIMITS: readonly number[] = [
  PAGINATION_CONFIG.notifications.defaultLimit,
  PAGINATION_CONFIG.badge.defaultLimit,
];
