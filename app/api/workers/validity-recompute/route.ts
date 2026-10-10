import { NextRequest, NextResponse } from "next/server";
import { qstashService } from "@/app/lib/services/qstashService";
import { validityEngine, computeRouteDetailScore, computeSimilarityRatio } from "@/app/lib/services/ValidityEngine";
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

    // Canonical detail scorer (shared with POST /api/posts) so create-time
    // and recompute-time scores agree.
    const routeDetailScore = computeRouteDetailScore(post.routes);

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
    const similarityRatio = computeSimilarityRatio(similarPosts);

    // Dynamic signals: author reputation (followers/verification/age),
    // engagement depth (comments/bookmarks/views/shares), and report
    // pressure (open reports). Every lookup is best-effort — a missing
    // relation degrades to 0 signal, never to a failed recompute.
    let authorFollowerCount = 0;
    let authorVerified = false;
    let authorAgeDays = 0;
    let openReports = 0;
    try {
      const [author, followerCount, reports] = await Promise.all([
        prisma.user.findUnique({
          where: { id: post.userId },
          select: { verified: true, createdAt: true },
        }).catch(() => null),
        prisma.follow.count({ where: { followingId: post.userId } }).catch(() => 0),
        prisma.bugReport.count({
          where: { postId, status: { notIn: ["RESOLVED", "CLOSED"] } },
        }).catch(() => 0),
      ]);
      authorFollowerCount = followerCount ?? 0;
      authorVerified = author?.verified ?? false;
      if (author?.createdAt) {
        authorAgeDays = Math.max(0, (Date.now() - new Date(author.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      }
      openReports = reports ?? 0;
    } catch {
      /* signal fallbacks above (all zero) already apply */
    }

    const result = await validityEngine.evaluate({
      likes: post.likes,
      dislikes: post.dislikes,
      routeDetailScore,
      similarityRatio,
      createdAt: post.createdAt,
      authorFollowerCount,
      authorVerified,
      authorAgeDays,
      comments: post.comments,
      bookmarks: post.bookmarks,
      views: post.views,
      shares: post.shares,
      openReports,
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
