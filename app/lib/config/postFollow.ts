import { UserPlus, UserCheck } from "lucide-react";

/**
 * Post-card inline follow configuration (config-driven, zero app deps).
 *
 * Directive (Sprint 59): every post card carries a quick-follow affordance
 * beside the author identity — an icon-only button on small screens
 * (UserPlus when not following, UserCheck momentarily after following)
 * and a Follow/Unfollow text button on larger screens. When the viewer
 * already follows the author the affordance is hidden entirely (directive
 * preference over a disabled "Following" chip), and it never renders on
 * the viewer's own posts. All labels/classes/icons live here so post
 * surfaces stay metadata-driven.
 */
export interface PostFollowConfig {
  /** Icon shown when the viewer does not follow the author (mobile). */
  followIcon: typeof UserPlus;
  /** Icon shown briefly after a successful follow, before hiding. */
  followingIcon: typeof UserCheck;
  /** Desktop text labels. */
  followLabel: string;
  followingLabel: string;
  /** Hide the affordance once the viewer follows (directive preference). */
  hideWhenFollowing: boolean;
  /** Never render on the viewer's own posts. */
  hideOnOwnPost: boolean;
  /** Button classes for the icon (mobile) variant — icon only. */
  iconButtonClass: string;
  /**
   * Button classes for a standalone icon button (same visuals as the mobile
   * icon, but visible on all breakpoints — for non-card surfaces).
   */
  iconStandaloneClass: string;
  /** Button classes for the text (desktop) variant. */
  textButtonClass: string;
  /** Icon pixel size for the mobile variant. */
  iconSize: number;
  /** Follow-status endpoint path builder (GET returns `{ following }`). */
  statusPath: (authorId: string) => string;
  /** Memory-cache TTL (seconds) for follow-status reads. */
  statusCacheTtlSec: number;
}

export const POST_FOLLOW_CONFIG: PostFollowConfig = {
  followIcon: UserPlus,
  followingIcon: UserCheck,
  followLabel: "Follow",
  followingLabel: "Following",
  hideWhenFollowing: true,
  hideOnOwnPost: true,
  iconButtonClass:
    "sm:hidden shrink-0 inline-flex items-center justify-center w-7 h-7 radius-md border border-border bg-transparent text-primary cursor-pointer font-sans transition-colors duration-fast hover:bg-primary-muted hover:border-primary-muted",
  iconStandaloneClass:
    "shrink-0 inline-flex items-center justify-center w-7 h-7 radius-md border border-border bg-transparent text-primary cursor-pointer font-sans transition-colors duration-fast hover:bg-primary-muted hover:border-primary-muted",
  textButtonClass:
    "hidden sm:inline-flex shrink-0 items-center h-7 px-3 rounded-md text-xs font-semibold border border-primary bg-transparent text-primary cursor-pointer font-sans transition-colors duration-fast hover:bg-primary hover:text-white",
  iconSize: 14,
  statusPath: (authorId: string) => `/api/users/${encodeURIComponent(authorId)}/follow`,
  statusCacheTtlSec: 120,
};
