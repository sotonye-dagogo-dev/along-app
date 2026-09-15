import { NextRequest, NextResponse } from "next/server";
import { qstashService } from "@/app/lib/services/qstashService";
import { validityEngine } from "@/app/lib/services/ValidityEngine";
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
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        likes: true,
        dislikes: true,
        routes: true,
        createdAt: true,
        tags: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const routes = post.routes as Array<{ distance?: number; steps?: unknown[] }> | null;
    const routeDetailScore = routes
      ? Math.min(100, routes.reduce((sum, r) => {
          let score = 0;
          if (r.distance && r.distance > 0) score += 30;
          if (r.steps && r.steps.length > 0) score += Math.min(70, r.steps.length * 10);
          return sum + score;
        }, 0))
      : 0;

    const similarPosts = await prisma.post.count({
      where: {
        id: { not: postId },
        tags: { hasSome: post.tags },
        createdAt: {
          gte: new Date(post.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(post.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });
    const similarityRatio = Math.min(100, similarPosts * 10);

    const result = await validityEngine.evaluate({
      likes: post.likes,
      dislikes: post.dislikes,
      routeDetailScore,
      similarityRatio,
      createdAt: post.createdAt,
    });

    await prisma.post.update({
      where: { id: postId },
      data: {
        validityScore: result.score,
        validityTier: result.tier,
      },
    });

    await redis.del(CACHE_KEYS.validity(postId));
    await redis.del(CACHE_KEYS.post(postId));

    return NextResponse.json({ postId, score: result.score, tier: result.tier }, { status: 200 });
  } catch (error) {
    console.error("Validity recompute worker error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
