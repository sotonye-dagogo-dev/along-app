import { prisma } from "@/app/lib/db/prisma";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config";
import {
  SEARCH_CONFIG,
  SEARCH_ANALYTICS_CONFIG,
  buildZeroResultPayload,
  normalizeAnalyticsQuery,
  tokenizeSearchQuery,
  scoreTextRelevance,
  type TokenizedQuery,
} from "@/app/lib/config/search";

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

export function normalizeSearchParams(input: SearchParams): Required<Omit<SearchParams, "cursor" | "region" | "postType" | "viewerId">> & Pick<SearchParams, "cursor" | "region" | "postType" | "viewerId"> {
  const query = input.query.trim().slice(0, 100);
  const type = input.type && VALID_TYPES.has(input.type) ? input.type : "all";
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
  const region = input.region?.trim().slice(0, 80) || undefined;
  const postType = input.postType && VALID_POST_TYPES.has(input.postType) ? input.postType : undefined;
  return { query, type, limit, region, postType, cursor: input.cursor, viewerId: input.viewerId };
}

class SearchService {
  /**
   * Best-effort recall of per-step stop names. Route steps live in the
   * `Post.routes` JSON array (local names like "Cele Bus Stop" that no map
   * source knows), so the structured OR-clause cannot see them. One bounded
   * `routes::text ILIKE` query ORs every significant token (phrase + terms)
   * and collects matching ids which are ORed into the main query — failures
   * (or non-Postgres hosts) resolve to [] and the structured search proceeds
   * unchanged. Never throws.
   */
  private async stepLocationIdsForTokens(tokens: string[]): Promise<string[]> {
    const needles = [...new Set(
      tokens
        .map((t) => String(t ?? "").trim().slice(0, 100))
        .filter((t) => t.length >= 2),
    )].slice(0, SEARCH_CONFIG.maxTerms + 1);
    if (needles.length === 0) return [];
    try {
      const { Prisma } = await import("@/app/generated/prisma/client");
      const ors = Prisma.join(
        needles.map((n) => Prisma.sql`routes::text ILIKE ${"%" + n + "%"}`),
        " OR ",
      );
      const rows = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM "Post" WHERE "isArchived" = false AND (${ors}) LIMIT ${SEARCH_CONFIG.stepNamePrefetchLimit}`,
      );
      return Array.isArray(rows) ? rows.map((r) => r.id).filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  /** Per-term structured recall clauses (title/desc/region/tags, lowercased). */
  private termClauses(terms: string[]): Record<string, unknown>[] {
    const clauses: Record<string, unknown>[] = [];
    for (const t of terms) {
      clauses.push(
        { title: { contains: t, mode: "insensitive" } },
        { description: { contains: t, mode: "insensitive" } },
        { region: { contains: t, mode: "insensitive" } },
        { tags: { has: t } },
      );
    }
    return clauses;
  }

  /**
   * Two-phase loose recall (deterministic, capped, never throws beyond the
   * safe-finder fallbacks):
   *  Phase 1 — exact: whole phrase + every significant term (+ stop-name ids).
   *  Phase 2 — typo-recall: head-prefix clauses top the set up to the cap.
   * Phase 1 wins on precision; phase 2 catches single-typo queries that
   * exact recall would miss entirely.
   */
  private async recallPosts(
    query: TokenizedQuery,
    region?: string,
    postType?: SearchPostType,
  ): Promise<Record<string, unknown>[]> {
    const cap = SEARCH_CONFIG.candidateCap;
    const base: Record<string, unknown> = {
      // Deleted/archived authors never surface on user-facing search.
      user: { isDeleted: false, deletionScheduledFor: null },
    };
    if (region) base.region = { contains: region, mode: "insensitive" };
    if (postType) base.type = postType;
    const include = { user: { select: { ...USER_SELECT_FULL } } };
    const orderBy = [{ validityScore: "desc" }, { createdAt: "desc" }];

    const exactOr: Record<string, unknown>[] = [];
    if (query.phrase.length >= 2) {
      exactOr.push(
        { title: { contains: query.phrase, mode: "insensitive" } },
        { description: { contains: query.phrase, mode: "insensitive" } },
        { region: { contains: query.phrase, mode: "insensitive" } },
      );
    }
    exactOr.push(...this.termClauses(query.terms));
    const stepIds = await this.stepLocationIdsForTokens([query.phrase, ...query.terms]);
    if (stepIds.length > 0) exactOr.push({ id: { in: stepIds } });
    if (exactOr.length === 0) return [];

    let recalled: Record<string, unknown>[] = await safePostFindMany({
      where: { ...base, OR: exactOr },
      take: cap,
      include,
      orderBy,
    });

    if (recalled.length < cap && query.terms.length > 0) {
      const found = new Set(recalled.map((r) => String(r.id)));
      const prefixOr: Record<string, unknown>[] = [];
      for (const t of query.terms) {
        const prefix = SEARCH_CONFIG.typoRecallPrefix(t);
        if (prefix.length >= 2 && prefix !== t) {
          prefixOr.push(
            { title: { contains: prefix, mode: "insensitive" } },
            { description: { contains: prefix, mode: "insensitive" } },
            { region: { contains: prefix, mode: "insensitive" } },
          );
        }
      }
      if (prefixOr.length > 0) {
        const extra: Record<string, unknown>[] = await safePostFindMany({
          where: {
            ...base,
            OR: prefixOr,
            ...(found.size > 0 ? { id: { notIn: [...found] } } : {}),
          },
          take: cap - recalled.length,
          include,
          orderBy,
        });
        recalled = recalled.concat(extra);
      }
    }
    return recalled;
  }

  /**
   * Deterministic in-memory relevance rank: whole-phrase ≫ all-terms-covered
   * > per-term exact > per-term fuzzy > validity > recency > id. Rows that
   * match none of the significant terms (pure prefix-recall noise) are
   * dropped; phrase-fallback queries (no terms) keep every recalled row.
   */
  private rankPosts(
    rows: Record<string, unknown>[],
    query: TokenizedQuery,
  ): Record<string, unknown>[] {
    const bagOf = (p: Record<string, unknown>) => ({
      title: p.title,
      description: p.description,
      region: p.region,
      tags: p.tags,
    });
    // Invalid/missing timestamps sort as epoch (never NaN — NaN breaks
    // comparators and makes page order nondeterministic).
    const timeOf = (v: unknown): number => {
      const t = new Date(v as string | Date).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    return rows
      .map((p) => ({ p, rel: scoreTextRelevance(bagOf(p), query).total }))
      .filter((r) => query.terms.length === 0 || r.rel > 0)
      .sort((a, b) => {
        if (b.rel !== a.rel) return b.rel - a.rel;
        const aTrust = typeof a.p.validityScore === "number" ? a.p.validityScore : 0;
        const bTrust = typeof b.p.validityScore === "number" ? b.p.validityScore : 0;
        if (bTrust !== aTrust) return bTrust - aTrust;
        const timeDiff = timeOf(b.p.createdAt) - timeOf(a.p.createdAt);
        if (timeDiff !== 0) return timeDiff;
        return String(a.p.id).localeCompare(String(b.p.id));
      })
      .map((r) => r.p);
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
    const tokenized = tokenizeSearchQuery(query);

    // Tokenized user recall: whole phrase + every significant term across
    // handle + names, so "firstname lastname" matches in any order.
    const userOr: Record<string, unknown>[] = [];
    if (tokenized.phrase.length >= 2) {
      userOr.push(
        { userName: { contains: tokenized.phrase, mode: "insensitive" } },
        { firstName: { contains: tokenized.phrase, mode: "insensitive" } },
        { lastName: { contains: tokenized.phrase, mode: "insensitive" } },
      );
    }
    for (const t of tokenized.terms) {
      userOr.push(
        { userName: { contains: t, mode: "insensitive" } },
        { firstName: { contains: t, mode: "insensitive" } },
        { lastName: { contains: t, mode: "insensitive" } },
      );
    }

    const [recalledPosts, userRows] = await Promise.all([
      type === "users"
        ? Promise.resolve([])
        : this.recallPosts(tokenized, region, postType),
      type === "posts"
        ? Promise.resolve([])
        : userOr.length > 0
          ? safeUserFindMany({
              where: {
                // Deleted/archived accounts are never searchable on user surfaces.
                isDeleted: false,
                deletionScheduledFor: null,
                OR: userOr,
              },
              select: {
                ...USER_SELECT_FULL,
                _count: { select: { posts: true } },
              },
              take: type === "all" ? 5 : take,
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),
    ]);

    // Loose relevance rank over the recalled set (deterministic), then
    // index-based cursor pagination: the cursor is a post id from a previous
    // page; an unknown cursor (deleted/archived since) ends the list instead
    // of looping or duplicating.
    const ranked = this.rankPosts(recalledPosts, tokenized);
    let pagePosts: Record<string, unknown>[];
    let nextCursor: string | null = null;
    if (cursor) {
      const idx = ranked.findIndex((p) => String(p.id) === cursor);
      if (idx === -1) {
        pagePosts = [];
      } else {
        pagePosts = ranked.slice(idx + 1, idx + 1 + limit);
        const lastId = pagePosts.length > 0 ? pagePosts[pagePosts.length - 1]?.id : undefined;
        nextCursor =
          typeof lastId === "string" && lastId !== "" && idx + 1 + limit < ranked.length
            ? lastId
            : null;
      }
    } else {
      pagePosts = ranked.slice(0, limit);
      const lastId = pagePosts.length > 0 ? pagePosts[pagePosts.length - 1]?.id : undefined;
      nextCursor =
        typeof lastId === "string" && lastId !== "" && ranked.length > limit
          ? lastId
          : null;
    }

    // Canonical live trust (same service as feed/detail) so search cards
    // carry identical breakdown values. Best-effort — failures keep rows.
    let trustedPosts = pagePosts as unknown as SearchPostHit[];
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

    // Loose user rank (deterministic): handle + name coverage first, so
    // "lastname firstname" still finds the account in any order.
    const rankedUserRows = (userRows as Array<Record<string, unknown>>)
      .map((u) => ({
        u,
        rel: scoreTextRelevance(
          {
            title: u.userName,
            description: `${String(u.firstName ?? "")} ${String(u.lastName ?? "")}`,
            tags: [],
          },
          tokenized,
        ).total,
      }))
      .sort((a, b) => b.rel - a.rel || String(a.u.id).localeCompare(String(b.u.id)))
      .map((r) => r.u);

    const users: SearchUserHit[] = rankedUserRows.map((u) => ({
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

    // Zero-result analytics (first page only, fire-and-forget, never throws):
    // one AnalyticsEvent per empty result so stopwords/fuzzy thresholds can
    // be tuned from evidence. Cached-empty fast path above returns early and
    // is intentionally NOT logged (already counted on first computation).
    if (!cursor && trustedPosts.length === 0 && users.length === 0 && tags.length === 0) {
      try {
        const payload = buildZeroResultPayload(query, tokenized, { type, region: region ?? undefined, postType: postType ?? undefined });
        if (normalizeAnalyticsQuery(query)) {
          void (async () => {
            try {
              await prisma.analyticsEvent.create({
                data: {
                  eventName: SEARCH_ANALYTICS_CONFIG.eventName,
                  region: typeof region === "string" && region ? region.slice(0, 100) : null,
                  payload: payload as never,
                },
              });
            } catch {
              /* analytics must never break search */
            }
          })();
        }
      } catch {
        /* never break search */
      }
    }

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
