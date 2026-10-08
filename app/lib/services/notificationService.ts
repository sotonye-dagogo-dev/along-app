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
    | "COMMENT"
    | "FOLLOW"
    | "MENTION"
    | "WELCOME"
    | "ROUTE_REQUEST"
    | "ROUTE_RESPONSE"
    | "REWARD"
    | "BADGE"
    | "VERIFIED"
    | "REPORT"
    | "MODERATION";
  actorId: string;
  message: string;
  postId?: string;
  commentId?: string;
  /** Users who receive this notification. Duplicates/self are filtered out. */
  recipientIds: string[];
}

/**
 * Creates one Notification with a recipient row per user.
 * Returns the notification id, or null if creation failed / no recipients.
 */
export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  const recipientIds = [...new Set(input.recipientIds.filter(Boolean))].filter((id) => id !== input.actorId);
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
