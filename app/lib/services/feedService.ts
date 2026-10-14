import { prisma } from "@/app/lib/db/prisma";
import { DEFAULT_FEED_CONFIG, CACHE_TTL, CACHE_KEYS } from "@/app/lib/config";
import { FEED_DIVERSITY_CONFIG, applyFeedDiversity } from "@/app/lib/config/feedAlgorithm";
import type { FeedDiversityConfig } from "@/app/lib/config/feedAlgorithm";

interface FeedPost {
  id: string;
  userId: string;
  title: string;
  routes: unknown;
  images: string[];
  tags: string[];
  likes: number;
  dislikes: number;
  comments: number;
  bookmarks: number;
  validityScore: number;
  validityTier: string | null;
  validityBreakdown?: {
    community?: number;
    detail?: number;
    corroboration?: number;
    recency?: number;
    reputation?: number;
    engagement?: number;
    score?: number;
  } | null;
  region: string | null;
  totalDistanceKm: number | null;
  estimatedMins: number | null;
  isPlatformGen: boolean;
  views: number;
  createdAt: Date;
  user: {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    avatarConfig: unknown;
  };
  _isLiked?: boolean;
  _isDisliked?: boolean;
  _isBookmarked?: boolean;
}

interface FeedOptions {
  cursor?: string;
  limit?: number;
  /** Optional viewer fix (client lat/lng). Behind-the-scenes nearby boost only; absent = no-op. */
  viewerLocation?: { lat: number; lng: number } | null;
  /**
   * Ids the client already renders. Score-ordered pages are otherwise
   * unstable (cursor is createdAt-based while ranking is score-based), so
   * previously-seen rows can resurface as "new" — the source of the
   * redundant-render glitch. Excluded server-side before scoring/slicing.
   */
  excludeIds?: string[];
}

/** Haversine distance (km) — local copy so the service stays dependency-light. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Resolve effective feed config: admin-tuned SiteConfig wins, hardcoded default is the fallback. */
async function resolveFeedConfig(): Promise<typeof DEFAULT_FEED_CONFIG> {
  try {
    const { getSiteConfig } = await import("@/app/lib/utils/siteConfig");
    const stored = await getSiteConfig<Partial<typeof DEFAULT_FEED_CONFIG>>("feedAlgorithm", {});
    if (stored && typeof stored === "object") {
      return { ...DEFAULT_FEED_CONFIG, ...stored };
    }
  } catch {
    /* config store unavailable — fall through to default */
  }
  return DEFAULT_FEED_CONFIG;
}

/**
 * Resolve effective feed-diversity knobs: admin-tuned SiteConfig
 * "feedDiversity" wins, hardcoded default is the fallback. Validated +
 * never throws — bad stored shapes degrade to defaults, never to a crash.
 */
async function resolveFeedDiversity(): Promise<FeedDiversityConfig> {
  try {
    const { getSiteConfig } = await import("@/app/lib/utils/siteConfig");
    const stored = await getSiteConfig<Partial<FeedDiversityConfig>>("feedDiversity", {});
    if (stored && typeof stored === "object") {
      const pick = (v: unknown, fallback: number): number =>
        typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
      return {
        maxConsecutiveFromSameAuthor: Math.max(
          1,
          Math.floor(pick(stored.maxConsecutiveFromSameAuthor, FEED_DIVERSITY_CONFIG.maxConsecutiveFromSameAuthor)),
        ),
        lookaheadWindow: Math.max(
          1,
          Math.floor(pick(stored.lookaheadWindow, FEED_DIVERSITY_CONFIG.lookaheadWindow)),
        ),
        jitterWeight: pick(stored.jitterWeight, FEED_DIVERSITY_CONFIG.jitterWeight),
      };
    }
  } catch {
    /* config store unavailable — fall through to default */
  }
  return FEED_DIVERSITY_CONFIG;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client cast workarounds: optional columns (avatarConfig, isArchived) may be absent on older generated clients; casts keep the P2022 fallback path compiling */
function isMissingColumnError(error: unknown): boolean {
  return error instanceof Error && ((error as any).code === "P2022" || error.name === "PrismaClientKnownRequestError" && (error as any).code === "P2022");
}

/** Archived posts never surface in feeds (owner/admin can still open them by link). */
function withVisibleFilter(where: any): any {
  if (!where || typeof where !== "object" || "isArchived" in where) return where;
  return { ...where, isArchived: false };
}

async function safeFindManyPosts(args: Parameters<typeof prisma.post.findMany>[0]): Promise<any[]> {
  const filteredArgs = { ...(args as any), where: withVisibleFilter((args as any)?.where) };
  try {
    return await (prisma.post.findMany as any)(filteredArgs);
  } catch (error) {
    if (isMissingColumnError(error)) {
      // Retry without the additive columns — production DB may not yet have
      // them if the moderation migration has not applied.
      const { isArchived: _drop, ...restWhere } = (filteredArgs as any)?.where ?? {};
      void _drop;
      const needsAvatarFallback =
        (filteredArgs as any)?.include?.user?.select?.avatarConfig ||
        (filteredArgs as any)?.include?.quotedPost?.select?.user?.select?.avatarConfig;
      const fallbackArgs = {
        ...filteredArgs,
        ...(Object.keys(restWhere).length > 0 || (args as any)?.where ? { where: restWhere } : {}),
        ...(needsAvatarFallback
          ? {
              include: {
                ...(filteredArgs as any).include,
                user: {
                  select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
                },
                ...((filteredArgs as any)?.include?.quotedPost
                  ? {
                      quotedPost: {
                        select: {
                          id: true,
                          title: true,
                          type: true,
                          createdAt: true,
                          user: {
                            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
                          },
                        },
                      },
                    }
                  : {}),
              },
            }
          : {}),
      };
      return await (prisma.post.findMany as any)(fallbackArgs);
    }
    throw error;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-explicit-any -- same Prisma P2022 fallback cast workaround as above */
async function safeFindUniquePost(args: Parameters<typeof prisma.post.findUnique>[0]): Promise<any> {
  try {
    return await (prisma.post.findUnique as any)(args);
  } catch (error) {
    const needsAvatarFallback =
      (args as any)?.include?.user?.select?.avatarConfig ||
      (args as any)?.include?.quotedPost?.select?.user?.select?.avatarConfig;
    if (isMissingColumnError(error) && needsAvatarFallback) {
      const fallbackArgs = {
        ...args,
        include: {
          ...(args as any).include,
          user: {
            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
          },
          ...((args as any)?.include?.quotedPost
            ? {
                quotedPost: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    createdAt: true,
                    user: {
                      select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
                    },
                  },
                },
              }
            : {}),
        },
      };
      return await (prisma.post.findUnique as any)(fallbackArgs);
    }
    throw error;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

class FeedService {
  async getFeed(userId: string, options: FeedOptions = {}): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
    const config = await resolveFeedConfig();
    const limit = options.limit ?? config.pageSize;
    const cursor = options.cursor;

    // Check Redis cache for non-cursor requests — timeout-guarded, never blocks feed.
    // Cached rows are re-enriched with fresh trust below (same canonical
    // service as the detail view) so cached feeds never disagree with detail.
    if (!cursor) {
      try {
        const { redis } = await import("@/app/lib/db/redis");
        const cacheKey = CACHE_KEYS.feed(userId);
        const cached = await redis.get<{ posts: FeedPost[]; nextCursor: string | null }>(cacheKey);
        if (cached) {
          try {
            const { attachLiveBreakdownsToPosts } = await import(
              "@/app/lib/services/trustBreakdownService"
            );
            const { prisma } = await import("@/app/lib/db/prisma");
            const fresh = await attachLiveBreakdownsToPosts(prisma, cached.posts as { id: string }[]);
            return { posts: fresh as FeedPost[], nextCursor: cached.nextCursor };
          } catch {
            return cached;
          }
        }
      } catch {
        // Redis unavailable — fall through to compute
      }
    }

    // Get users the current user follows + activity tags in parallel
    const [following, userActivities] = await Promise.all([
      prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
      prisma.userActivity.findMany({ where: { userId }, select: { tagId: true }, take: 50, orderBy: { createdAt: "desc" } }),
    ]);
    const followingIds = following.map((f) => f.followingId);
    const activeTags = [...new Set(userActivities.filter(a => a.tagId).map(a => a.tagId as string))];

    // Resolve cursor to createdAt for correct pagination (cuid is time-sortable but not lexical lt)
    let cursorCreatedAt: Date | null = null;
    if (cursor) {
      try {
        const cursorPost = await prisma.post.findUnique({ where: { id: cursor }, select: { createdAt: true } });
        if (cursorPost) cursorCreatedAt = cursorPost.createdAt;
      } catch { /* ignore */ }
    }
    const cursorFilter = cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {};
    const recentCursorFilter = cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {};
    // Stable score-order pagination: never re-score rows the client already
    // holds. Capped + sanitized (alphanumeric/cuid-ish only) so a hostile
    // query string cannot blow up the Prisma where clause.
    const seenIds = Array.isArray(options.excludeIds)
      ? [...new Set(options.excludeIds.filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id)))].slice(0, 200)
      : [];
    const excludeFilter = seenIds.length > 0 ? { id: { notIn: seenIds } } : {};
    // Excluded rows shrink each candidate pool — over-fetch to still fill pages.
    const backfill = Math.min(seenIds.length, limit);

    // Fetch posts in parallel: following, trending, tag-matched, plus recent fallback for cold-start
    const [followingPosts, trendingPosts, tagPosts, recentPosts] = await Promise.all([
      followingIds.length > 0 ? safeFindManyPosts({
        where: { userId: { in: followingIds }, ...excludeFilter, ...cursorFilter },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } }, quotedPost: { select: { id: true, title: true, type: true, createdAt: true, user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } } } },
        orderBy: { createdAt: "desc" },
        take: Math.ceil(limit * 2) + backfill,
      }) : Promise.resolve([]),
      safeFindManyPosts({
        where: {
          ...excludeFilter,
          ...cursorFilter,
          ...(followingIds.length > 0 ? { userId: { notIn: followingIds } } : {}),
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), ...(cursorCreatedAt ? { lt: cursorCreatedAt } : {}) },
        },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } }, quotedPost: { select: { id: true, title: true, type: true, createdAt: true, user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } } } },
        orderBy: [{ likes: "desc" }, { comments: "desc" }],
        take: Math.ceil(limit * 1.5) + backfill,
      }),
      activeTags.length > 0 ? safeFindManyPosts({
        where: { tags: { hasSome: activeTags }, ...(followingIds.length > 0 ? { userId: { notIn: followingIds } } : {}), ...excludeFilter, ...cursorFilter },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } }, quotedPost: { select: { id: true, title: true, type: true, createdAt: true, user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } } } },
        orderBy: { createdAt: "desc" },
        take: Math.ceil(limit * 1.5) + backfill,
      }) : Promise.resolve([]),
      // Recent posts fallback ensures new posts always surface, even for cold-start users
      safeFindManyPosts({
        where: { ...excludeFilter, ...recentCursorFilter },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } }, quotedPost: { select: { id: true, title: true, type: true, createdAt: true, user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } } } },
        orderBy: { createdAt: "desc" },
        take: limit + backfill,
      }),
    ]);

    // Get user's likes, dislikes and bookmarks for enrichment
    const [userLikes, userDislikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: { userId, type: "LIKE" },
        select: { postId: true },
      }),
      prisma.like.findMany({
        where: { userId, type: "DISLIKE" },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId },
        select: { postId: true },
      }),
    ]);
    const likedPostIds = new Set(userLikes.map((l) => l.postId));
    const dislikedPostIds = new Set(userDislikes.map((l) => l.postId));
    const bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId));

    // Merge and score posts — include recency bonus and recent fallback
    const postMap = new Map<string, { post: FeedPost; score: number }>();

    // Behind-the-scenes nearby boost: when a viewer fix is available
    // (explicit query param wins, stored last-known is the fallback), posts
    // with start coords earn a distance-decayed bonus (50km half-life).
    // Absent geo = zero bonus, so ordering is unchanged for geo-less viewers.
    let viewerFix = options.viewerLocation ?? null;
    if (!viewerFix) {
      try {
        const viewer = await prisma.user.findUnique({
          where: { id: userId },
          select: { lastKnownLat: true, lastKnownLng: true },
        });
        if (
          viewer &&
          typeof viewer.lastKnownLat === "number" &&
          typeof viewer.lastKnownLng === "number" &&
          Number.isFinite(viewer.lastKnownLat) &&
          Number.isFinite(viewer.lastKnownLng)
        ) {
          viewerFix = { lat: viewer.lastKnownLat, lng: viewer.lastKnownLng };
        }
      } catch {
        /* geo fallback unavailable — proceed without location bonus */
      }
    }
    const locationBonusFor = (p: { startLat?: number | null; startLng?: number | null }): number => {
      if (!viewerFix || config.locationBonus <= 0) return 0;
      const sLat = (p as { startLat?: unknown }).startLat;
      const sLng = (p as { startLng?: unknown }).startLng;
      if (typeof sLat !== "number" || typeof sLng !== "number") return 0;
      if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) return 0;
      const dKm = haversineKm(viewerFix.lat, viewerFix.lng, sLat, sLng);
      return config.locationBonus * Math.exp(-dKm / 50);
    };

    const addWithScore = (posts: typeof trendingPosts, weight: number, recencyBonus = 0) => {
      for (const p of posts) {
        const existing = postMap.get(p.id);
        // Recency bonus: posts within last 24h get extra 0.05, decaying linearly over 7 days
        const ageHours = (Date.now() - new Date(p.createdAt).getTime()) / 3600000;
        const recency = recencyBonus > 0 ? Math.max(0, recencyBonus * (1 - ageHours / (7 * 24))) : 0;
        const increment = weight * (p.isPlatformGen ? 0.5 : 1.0) + recency + locationBonusFor(p);
        if (existing) {
          existing.score += increment;
        } else {
          postMap.set(p.id, {
            post: {
              ...p,
              _isLiked: likedPostIds.has(p.id),
              _isDisliked: dislikedPostIds.has(p.id),
              _isBookmarked: bookmarkedPostIds.has(p.id),
            } as FeedPost,
            score: increment,
          });
        }
      }
    };

    addWithScore(followingPosts, config.followingWeight);
    addWithScore(trendingPosts, config.trendingWeight, 0.03);
    addWithScore(tagPosts, config.matchingTagsWeight);
    // Recent posts with higher recency bonus ensures new posts surface immediately
    addWithScore(recentPosts, 0.15, 0.08);

    // If total scored posts < limit (e.g. cold-start with few posts), ensure we still fill up to limit with recent posts not yet scored
    if (postMap.size < limit) {
      for (const p of recentPosts) {
        if (!postMap.has(p.id)) {
          const ageHours = (Date.now() - new Date(p.createdAt).getTime()) / 3600000;
          const recency = Math.max(0, 0.08 * (1 - ageHours / (7 * 24)));
          postMap.set(p.id, {
            post: { ...p, _isLiked: likedPostIds.has(p.id), _isDisliked: dislikedPostIds.has(p.id), _isBookmarked: bookmarkedPostIds.has(p.id) } as FeedPost,
            score: 0.15 + recency,
          });
        }
      }
    }

    // Sort by score, then live trust, then recency as tie-breakers — trust
    // stays display-canonical but now also breaks score ties so credible
    // posts surface first without overriding follow/tag affinity.
    const scored = Array.from(postMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aTrust = typeof a.post.validityScore === "number" ? a.post.validityScore : 0;
        const bTrust = typeof b.post.validityScore === "number" ? b.post.validityScore : 0;
        if (bTrust !== aTrust) return bTrust - aTrust;
        const timeDiff = new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
        // Final id tie-break keeps arrangement deterministic across pages —
        // without it, equal-score rows shuffle between fetches (visual glitch).
        if (timeDiff !== 0) return timeDiff;
        return String(a.post.id).localeCompare(String(b.post.id));
      });

    // Diversity pass (config-driven): ±jitter shuffles near-ties for variety
    // while tiers stay dominant, then a bounded lookahead breaks
    // same-poster back-to-back runs. Runs BEFORE the slice so every page is
    // diverse yet relevance-ordered; rows are never dropped or duplicated.
    let diversified = scored;
    try {
      const diversity = await resolveFeedDiversity();
      diversified = applyFeedDiversity(
        scored.map((s) => ({ ...s, authorId: s.post.userId ?? "" })),
        diversity,
      ).map(({ post, score }) => ({ post, score }));
    } catch {
      diversified = scored;
    }
    const sliced = diversified.slice(0, limit);

    const posts = sliced.map((s) => s.post);

    // Canonical live trust (same service as detail) — attached BEFORE the
    // cache write so every feed card carries real components, never the
    // synthetic score±offset placeholders that disagreed with detail.
    let trustedPosts = posts;
    try {
      const { attachLiveBreakdownsToPosts } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      trustedPosts = (await attachLiveBreakdownsToPosts(
        prisma,
        posts as { id: string }[]
      )) as FeedPost[];
    } catch { /* stored rows */ }

    const nextCursor = trustedPosts.length === limit ? trustedPosts[trustedPosts.length - 1].id : null;

    // Cache non-cursor results in Redis — never blocks feed on failure
    if (!cursor) {
      try {
        const { redis } = await import("@/app/lib/db/redis");
        const cacheKey = CACHE_KEYS.feed(userId);
        await redis.set(cacheKey, { posts: trustedPosts, nextCursor }, { ex: CACHE_TTL.feed });
      } catch {
        // Cache write failure is non-critical
      }
    }

    return { posts: trustedPosts, nextCursor };
  }

  async getPostById(postId: string, userId?: string): Promise<FeedPost | null> {
    const post = await safeFindUniquePost({
      where: { id: postId },
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
        quotedPost: {
          select: {
            id: true,
            title: true,
            type: true,
            createdAt: true,
            user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } },
          },
        },
      },
    });

    if (!post) return null;

    let _isLiked = false;
    let _isDisliked = false;
    let _isBookmarked = false;

    if (userId) {
      const [like, bookmark] = await Promise.all([
        prisma.like.findUnique({ where: { postId_userId: { postId, userId } } }),
        prisma.bookmark.findUnique({ where: { postId_userId: { postId, userId } } }),
      ]);
      _isLiked = like?.type === "LIKE";
      _isDisliked = like?.type === "DISLIKE";
      _isBookmarked = !!bookmark;
    }

    return { ...post, _isLiked, _isDisliked, _isBookmarked };
  }
}

export const feedService = new FeedService();
