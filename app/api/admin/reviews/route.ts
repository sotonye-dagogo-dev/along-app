import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const reviews = await prisma.userReview.findMany({
      where: where as never,
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, userName: true, avatar: true } },
        reviewee: { select: { id: true, firstName: true, lastName: true, userName: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = reviews.length > limit;
    const resultReviews = hasMore ? reviews.slice(0, limit) : reviews;
    const nextCursor = hasMore ? resultReviews[resultReviews.length - 1].id : null;

    return NextResponse.json({ reviews: resultReviews, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("Admin reviews list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { reviewId, reviewIds, status } = body as {
      reviewId?: string; reviewIds?: string[]; status?: string;
    };
    const targets: string[] = reviewIds?.length ? reviewIds : reviewId ? [reviewId] : [];

    if (targets.length === 0 || !status) {
      return NextResponse.json({ error: "reviewId(s) and status required" }, { status: 400 });
    }

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await prisma.userReview.updateMany({
      where: { id: { in: targets } },
      data: { status },
    });

    return NextResponse.json({ success: true, updated: targets.length }, { status: 200 });
  } catch (error) {
    console.error("Admin review update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
