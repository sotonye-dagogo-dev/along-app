/**
 * Central notification creation. All notification writes go through here so
 * fan-out shape (1 Notification + N NotificationRecipient rows) and error
 * handling stay consistent. Never throws — notifications are non-critical.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";

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
 */
export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  const recipientIds = [...new Set(input.recipientIds.filter(Boolean))].filter(
    (id) => input.allowSelf || id !== input.actorId
  );
  if (recipientIds.length === 0) return null;

  try {
    const notification = await prisma.notification.create({
      data: {
        type: input.type,
        actorId: input.actorId,
        message: input.message,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
        recipients: { create: recipientIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
    await invalidateNotificationCaches(recipientIds);
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

/** Follower ids of a user (the fan-out set used for route requests). */
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
