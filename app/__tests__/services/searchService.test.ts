/**
 * @jest-environment node
 *
 * searchService — normalization, short-query guard, cache read-through,
 * tag aggregation, and cursor envelope.
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

import { prisma } from "@/app/lib/db/prisma";
import { redis } from "@/app/lib/db/redis";

const mockPost = prisma.post as unknown as { findMany: jest.Mock };
const mockUser = prisma.user as unknown as { findMany: jest.Mock };
const mockRedis = redis as unknown as { get: jest.Mock; set: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.get.mockResolvedValue(null);
  mockPost.findMany.mockResolvedValue([]);
  mockUser.findMany.mockResolvedValue([]);
});

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
    expect(res).toBe(cached);
    expect(mockPost.findMany).not.toHaveBeenCalled();
  });

  it("aggregates tags from matched posts", async () => {
    mockPost.findMany.mockResolvedValue([
      { id: "p1", title: "A", tags: ["yaba", "cms"], user: { id: "u1" } },
      { id: "p2", title: "B", tags: ["yaba"], user: { id: "u1" } },
    ]);
    const res = await searchService.search({ query: "yaba", type: "posts" });
    expect(res.posts).toHaveLength(2);
    expect(res.tags[0]).toEqual({ tag: "yaba", count: 2 });
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it("paginates posts with nextCursor", async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i}`,
      title: `Post ${i}`,
      tags: [],
      user: { id: "u1" },
    }));
    mockPost.findMany.mockResolvedValue(rows);
    const res = await searchService.search({ query: "yaba", type: "posts", limit: 10 });
    expect(res.posts).toHaveLength(10);
    expect(res.nextCursor).toBe("p9");
  });

  it("retries post query without avatarConfig on P2022", async () => {
    const p2022 = Object.assign(new Error("missing column"), { code: "P2022", name: "PrismaClientKnownRequestError" });
    mockPost.findMany.mockRejectedValueOnce(p2022).mockResolvedValueOnce([]);
    const res = await searchService.search({ query: "yaba", type: "posts" });
    expect(res.posts).toEqual([]);
    expect(mockPost.findMany).toHaveBeenCalledTimes(2);
  });
});
