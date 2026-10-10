import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { feedService } from "@/app/lib/services/feedService";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);

    if (user) {
      // Optional behind-the-scenes nearby boost: ?lat=&lng= are best-effort
      // only — absent/invalid values leave ranking unchanged.
      const latRaw = searchParams.get("lat");
      const lngRaw = searchParams.get("lng");
      const lat = latRaw !== null ? Number(latRaw) : NaN;
      const lng = lngRaw !== null ? Number(lngRaw) : NaN;
      const viewerLocation =
        Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
          ? { lat, lng }
          : undefined;
      const result = await feedService.getFeed(user.id as string, { cursor, limit, ...(viewerLocation ? { viewerLocation } : {}) });
      return NextResponse.json(result, { status: 200 });
    }

    // Guest access: return public posts (most recent). Archived posts are excluded.
    let posts: any[];
    try {
      posts = await (prisma.post.findMany as any)({
        where: { isArchived: false },
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          user: {
            select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (e) {
      const isP2022 = e instanceof Error && ((e as any).code === "P2022" || e.name === "PrismaClientKnownRequestError");
      if (isP2022) {
        posts = await (prisma.post.findMany as any)({
          take: limit + 1,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: {
            user: {
              select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      } else {
        throw e;
      }
    }

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? resultPosts[resultPosts.length - 1].id : null;

    // Same canonical live trust as authenticated feeds + detail — guest
    // cards carry identical breakdown values (best-effort, never fails).
    try {
      const { attachLiveBreakdownsToPosts } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      const withTrust = await attachLiveBreakdownsToPosts(prisma, resultPosts);
      return NextResponse.json({ posts: withTrust, nextCursor }, { status: 200 });
    } catch {
      return NextResponse.json({ posts: resultPosts, nextCursor }, { status: 200 });
    }
  } catch (error) {
    console.error("Feed error:", error);
    const isPrismaKnown = error instanceof Error && (error.name === "PrismaClientKnownRequestError" || (error as any).code === "P2022");
    const isPrismaInit = error instanceof Error && error.name === "PrismaClientInitializationError";
    if (isPrismaKnown || isPrismaInit) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      error: "Something went wrong. Please try again.",
      ...(process.env.NODE_ENV !== "production" && { detail: message }),
    }, { status: 500 });
  }
}
