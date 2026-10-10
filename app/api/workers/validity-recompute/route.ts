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
    const { postId } = body as { postId: string };

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const { prisma } = await import("@/app/lib/db/prisma");
    const { redis } = await import("@/app/lib/db/redis");

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        likes: true,
        dislikes: true,
        comments: true,
        bookmarks: true,
        views: true,
        shares: true,
        routes: true,
        createdAt: true,
        tags: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Canonical live breakdown (same service as every read surface) so the
    // stored score the worker writes can never disagree with what feed
    // cards and the detail view compute at read time.
    const { getLiveBreakdownForPost } = await import(
      "@/app/lib/services/trustBreakdownService"
    );
    const live = await getLiveBreakdownForPost(prisma, {
      id: post.id,
      userId: post.userId,
      likes: post.likes,
      dislikes: post.dislikes,
      comments: post.comments,
      bookmarks: post.bookmarks,
      views: post.views,
      shares: post.shares,
      routes: post.routes,
      tags: post.tags,
      createdAt: post.createdAt,
    });

    if (!live) {
      return NextResponse.json({ postId, unchanged: true }, { status: 200 });
    }

    await prisma.post.update({
      where: { id: postId },
      data: {
        validityScore: live.score,
        validityTier: live.tier,
      },
    });

    await redis.del(CACHE_KEYS.validity(postId));
    await redis.del(CACHE_KEYS.post(postId));

    return NextResponse.json({ postId, score: live.score, tier: live.tier }, { status: 200 });
  } catch (error) {
    console.error("Validity recompute worker error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
