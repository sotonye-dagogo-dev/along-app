import { prisma } from "@/app/lib/db/prisma";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config";

export type SearchType = "all" | "posts" | "users";
export type SearchPostType = "ROUTE" | "ROUTE_REQUEST" | "ROUTE_RESPONSE";

export interface SearchParams {
  query: string;
  type?: SearchType;
  region?: string;
  postType?: SearchPostType;
  limit?: number;
  cursor?: string;
  /** Viewer for interaction enrichment (_isLiked/_isDisliked/_isBookmarked). Optional — guests get false. */
  viewerId?: string;
}

export interface SearchPostHit {
  id: string;
  title: string;
  description: string | null;
  type: string;
  region: string | null;
  tags: string[];
  images: string[];
  likes: number;
  dislikes: number;
  comments: number;
  bookmarks: number;
  _isLiked?: boolean;
  _isDisliked?: boolean;
  _isBookmarked?: boolean;
  isArchived?: boolean;
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
  totalDistanceKm: number | null;
  estimatedMins: number | null;
  createdAt: Date;
  user: {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
}

export interface SearchUserHit {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  verified: boolean;
  postCount?: number;
}

export interface SearchResult {
  posts: SearchPostHit[];
  users: SearchUserHit[];
  tags: { tag: string; count: number }[];
  nextCursor: string | null;
}

const USER_SELECT_FULL = {
  id: true,
  userName: true,
  firstName: true,
  lastName: true,
  avatar: true,
  avatarConfig: true,
  verified: true,
} as const;

const USER_SELECT_FALLBACK = {
  id: true,
  userName: true,
  firstName: true,
  lastName: true,
  avatar: true,
} as const;

function isMissingColumnError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as { code?: string }).code === "P2022" ||
      (error.name === "PrismaClientKnownRequestError" &&
        (error as { code?: string }).code === "P2022"))
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma P2022 fallback casts (same pattern as feedService) */
async function safePostFindMany(args: any): Promise<any[]> {
  // Archived posts never surface in search (owner/admin can still open by link).
  const filteredArgs =
    args?.where && typeof args.where === "object" && !("isArchived" in args.where)
      ? { ...args, where: { ...args.where, isArchived: false } }
      : args;
  try {
    return await (prisma.post.findMany as any)(filteredArgs);
  } catch (error) {
    if (isMissingColumnError(error)) {
      const { isArchived: _drop, user: _userFilter, ...restWhere } = filteredArgs?.where ?? {};
      void _drop; void _userFilter;
      const fallbackArgs = {
        ...filteredArgs,
        ...(filteredArgs?.where ? { where: restWhere } : {}),
        ...(filteredArgs?.include?.user?.select?.avatarConfig
          ? { include: { ...filteredArgs.include, user: { select: { ...USER_SELECT_FALLBACK } } } }
          : {}),
      };
      return await (prisma.post.findMany as any)(fallbackArgs);
    }
    throw error;
  }
}

async function safeUserFindMany(args: any): Promise<any[]> {
  try {
    return await (prisma.user.findMany as any)(args);
  } catch (error) {
    if (isMissingColumnError(error)) {
      // Strip additive selects + visibility filters for legacy DBs.
      const { isDeleted: _del, deletionScheduledFor: _sched, ...restWhere } = args?.where ?? {};
      void _del; void _sched;
      const { avatarConfig: _omit, ...rest } = args.select ?? {};
      void _omit;
      return await (prisma.user.findMany as any)({ ...args, where: restWhere, select: rest });
    }
    throw error;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const VALID_TYPES = new Set<SearchType>(["all", "posts", "users"]);
const VALID_POST_TYPES = new Set<SearchPostType>(["ROUTE", "ROUTE_REQUEST", "ROUTE_RESPONSE"]);

export function normalizeSearchParams(input: SearchParams): Required<Omit<SearchParams, "cursor" | "region" | "postType">> & Pick<SearchParams, "cursor" | "region" | "postType"> {
  const query = input.query.trim().slice(0, 100);
  const type = input.type && VALID_TYPES.has(input.type) ? input.type : "all";
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
  const region = input.region?.trim().slice(0, 80) || undefined;
  const postType = input.postType && VALID_POST_TYPES.has(input.postType) ? input.postType : undefined;
  return { query, type, limit, region, postType, cursor: input.cursor };
}

class SearchService {
  /**
   * Best-effort recall of per-step stop names. Route steps live in the
   * `Post.routes` JSON array (local names like "Cele Bus Stop" that no map
   * source knows), so the structured OR-clause above cannot see them. A
   * bounded `routes::text ILIKE` prefetch collects matching ids which are ORed
   * into the main query — failures (or non-Postgres hosts) resolve to [] and
   * the structured search proceeds unchanged. Never throws.
   */
  private async stepLocationIds(query: string): Promise<string[]> {
    const q = query.trim().slice(0, 100);
    if (q.length < 2) return [];
    try {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Post"
        WHERE "isArchived" = false AND routes::text ILIKE ${"%" + q + "%"}
        LIMIT 25
      `;
      return Array.isArray(rows) ? rows.map((r) => r.id).filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  async search(input: SearchParams): Promise<SearchResult> {
    const { query, type, limit, region, postType, cursor } = normalizeSearchParams(input);
    const viewerId = typeof (input as { viewerId?: unknown }).viewerId === "string"
      ? ((input as { viewerId?: string }).viewerId as string)
      : undefined;

    if (!query || query.length < 2) {
      return { posts: [], users: [], tags: [], nextCursor: null };
    }

    // Read-through cache for first-page queries only (cursor pages bypass cache).
    // Cached post rows are re-enriched with fresh trust (same canonical
    // service as feed/detail) so cached searches never disagree with detail.
    if (!cursor) {
      try {
        const { redis } = await import("@/app/lib/db/redis");
        const cached = await redis.get<SearchResult>(
          CACHE_KEYS.search(`${type}:${region ?? "-"}:${postType ?? "-"}:${query}`, "unified")
        );
        if (cached) {
          // Empty cached pages carry nothing to re-enrich — return as-is so
          // callers keep a stable reference and we skip a needless import.
          if (!cached.posts || cached.posts.length === 0) return cached;
          try {
            const { attachLiveBreakdownsToPosts } = await import(
              "@/app/lib/services/trustBreakdownService"
            );
            const fresh = await attachLiveBreakdownsToPosts(
              prisma,
              (cached.posts ?? []) as unknown as { id: string }[]
            );
            let posts = fresh as unknown as SearchPostHit[];
            // Per-viewer interaction overlay on cached rows (cache is shared).
            if (viewerId) {
              try {
                const ids = posts.map((p) => p.id).filter(Boolean);
                const [likes, dislikes, bookmarks] = await Promise.all([
                  (prisma.like.findMany({ where: { postId: { in: ids }, userId: viewerId, type: "LIKE" }, select: { postId: true } }) as Promise<{ postId: string }[]>).catch(() => [] as { postId: string }[]),
                  (prisma.like.findMany({ where: { postId: { in: ids }, userId: viewerId, type: "DISLIKE" }, select: { postId: true } }) as Promise<{ postId: string }[]>).catch(() => [] as { postId: string }[]),
                  (prisma.bookmark.findMany({ where: { postId: { in: ids }, userId: viewerId }, select: { postId: true } }) as Promise<{ postId: string }[]>).catch(() => [] as { postId: string }[]),
                ]);
                const liked = new Set(likes.map((l) => l.postId));
                const disliked = new Set(dislikes.map((l) => l.postId));
                const saved = new Set(bookmarks.map((b) => b.postId));
                posts = posts.map((p) => ({ ...p, _isLiked: liked.has(p.id), _isDisliked: disliked.has(p.id), _isBookmarked: saved.has(p.id) }));
              } catch { /* keep fresh rows */ }
            }
            return { ...cached, posts };
          } catch {
            return cached;
          }
        }
      } catch {
        // cache miss / unavailable — fall through to DB
      }
    }

    const take = limit + 1;
    const cursorArgs = cursor ? { skip: 1, cursor: { id: cursor } } : {};

    const postWhere: Record<string, unknown> = {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        // Route descriptions carry the local stop/street names map sources
        // miss — matching here is what drives community wording to results.
        { description: { contains: query, mode: "insensitive" } },
        { region: { contains: query, mode: "insensitive" } },
        { tags: { has: query.toLowerCase() } },
      ],
      // Deleted/archived authors never surface on user-facing search.
      user: { isDeleted: false, deletionScheduledFor: null },
    };
    // Per-step stop names (routes JSON) recall — best-effort ids ORed in.
    // Runs before the main query; on miss the OR is simply not extended.
    if (type !== "users") {
      const stepIds = await this.stepLocationIds(query);
      if (stepIds.length > 0) {
        (postWhere.OR as unknown[]).push({ id: { in: stepIds } });
      }
    }
    if (region) postWhere.region = { contains: region, mode: "insensitive" };
    if (postType) postWhere.type = postType;

    const [postRows, userRows] = await Promise.all([
      type === "users"
        ? Promise.resolve([])
        : safePostFindMany({
            where: postWhere,
            take,
            ...cursorArgs,
            include: { user: { select: { ...USER_SELECT_FULL } } },
            orderBy: [{ validityScore: "desc" }, { createdAt: "desc" }],
          }),
      type === "posts"
        ? Promise.resolve([])
        : safeUserFindMany({
            where: {
              // Deleted/archived accounts are never searchable on user surfaces.
              isDeleted: false,
              deletionScheduledFor: null,
              OR: [
                { userName: { contains: query, mode: "insensitive" } },
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
              ],
            },
            select: {
              ...USER_SELECT_FULL,
              _count: { select: { posts: true } },
            },
            take: type === "all" ? 5 : take,
            orderBy: { createdAt: "desc" },
          }),
    ]);

    const hasMorePosts = postRows.length > limit;
    const pagePosts = (hasMorePosts ? postRows.slice(0, limit) : postRows) as SearchPostHit[];
    // Cursor is post-id based (posts drive pagination); user hits are top-N per query
    const nextCursor =
      type !== "users" && hasMorePosts && pagePosts.length > 0
        ? pagePosts[pagePosts.length - 1].id
        : null;

    // Canonical live trust (same service as feed/detail) so search cards
    // carry identical breakdown values. Best-effort — failures keep rows.
    let trustedPosts = pagePosts;
    try {
      const { attachLiveBreakdownsToPosts } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      trustedPosts = (await attachLiveBreakdownsToPosts(
        prisma,
        pagePosts as unknown as { id: string }[]
      )) as unknown as SearchPostHit[];
    } catch { /* stored rows */ }

    // Viewer-scoped interaction enrichment (parity with GET /api/posts) so
    // search cards render the same filled like/bookmark state and fire the
    // same actions as feed/profile. Never throws — failures keep plain rows.
    if (viewerId) {
      try {
        const ids = trustedPosts.map((p) => p.id).filter(Boolean);
        if (ids.length > 0) {
          const [likes, dislikes, bookmarks] = await Promise.all([
            (prisma.like.findMany({ where: { postId: { in: ids }, userId: viewerId, type: "LIKE" }, select: { postId: true } }) as Promise<{ postId: string }[]>).catch(() => [] as { postId: string }[]),
            (prisma.like.findMany({ where: { postId: { in: ids }, userId: viewerId, type: "DISLIKE" }, select: { postId: true } }) as Promise<{ postId: string }[]>).catch(() => [] as { postId: string }[]),
            (prisma.bookmark.findMany({ where: { postId: { in: ids }, userId: viewerId }, select: { postId: true } }) as Promise<{ postId: string }[]>).catch(() => [] as { postId: string }[]),
          ]);
          const liked = new Set(likes.map((l) => l.postId));
          const disliked = new Set(dislikes.map((l) => l.postId));
          const saved = new Set(bookmarks.map((b) => b.postId));
          trustedPosts = trustedPosts.map((p) => ({
            ...p,
            _isLiked: liked.has(p.id),
            _isDisliked: disliked.has(p.id),
            _isBookmarked: saved.has(p.id),
          }));
        }
      } catch { /* plain rows */ }
    } else {
      trustedPosts = trustedPosts.map((p) => ({
        ...p,
        _isLiked: false,
        _isDisliked: false,
        _isBookmarked: false,
      }));
    }

    const users: SearchUserHit[] = (userRows as Array<Record<string, unknown>>).map((u) => ({
      id: u.id as string,
      userName: u.userName as string,
      firstName: u.firstName as string,
      lastName: u.lastName as string,
      avatar: (u.avatar as string | null) ?? null,
      verified: (u.verified as boolean) ?? false,
      postCount: (u as { _count?: { posts?: number } })._count?.posts,
    }));

    // Trending/related tags derived from matched post tags (top 8 by frequency)
    const tagCounts = new Map<string, number>();
    for (const p of trustedPosts) {
      for (const t of p.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    const result: SearchResult = { posts: trustedPosts, users, tags, nextCursor };

    if (!cursor) {
      try {
        const { redis } = await import("@/app/lib/db/redis");
        await redis.set(
          CACHE_KEYS.search(`${type}:${region ?? "-"}:${postType ?? "-"}:${query}`, "unified"),
          result,
          { ex: CACHE_TTL.searchResults }
        );
      } catch {
        // cache write failure is non-critical
      }
    }

    return result;
  }
}

export const searchService = new SearchService();
