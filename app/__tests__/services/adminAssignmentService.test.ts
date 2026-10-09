/**
 * @jest-environment node
 *
 * Single-admin assignment policy — exactly one admin owns each issue:
 * - no admins → null (caller falls back to the platform inbox)
 * - one admin → that admin (no randomness needed)
 * - several admins → the least-loaded admin; ties broken randomly
 * - load-query failure → still exactly one admin (random fallback)
 */
import { assignAdminForIssue, getActiveAdmins } from "@/app/lib/services/adminAssignmentService"

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    user: { findMany: jest.fn() },
    bugReport: { groupBy: jest.fn() },
    accountDeletionRequest: { count: jest.fn() },
  },
}))

import { prisma } from "@/app/lib/db/prisma"

const mockFindMany = prisma.user.findMany as jest.Mock
const mockGroupBy = prisma.bugReport.groupBy as jest.Mock
const mockPendingCount = prisma.accountDeletionRequest.count as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("getActiveAdmins", () => {
  it("returns [] when the query fails", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"))
    await expect(getActiveAdmins()).resolves.toEqual([])
  })
})

describe("assignAdminForIssue", () => {
  it("returns null when there are no admins", async () => {
    mockFindMany.mockResolvedValue([])
    await expect(assignAdminForIssue()).resolves.toBeNull()
  })

  it("returns the sole admin without touching load queries", async () => {
    mockFindMany.mockResolvedValue([{ id: "a1", email: "a1@x.com" }])
    await expect(assignAdminForIssue()).resolves.toEqual({ id: "a1", email: "a1@x.com" })
    expect(mockGroupBy).not.toHaveBeenCalled()
  })

  it("picks the least-loaded admin deterministically under skew", async () => {
    mockFindMany.mockResolvedValue([
      { id: "busy", email: "busy@x.com" },
      { id: "free", email: "free@x.com" },
    ])
    mockGroupBy.mockResolvedValue([{ reviewerId: "busy", _count: { _all: 5 } }])
    mockPendingCount.mockResolvedValue(0)
    await expect(assignAdminForIssue()).resolves.toEqual({ id: "free", email: "free@x.com" })
  })

  it("returns exactly one admin when loads tie", async () => {
    const admins = [
      { id: "a1", email: "a1@x.com" },
      { id: "a2", email: "a2@x.com" },
      { id: "a3", email: "a3@x.com" },
    ]
    mockFindMany.mockResolvedValue(admins)
    mockGroupBy.mockResolvedValue([])
    mockPendingCount.mockResolvedValue(0)
    const picked = await assignAdminForIssue()
    expect(admins).toContainEqual(picked)
  })

  it("still returns one admin when the load query fails", async () => {
    const admins = [
      { id: "a1", email: "a1@x.com" },
      { id: "a2", email: "a2@x.com" },
    ]
    mockFindMany.mockResolvedValue(admins)
    mockGroupBy.mockRejectedValue(new Error("db down"))
    mockPendingCount.mockRejectedValue(new Error("db down"))
    const picked = await assignAdminForIssue()
    expect(admins).toContainEqual(picked)
  })
})
