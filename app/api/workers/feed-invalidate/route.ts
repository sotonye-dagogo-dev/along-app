import { NextRequest, NextResponse } from "next/server";
import { qstashService } from "@/app/lib/services/qstashService";
import { CACHE_KEYS } from "@/app/lib/config";

export async function POST(request: NextRequest) {
  try {
    const sigResult = await qstashService.verifySignature(request);
    if (!sigResult.valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = sigResult.bodyText ? JSON.parse(sigResult.bodyText) : await request.json();
    const { userIds, postId, followersOfUserId } = body as {
      userIds?: string[];
      postId?: string;
      followersOfUserId?: string;
    };

    const { redis } = await import("@/app/lib/db/redis");

    const keysToDelete: string[] = [];

    if (userIds && userIds.length > 0) {
      for (const uid of userIds) {
        keysToDelete.push(CACHE_KEYS.feed(uid));
      }
    }

    if (followersOfUserId) {
      const { prisma } = await import("@/app/lib/db/prisma");
      const followers = await prisma.follow.findMany({
        where: { followingId: followersOfUserId },
        select: { followerId: true },
      });
      for (const f of followers) {
        keysToDelete.push(CACHE_KEYS.feed(f.followerId));
      }
    }

    if (postId) {
      keysToDelete.push(CACHE_KEYS.post(postId));
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }

    return NextResponse.json({ invalidated: keysToDelete.length }, { status: 200 });
  } catch (error) {
    console.error("Feed invalidate worker error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
