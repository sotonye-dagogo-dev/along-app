import { NextRequest, NextResponse } from "next/server";
import { qstashService } from "@/app/lib/services/qstashService";
import { rewardsService } from "@/app/lib/services/rewardsService";

export async function POST(request: NextRequest) {
  try {
    const sigResult = await qstashService.verifySignature(request);
    if (!sigResult.valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = sigResult.bodyText ? JSON.parse(sigResult.bodyText) : await request.json();
    const { userId, actionKey, postAuthorId } = body as {
      userId: string;
      actionKey: string;
      postAuthorId?: string;
    };

    if (!userId || !actionKey) {
      return NextResponse.json({ error: "userId and actionKey are required" }, { status: 400 });
    }

    const result = await rewardsService.awardPoints(userId, actionKey, postAuthorId);

    // Surface the win in-app: points notice + tier-up notice (both never-throw).
    if (result.pointsAwarded > 0 || result.tierChanged) {
      try {
        const { POINTS_CONFIG } = await import("@/app/lib/config");
        const { notifyPointsAwarded } = await import("@/app/lib/services/notificationService");
        const targetUserId = postAuthorId ?? userId;
        await notifyPointsAwarded({
          userId: targetUserId,
          pointsAwarded: result.pointsAwarded,
          actionLabel: POINTS_CONFIG[actionKey]?.action ?? actionKey,
          oldTier: result.oldTier,
          newTier: result.newTier,
          tierChanged: result.tierChanged,
        });
      } catch { /* notifications are non-critical */ }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Rewards worker error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
