/**
 * Notification deep-routing (config-driven).
 * Every in-app notification click AND every push `notificationclick` resolve
 * through `resolveNotificationRoute` so a post notification opens the post,
 * a bug/report notification opens the right queue, a follow opens the actor
 * profile, and system notices fall back to /notifications — never to a
 * wrong profile. Non-breaking: unknown types fall back to /notifications.
 */

export interface NotificationRouteInput {
  type: string;
  postId?: string | null;
  commentId?: string | null;
  actorUserName?: string | null;
  metadata?: Record<string, unknown> | null;
}

function isNonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Resolve the click target for a notification. Priority:
 * 1. commentId → post with ?comment= anchor (COMMENT / MENTION).
 * 2. postId → /posts/:id (LIKE / DISLIKE / COMMENT / ROUTE_* / MODERATION…).
 * 3. type-specific fallbacks (FOLLOW → actor profile, VERIFIED → security
 *    tab, REPORT/MODERATION without post → /admin/bugs for admins else
 *    /notifications, WELCOME → /home, REVIEW → /about).
 * 4. generic fallback → /notifications (never a misleading profile).
 */
export function resolveNotificationRoute(input: NotificationRouteInput): string {
  const type = String(input.type ?? "").toUpperCase();
  const postId = isNonEmpty(input.postId) ? String(input.postId).trim() : null;
  const commentId = isNonEmpty(input.commentId) ? String(input.commentId).trim() : null;
  const actor = isNonEmpty(input.actorUserName) ? String(input.actorUserName).trim() : null;

  // Comment-anchored deep links win wherever a comment exists.
  if (commentId && postId && (type === "COMMENT" || type === "MENTION")) {
    return `/posts/${postId}?comment=${encodeURIComponent(commentId)}`;
  }
  if (postId) {
    // Any notification carrying a post opens that post (post about a post →
    // direct to the post; bug about a post → direct to the post).
    return `/posts/${postId}`;
  }

  switch (type) {
    case "FOLLOW":
      return actor ? `/profile/${actor}` : "/notifications";
    case "VERIFIED":
      // No post ⇒ email-verification prompt → security tab.
      return "/profile?tab=security";
    case "WELCOME":
      return "/home";
    case "REVIEW":
      // Platform-review thank-you mirror → the public reviews tape.
      return "/about";
    case "REWARD":
    case "BADGE":
      // Self-addressed points/tier notices → profile rewards context.
      return actor ? `/profile/${actor}` : "/notifications";
    case "REPORT":
    case "MODERATION": {
      // Bug/post reports without a linked post are queue items, not people.
      const bugId =
        input.metadata && typeof input.metadata.bugId === "string"
          ? (input.metadata.bugId as string)
          : null;
      if (bugId) return `/admin/bugs?highlight=${encodeURIComponent(bugId)}`;
      return "/notifications";
    }
    case "ACCOUNT_DELETION_REQUESTED":
    case "ACCOUNT_DELETION_CANCELLED":
    case "ACCOUNT_DELETION_COMPLETED":
      return "/notifications";
    default:
      return actor && (type === "MENTION" || type === "FOLLOW")
        ? `/profile/${actor}`
        : "/notifications";
  }
}
