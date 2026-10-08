/**
 * @jest-environment node
 *
 * Sprint 14: post nature preservation through edit/archive operations.
 * PATCH /api/posts/[id] must never change `type` or `quotedPostId`, no
 * matter what the client sends — a ROUTE stays a ROUTE, a ROUTE_REQUEST
 * stays a request, through edits, archives and admin corrections.
 */
import { PATCH } from "@/app/api/posts/[id]/route"

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    post: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))
jest.mock("@/app/lib/utils/auth", () => ({ getUserFromRequest: jest.fn() }))

import { prisma } from "@/app/lib/db/prisma"
import { getUserFromRequest } from "@/app/lib/utils/auth"

const mockPost = prisma.post as unknown as { findUnique: jest.Mock; update: jest.Mock }
const mockAuth = getUserFromRequest as jest.Mock

const storedRequest = {
  id: "p1",
  userId: "u1",
  type: "ROUTE_REQUEST",
  title: "Need a ride to Lekki",
  quotedPostId: null,
}

function patchReq(body: unknown) {
  return { json: async () => body } as never
}
function params(id = "p1") {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("PATCH /api/posts/[id] nature preservation", () => {
  it("strips `type` from an owner edit — a request stays a request", async () => {
    mockAuth.mockResolvedValue({ id: "u1", role: "USER" })
    mockPost.findUnique.mockResolvedValue(storedRequest)
    mockPost.update.mockResolvedValue({ ...storedRequest, title: "Need a ride to Lekki asap" })

    const res = await PATCH(
      patchReq({
        title: "Need a ride to Lekki asap",
        type: "ROUTE",
        routes: [{ location: "Yaba" }, { location: "Lekki" }],
      }),
      params()
    )
    expect(res.status).toBe(200)
    const data = mockPost.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty("type")
    expect(data.title).toBe("Need a ride to Lekki asap")
  })

  it("strips `quotedPostId` so edits cannot re-parent a response", async () => {
    mockAuth.mockResolvedValue({ id: "u1", role: "USER" })
    mockPost.findUnique.mockResolvedValue({ ...storedRequest, type: "ROUTE_RESPONSE", quotedPostId: "req-1" })
    mockPost.update.mockResolvedValue({})

    const res = await PATCH(patchReq({ title: "Updated response title here", quotedPostId: "req-2" }), params())
    expect(res.status).toBe(200)
    const data = mockPost.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty("quotedPostId")
  })

  it("strips `type` from admin corrections as well", async () => {
    mockAuth.mockResolvedValue({ id: "admin-1", role: "ADMIN" })
    mockPost.findUnique.mockResolvedValue(storedRequest)
    mockPost.update.mockResolvedValue({})

    const res = await PATCH(patchReq({ title: "Admin corrected title", type: "ROUTE_RESPONSE" }), params())
    expect(res.status).toBe(200)
    expect(mockPost.update.mock.calls[0][0].data).not.toHaveProperty("type")
  })

  it("archive path only flips archive state — never content or nature", async () => {
    mockAuth.mockResolvedValue({ id: "u1", role: "USER" })
    mockPost.findUnique.mockResolvedValue(storedRequest)
    mockPost.update.mockResolvedValue({ ...storedRequest, isArchived: true })

    const res = await PATCH(patchReq({ isArchived: true }), params())
    expect(res.status).toBe(200)
    expect(mockPost.update.mock.calls[0][0].data).toEqual({
      isArchived: true,
      archivedAt: expect.any(Date),
    })
  })
})
