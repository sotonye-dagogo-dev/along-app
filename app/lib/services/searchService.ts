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
}

export interface SearchPostHit {
  id: string;
  title: string;
  description: string | null;
  type: string;
  region: string | null;
  tags: string[];
  images: string[];
  validityScore: number;
  validityTier: string | null;
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
  try {
    return await (prisma.post.findMany as any)(args);
  } catch (error) {
    if (isMissingColumnError(error) && args?.include?.user?.select?.avatarConfig) {
      const fallbackArgs = {
        ...args,
        include: {
          ...args.include,
          user: { select: { ...USER_SELECT_FALLBACK } },
        },
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
    if (isMissingColumnError(error) && args?.select?.avatarConfig) {
      const { avatarConfig: _omit, ...rest } = args.select;
      void _omit;
      return await (prisma.user.findMany as any)({ ...args, select: rest });
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
  async search(input: SearchParams): Promise<SearchResult> {
    const { query, type, limit, region, postType, cursor } = normalizeSearchParams(input);

    if (!query || query.length < 2) {
      return { posts: [], users: [], tags: [], nextCursor: null };
    }

    // Read-through cache for first-page queries only (cursor pages bypass cache)
    if (!cursor) {
      try {
        const { redis } = await import("@/app/lib/db/redis");
        const cached = await redis.get<SearchResult>(
          CACHE_KEYS.search(`${type}:${region ?? "-"}:${postType ?? "-"}:${query}`, "unified")
        );
        if (cached) return cached;
      } catch {
        // cache miss / unavailable — fall through to DB
      }
    }

    const take = limit + 1;
    const cursorArgs = cursor ? { skip: 1, cursor: { id: cursor } } : {};

    const postWhere: Record<string, unknown> = {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { region: { contains: query, mode: "insensitive" } },
        { tags: { has: query.toLowerCase() } },
      ],
    };
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
    for (const p of pagePosts) {
      for (const t of p.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    const result: SearchResult = { posts: pagePosts, users, tags, nextCursor };

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
