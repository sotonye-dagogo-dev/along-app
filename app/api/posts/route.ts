import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { CREATE_POST_SCHEMA } from "@/app/lib/schemas/post";
import { validityEngine } from "@/app/lib/services/ValidityEngine";
import { qstashService } from "@/app/lib/services/qstashService";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (e) {
      if (e instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid request body. Please check your input." }, { status: 400 });
      }
      throw e;
    }
    const parsed = CREATE_POST_SCHEMA.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, routes, images, tags, region, startLat, startLng, endLat, endLng, totalDistanceKm, estimatedMins } = parsed.data;

    const post = await prisma.post.create({
      data: {
        userId: user.id as string,
        title,
        routes: routes as never,
        images: images ?? [],
        tags: tags ?? [],
        region: region ?? null,
        startLat: startLat ?? null,
        startLng: startLng ?? null,
        endLat: endLat ?? null,
        endLng: endLng ?? null,
        totalDistanceKm: totalDistanceKm ?? null,
        estimatedMins: estimatedMins ?? null,
      },
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
    });

    // Calculate initial validity score
    const validityResult = await validityEngine.evaluate({
      likes: 0,
      dislikes: 0,
      routeDetailScore: routes.length * 20,
      similarityRatio: 100,
      createdAt: new Date(),
    });

    await prisma.post.update({
      where: { id: post.id },
      data: { validityScore: validityResult.score, validityTier: validityResult.tier },
    });

    // Invalidate author's own feed cache immediately as well as followers (fire-and-forget with error swallow inside service)
    qstashService.publishRewardsAward({ userId: user.id as string, actionKey: "CREATE_POST" });
    qstashService.publishFeedInvalidation({ followersOfUserId: user.id as string, userIds: [user.id as string] });
    qstashService.publishValidityRecompute({ postId: post.id });

    // Optimistically clear Redis cache for author so immediate refresh sees the new post even before QStash worker runs — never blocks response
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const { CACHE_KEYS } = await import("@/app/lib/config");
      await redis.del(CACHE_KEYS.feed(user.id as string));
    } catch { /* non-critical */ }

    return NextResponse.json({ post: { ...post, validityScore: validityResult.score, validityTier: validityResult.tier } }, { status: 201 });
  } catch (error) {
    console.error("Create post error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const isPrismaKnown = error instanceof Error && ((error as unknown as { code?: string }).code === "P2022" || error.name === "PrismaClientKnownRequestError");
    const isPrismaInit = error instanceof Error && error.name === "PrismaClientInitializationError";
    if (isPrismaKnown || isPrismaInit) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);

    const fetchArgs = {
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
      orderBy: { createdAt: "desc" as const },
    };

    let posts: unknown[];
    try {
      posts = await (prisma.post.findMany as unknown as (args: typeof fetchArgs) => Promise<unknown[]>)(fetchArgs);
    } catch (e) {
      const isP2022 = e instanceof Error && ((e as unknown as { code?: string }).code === "P2022" || e.name === "PrismaClientKnownRequestError");
      if (isP2022) {
        const fallbackArgs = {
          ...fetchArgs,
          include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true } } },
        };
        posts = await (prisma.post.findMany as unknown as (args: typeof fallbackArgs) => Promise<unknown[]>)(fallbackArgs);
      } else {
        throw e;
      }
    }

    const hasMore = (posts as { id: string }[]).length > limit;
    const resultPosts = hasMore ? (posts as unknown[]).slice(0, limit) : posts;
    const nextCursor = hasMore ? (resultPosts as { id: string }[])[resultPosts.length - 1].id : null;

    return NextResponse.json({ posts: resultPosts, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("List posts error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const isPrismaKnown = error instanceof Error && ((error as unknown as { code?: string }).code === "P2022" || error.name === "PrismaClientKnownRequestError");
    const isPrismaInit = error instanceof Error && error.name === "PrismaClientInitializationError";
    if (isPrismaKnown || isPrismaInit) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
