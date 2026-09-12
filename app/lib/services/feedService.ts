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

    // Get users the current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // Get user's activity tags for personalization
    const userActivities = await prisma.userActivity.findMany({
      where: { userId },
      select: { tagId: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    const activeTags = [...new Set(userActivities.filter(a => a.tagId).map(a => a.tagId as string))];

    // Fetch posts from following users (weighted highest)
    const followingPosts = followingIds.length > 0 ? await safeFindManyPosts({
      where: { userId: { in: followingIds } },
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.ceil(limit * 2),
    }) : [];

    // Trending posts (high engagement)
    const trendingPosts = await safeFindManyPosts({
      where: {
        ...(cursor ? { id: { lt: cursor } } : {}),
        ...(followingIds.length > 0 ? { userId: { notIn: followingIds } } : {}),
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
      orderBy: [{ likes: "desc" }, { comments: "desc" }],
      take: Math.ceil(limit * 1.5),
    });

    // Tag-matched posts
    const tagPosts = activeTags.length > 0 ? await safeFindManyPosts({
      where: {
        tags: { hasSome: activeTags },
        ...(followingIds.length > 0 ? { userId: { notIn: followingIds } } : {}),
      },
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.ceil(limit * 1.5),
    }) : [];

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

    // Merge and score posts
    const postMap = new Map<string, { post: FeedPost; score: number }>();

    const addWithScore = (posts: typeof followingPosts, weight: number) => {
      for (const p of posts) {
        const existing = postMap.get(p.id);
        const increment = weight * (p.isPlatformGen ? 0.5 : 1.0);
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
    addWithScore(trendingPosts, config.trendingWeight);
    addWithScore(tagPosts, config.matchingTagsWeight);

    // Sort by score, then remove score property
    const scored = Array.from(postMap.values())
      .sort((a, b) => b.score - a.score)
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
