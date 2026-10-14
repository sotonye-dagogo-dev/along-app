/**
 * @jest-environment node
 *
 * searchService — normalization, short-query guard, cache read-through,
 * loose tokenized recall + relevance ranking, tag aggregation, and
 * index-based cursor pagination.
 */
import { normalizeSearchParams, searchService } from "@/app/lib/services/searchService";

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    post: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));
jest.mock("@/app/lib/db/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(1),
  },
}));
// The routes-JSON stop-name prefetch dynamically imports the generated
// client; stub the Prisma namespace so no engine code loads in tests.
jest.mock("@/app/generated/prisma/client", () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    join: jest.fn((parts: unknown[], sep: unknown) => ({ parts, sep })),
  },
}));

import { prisma } from "@/app/lib/db/prisma";
import { redis } from "@/app/lib/db/redis";

const mockPost = prisma.post as unknown as { findMany: jest.Mock };
const mockUser = prisma.user as unknown as { findMany: jest.Mock };
const mockRedis = redis as unknown as { get: jest.Mock; set: jest.Mock };

// Fixture rows returned by the post mock (honest-DB simulation: the mock
// respects `id.notIn` so phase-2 typo-recall never resurfaces phase-1 rows).
let postFixture: Array<Record<string, unknown>> = [];

beforeEach(() => {
  jest.clearAllMocks();
  postFixture = [];
  mockRedis.get.mockResolvedValue(null);
  mockPost.findMany.mockImplementation(
    (args?: { where?: { id?: { notIn?: string[] } } }) => {
      const notIn = args?.where?.id?.notIn ?? [];
      return Promise.resolve(postFixture.filter((r) => !notIn.includes(String(r.id))));
    },
  );
  mockUser.findMany.mockResolvedValue([]);
});

function postRow(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title,
    description: null,
    region: null,
    tags: [],
    user: { id: "u1" },
    validityScore: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...extra,
  };
}

describe("normalizeSearchParams", () => {
  it("defaults type to all and clamps limit", () => {
    expect(normalizeSearchParams({ query: " yaba " }).type).toBe("all");
    expect(normalizeSearchParams({ query: "yaba", limit: 999 }).limit).toBe(50);
    expect(normalizeSearchParams({ query: "yaba", limit: 0 }).limit).toBe(10);
  });

  it("rejects invalid type and postType values", () => {
    const n = normalizeSearchParams({ query: "yaba", type: "nope" as never, postType: "NOPE" as never });
    expect(n.type).toBe("all");
    expect(n.postType).toBeUndefined();
  });

  it("trims and truncates the query", () => {
    expect(normalizeSearchParams({ query: `  ${"x".repeat(200)}  ` }).query).toHaveLength(100);
  });
});

describe("searchService.search", () => {
  it("returns an empty envelope for short queries without hitting the DB", async () => {
    const res = await searchService.search({ query: "a" });
    expect(res).toEqual({ posts: [], users: [], tags: [], nextCursor: null });
    expect(mockPost.findMany).not.toHaveBeenCalled();
  });

  it("returns cached results without hitting the DB", async () => {
    const cached = { posts: [], users: [], tags: [], nextCursor: null };
    mockRedis.get.mockResolvedValueOnce(cached);
    const res = await searchService.search({ query: "yaba" });
    // Deep equality (not reference): cached pages are re-enriched with live
    // trust before return, so non-empty pages are new objects by design.
    expect(res).toEqual(cached);
    expect(mockPost.findMany).not.toHaveBeenCalled();
  });

  it("re-enriches non-empty cached pages without hitting the post table", async () => {
    const cached = {
      posts: [{ id: "p1", title: "A", tags: ["yaba"], user: { id: "u1" } }],
      users: [],
      tags: [{ tag: "yaba", count: 1 }],
      nextCursor: null,
    };
    mockRedis.get.mockResolvedValueOnce(cached);
    const res = await searchService.search({ query: "yaba" });
    expect(res.posts).toHaveLength(1);
    expect(mockPost.findMany).not.toHaveBeenCalled();
  });

  it("aggregates tags from matched posts", async () => {
    postFixture = [
      postRow("p1", "Yaba run", { tags: ["yaba", "cms"] }),
      postRow("p2", "Yaba nights", { tags: ["yaba"] }),
    ];
    const res = await searchService.search({ query: "yaba", type: "posts" });
    expect(res.posts).toHaveLength(2);
    expect(res.tags[0]).toEqual({ tag: "yaba", count: 2 });
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it("paginates ranked posts with nextCursor", async () => {
    postFixture = Array.from({ length: 11 }, (_, i) =>
      postRow(`p${i}`, `Yaba Post ${i}`, {
        // Staggered recency: p10 newest so ranked order is deterministic.
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      }),
    );
    const res = await searchService.search({ query: "yaba", type: "posts", limit: 10 });
    expect(res.posts).toHaveLength(10);
    expect(res.posts[0].id).toBe("p10");
    expect(res.nextCursor).toBe("p1");
  });

  it("continues from a cursor and ends the list", async () => {
    postFixture = ["a", "b", "c"].map((s) => postRow(s, `Yaba ${s}`));
    const first = await searchService.search({ query: "yaba", type: "posts", limit: 2 });
    expect(first.posts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(first.nextCursor).not.toBeNull();
    const second = await searchService.search({
      query: "yaba",
      type: "posts",
      limit: 2,
      cursor: first.nextCursor as string,
    });
    expect(second.posts.map((p) => p.id)).toEqual(["c"]);
    expect(second.nextCursor).toBeNull();
  });

  it("ends the list on an unknown cursor instead of looping", async () => {
    postFixture = [postRow("a", "Yaba a")];
    const res = await searchService.search({ query: "yaba", type: "posts", cursor: "gone" });
    expect(res.posts).toEqual([]);
    expect(res.nextCursor).toBeNull();
  });

  it("matches every significant term regardless of order or connectors", async () => {
    postFixture = [postRow("p1", "Ajah from Lekki", { description: "Evening shuttle" })];
    const res = await searchService.search({ query: "Lekki to Ajah", type: "posts" });
    expect(res.posts.map((p) => p.id)).toEqual(["p1"]);
  });

  it("ranks the exact-phrase match above partial matches", async () => {
    postFixture = [
      postRow("partial", "Lekki market gist"),
      postRow("exact", "Lekki to Ajah Express"),
    ];
    const res = await searchService.search({ query: "Lekki to Ajah", type: "posts" });
    expect(res.posts.map((p) => p.id)).toEqual(["exact", "partial"]);
  });

  it("tolerates single-typo terms via fuzzy coverage", async () => {
    postFixture = [postRow("p1", "Lekki Phase 1")];
    const res = await searchService.search({ query: "Leki Phase 1", type: "posts" });
    expect(res.posts.map((p) => p.id)).toEqual(["p1"]);
  });

  it("retries post query without avatarConfig on P2022", async () => {
    const p2022 = Object.assign(new Error("missing column"), { code: "P2022", name: "PrismaClientKnownRequestError" });
    mockPost.findMany.mockRejectedValueOnce(p2022);
    const res = await searchService.search({ query: "yaba", type: "posts" });
    expect(res.posts).toEqual([]);
    // Phase-1 attempt + P2022 retry + phase-2 typo-recall top-up.
    expect(mockPost.findMany).toHaveBeenCalledTimes(3);
  });
});
