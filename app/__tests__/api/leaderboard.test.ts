/**
 * @jest-environment node
 *
 * Sprint 14: the global leaderboard includes every user — there is no
 * points floor, so zero-point users appear (ranked below earners).
 */
import { GET } from "@/app/api/leaderboard/route"

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    user: { findMany: jest.fn() },
  },
}))
jest.mock("@/app/lib/utils/auth", () => ({ getUserFromRequest: jest.fn() }))
jest.mock("@/app/lib/db/redis", () => ({
  redis: { get: jest.fn().mockResolvedValue(null), set: jest.fn() },
}))

import { prisma } from "@/app/lib/db/prisma"
import { getUserFromRequest } from "@/app/lib/utils/auth"

const mockFindMany = (prisma.user as unknown as { findMany: jest.Mock }).findMany
const mockAuth = getUserFromRequest as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/leaderboard", () => {
  it("queries without a rewardPoints floor and keeps zero-point users", async () => {
    mockAuth.mockResolvedValue({ id: "viewer-1" })
    mockFindMany.mockResolvedValue([
      {
        id: "u1", firstName: "Ama", lastName: "Boat", userName: "ama",
        avatar: null, rewardPoints: 120, rewardTier: "BRONZE",
        _count: { posts: 2, followers: 1 },
      },
      {
        id: "u2", firstName: "Kofi", lastName: "Men", userName: "kofi",
        avatar: null, rewardPoints: 0, rewardTier: "BRONZE",
        _count: { posts: 0, followers: 0 },
      },
    ])

    const res = await GET({ url: "http://localhost/api/leaderboard" } as never)
    expect(res.status).toBe(200)

    const args = mockFindMany.mock.calls[0][0]
    // No `where` points floor — every user is ranked, including zero-point.
    expect(args.where).toBeUndefined()
    expect(args.take).toBe(100)

    const body = await res.json()
    expect(body.leaderboard).toHaveLength(2)
    expect(body.leaderboard[1]).toMatchObject({ id: "u2", rank: 2, rewardPoints: 0 })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET({ url: "http://localhost/api/leaderboard" } as never)
    expect(res.status).toBe(401)
  })
})
