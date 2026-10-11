import {
  validityEngine,
  computeRouteDetailScore,
  computePostDetailScore,
  detailContextFromPost,
  computeSimilarityRatio,
  pairSimilarityScore,
  endorsementScore,
  computeCorroborationScore,
  normalizeCorroborationToken,
  type PostDetailContext,
} from "@/app/lib/services/ValidityEngine";
import { CORROBORATION_CONFIG } from "@/app/lib/config/validityConfig";

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
 *
 * Corroboration blend (see CORROBORATION_CONFIG): normalized tag overlap +
 * geo corridor (start/end proximity + region) + route-content agreement
 * (stops/vehicle/fare-band, destination legs excluded) + endorsement
 * (likes/dislikes relative to views) + explicit ROUTE_RESPONSE linkage.
 * Every leg is best-effort — a failing lookup degrades that leg to 0, never
 * the whole read.
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
  // Post-richness fields for the detail leg (all optional — absent legs
  // contribute 0, so rows without them score exactly as before).
  images?: unknown;
  description?: unknown;
  createdAt?: string | Date;
  // Corroboration evidence fields (all optional — absent legs score 0).
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  region?: string | null;
  type?: string;
  quotedPostId?: string | null;
};

const CORROBORATION_WINDOW_MS =
  CORROBORATION_CONFIG.windowDays * 24 * 60 * 60 * 1000;

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
  /**
   * Tightened corroboration (0-100) from computeCorroborationForPost. When
   * provided it is used directly; otherwise the legacy N*10 tag-overlap
   * count applies (backward compatible for existing callers/tests).
   */
  corroborationScore?: number;
  /**
   * Post-richness context for the detail leg (photos, tags, description,
   * vehicle/fare coverage, stops). Omitted → legacy leg-only score, so
   * existing callers/tests keep their exact numbers.
   */
  detailContext?: PostDetailContext;
}): Promise<LiveTrustBreakdown> {
  const live = await validityEngine.evaluate({
    likes: input.likes,
    dislikes: input.dislikes,
    routeDetailScore:
      input.detailContext && typeof input.detailContext === "object"
        ? computePostDetailScore(input.routes, input.detailContext)
        : computeRouteDetailScore(input.routes),
    similarityRatio:
      typeof input.corroborationScore === "number" && Number.isFinite(input.corroborationScore)
        ? Math.min(100, Math.max(0, Math.round(input.corroborationScore)))
        : computeSimilarityRatio(input.overlappingPostCount),
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

/**
 * Corroboration evidence for ONE post → 0-100 (see CORROBORATION_CONFIG).
 *
 * Three legs, each best-effort and independent:
 * 1. routeEvidence — candidate posts in ±windowDays are pair-scored
 *    (normalized tags + geo corridor + stop/vehicle/fare agreement);
 *    matches above threshold scale the best similarity by coverage.
 * 2. endorsement — the post's own likes/dislikes relative to views, so a
 *    liked post never sits at a permanent zero even before a matching
 *    route exists.
 * 3. responseLinkage — explicit ROUTE_RESPONSE rows quoting this post (or,
 *    for a response, siblings quoting the same request).
 *
 * Replaces the old tag-exact ±7d `N*10` count, which sat at zero whenever
 * tags were absent, cased differently, or older than a week — even for
 * identical itineraries. The legacy `computeSimilarityRatio` count is kept
 * as the last-resort fallback when candidate rows can't be read.
 */
export async function computeCorroborationForPost(
  prisma: PrismaLike,
  post: TrustPostLike,
  createdAt: Date
): Promise<number> {
  const endorsement = endorsementScore({
    likes: Number(post.likes) || 0,
    dislikes: Number(post.dislikes) || 0,
    views: Number(post.views) || 0,
  });

  // Explicit response linkage (cheap counts, best-effort).
  let responseCount = 0;
  try {
    if (prisma?.post?.count && typeof prisma.post.count === "function") {
      const direct = await prisma.post.count({
        where: { quotedPostId: post.id, type: "ROUTE_RESPONSE" },
      });
      responseCount += Number.isFinite(direct) ? direct : 0;
      const quotedId = typeof post.quotedPostId === "string" ? post.quotedPostId : null;
      if (post.type === "ROUTE_RESPONSE" && quotedId) {
        const siblings = await prisma.post.count({
          where: { quotedPostId: quotedId, id: { not: post.id } },
        });
        responseCount += Number.isFinite(siblings) ? siblings : 0;
      }
    }
  } catch {
    responseCount = 0;
  }

  // Route evidence from comparable posts in the window.
  let bestSimilarity = 0;
  let matchCount = 0;
  try {
    if (prisma?.post?.findMany && typeof prisma.post.findMany === "function") {
      const candidates = await prisma.post.findMany({
        where: {
          id: { not: post.id },
          createdAt: {
            gte: new Date(createdAt.getTime() - CORROBORATION_WINDOW_MS),
            lte: new Date(createdAt.getTime() + CORROBORATION_WINDOW_MS),
          },
        },
        select: {
          tags: true,
          routes: true,
          startLat: true,
          startLng: true,
          endLat: true,
          endLng: true,
          region: true,
        },
        orderBy: { createdAt: "desc" },
        take: CORROBORATION_CONFIG.maxCandidates,
      });
      const rows = Array.isArray(candidates) ? candidates : [];
      for (const candidate of rows) {
        const similarity = pairSimilarityScore(post, candidate ?? {});
        if (similarity > bestSimilarity) bestSimilarity = similarity;
        if (similarity >= CORROBORATION_CONFIG.matchThreshold) matchCount++;
      }
    } else if (prisma?.post?.count && typeof prisma.post.count === "function") {
      // Last resort (candidate rows unreadable): legacy tag-overlap count
      // treated as moderate-strength matches.
      const tags = (Array.isArray(post.tags) ? post.tags : [])
        .map(normalizeCorroborationToken)
        .filter(Boolean);
      if (tags.length > 0) {
        const overlapping = await prisma.post.count({
          where: {
            id: { not: post.id },
            tags: { hasSome: tags },
            createdAt: {
              gte: new Date(createdAt.getTime() - CORROBORATION_WINDOW_MS),
              lte: new Date(createdAt.getTime() + CORROBORATION_WINDOW_MS),
            },
          },
        });
        if (Number.isFinite(overlapping) && overlapping > 0) {
          matchCount = overlapping;
          bestSimilarity = Math.min(100, computeSimilarityRatio(overlapping) + 20);
        }
      }
    }
  } catch {
    // Keep whatever legs already resolved — never fail the read.
  }

  return computeCorroborationScore({
    bestSimilarity,
    matchCount,
    endorsement,
    responseCount,
  });
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
    const [author, followerCount, openReports, corroboration] = await Promise.all([
      userId
        ? prisma.user
            .findUnique({ where: { id: userId }, select: { verified: true, createdAt: true } })
            .catch(() => null)
        : Promise.resolve(null),
      userId ? prisma.follow.count({ where: { followingId: userId } }).catch(() => 0) : Promise.resolve(0),
      prisma.bugReport
        .count({ where: { postId: post.id, status: { notIn: ["RESOLVED", "CLOSED"] } } })
        .catch(() => 0),
      computeCorroborationForPost(prisma, post, createdAt),
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
      overlappingPostCount: 0,
      corroborationScore: corroboration,
      // Post richness (photos, tags, description, vehicles/fares, stops) so
      // the detail row reflects the whole post, not just the leg text.
      detailContext: detailContextFromPost(post),
    });
  } catch {
    return null;
  }
}

/**
 * Fields attached to each post by attachLiveBreakdownsToPosts. Partial
 * because the per-post evaluation is best-effort — a failing post keeps its
 * stored shape with none of these set.
 */
export interface LiveBreakdownAttachment {
  validityScore: number;
  validityTier: LiveTrustBreakdown["tier"];
  validityBreakdown: {
    community: number;
    detail: number;
    corroboration: number;
    recency: number;
    reputation: number;
    engagement: number;
    score: number;
  };
}
/**
 * Batched corroboration for list surfaces. Uses ONE shared candidate pool
 * (union of every post's ±window) plus grouped response counts, then scores
 * per post in memory with the same pair scorers as the single path — same
 * inputs, same engine, same numbers. Falls back to per-post evaluation when
 * the batched reads are unavailable (or fail), so results stay identical to
 * the detail path either way.
 */
async function computeBatchedCorroboration<T extends TrustPostLike>(
  prisma: PrismaLike,
  posts: T[],
  now: number
): Promise<number[]> {
  const perPostFallback = async (): Promise<number[]> =>
    Promise.all(
      posts.map((p) => computeCorroborationForPost(prisma, p, toDate(p.createdAt, new Date(now))))
    );
  try {
    const canPool =
      prisma?.post?.findMany && typeof prisma.post.findMany === "function" &&
      prisma?.post?.groupBy && typeof prisma.post.groupBy === "function";
    if (!canPool) return perPostFallback();

    const postIds = posts.map((p) => p.id);
    const createdAts = posts.map((p) => toDate(p.createdAt, new Date(now)).getTime());
    const poolGte = new Date(Math.min(...createdAts) - CORROBORATION_WINDOW_MS);
    const poolLte = new Date(Math.max(...createdAts) + CORROBORATION_WINDOW_MS);
    const quotedIds = [
      ...new Set(
        posts
          .map((p) => (typeof p.quotedPostId === "string" ? p.quotedPostId : null))
          .filter((id): id is string => !!id)
      ),
    ];

    const [pool, childGroups, siblingGroups] = await Promise.all([
      prisma.post
        .findMany({
          where: { createdAt: { gte: poolGte, lte: poolLte } },
          select: {
            id: true,
            createdAt: true,
            tags: true,
            routes: true,
            startLat: true,
            startLng: true,
            endLat: true,
            endLng: true,
            region: true,
          },
          orderBy: { createdAt: "desc" },
          take: Math.min(1000, CORROBORATION_CONFIG.maxCandidates * Math.max(1, posts.length)),
        })
        .catch(() => []),
      prisma.post
        .groupBy({
          by: ["quotedPostId"],
          where: { quotedPostId: { in: postIds }, type: "ROUTE_RESPONSE" },
          _count: { quotedPostId: true },
        })
        .catch(() => []),
      quotedIds.length > 0
        ? prisma.post
            .groupBy({
              by: ["quotedPostId"],
              where: { quotedPostId: { in: quotedIds } },
              _count: { quotedPostId: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const childrenByPost = new Map<string, number>();
    for (const g of (childGroups ?? []) as { quotedPostId?: string | null; _count?: { quotedPostId?: number } }[]) {
      if (g?.quotedPostId) childrenByPost.set(g.quotedPostId, Number(g._count?.quotedPostId) || 0);
    }
    const quotesByRequest = new Map<string, number>();
    for (const g of (siblingGroups ?? []) as { quotedPostId?: string | null; _count?: { quotedPostId?: number } }[]) {
      if (g?.quotedPostId) quotesByRequest.set(g.quotedPostId, Number(g._count?.quotedPostId) || 0);
    }
    const poolRows = Array.isArray(pool) ? pool : [];

    return posts.map((post) => {
      try {
        const createdAt = toDate(post.createdAt, new Date(now));
        const gte = createdAt.getTime() - CORROBORATION_WINDOW_MS;
        const lte = createdAt.getTime() + CORROBORATION_WINDOW_MS;
        let bestSimilarity = 0;
        let matchCount = 0;
        for (const candidate of poolRows as (TrustPostLike & { id?: string; createdAt?: unknown })[]) {
          if (!candidate || candidate.id === post.id) continue;
          const candidateTime = toDate(candidate.createdAt, createdAt).getTime();
          if (candidateTime < gte || candidateTime > lte) continue;
          const similarity = pairSimilarityScore(post, candidate);
          if (similarity > bestSimilarity) bestSimilarity = similarity;
          if (similarity >= CORROBORATION_CONFIG.matchThreshold) matchCount++;
        }
        let responseCount = childrenByPost.get(post.id) ?? 0;
        const quotedId = typeof post.quotedPostId === "string" ? post.quotedPostId : null;
        if (post.type === "ROUTE_RESPONSE" && quotedId) {
          // Sibling responses to the same request (minus self).
          responseCount += Math.max(0, (quotesByRequest.get(quotedId) ?? 0) - 1);
        }
        return computeCorroborationScore({
          bestSimilarity,
          matchCount,
          endorsement: endorsementScore({
            likes: Number(post.likes) || 0,
            dislikes: Number(post.dislikes) || 0,
            views: Number(post.views) || 0,
          }),
          responseCount,
        });
      } catch {
        return 0;
      }
    });
  } catch {
    return perPostFallback();
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
): Promise<Array<T & Partial<LiveBreakdownAttachment>>> {
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

    // Corroboration evidence per post (route/tag/geo blend + endorsement +
    // response linkage) — identical computation to the detail path. One
    // shared candidate pool covers the whole list so this stays at a
    // constant handful of queries instead of N per-post lookups.
    const corroborationScores = await computeBatchedCorroboration(prisma, posts, now);

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
            overlappingPostCount: 0,
            corroborationScore: corroborationScores[i] ?? 0,
            detailContext: detailContextFromPost(post),
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
