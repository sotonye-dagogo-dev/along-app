/**
 * @jest-environment node
 *
 * Sprint 14: referral rewards policy — linking is unlimited on every auth
 * method, the cap applies to send-credit points only (never to inviting).
 * - INVITE_ACCEPTED (conversion) always pays.
 * - INVITE_SENT (send credit) pays only while the inviter is under
 *   INVITE_CONFIG.maxInvitesPerUser converted invitees.
 * - Self-referrals pay nothing.
 */
import { linkReferralRewards, resolveReferral } from "@/app/lib/services/referralService"

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), count: jest.fn() },
  },
}))
jest.mock("@/app/lib/services/qstashService", () => ({
  qstashService: { publishRewardsAward: jest.fn() },
}))

import { prisma } from "@/app/lib/db/prisma"
import { qstashService } from "@/app/lib/services/qstashService"
import { INVITE_CONFIG } from "@/app/lib/config"

const mockUser = prisma.user as unknown as { findUnique: jest.Mock; count: jest.Mock }
const mockRewards = qstashService.publishRewardsAward as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("resolveReferral", () => {
  it("returns {} for missing/blank/invalid codes", async () => {
    await expect(resolveReferral(null)).resolves.toEqual({})
    await expect(resolveReferral("  ")).resolves.toEqual({})
    mockUser.findUnique.mockResolvedValue(null)
    await expect(resolveReferral("nope")).resolves.toEqual({})
  })

  it("links the inviter no matter how many invitees they already have (unlimited)", async () => {
    mockUser.findUnique.mockResolvedValue({ id: "inviter-1" })
    mockUser.count.mockResolvedValue(5000)
    await expect(resolveReferral("code-abc")).resolves.toEqual({
      invitedById: "inviter-1",
      inviterInviteeCount: 5000,
    })
  })
})

describe("linkReferralRewards", () => {
  it("awards both ACCEPTED + SENT inside the cap window", () => {
    const linked = linkReferralRewards("inviter-1", "new-user", 3)
    expect(linked).toBe("inviter-1")
    expect(mockRewards).toHaveBeenCalledWith({ userId: "inviter-1", actionKey: "INVITE_ACCEPTED" })
    expect(mockRewards).toHaveBeenCalledWith({ userId: "inviter-1", actionKey: "INVITE_SENT" })
  })

  it("awards ACCEPTED only past the cap — inviting still links, points stop", () => {
    const linked = linkReferralRewards("inviter-1", "new-user", INVITE_CONFIG.maxInvitesPerUser)
    expect(linked).toBe("inviter-1")
    expect(mockRewards).toHaveBeenCalledWith({ userId: "inviter-1", actionKey: "INVITE_ACCEPTED" })
    expect(mockRewards).not.toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "INVITE_SENT" })
    )
  })

  it("pays nothing on self-referral", () => {
    expect(linkReferralRewards("user-1", "user-1", 0)).toBeUndefined()
    expect(mockRewards).not.toHaveBeenCalled()
  })

  it("does nothing without an inviter", () => {
    expect(linkReferralRewards(undefined, "new-user", 0)).toBeUndefined()
    expect(mockRewards).not.toHaveBeenCalled()
  })
})
