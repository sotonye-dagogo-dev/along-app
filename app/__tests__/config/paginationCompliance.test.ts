/**
 * Pagination compliance — every list route touched by this sprint parses
 * `limit` through the central clamp (no inline `Math.min(Number(...) || n, m)`
 * literals), pins a final id sort key so cursor pages stay deterministic on
 * createdAt ties, keys the notifications cache by effective page size (the
 * badge poller's 1-item payload must never be served to the page), and
 * derives the admin UI meta from the same central config as the admin API.
 */
import fs from "fs";
import path from "path";
import { PAGINATION_CONFIG, clampPageLimit } from "@/app/lib/config";
import { ADMIN_PAGINATION_META } from "@/app/lib/config/admin";
import { CACHE_KEYS, NOTIFICATION_CACHE_LIMITS } from "@/app/lib/config/cache";
import { DEFAULT_FEED_CONFIG, FEED_STREAM_CONFIG } from "@/app/lib/config/feedAlgorithm";

const ROOT = path.resolve(__dirname, "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Every route/service in scope that parses a `limit` query param. */
const CLAMPED_SOURCES = [
  "app/api/posts/feed/route.ts",
  "app/api/posts/route.ts",
  "app/api/search/route.ts",
  "app/api/users/search/route.ts",
  "app/api/notifications/route.ts",
  "app/api/posts/[id]/comments/route.ts",
  "app/api/bookmarks/route.ts",
  "app/api/reviews/route.ts",
  "app/api/admin/posts/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/reviews/route.ts",
  "app/api/admin/bugs/route.ts",
  "app/api/admin/deletions/route.ts",
  "app/api/admin/audit/route.ts",
  "app/lib/services/auditService.ts",
];

/** Cursor list queries that need a final id sort key for stable paging. */
const CURSOR_LIST_SOURCES = [
  "app/api/posts/feed/route.ts",
  "app/api/posts/route.ts",
  "app/api/notifications/route.ts",
  "app/api/posts/[id]/comments/route.ts",
  "app/api/bookmarks/route.ts",
  "app/api/reviews/route.ts",
  "app/api/admin/posts/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/reviews/route.ts",
  "app/api/admin/bugs/route.ts",
  "app/api/admin/deletions/route.ts",
  "app/lib/services/auditService.ts",
];

/**
 * `{ id: "desc" }` / `{ id: sortDir }` final sort key. Deliberately does NOT
 * match `cursor: { id: cursor }` or `select: { id: true }` — those are not
 * ordering clauses.
 */
function hasIdTiebreaker(src: string): boolean {
  return /\{\s*id:\s*(?:"(?:asc|desc)"|[A-Za-z_]*[Dd]ir)(?:\s+as\s+const)?\s*\}/.test(src);
}

describe("limit parsing routes through clampPageLimit", () => {
  it.each(CLAMPED_SOURCES)("%s uses the central clamp", (rel) => {
    const src = read(rel);
    expect(src).toContain("clampPageLimit(");
    // Inline `Math.min(Number(x) || n, m)` literals are what drifted apart.
    expect(src).not.toMatch(/Math\.min\(\s*Number\(/);
  });

  it("surfaces used by the routes match the sprint's table", () => {
    expect(PAGINATION_CONFIG.search).toEqual({ defaultLimit: 10, maxLimit: 50 });
    expect(PAGINATION_CONFIG.notifications).toEqual({ defaultLimit: 20, maxLimit: 50 });
    expect(PAGINATION_CONFIG.comments).toEqual({ defaultLimit: 20, maxLimit: 50 });
    expect(PAGINATION_CONFIG.bookmarks).toEqual({ defaultLimit: 20, maxLimit: 50 });
    expect(PAGINATION_CONFIG.reviews).toEqual({ defaultLimit: 20, maxLimit: 50 });
    expect(PAGINATION_CONFIG.admin).toEqual({ defaultLimit: 20, maxLimit: 100 });
    expect(PAGINATION_CONFIG.badge).toEqual({ defaultLimit: 1, maxLimit: 1 });
  });
});

describe("cursor lists are deterministic (id tiebreaker)", () => {
  it.each(CURSOR_LIST_SOURCES)("%s orders by id as the final sort key", (rel) => {
    expect(hasIdTiebreaker(read(rel))).toBe(true);
  });
});

describe("notifications cache key is limit-scoped", () => {
  it("builds different keys for the badge (1) and page default (20)", () => {
    const badge = CACHE_KEYS.notifications("u1", "all", 1);
    const page = CACHE_KEYS.notifications("u1", "all", PAGINATION_CONFIG.notifications.defaultLimit);
    expect(badge).not.toBe(page);
    expect(badge.endsWith(":1")).toBe(true);
    expect(page.endsWith(":20")).toBe(true);
    // Default arg = the notifications-page size.
    expect(CACHE_KEYS.notifications("u1")).toBe(page);
  });

  it("notificationsAll enumerates every filter × cacheable limit", () => {
    const keys = CACHE_KEYS.notificationsAll("u1");
    for (const filter of ["all", "unread", "rewards"]) {
      for (const limit of NOTIFICATION_CACHE_LIMITS) {
        expect(keys).toContain(CACHE_KEYS.notifications("u1", filter, limit));
      }
    }
    // No key may be enumerated twice (redis.del tolerates it, but the set
    // should mirror the filter × limit matrix exactly).
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(CACHE_KEYS.notifications("u1", "all", 1));
    expect(keys).toContain(CACHE_KEYS.notifications("u1", "all", 20));
  });

  it("route builds the key with the effective limit and only caches keys invalidation covers", () => {
    const src = read("app/api/notifications/route.ts");
    expect(src).toMatch(/CACHE_KEYS\.notifications\([^)]*limit\s*\)/);
    expect(src).toContain("CACHE_KEYS.notificationsAll(userId).includes(cacheKey)");
    // The cache bust still deletes every enumerated key.
    expect(src).toContain("CACHE_KEYS.notificationsAll(userId)");
  });
});

describe("ADMIN_PAGINATION_META mirrors the central config", () => {
  it("defaultLimit/maxLimit equal PAGINATION_CONFIG.admin", () => {
    expect(ADMIN_PAGINATION_META.defaultLimit).toBe(PAGINATION_CONFIG.admin.defaultLimit);
    expect(ADMIN_PAGINATION_META.maxLimit).toBe(PAGINATION_CONFIG.admin.maxLimit);
  });

  it("is derived from PAGINATION_CONFIG.admin (cannot drift)", () => {
    const src = read("app/lib/config/admin.ts");
    expect(src).toContain("PAGINATION_CONFIG.admin.defaultLimit");
    expect(src).toContain("PAGINATION_CONFIG.admin.maxLimit");
    expect(src).not.toMatch(/maxLimit:\s*\d+/);
  });
});

describe("clampPageLimit matrix", () => {
  it("returns the surface default for missing/garbage/zero/negative input", () => {
    for (const raw of [null, undefined, "", "abc", " ", 0, -1, "-20", Number.NaN]) {
      expect(clampPageLimit(raw, "notifications")).toBe(PAGINATION_CONFIG.notifications.defaultLimit);
      expect(clampPageLimit(raw, "admin")).toBe(PAGINATION_CONFIG.admin.defaultLimit);
    }
    // Non-finite numbers never throw.
    expect(clampPageLimit(Number.POSITIVE_INFINITY, "search")).toBe(PAGINATION_CONFIG.search.defaultLimit);
    expect(clampPageLimit(Number.NaN, "search")).toBe(PAGINATION_CONFIG.search.defaultLimit);
  });

  it("clamps over-max input to the surface max", () => {
    expect(clampPageLimit("9999", "admin")).toBe(PAGINATION_CONFIG.admin.maxLimit);
    expect(clampPageLimit(1000, "search")).toBe(PAGINATION_CONFIG.search.maxLimit);
    expect(clampPageLimit("51", "notifications")).toBe(PAGINATION_CONFIG.notifications.maxLimit);
    expect(clampPageLimit("20", "badge")).toBe(PAGINATION_CONFIG.badge.maxLimit);
  });

  it("floors fractional input (then clamps)", () => {
    expect(clampPageLimit("24.9", "notifications")).toBe(24);
    expect(clampPageLimit("79.99", "admin")).toBe(79);
    expect(clampPageLimit(54.7, "search")).toBe(PAGINATION_CONFIG.search.maxLimit);
  });

  it("honors in-range integer input verbatim", () => {
    expect(clampPageLimit("1", "notifications")).toBe(1);
    expect(clampPageLimit(10, "search")).toBe(10);
    expect(clampPageLimit("100", "admin")).toBe(100);
    expect(clampPageLimit(null)).toBe(PAGINATION_CONFIG.default.defaultLimit);
  });
});


describe("feed first-page size (default cap 20, not 10)", () => {
  it("server fallback, feedService config and client stream all default to 20", () => {
    expect(PAGINATION_CONFIG.feed.defaultLimit).toBe(20);
    expect(DEFAULT_FEED_CONFIG.pageSize).toBe(20);
    expect(FEED_STREAM_CONFIG.pageSize).toBe(20);
  });

  it("feed route + stream + zod schema all read the central config", () => {
    expect(read("app/api/posts/feed/route.ts")).toContain('clampPageLimit(searchParams.get("limit"), "feed")');
    expect(read("app/lib/streams/feedStream.ts")).toContain("FEED_STREAM_CONFIG.pageSize");
    expect(read("app/lib/schemas/post.ts")).toContain("PAGINATION_CONFIG.feed.defaultLimit");
  });

  it("feedStream never flips hasMore off on a transient fetch failure", () => {
    const stream = read("app/lib/streams/feedStream.ts");
    // fetchFeed resolves null on failure; callers keep cursor/hasMore.
    expect(stream).toContain("Promise<FeedState | null>");
    expect(stream).toContain("armErrorBackoff");
    expect(stream).not.toMatch(
      /if \(!res\.ok\) return \{ posts: \[\], cursor: null, hasMore: false/,
    );
  });
});
