import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { feedService } from "@/app/lib/services/feedService";
import { prisma } from "@/app/lib/db/prisma";
import { clampPageLimit } from "@/app/lib/config";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    // Config-driven default (20) + max clamp — PAGINATION_CONFIG.feed.
    const limit = clampPageLimit(searchParams.get("limit"), "feed");
    // Stable pagination: client sends ids it already renders so score-ordered
    // pages never resurface them (see feedService excludeIds).
    const excludeIds = (searchParams.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s))
      .slice(0, 200);
    const excludeSet = new Set(excludeIds);

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
      const result = await feedService.getFeed(user.id as string, { cursor, limit, excludeIds, ...(viewerLocation ? { viewerLocation } : {}) });
      return NextResponse.json(result, { status: 200 });
    }

    // Guest access: return public posts (most recent). Archived posts are excluded.
    // `exclude` is honored here too so infinite scroll never repeats rows.
    const guestWhere =
      excludeSet.size > 0 ? { isArchived: false, id: { notIn: [...excludeSet] } } : { isArchived: false };
    const guestFetchArgs = {
      where: guestWhere,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
      },
      orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    };

    let posts: unknown[];
    try {
      posts = await (prisma.post.findMany as unknown as (args: typeof guestFetchArgs) => Promise<unknown[]>)(guestFetchArgs);
    } catch (e) {
      const isP2022 = e instanceof Error && ((e as unknown as { code?: string }).code === "P2022" || e.name === "PrismaClientKnownRequestError");
      if (isP2022) {
        // Strip additive columns (avatarConfig select, isArchived filter) so
        // guest reads keep working if the moderation migrations lag behind.
        const fallbackArgs = {
          take: limit + 1,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: {
            user: {
              select: { id: true, userName: true, firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
        };
        posts = await (prisma.post.findMany as unknown as (args: typeof fallbackArgs) => Promise<unknown[]>)(fallbackArgs);
      } else {
        throw e;
      }
    }

    const hasMore = (posts as { id: string }[]).length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? (resultPosts as { id: string }[])[resultPosts.length - 1].id : null;

    // Same canonical live trust as authenticated feeds + detail — guest
    // cards carry identical breakdown values (best-effort, never fails).
    try {
      const { attachLiveBreakdownsToPosts } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      const withTrust = await attachLiveBreakdownsToPosts(prisma, resultPosts as { id: string }[]);
      return NextResponse.json({ posts: withTrust, nextCursor }, { status: 200 });
    } catch {
      return NextResponse.json({ posts: resultPosts, nextCursor }, { status: 200 });
    }
  } catch (error) {
    console.error("Feed error:", error);
    const errCode = error instanceof Error && "code" in error ? (error as { code?: unknown }).code : undefined;
    const isPrismaKnown = error instanceof Error && (error.name === "PrismaClientKnownRequestError" || errCode === "P2022");
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
