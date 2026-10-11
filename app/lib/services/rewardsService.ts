import { prisma } from "@/app/lib/db/prisma";
import { POINTS_CONFIG, REWARD_TIERS } from "@/app/lib/config";

interface AwardPointsResult {
  pointsAwarded: number;
  newTotal: number;
  oldTier: string;
  newTier: string;
  tierChanged: boolean;
}

interface RewardHistoryItem {
  id: string;
  action: string;
  points: number;
  createdAt: Date;
}

class RewardsService {
  async awardPoints(
    userId: string,
    actionKey: string,
    postAuthorId?: string
  ): Promise<AwardPointsResult> {
    const config = POINTS_CONFIG[actionKey];
    if (!config) {
      return { pointsAwarded: 0, newTotal: 0, oldTier: "BRONZE", newTier: "BRONZE", tierChanged: false };
    }

    const targetUserId = postAuthorId ?? userId;

    if (config.cooldownHours && config.cooldownHours > 0) {
      const recentEvent = await prisma.analyticsEvent.findFirst({
        where: {
          eventName: `REWARD:${actionKey}`,
          userId: targetUserId,
          createdAt: { gte: new Date(Date.now() - config.cooldownHours * 3600000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recentEvent) {
        const cooldownEnd = new Date(recentEvent.createdAt.getTime() + config.cooldownHours * 3600000);
        if (cooldownEnd > new Date()) {
          return { pointsAwarded: 0, newTotal: 0, oldTier: "BRONZE", newTier: "BRONZE", tierChanged: false };
        }
      }
    }

    if (config.maxPerDay && config.maxPerDay > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await prisma.analyticsEvent.count({
        where: {
          eventName: `REWARD:${actionKey}`,
          userId: targetUserId,
          createdAt: { gte: todayStart },
        },
      });
      if (todayCount >= config.maxPerDay) {
        return { pointsAwarded: 0, newTotal: 0, oldTier: "BRONZE", newTier: "BRONZE", tierChanged: false };
      }
    }

    const [currentUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId }, select: { rewardPoints: true, rewardTier: true } }),
    ]);

    if (!currentUser) {
      return { pointsAwarded: 0, newTotal: 0, oldTier: "BRONZE", newTier: "BRONZE", tierChanged: false };
    }

    const oldPoints = currentUser.rewardPoints;
    const oldTier = currentUser.rewardTier;
    const newPoints = oldPoints + config.points;
    const newTier = this.computeTier(newPoints);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          rewardPoints: newPoints,
          rewardTier: newTier as never,
        },
      }),
      prisma.analyticsEvent.create({
        data: {
          eventName: `REWARD:${actionKey}`,
          userId: targetUserId,
          payload: { points: config.points, action: config.action, oldPoints, newPoints, actionKey },
        },
      }),
    ]);

    // Leaderboard accuracy: points changed, so the cached board (10 min
    // TTL) is now stale. Best-effort invalidation — failure keeps the TTL
    // fallback and never blocks the award.
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const { CACHE_KEYS } = await import("@/app/lib/config");
      await redis.del(CACHE_KEYS.leaderboard());
    } catch { /* non-critical */ }

    return {
      pointsAwarded: config.points,
      newTotal: newPoints,
      oldTier,
      newTier,
      tierChanged: newTier !== oldTier,
    };
  }

  computeTier(points: number): string {
    const sorted = Object.entries(REWARD_TIERS).sort(([, a], [, b]) => b.minPoints - a.minPoints);
    for (const [key, config] of sorted) {
      if (points >= config.minPoints) return key;
    }
    return "BRONZE";
  }

  async checkTierUpgrade(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rewardPoints: true, rewardTier: true },
    });
    if (!user) return null;

    const computedTier = this.computeTier(user.rewardPoints);
    if (computedTier !== user.rewardTier) {
      await prisma.user.update({
        where: { id: userId },
        data: { rewardTier: computedTier as never },
      });
      return computedTier;
    }
    return null;
  }

  async getHistory(userId: string, limit = 10): Promise<RewardHistoryItem[]> {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        userId,
        eventName: { startsWith: "REWARD:" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        eventName: true,
        payload: true,
        createdAt: true,
      },
    });

    return events.map((e) => {
      const payload = e.payload as { points?: number; action?: string } | null;
      return {
        id: e.id,
        action: payload?.action ?? e.eventName.replace("REWARD:", ""),
        points: payload?.points ?? 0,
        createdAt: e.createdAt,
      };
    });
  }
}

export const rewardsService = new RewardsService();
