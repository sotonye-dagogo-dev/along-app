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

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Rewards worker error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
