/**
 * Central notification creation. All notification writes go through here so
 * fan-out shape (1 Notification + N NotificationRecipient rows) and error
 * handling stay consistent. Never throws — notifications are non-critical.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import type { RouteRequestAudienceConfig } from "@/app/lib/config/routeRequestAudience";

export interface CreateNotificationInput {
  type:
    | "LIKE"
    | "DISLIKE"
    | "COMMENT"
    | "FOLLOW"
    | "MENTION"
    | "WELCOME"
    | "ROUTE_REQUEST"
    | "ROUTE_RESPONSE"
    | "NEW_ROUTE"
    | "REWARD"
    | "BADGE"
    | "VERIFIED"
    | "REPORT"
    | "MODERATION"
    | "ACCOUNT_DELETION_REQUESTED"
    | "ACCOUNT_DELETION_CANCELLED"
    | "ACCOUNT_DELETION_COMPLETED";
  actorId: string;
  message: string;
  postId?: string;
  commentId?: string;
  /**
   * Deep-link context persisted on the notification (additive/nullable) and
   * mirrored to push. `{ bugId }` makes a REPORT assignment open the exact
   * report in the admin queue (`resolveNotificationRoute`).
   */
  metadata?: Record<string, unknown> | null;
  /** Users who receive this notification. Duplicates/self are filtered out. */
  recipientIds: string[];
  /**
   * Allow a self-notification (actor === recipient). Only used by WELCOME,
   * which is addressed to the new user themselves; every other type keeps
   * the self-filter so users never notify themselves.
   */
  allowSelf?: boolean;
}

/**
 * Creates one Notification with a recipient row per user.
 * Returns the notification id, or null if creation failed / no recipients.
 *
 * Preference-gated (non-breaking): recipient ids are filtered through the
 * owners' effective notification preferences first — a missing prefs row or
 * NULL/partial JSON resolves per-key to `true` (current behaviour), so
 * existing users keep receiving everything until they opt out in the
 * Notifications settings modal. WELCOME/allowSelf bypasses the self-filter
 * but still honours prefs (defaults allow it). Never throws.
 */
export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  const deduped = [...new Set(input.recipientIds.filter(Boolean))].filter(
    (id) => input.allowSelf || id !== input.actorId
  );
  if (deduped.length === 0) return null;
  let recipientIds = deduped;
  try {
    const { filterRecipientsByPreferences } = await import(
      "@/app/lib/services/notificationPreferenceService"
    );
    recipientIds = await filterRecipientsByPreferences(deduped, input.type);
  } catch {
    recipientIds = deduped;
  }
  if (recipientIds.length === 0) return null;

  try {
    const notification = await prisma.notification.create({
      data: {
        type: input.type,
        actorId: input.actorId,
        message: input.message,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
        ...(input.metadata && Object.keys(input.metadata).length > 0
          ? { metadata: input.metadata as unknown as Prisma.InputJsonValue }
          : {}),
        recipients: { create: recipientIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
    await invalidateNotificationCaches(recipientIds);
    // Push mirror: every in-app notification also fans out to Web Push
    // (same copy family as emailed notifications). Fire-and-forget, never
    // throws, never delays the response — runs after the write commits.
    void import("@/app/lib/services/pushSender")
      .then(({ fanOutPush }) =>
        fanOutPush({
          type: input.type,
          message: input.message,
          postId: input.postId,
          commentId: input.commentId,
          metadata: input.metadata ?? undefined,
          recipientIds,
        }),
      )
      .catch(() => {});
    return notification.id;
  } catch (error) {
    console.error("[notificationService] createNotification failed:", error);
    Sentry.captureException(error);
    return null;
  }
}

/** Clears the Redis list cache for every recipient (all filter variants). Never throws. */
export async function invalidateNotificationCaches(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const { redis } = await import("@/app/lib/db/redis");
    const { CACHE_KEYS } = await import("@/app/lib/config");
    const keys = userIds.flatMap((id) => CACHE_KEYS.notificationsAll(id));
    await redis.del(...keys);
  } catch { /* cache invalidation is non-critical */ }
}

/** Follower ids of a user (the fan-out set used for new-route posts). */
export async function getFollowerIds(userId: string): Promise<string[]> {
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });
    return followers.map((f) => f.followerId);
  } catch (error) {
    console.error("[notificationService] getFollowerIds failed:", error);
    return [];
  }
}

/**
 * Community-wide audience for ROUTE_REQUEST notifications (config-driven).
 * Followers are guaranteed first, then the net widens to recent community
 * members up to the configured cap — so a request notifies recipients whether
 * or not any follow relationship exists. Self is always excluded; deleted
 * accounts are excluded per config. Never throws (falls back to followers).
 *
 * Optimistic location filtering (privacy-safe, non-breaking):
 * - The requester's location is EPHEMERAL: `opts.requestLat/requestLng` are
 *   used only for this fan-out computation and are never written to the DB,
 *   never logged, never returned to clients. Valid sources are the request's
 *   own start coords (route geometry, already stored as the post) or an
 *   explicit one-shot browser fix attached to the POST body with consent.
 * - Recipient proximity is derived server-side ONLY from the already-stored,
 *   consented, nullable `User.lastKnownLat/Lng` (used today for the feed
 *   nearby boost). Raw coords are never exposed — only a boolean within-radius
 *   test runs in memory; no coordinates leave the server.
 * - When filtering is enabled, coords are valid, and at least
 *   `location.minNearby` recipients fall inside `location.radiusKm`, only the
 *   nearby subset is returned (capped). Otherwise the fan-out falls back
 *   gracefully to the full community audience — missing/stale location data
 *   degrades to "everyone gets notified", never to silence or an error.
 * - Preference-gated: the final list excludes users who opted out of route
 *   requests (missing prefs = opted in = current behaviour).
 */
export interface RouteRequestAudienceOptions {
  /** Ephemeral request location (never persisted). Both required to apply. */
  requestLat?: number | null;
  requestLng?: number | null;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function audienceHaversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sLat = Math.sin(dLat / 2);
  const sLng = Math.sin(dLng / 2);
  const v =
    sLat * sLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sLng * sLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}

function validRequestFix(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null; // null-island sentinel, never a real request
  return { lat, lng };
}

export async function getRouteRequestAudienceIds(
  actorId: string,
  opts?: RouteRequestAudienceOptions
): Promise<string[]> {
  try {
    const {
      DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG,
      DEFAULT_ROUTE_REQUEST_LOCATION_FILTER,
      normalizeRouteRequestAudienceConfig,
      ROUTE_REQUEST_AUDIENCE_CONFIG_KEY,
    } = await import("@/app/lib/config/routeRequestAudience");
    let config: RouteRequestAudienceConfig = {
      ...DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG,
      location: { ...DEFAULT_ROUTE_REQUEST_LOCATION_FILTER },
    };
    try {
      const { getSiteConfig } = await import("@/app/lib/utils/siteConfig");
      const stored = await getSiteConfig<unknown>(ROUTE_REQUEST_AUDIENCE_CONFIG_KEY, {});
      config = normalizeRouteRequestAudienceConfig(stored, config);
    } catch {
      /* hardcoded fallback wins when SiteConfig is unreadable */
    }
    const followers = await getFollowerIds(actorId);
    if (config.mode === "followers") {
      try {
        const { filterRecipientsByPreferences } = await import(
          "@/app/lib/services/notificationPreferenceService"
        );
        return await filterRecipientsByPreferences(followers, "ROUTE_REQUEST");
      } catch {
        return followers;
      }
    }
    const cap = Math.max(1, Math.floor(config.maxRecipients));
    const seen = new Set<string>();
    const ordered: string[] = [];
    const push = (id: string) => {
      if (!id || id === actorId || seen.has(id)) return;
      if (ordered.length >= cap) return;
      seen.add(id);
      ordered.push(id);
    };
    followers.forEach(push);
    if (ordered.length < cap) {
      try {
        const where: Record<string, unknown> = { id: { not: actorId } };
        if (config.excludeDeleted) where.isDeleted = false;
        const community = await prisma.user.findMany({
          where: where as never,
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: cap,
        });
        for (const u of community as { id: string }[]) {
          push(u.id);
          if (ordered.length >= cap) break;
        }
      } catch {
        /* followers-only fallback below */
      }
    }
    // Optimistic nearby filtering — best-effort, fails open to `ordered`.
    const loc = config.location ?? { ...DEFAULT_ROUTE_REQUEST_LOCATION_FILTER };
    const fix = loc.enabled ? validRequestFix(opts?.requestLat, opts?.requestLng) : null;
    let audience = ordered;
    if (fix && ordered.length > 0) {
      try {
        const rows = (await prisma.user.findMany({
          where: { id: { in: ordered } },
          select: { id: true, lastKnownLat: true, lastKnownLng: true },
        })) as { id: string; lastKnownLat: number | null; lastKnownLng: number | null }[];
        const byId = new Map(rows.map((r) => [r.id, r]));
        const nearby = ordered.filter((id) => {
          const r = byId.get(id);
          if (!r || typeof r.lastKnownLat !== "number" || typeof r.lastKnownLng !== "number") return false;
          if (!Number.isFinite(r.lastKnownLat) || !Number.isFinite(r.lastKnownLng)) return false;
          try {
            return audienceHaversineKm(fix.lat, fix.lng, r.lastKnownLat, r.lastKnownLng) <= loc.radiusKm;
          } catch {
            return false;
          }
        });
        // Only filter when the nearby cluster is meaningful; otherwise the
        // request behaves exactly as before (everyone gets notified).
        if (nearby.length >= Math.max(1, Math.floor(loc.minNearby))) {
          audience = nearby.slice(0, cap);
        }
      } catch {
        audience = ordered;
      }
    }
    try {
      const { filterRecipientsByPreferences } = await import(
        "@/app/lib/services/notificationPreferenceService"
      );
      return await filterRecipientsByPreferences(audience, "ROUTE_REQUEST");
    } catch {
      return audience;
    }
  } catch (error) {
    console.error("[notificationService] getRouteRequestAudienceIds failed:", error);
    try {
      return await getFollowerIds(actorId);
    } catch {
      return [];
    }
  }
}

/**
 * Notifies the inviter that someone converted on their invite code.
 * Fire-and-forget (void at call sites) — never throws, so signup can never
 * fail because of a notification write.
 */
export async function notifyReferralConversion(
  inviterId: string,
  newUserId: string,
  newUserName: string
): Promise<string | null> {
  if (!inviterId || inviterId === newUserId) return null;
  try {
    const { NOTIFICATION_MESSAGES } = await import("@/app/lib/config");
    return await createNotification({
      type: "REWARD",
      actorId: newUserId,
      message: NOTIFICATION_MESSAGES.referralConversion(newUserName),
      recipientIds: [inviterId],
    });
  } catch {
    return null;
  }
}

/**
 * Thanks the user for a platform review (in-app + push mirror, never email).
 * Uses REWARD with allowSelf (self-addressed, like WELCOME) so no
 * NotificationType migration is needed. Fire-and-forget — never throws.
 */
export async function notifyReviewThanks(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    return await createNotification({
      type: "REWARD",
      actorId: userId,
      message: "Thanks for reviewing Along! Your review is in moderation and will appear on the About page once approved.",
      recipientIds: [userId],
      allowSelf: true,
    });
  } catch {
    return null;
  }
}
/**
 * Notifies the earner after points land (and on tier promotion).
 * Called by the rewards worker with the awardPoints result — void, never throws.
 */
export async function notifyPointsAwarded(input: {
  userId: string;
  pointsAwarded: number;
  actionLabel: string;
  oldTier?: string;
  newTier?: string;
  tierChanged?: boolean;
}): Promise<void> {
  if (input.pointsAwarded <= 0 && !input.tierChanged) return;
  try {
    const { NOTIFICATION_MESSAGES } = await import("@/app/lib/config");
    if (input.pointsAwarded > 0) {
      await createNotification({
        type: "REWARD",
        actorId: input.userId,
        message: NOTIFICATION_MESSAGES.pointsEarned(input.pointsAwarded, input.actionLabel),
        recipientIds: [input.userId],
        allowSelf: true,
      });
    }
    if (input.tierChanged && input.oldTier && input.newTier) {
      await createNotification({
        type: "BADGE",
        actorId: input.userId,
        message: NOTIFICATION_MESSAGES.tierUp(
          input.oldTier.charAt(0) + input.oldTier.slice(1).toLowerCase(),
          input.newTier.charAt(0) + input.newTier.slice(1).toLowerCase()
        ),
        recipientIds: [input.userId],
        allowSelf: true,
      });
    }
  } catch {
    /* notifications are non-critical */
  }
}
