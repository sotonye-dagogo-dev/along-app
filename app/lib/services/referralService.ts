/**
 * Referral linking shared by every signup path (email+password register and
 * Google OAuth callback) so the invite system behaves identically no matter
 * which auth method a new user picks.
 *
 * Growth policy (see INVITE_CONFIG): linking is UNLIMITED — a valid invite
 * code always sets `invitedById`. Points follow the cap rule instead:
 * - INVITE_ACCEPTED (conversion) is always awarded — growth happened.
 * - INVITE_SENT (send credit) is awarded only while the inviter's converted
 *   invite count is still under `maxInvitesPerUser` — the cap applies to the
 *   cheap send-credit points, never to the ability to invite.
 * Never throws — referrals are non-critical to account creation.
 */

import { prisma } from "@/app/lib/db/prisma";
import { INVITE_CONFIG } from "@/app/lib/config";
import { qstashService } from "@/app/lib/services/qstashService";

export interface ReferralResolution {
  invitedById?: string;
  inviterInviteeCount?: number;
}

/** Look up the inviter for a raw `ref` code. Returns {} when absent/invalid. */
export async function resolveReferral(ref: string | null | undefined): Promise<ReferralResolution> {
  if (!ref || typeof ref !== "string" || ref.trim().length === 0) return {};
  try {
    const inviter = await prisma.user.findUnique({
      where: { inviteCode: ref.trim() },
      select: { id: true },
    });
    if (!inviter) return {};
    // Self-referral guard is applied by the caller (new user id unknown here
    // for the email path, known for OAuth) — see linkReferralRewards.
    const inviteeCount = await prisma.user.count({ where: { invitedById: inviter.id } });
    return { invitedById: inviter.id, inviterInviteeCount: inviteeCount };
  } catch {
    return {};
  }
}

/**
 * Award referral points after the new user row exists. Self-referrals
 * (inviter === new user) earn nothing. Returns the linked inviter id, or
 * undefined when no reward/linking applied.
 */
export function linkReferralRewards(
  invitedById: string | undefined,
  newUserId: string,
  inviterInviteeCount = 0
): string | undefined {
  if (!invitedById || invitedById === newUserId) return undefined;
  // Conversion always pays — the platform grew by one verified user.
  qstashService.publishRewardsAward({ userId: invitedById, actionKey: "INVITE_ACCEPTED" });
  // Send credit pays only inside the cap window.
  if (inviterInviteeCount < INVITE_CONFIG.maxInvitesPerUser) {
    qstashService.publishRewardsAward({ userId: invitedById, actionKey: "INVITE_SENT" });
  }
  return invitedById;
}
