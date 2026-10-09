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
  /** Notification list cache is per filter variant — see NOTIFICATION_FILTERS. */
  notifications: (userId: string, filter: string = "all") => `notifications:${userId}:${filter}`,
  /** Every notifications cache key for a user (delete all on any write). */
  notificationsAll: (userId: string) =>
    ["all", "unread", "rewards"].map((f) => `notifications:${userId}:${f}`),
  analytics: (userId: string, period: string) => `analytics:${userId}:${period}`,
  /** Keyless map proxy caches (server-side read-through). */
  mapsRoute: (signature: string) => `maps:route:${signature}`,
  mapsGeocode: (query: string, limit: number) => `maps:geocode:${query.toLowerCase()}:${limit}`,
  mapsReverse: (lat: number, lng: number) => `maps:reverse:${lat.toFixed(4)},${lng.toFixed(4)}`,
} as const;

/** Filter values the notifications endpoint accepts (must match notificationsAll). */
export const NOTIFICATION_FILTERS = ["all", "unread", "rewards"] as const;
