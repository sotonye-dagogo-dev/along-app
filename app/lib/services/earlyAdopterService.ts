import { prisma } from "@/app/lib/db/prisma";
import { redis } from "@/app/lib/db/redis";
import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import {
  EARLY_ADOPTER_CONFIG_KEY,
  DEFAULT_EARLY_ADOPTER_CONFIG,
  normalizeEarlyAdopterConfig,
  buildEarlyAdopterLabel,
  type EarlyAdopterConfig,
} from "@/app/lib/config/earlyAdopter";

const RANK_CACHE_TTL_SEC = 600;
const rankCacheKey = (userId: string) => `earlyAdopter:rank:${userId}`;

export interface EarlyAdopterStatus {
  enabled: boolean;
  limit: number;
  rank: number | null;
  isEarlyAdopter: boolean;
  label: string | null;
}

export async function getEarlyAdopterConfig(): Promise<EarlyAdopterConfig> {
  const raw = await getSiteConfig<unknown>(
    EARLY_ADOPTER_CONFIG_KEY,
    DEFAULT_EARLY_ADOPTER_CONFIG
  );
  return normalizeEarlyAdopterConfig(raw);
}

/**
 * Deterministic 1-based join rank: users ordered by (createdAt asc, id asc).
 * Counts how many users joined strictly before this user, then +1.
 * Returns null when the user does not exist.
 */
export async function getUserEarlyAdopterRank(
  userId: string
): Promise<number | null> {
  try {
    const cached = await redis.get<number>(rankCacheKey(userId));
    if (typeof cached === "number" && Number.isFinite(cached) && cached >= 1) {
      return Math.floor(cached);
    }
  } catch {
    /* cache is best-effort */
  }

  let user: { createdAt: Date; id: string } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true },
    });
  } catch {
    return null;
  }
  if (!user) return null;

  let rank: number;
  try {
    const before = await prisma.user.count({
      where: {
        OR: [
          { createdAt: { lt: user.createdAt } },
          { createdAt: user.createdAt, id: { lt: user.id } },
        ],
      },
    });
    rank = before + 1;
  } catch {
    return null;
  }

  try {
    await redis.set(rankCacheKey(userId), rank, { ex: RANK_CACHE_TTL_SEC });
  } catch {
    /* ignore */
  }
  return rank;
}

/** Full badge status for one user (drives profile badge visibility). */
export async function getEarlyAdopterStatus(
  userId: string
): Promise<EarlyAdopterStatus> {
  const config = await getEarlyAdopterConfig();
  if (!config.enabled) {
    return { enabled: false, limit: config.limit, rank: null, isEarlyAdopter: false, label: null };
  }
  const rank = await getUserEarlyAdopterRank(userId);
  if (rank === null) {
    return { enabled: true, limit: config.limit, rank: null, isEarlyAdopter: false, label: null };
  }
  const qualifies = rank <= config.limit;
  return {
    enabled: true,
    limit: config.limit,
    rank,
    isEarlyAdopter: qualifies,
    label: qualifies ? buildEarlyAdopterLabel(config, rank) : null,
  };
}

/** Earliest-joined users (for admin management / future rewards & filtering). */
export async function listEarlyAdopters(limitOverride?: number): Promise<
  Array<{
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    createdAt: Date;
    rank: number;
    label: string;
  }>
> {
  const config = await getEarlyAdopterConfig();
  const limit =
    typeof limitOverride === "number" && Number.isFinite(limitOverride)
      ? Math.max(1, Math.min(500, Math.floor(limitOverride)))
      : config.limit;

  let users: Array<{
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    createdAt: Date;
  }> = [];
  try {
    users = await prisma.user.findMany({
      take: limit,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        avatar: true,
        createdAt: true,
      },
    });
  } catch {
    return [];
  }
  return users.map((u, i) => ({
    ...u,
    rank: i + 1,
    label: buildEarlyAdopterLabel(config, i + 1),
  }));
}
