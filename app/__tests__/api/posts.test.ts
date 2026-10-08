/**
 * @jest-environment node
 *
 * H1/H4: Posting E2E verification at the API boundary.
 * POST /api/posts (create → 201, validation, quote rules, fan-out notifications)
 * GET  /api/posts (list, filters used by profile tabs, pagination envelope)
 */
import { POST, GET } from "@/app/api/posts/route"

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))
jest.mock("@/app/lib/utils/auth", () => ({ getUserFromRequest: jest.fn() }))
jest.mock("@/app/lib/services/qstashService", () => ({
  qstashService: {
    publishRewardsAward: jest.fn(),
    publishFeedInvalidation: jest.fn(),
    publishValidityRecompute: jest.fn(),
  },
}))
jest.mock("@/app/lib/services/notificationService", () => ({
  createNotification: jest.fn().mockResolvedValue("n1"),
  getFollowerIds: jest.fn().mockResolvedValue(["follower-1"]),
  invalidateNotificationCaches: jest.fn().mockResolvedValue(undefined),
}))
jest.mock("@/app/lib/db/redis", () => ({
  redis: { del: jest.fn().mockResolvedValue(1), get: jest.fn().mockResolvedValue(null), set: jest.fn() },
}))

import { prisma } from "@/app/lib/db/prisma"
import { getUserFromRequest } from "@/app/lib/utils/auth"
import { createNotification, getFollowerIds } from "@/app/lib/services/notificationService"

const mockPrisma = prisma as unknown as {
  post: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock }
}
const mockAuth = getUserFromRequest as jest.Mock

const validPayload = {
  title: "Yaba to CMS route request",
  description: "Looking for a reliable morning route to CMS",
  type: "ROUTE_REQUEST",
  routes: [{ location: "Yaba" }, { location: "CMS" }],
  tags: ["yaba", "cms"],
}

function postReq(payload: unknown) {
  return { json: async () => payload } as never
}
function getReq(url: string) {
  return { url } as never
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("POST /api/posts", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(postReq(validPayload))
    expect(res.status).toBe(401)
    expect(mockPrisma.post.create).not.toHaveBeenCalled()
  })

  it("returns 400 for malformed JSON", async () => {
    mockAuth.mockResolvedValue({ id: "u1" })
    const bad = { json: async () => { throw new SyntaxError("bad json") } } as never
    const res = await POST(bad)
    expect(res.status).toBe(400)
  })

  it("returns 400 with validation details when payload is invalid", async () => {
    mockAuth.mockResolvedValue({ id: "u1" })
    const res = await POST(postReq({ title: "short", routes: [{ location: "A" }] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Validation failed")
    expect(body.details).toBeDefined()
    expect(mockPrisma.post.create).not.toHaveBeenCalled()
  })

  it("returns 400 when the quoted post no longer exists", async () => {
    mockAuth.mockResolvedValue({ id: "u1" })
    mockPrisma.post.findUnique.mockResolvedValue(null)
    const res = await POST(postReq({ ...validPayload, quotedPostId: "missing" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("quoted post")
    expect(mockPrisma.post.create).not.toHaveBeenCalled()
  })

  it("creates a ROUTE_REQUEST and fans out to followers", async () => {
    mockAuth.mockResolvedValue({ id: "u1" })
    mockPrisma.post.create.mockResolvedValue({
      id: "p1",
      ...validPayload,
      userId: "u1",
      validityScore: 40,
      validityTier: "Developing",
      user: { id: "u1", userName: "tester" },
    })

    const res = await POST(postReq(validPayload))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.post.id).toBe("p1")

    expect(mockPrisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          type: "ROUTE_REQUEST",
          description: validPayload.description,
        }),
      })
    )
    expect(getFollowerIds).toHaveBeenCalledWith("u1")
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "ROUTE_REQUEST" }))
  })

  it("creates a ROUTE_RESPONSE that quotes the request and notifies its author", async () => {
    mockAuth.mockResolvedValue({ id: "u2" })
    mockPrisma.post.findUnique.mockResolvedValue({ userId: "u1" })
    mockPrisma.post.create.mockResolvedValue({
      id: "p2",
      type: "ROUTE_RESPONSE",
      userId: "u2",
      quotedPostId: "p1",
      validityScore: 40,
      validityTier: "Developing",
      user: { id: "u2", userName: "responder" },
    })

    const res = await POST(
      postReq({ ...validPayload, type: "ROUTE_RESPONSE", quotedPostId: "p1" })
    )
    expect(res.status).toBe(201)
    expect(mockPrisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "ROUTE_RESPONSE", quotedPostId: "p1" }),
      })
    )
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ROUTE_RESPONSE" })
    )
    expect(getFollowerIds).not.toHaveBeenCalled()
  })

  it("returns 500 on unexpected database failure", async () => {
    mockAuth.mockResolvedValue({ id: "u1" })
    mockPrisma.post.create.mockRejectedValue(new Error("db down"))
    const res = await POST(postReq(validPayload))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})

describe("GET /api/posts", () => {
  it("returns posts with a pagination envelope", async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      { id: "p1", title: "A" },
      { id: "p2", title: "B" },
    ])
    const res = await GET(getReq("http://localhost/api/posts?limit=20"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it("applies userId / type / likedBy / bookmarkedBy filters (profile tabs)", async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    await GET(
      getReq(
        "http://localhost/api/posts?userId=u1&type=ROUTE&likedBy=u9&bookmarkedBy=u9&limit=20"
      )
    )
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "u1",
          type: "ROUTE",
          postLikes: { some: { userId: "u9", type: "LIKE" } },
          postBookmarks: { some: { userId: "u9" } },
        },
      })
    )
  })

  it("excludes archived posts from public listings (guest view)", async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    await GET(getReq("http://localhost/api/posts?limit=20"))
    const args = mockPrisma.post.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ isArchived: false })
  })

  it("returns 503 when the database is unavailable", async () => {
    const err = new Error("init") as Error & { name: string }
    err.name = "PrismaClientInitializationError"
    mockPrisma.post.findMany.mockRejectedValue(err)
    const res = await GET(getReq("http://localhost/api/posts?limit=20"))
    expect(res.status).toBe(503)
  })
})
