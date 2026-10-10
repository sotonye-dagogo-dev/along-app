import {
  validityEngine,
  computeRouteDetailScore,
  computeSimilarityRatio,
} from "@/app/lib/services/ValidityEngine";

/**
 * Canonical live trust-breakdown service — the single source of truth every
 * read surface (feed cards, post detail, search, profile tabs, suggestions)
 * uses to build `validityBreakdown`.
 *
 * Previously only GET /api/posts/[id] computed a live breakdown while list
 * surfaces shipped no breakdown at all, so PostCard fell back to synthetic
 * `score ± offset` placeholders. The corroboration row (and every other
 * row) therefore disagreed between the feed and the detail view for the
 * same post. Every list API now attaches the SAME live object the detail
 * view ships, so shared rows are numerically identical everywhere.
 */

export interface LiveTrustBreakdown {
  community: number;
  detail: number;
  corroboration: number;
  recency: number;
  reputation: number;
  engagement: number;
  /** Fresh overall score for these components (badge number source). */
  score: number;
  tier: "low" | "developing" | "verified" | "trusted";
}

/** Minimal post shape every caller already has (DB row or list item). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TrustPostLike = Record<string, any> & {
  id: string;
  userId?: string;
  likes?: number;
  dislikes?: number;
  comments?: number;
  bookmarks?: number;
  views?: number;
  shares?: number;
  routes?: unknown;
  tags?: string[];
  createdAt?: string | Date;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

/**
 * Single canonical evaluation used by BOTH the single-post path (detail)
 * and the batched list path (feed/search/profile). Same inputs → same
 * outputs, regardless of surface.
 */
export async function evaluateLiveTrust(input: {
  likes: number;
  dislikes: number;
  routes: unknown;
  tags: string[];
  createdAt: Date;
  authorFollowerCount: number;
  authorVerified: boolean;
  authorAgeDays: number;
  comments: number;
  bookmarks: number;
  views: number;
  shares: number;
  openReports: number;
  overlappingPostCount: number;
}): Promise<LiveTrustBreakdown> {
  const live = await validityEngine.evaluate({
    likes: input.likes,
    dislikes: input.dislikes,
    routeDetailScore: computeRouteDetailScore(input.routes),
    similarityRatio: computeSimilarityRatio(input.overlappingPostCount),
    createdAt: input.createdAt,
    authorFollowerCount: input.authorFollowerCount,
    authorVerified: input.authorVerified,
    authorAgeDays: input.authorAgeDays,
    comments: input.comments,
    bookmarks: input.bookmarks,
    views: input.views,
    shares: input.shares,
    openReports: input.openReports,
  });
  return {
    community: live.community,
    detail: live.detail,
    corroboration: live.corroboration,
    recency: live.recency,
    reputation: live.reputation,
    engagement: live.engagement,
    score: live.score,
    tier: live.tier,
  };
}

async function countOverlappingPosts(
  prisma: PrismaLike,
  post: TrustPostLike,
  createdAt: Date
): Promise<number> {
  try {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    if (tags.length === 0) return 0;
    const overlapping = await prisma.post.count({
      where: {
        id: { not: post.id },
        tags: { hasSome: tags },
        createdAt: {
          gte: new Date(createdAt.getTime() - SEVEN_DAYS_MS),
          lte: new Date(createdAt.getTime() + SEVEN_DAYS_MS),
        },
      },
    });
    return Number.isFinite(overlapping) ? overlapping : 0;
  } catch {
    return 0;
  }
}

/**
 * Live breakdown for ONE post (detail view). Best-effort — returns null
 * instead of throwing so reads never fail because of trust.
 */
export async function getLiveBreakdownForPost(
  prisma: PrismaLike,
  post: TrustPostLike
): Promise<LiveTrustBreakdown | null> {
  try {
    const createdAt = toDate(post.createdAt, new Date());
    const userId = typeof post.userId === "string" ? post.userId : null;
    const [author, followerCount, openReports, overlapping] = await Promise.all([
      userId
        ? prisma.user
            .findUnique({ where: { id: userId }, select: { verified: true, createdAt: true } })
            .catch(() => null)
        : Promise.resolve(null),
      userId ? prisma.follow.count({ where: { followingId: userId } }).catch(() => 0) : Promise.resolve(0),
      prisma.bugReport
        .count({ where: { postId: post.id, status: { notIn: ["RESOLVED", "CLOSED"] } } })
        .catch(() => 0),
      countOverlappingPosts(prisma, post, createdAt),
    ]);
    const authorCreatedAt = author?.createdAt ? toDate(author.createdAt, createdAt) : null;
    return evaluateLiveTrust({
      likes: Number(post.likes) || 0,
      dislikes: Number(post.dislikes) || 0,
      routes: post.routes,
      tags: Array.isArray(post.tags) ? post.tags : [],
      createdAt,
      authorFollowerCount: Number(followerCount) || 0,
      authorVerified: author?.verified ?? false,
      authorAgeDays: authorCreatedAt
        ? Math.max(0, (Date.now() - authorCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      comments: Number(post.comments) || 0,
      bookmarks: Number(post.bookmarks) || 0,
      views: Number(post.views) || 0,
      shares: Number(post.shares) || 0,
      openReports: Number(openReports) || 0,
      overlappingPostCount: overlapping,
    });
  } catch {
    return null;
  }
}

/**
 * Batched live breakdowns for list surfaces (feed, search, profile tabs,
 * explore). Same per-post computation as the detail path — same inputs,
 * same engine, same numbers — with batched author/follower/report lookups
 * so a 10-50 row list stays cheap. Best-effort per post: failures keep the
 * stored score/breakdown instead of failing the read.
 */
export async function attachLiveBreakdownsToPosts<T extends TrustPostLike>(
  prisma: PrismaLike,
  posts: T[]
): Promise<T[]> {
  if (!Array.isArray(posts) || posts.length === 0) return posts;
  try {
    const now = Date.now();
    const authorIds = [...new Set(posts.map((p) => p.userId).filter((id): id is string => typeof id === "string"))];
    const postIds = posts.map((p) => p.id);

    const [authorRows, followerGroups, reportGroups] = await Promise.all([
      authorIds.length > 0
        ? prisma.user
            .findMany({ where: { id: { in: authorIds } }, select: { id: true, verified: true, createdAt: true } })
            .catch(() => [])
        : Promise.resolve([]),
      authorIds.length > 0
        ? prisma.follow
            .groupBy({ by: ["followingId"], where: { followingId: { in: authorIds } }, _count: { followingId: true } })
            .catch(() => [])
        : Promise.resolve([]),
      postIds.length > 0
        ? prisma.bugReport
            .groupBy({
              by: ["postId"],
              where: { postId: { in: postIds }, status: { notIn: ["RESOLVED", "CLOSED"] } },
              _count: { postId: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const authorById = new Map<string, { verified?: boolean; createdAt?: Date }>();
    for (const a of authorRows as { id: string; verified?: boolean; createdAt?: Date }[]) {
      if (a?.id) authorById.set(a.id, a);
    }
    const followersByAuthor = new Map<string, number>();
    for (const g of followerGroups as { followingId: string; _count?: { followingId?: number } }[]) {
      if (g?.followingId) followersByAuthor.set(g.followingId, Number(g._count?.followingId) || 0);
    }
    const reportsByPost = new Map<string, number>();
    for (const g of reportGroups as { postId: string; _count?: { postId?: number } }[]) {
      if (g?.postId) reportsByPost.set(g.postId, Number(g._count?.postId) || 0);
    }

    // Corroboration leg per post (tag overlap ±7 days, self excluded) —
    // identical query shape to the detail path.
    const overlappingCounts = await Promise.all(
      posts.map((p) => countOverlappingPosts(prisma, p, toDate(p.createdAt, new Date(now))))
    );

    return await Promise.all(
      posts.map(async (post, i) => {
        try {
          const createdAt = toDate(post.createdAt, new Date(now));
          const author = typeof post.userId === "string" ? authorById.get(post.userId) : undefined;
          const authorCreatedAt = author?.createdAt ? toDate(author.createdAt, createdAt) : null;
          const live = await evaluateLiveTrust({
            likes: Number(post.likes) || 0,
            dislikes: Number(post.dislikes) || 0,
            routes: post.routes,
            tags: Array.isArray(post.tags) ? post.tags : [],
            createdAt,
            authorFollowerCount:
              typeof post.userId === "string" ? followersByAuthor.get(post.userId) ?? 0 : 0,
            authorVerified: author?.verified ?? false,
            authorAgeDays: authorCreatedAt
              ? Math.max(0, (now - authorCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
              : 0,
            comments: Number(post.comments) || 0,
            bookmarks: Number(post.bookmarks) || 0,
            views: Number(post.views) || 0,
            shares: Number(post.shares) || 0,
            openReports: reportsByPost.get(post.id) ?? 0,
            overlappingPostCount: overlappingCounts[i] ?? 0,
          });
          return {
            ...post,
            // Live score/tier overwrite the stored row so the badge NUMBER
            // matches the breakdown everywhere (feed card == detail view).
            validityScore: live.score,
            validityTier: live.tier,
            validityBreakdown: {
              community: live.community,
              detail: live.detail,
              corroboration: live.corroboration,
              recency: live.recency,
              reputation: live.reputation,
              engagement: live.engagement,
              score: live.score,
            },
          };
        } catch {
          return post;
        }
      })
    );
  } catch {
    return posts;
  }
}
