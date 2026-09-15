import { prisma } from "@/app/lib/db/prisma";
import { DEFAULT_FEED_CONFIG, CACHE_TTL, CACHE_KEYS } from "@/app/lib/config";

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
  _isBookmarked?: boolean;
}

interface FeedOptions {
  cursor?: string;
  limit?: number;
}

function isMissingColumnError(error: unknown): boolean {
  return error instanceof Error && ((error as any).code === "P2022" || error.name === "PrismaClientKnownRequestError" && (error as any).code === "P2022");
}

async function safeFindManyPosts(args: Parameters<typeof prisma.post.findMany>[0]): Promise<any[]> {
  try {
    return await (prisma.post.findMany as any)(args);
  } catch (error) {
    if (isMissingColumnError(error) && (args as any)?.include?.user?.select?.avatarConfig) {
      // Retry without avatarConfig — production DB may not yet have this column if migration not applied
      const fallbackArgs = {
        ...args,
        include: {
          ...(args as any).include,
          user: {
            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
          },
        },
      };
      return await (prisma.post.findMany as any)(fallbackArgs);
    }
    throw error;
  }
}

async function safeFindUniquePost(args: Parameters<typeof prisma.post.findUnique>[0]): Promise<any> {
  try {
    return await (prisma.post.findUnique as any)(args);
  } catch (error) {
    if (isMissingColumnError(error) && (args as any)?.include?.user?.select?.avatarConfig) {
      const fallbackArgs = {
        ...args,
        include: {
          ...(args as any).include,
          user: {
            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
          },
        },
      };
      return await (prisma.post.findUnique as any)(fallbackArgs);
    }
    throw error;
  }
}

class FeedService {
  async getFeed(userId: string, options: FeedOptions = {}): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
    const config = DEFAULT_FEED_CONFIG;
    const limit = options.limit ?? config.pageSize;
    const cursor = options.cursor;

    // Check Redis cache for non-cursor requests
    if (!cursor) {
      try {
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        const cacheKey = CACHE_KEYS.feed(userId);
        const cached = await redis.get<{ posts: FeedPost[]; nextCursor: string | null }>(cacheKey);
        if (cached) {
          return cached;
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

    // Fetch posts in parallel: following, trending, tag-matched, plus recent fallback for cold-start
    const [followingPosts, trendingPosts, tagPosts, recentPosts] = await Promise.all([
      followingIds.length > 0 ? safeFindManyPosts({
        where: { userId: { in: followingIds }, ...cursorFilter },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.ceil(limit * 2),
      }) : Promise.resolve([]),
      safeFindManyPosts({
        where: {
          ...cursorFilter,
          ...(followingIds.length > 0 ? { userId: { notIn: followingIds } } : {}),
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), ...(cursorCreatedAt ? { lt: cursorCreatedAt } : {}) },
        },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } },
        orderBy: [{ likes: "desc" }, { comments: "desc" }],
        take: Math.ceil(limit * 1.5),
      }),
      activeTags.length > 0 ? safeFindManyPosts({
        where: { tags: { hasSome: activeTags }, ...(followingIds.length > 0 ? { userId: { notIn: followingIds } } : {}), ...cursorFilter },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.ceil(limit * 1.5),
      }) : Promise.resolve([]),
      // Recent posts fallback ensures new posts always surface, even for cold-start users
      safeFindManyPosts({
        where: { ...recentCursorFilter },
        include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    // Get user's likes and bookmarks for enrichment
    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: { userId, type: "LIKE" },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId },
        select: { postId: true },
      }),
    ]);
    const likedPostIds = new Set(userLikes.map((l) => l.postId));
    const bookmarkedPostIds = new Set(userBookmarks.map((b) => b.postId));

    // Merge and score posts — include recency bonus and recent fallback
    const postMap = new Map<string, { post: FeedPost; score: number }>();

    const addWithScore = (posts: typeof trendingPosts, weight: number, recencyBonus = 0) => {
      for (const p of posts) {
        const existing = postMap.get(p.id);
        // Recency bonus: posts within last 24h get extra 0.05, decaying linearly over 7 days
        const ageHours = (Date.now() - new Date(p.createdAt).getTime()) / 3600000;
        const recency = recencyBonus > 0 ? Math.max(0, recencyBonus * (1 - ageHours / (7 * 24))) : 0;
        const increment = weight * (p.isPlatformGen ? 0.5 : 1.0) + recency;
        if (existing) {
          existing.score += increment;
        } else {
          postMap.set(p.id, {
            post: {
              ...p,
              _isLiked: likedPostIds.has(p.id),
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
            post: { ...p, _isLiked: likedPostIds.has(p.id), _isBookmarked: bookmarkedPostIds.has(p.id) } as FeedPost,
            score: 0.15 + recency,
          });
        }
      }
    }

    // Sort by score, then by recency as tie-breaker
    const scored = Array.from(postMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
      })
      .slice(0, limit);

    const posts = scored.map((s) => s.post);
    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

    // Cache non-cursor results in Redis
    if (!cursor) {
      try {
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        const cacheKey = CACHE_KEYS.feed(userId);
        await redis.set(cacheKey, { posts, nextCursor }, { ex: CACHE_TTL.feed });
      } catch {
        // Cache write failure is non-critical
      }
    }

    return { posts, nextCursor };
  }

  async getPostById(postId: string, userId?: string): Promise<FeedPost | null> {
    const post = await safeFindUniquePost({
      where: { id: postId },
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
    });

    if (!post) return null;

    let _isLiked = false;
    let _isBookmarked = false;

    if (userId) {
      const [like, bookmark] = await Promise.all([
        prisma.like.findUnique({ where: { postId_userId: { postId, userId } } }),
        prisma.bookmark.findUnique({ where: { postId_userId: { postId, userId } } }),
      ]);
      _isLiked = like?.type === "LIKE";
      _isBookmarked = !!bookmark;
    }

    return { ...post, _isLiked, _isBookmarked };
  }
}

export const feedService = new FeedService();
