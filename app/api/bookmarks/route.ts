import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

/** GET /api/bookmarks — the authenticated user's bookmarked posts (newest first). */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
    const cursor = searchParams.get("cursor");

    const rows = await prisma.bookmark.findMany({
      where: { userId: user.id as string },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        post: {
          include: {
            user: {
              select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    // `isBookmarked` kept for backward compat; `_isBookmarked` is the
    // canonical key PostCard reads (PROFILE_POSTS_CONFIG.interactionFields).
    const posts = page.map((row) => ({ ...row.post, isBookmarked: true, _isBookmarked: true }));

    // Canonical live trust (same service as feed/detail) so bookmarked
    // cards carry identical breakdown values. Best-effort, never fails.
    let trusted = posts;
    try {
      const { attachLiveBreakdownsToPosts } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      trusted = await attachLiveBreakdownsToPosts(prisma, posts);
    } catch { /* stored rows */ }

    return NextResponse.json({ posts: trusted, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("List bookmarks error:", error);
    const isPrismaKnown = error instanceof Error && ((error as unknown as { code?: string }).code === "P2022" || error.name === "PrismaClientKnownRequestError");
    const isPrismaInit = error instanceof Error && error.name === "PrismaClientInitializationError";
    if (isPrismaKnown || isPrismaInit) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
