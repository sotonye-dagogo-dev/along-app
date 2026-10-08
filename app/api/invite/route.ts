import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { INVITE_CONFIG } from "@/app/lib/config";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section");

    if (section === "leaderboard") {
      const users = await prisma.user.findMany({
        where: { invitedBy: { isNot: null } },
        select: {
          invitedBy: {
            select: { id: true, firstName: true, lastName: true, userName: true, avatar: true, rewardPoints: true },
          },
        },
      });

      const inviteCounts = new Map<string, { firstName: string; lastName: string; userName: string; avatar: string | null; rewardPoints: number; count: number }>();
      for (const u of users) {
        if (!u.invitedBy) continue;
        const key = u.invitedBy.id;
        if (!inviteCounts.has(key)) {
          inviteCounts.set(key, { ...u.invitedBy, count: 0 });
        }
        inviteCounts.get(key)!.count++;
      }

      const leaderboard = Array.from(inviteCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map((entry, i) => ({ rank: i + 1, ...entry }));

      return NextResponse.json({ leaderboard }, { status: 200 });
    }

    const inviteCount = await prisma.user.count({ where: { invitedById: user.id as string } });
    const maxInvites = INVITE_CONFIG.maxInvitesPerUser;

    // Legacy rows may predate invite codes — backfill one so the invite link
    // never renders as `?ref=null` (a dead referral link for the invitee).
    let inviteCode = user.inviteCode as string | null;
    if (!inviteCode) {
      inviteCode =
        typeof crypto?.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      try {
        await prisma.user.update({
          where: { id: user.id as string },
          data: { inviteCode },
        });
      } catch {
        // Non-critical — fall through with the generated code for display.
      }
    }

    return NextResponse.json({
      inviteCode,
      inviteCount,
      maxInvites,
      pointsPerInvite: INVITE_CONFIG.pointsForInviteSent,
      pointsPerAccepted: INVITE_CONFIG.pointsForInviteAccepted,
    }, { status: 200 });
  } catch (error) {
    console.error("Invite stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
