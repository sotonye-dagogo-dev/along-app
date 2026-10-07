/**
 * @jest-environment node
 *
 * H4: Mutation E2E tests for like / bookmark / comment / follow —
 * happy paths, toggle semantics, auth/validation guards, and error paths.
 */
import { POST as likePost } from "@/app/api/posts/[id]/like/route"
import { POST as bookmarkPost } from "@/app/api/posts/[id]/bookmark/route"
import { POST as commentPost, GET as commentGet } from "@/app/api/posts/[id]/comments/route"
import { POST as followPost, DELETE as followDelete } from "@/app/api/users/[id]/follow/route"

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    like: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    bookmark: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    comment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    post: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn(), deleteMany: jest.fn() },
    follow: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
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

import { prisma } from "@/app/lib/db/prisma"
import { getUserFromRequest } from "@/app/lib/utils/auth"

type ModelMock = Record<string, jest.Mock>
const mockPrisma = prisma as unknown as {
  like: ModelMock
  bookmark: ModelMock
  comment: ModelMock
  post: ModelMock
  notification: ModelMock
  follow: ModelMock
  user: ModelMock
  $transaction: jest.Mock
}
const mockAuth = getUserFromRequest as jest.Mock
const params = { params: Promise.resolve({ id: "p1" }) }
const jsonReq = (payload: unknown = {}) => ({ json: async () => payload }) as never
const bareReq = {} as never

const me = { id: "u1", firstName: "Ada", lastName: "Lovelace" }

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(mockPrisma)
    return arg // array form
  })
})

describe("POST /api/posts/[id]/like", () => {
  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await likePost(jsonReq(), params)
    expect(res.status).toBe(401)
  })

  it("creates a new LIKE, increments counter, notifies the author", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.like.findUnique.mockResolvedValue(null)
    mockPrisma.post.findUnique.mockResolvedValue({ userId: "u2", title: "Their post" })

    const res = await likePost(jsonReq({ type: "LIKE" }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ liked: true, type: "LIKE" })
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.like.create).toHaveBeenCalledWith({
      data: { postId: "p1", userId: "u1", type: "LIKE" },
    })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it("toggles off an existing identical like", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.like.findUnique.mockResolvedValue({ id: "l1", type: "LIKE" })

    const res = await likePost(jsonReq({ type: "LIKE" }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ liked: false, type: null })
    expect(mockPrisma.like.delete).toHaveBeenCalledWith({ where: { id: "l1" } })
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { likes: { decrement: 1 } } })
    )
  })

  it("does not notify when liking your own post", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.like.findUnique.mockResolvedValue(null)
    mockPrisma.post.findUnique.mockResolvedValue({ userId: "u1", title: "My post" })

    await likePost(jsonReq({ type: "LIKE" }), params)
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it("returns 500 on unexpected failure", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.like.findUnique.mockRejectedValue(new Error("boom"))
    const res = await likePost(jsonReq(), params)
    expect(res.status).toBe(500)
  })
})

describe("POST /api/posts/[id]/bookmark", () => {
  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await bookmarkPost(bareReq, params)
    expect(res.status).toBe(401)
  })

  it("adds a bookmark when none exists", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.bookmark.findUnique.mockResolvedValue(null)
    mockPrisma.post.findUnique.mockResolvedValue({ userId: "u2" })

    const res = await bookmarkPost(bareReq, params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ bookmarked: true })
    expect(mockPrisma.bookmark.create).toHaveBeenCalledWith({
      data: { postId: "p1", userId: "u1" },
    })
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { bookmarks: { increment: 1 } } })
    )
  })

  it("removes an existing bookmark", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.bookmark.findUnique.mockResolvedValue({ id: "b1" })

    const res = await bookmarkPost(bareReq, params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ bookmarked: false })
    expect(mockPrisma.bookmark.delete).toHaveBeenCalledWith({ where: { id: "b1" } })
  })

  it("returns 500 on unexpected failure", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.bookmark.findUnique.mockRejectedValue(new Error("boom"))
    const res = await bookmarkPost(bareReq, params)
    expect(res.status).toBe(500)
  })
})

describe("POST /api/posts/[id]/comments", () => {
  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await commentPost(jsonReq({ text: "hi" }), params)
    expect(res.status).toBe(401)
  })

  it("400 on empty comment text", async () => {
    mockAuth.mockResolvedValue(me)
    const res = await commentPost(jsonReq({ text: "" }), params)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Validation failed")
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it("creates a comment, bumps the counter, and notifies the author", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.comment.create.mockResolvedValue({ id: "c1", text: "nice route" })
    mockPrisma.post.findUnique.mockResolvedValue({ userId: "u2", title: "Their post" })

    const res = await commentPost(jsonReq({ text: "nice route" }), params)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.comment).toMatchObject({ id: "c1", text: "nice route" })
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { comments: { increment: 1 } } })
    )
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it("GET lists comments for the post", async () => {
    mockPrisma.comment.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }])
    const res = await commentGet(
      { url: "http://localhost/api/posts/p1/comments?limit=20" } as never,
      params
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.comments).toHaveLength(2)
  })
})

describe("POST/DELETE /api/users/[id]/follow", () => {
  const followParams = { params: Promise.resolve({ id: "u2" }) }

  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await followPost(bareReq, followParams)
    expect(res.status).toBe(401)
  })

  it("400 when trying to follow yourself", async () => {
    mockAuth.mockResolvedValue({ id: "u2" })
    const res = await followPost(bareReq, followParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("yourself")
  })

  it("404 when the target user does not exist", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const res = await followPost(bareReq, followParams)
    expect(res.status).toBe(404)
  })

  it("409 when already following", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u2" })
    mockPrisma.follow.findUnique.mockResolvedValue({ id: "f1" })
    const res = await followPost(bareReq, followParams)
    expect(res.status).toBe(409)
  })

  it("creates the follow + FOLLOW notification", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u2" })
    mockPrisma.follow.findUnique.mockResolvedValue(null)

    const res = await followPost(bareReq, followParams)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ followed: true })
    expect(mockPrisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: "u1", followingId: "u2" },
    })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it("unfollows an existing follow", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.follow.findUnique.mockResolvedValue({ id: "f1" })

    const res = await followDelete(bareReq, followParams)
    expect(res.status).toBe(200)
    expect(mockPrisma.follow.delete).toHaveBeenCalled()
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalled()
  })

  it("404 on unfollow when not following", async () => {
    mockAuth.mockResolvedValue(me)
    mockPrisma.follow.findUnique.mockResolvedValue(null)
    const res = await followDelete(bareReq, followParams)
    expect(res.status).toBe(404)
  })
})
