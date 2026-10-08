import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config";

interface CachedNotifications {
  notifications: unknown[];
  nextCursor: string | null;
  unreadCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // "all" | "unread" | "rewards"
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
    const userId = user.id as string;

    // First-page reads are cached (60s) — invalidation happens on every write
    const cacheKey = CACHE_KEYS.notifications(userId, filter ?? "all");
    if (!cursor) {
      try {
        const { redis } = await import("@/app/lib/db/redis");
        const cached = await redis.get<CachedNotifications>(cacheKey);
        if (cached) return NextResponse.json(cached, { status: 200 });
      } catch { /* fall through to DB */ }
    }

    const notifications = await prisma.notification.findMany({
      where: {
        recipients: filter === "unread" ? { some: { userId, read: false } } : { some: { userId } },
        ...(filter === "rewards" ? { type: { in: ["REWARD", "BADGE", "VERIFIED"] as never } } : {}),
      },
      include: {
        actor: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
        post: { select: { id: true, title: true } },
        recipients: {
          where: { userId },
          select: { read: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = notifications.length > limit;
    const resultNotifications = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? resultNotifications[resultNotifications.length - 1].id : null;

    const unreadCount = await prisma.notificationRecipient.count({
      where: { userId, read: false },
    });

    const payload: CachedNotifications = { notifications: resultNotifications, nextCursor, unreadCount };

    if (!cursor) {
      try {
        const { redis } = await import("@/app/lib/db/redis");
        await redis.set(cacheKey, payload, { ex: CACHE_TTL.notifications });
      } catch { /* non-critical */ }
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("List notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const userId = user.id as string;

    if (body.markAll) {
      await prisma.notificationRecipient.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    } else if (body.notificationId) {
      await prisma.notificationRecipient.updateMany({
        where: { notificationId: body.notificationId, userId },
        data: { read: true },
      });
    }

    // Read state changed → bust every filter variant of the list cache
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const { CACHE_KEYS } = await import("@/app/lib/config");
      await redis.del(...CACHE_KEYS.notificationsAll(userId));
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
