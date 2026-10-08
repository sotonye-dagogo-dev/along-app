/**
 * @jest-environment node
 *
 * GET /api/search — unified posts + users search boundary.
 * Mocks searchService via prisma; verifies validation, type filtering,
 * rate-limit pass-through, and sanitized error envelopes.
 */
import { GET } from "@/app/api/search/route";

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
jest.mock("@/app/lib/utils/rateLimit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true })),
}));

import { prisma } from "@/app/lib/db/prisma";
import { redis } from "@/app/lib/db/redis";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

const mockPost = prisma.post as unknown as { findMany: jest.Mock };
const mockUser = prisma.user as unknown as { findMany: jest.Mock };
const mockRedis = redis as unknown as { get: jest.Mock };
const mockCheckRateLimit = checkRateLimit as jest.Mock;

function getReq(url: string) {
  return { url, headers: new Headers() } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.get.mockResolvedValue(null);
  mockPost.findMany.mockResolvedValue([]);
  mockUser.findMany.mockResolvedValue([]);
});

describe("GET /api/search", () => {
  it("returns 400 when q is missing", async () => {
    const res = await GET(getReq("http://localhost/api/search"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/search term/i);
  });

  it("returns empty envelope for single-character queries", async () => {
    const res = await GET(getReq("http://localhost/api/search?q=a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toEqual([]);
    expect(body.users).toEqual([]);
    expect(mockPost.findMany).not.toHaveBeenCalled();
  });

  it("returns 400 for overlong queries", async () => {
    const res = await GET(getReq(`http://localhost/api/search?q=${"x".repeat(101)}`));
    expect(res.status).toBe(400);
  });

  it("searches posts and users for type=all", async () => {
    mockPost.findMany.mockResolvedValue([
      { id: "p1", title: "Yaba to CMS", tags: ["yaba"], user: { id: "u1", userName: "a" } },
    ]);
    mockUser.findMany.mockResolvedValue([
      { id: "u2", userName: "yaba_fan", firstName: "Y", lastName: "B", avatar: null, verified: false },
    ]);
    const res = await GET(getReq("http://localhost/api/search?q=yaba"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toHaveLength(1);
    expect(body.users).toHaveLength(1);
    expect(body.tags).toBeDefined();
    expect(mockPost.findMany).toHaveBeenCalled();
    expect(mockUser.findMany).toHaveBeenCalled();
  });

  it("skips user query when type=posts", async () => {
    const res = await GET(getReq("http://localhost/api/search?q=yaba&type=posts"));
    expect(res.status).toBe(200);
    expect(mockUser.findMany).not.toHaveBeenCalled();
    expect(mockPost.findMany).toHaveBeenCalled();
  });

  it("skips post query when type=users", async () => {
    const res = await GET(getReq("http://localhost/api/search?q=yaba&type=users"));
    expect(res.status).toBe(200);
    expect(mockPost.findMany).not.toHaveBeenCalled();
    expect(mockUser.findMany).toHaveBeenCalled();
  });

  it("applies region and postType filters to the post query", async () => {
    await GET(getReq("http://localhost/api/search?q=yaba&region=Lagos&postType=ROUTE"));
    expect(mockPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          region: { contains: "Lagos", mode: "insensitive" },
          type: "ROUTE",
        }),
      })
    );
  });

  it("returns 503 when the database is unavailable", async () => {
    const err = new Error("init") as Error & { name: string };
    err.name = "PrismaClientInitializationError";
    mockPost.findMany.mockRejectedValue(err);
    const res = await GET(getReq("http://localhost/api/search?q=yaba&type=posts"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 429 when rate-limited", async () => {
    const limited = new Response(JSON.stringify({ error: "Too many" }), { status: 429 });
    mockCheckRateLimit.mockReturnValueOnce({ allowed: false, response: limited });
    const res = await GET(getReq("http://localhost/api/search?q=yaba"));
    expect(res.status).toBe(429);
  });
});
