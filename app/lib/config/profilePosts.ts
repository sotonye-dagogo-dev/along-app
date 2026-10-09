/**
 * Profile-posts consistency registry (config-driven, metadata-driven).
 *
 * Covers three tightening items:
 * 1. Avatar consistency — profile tabs must render the same avatar as
 *    everywhere else (feed, post detail). The API already selects
 *    `avatar` + `avatarConfig`; pages must forward them (never rebuild a
 *    partial user), falling back to the profile header only when the row's
 *    author matches the profile owner.
 * 2. Interaction consistency — like/bookmark state on profile cards must
 *    match the feed. `GET /api/posts` enriches rows viewer-scoped, and
 *    clients mirror every mutation into `feedStream.applyInteraction` so
 *    both surfaces read the same cache.
 * 3. Verified-pill styling — design-token classes (visible in both themes).
 */
export const PROFILE_POSTS_CONFIG = {
  /** Forward these user fields from API rows into PostCard (never drop). */
  avatarFields: ["avatar", "avatarConfig"] as const,
  /** Interaction fields the list API enriches viewer-scoped. */
  interactionFields: ["_isLiked", "_isBookmarked"] as const,
  /** Design-token pill classes for the Email & Security verified tag. */
  verifiedPillClass:
    "text-[11px] px-2 py-0.5 rounded-full bg-success text-success-text border border-success-border font-semibold",
  unverifiedPillClass:
    "text-[11px] px-2 py-0.5 rounded-full bg-warning text-warning-text font-semibold",
  /** Cache-key builders so profile tabs share invalidation with the feed. */
  cacheKeys: {
    ownTab: (userId: string, tab: string) => `profile-tab:${userId}:${tab}`,
    otherTab: (profileId: string, tab: string) => `profile-tab:${profileId}:${tab}`,
  },
  /** TTL seconds for profile tab lists (matches existing 120s). */
  tabTtlSec: 120,
} as const;

export type ProfilePostsConfig = typeof PROFILE_POSTS_CONFIG;
