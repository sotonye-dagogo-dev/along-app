import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { REVIEWS_CONFIG } from "@/app/lib/config/reviews";

const REVIEWER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  userName: true,
  avatar: true,
  avatarConfig: true,
} as const;

/**
 * Public platform reviews (About carousel, profile Reviews tab).
 *
 * Storage: platform reviews are `UserReview` rows with
 * `reviewerId === revieweeId === authorId` (self-pair marker, see
 * REVIEWS_CONFIG). One platform review per user — re-submit updates in
 * place. GET serves APPROVED only; the author's own PENDING review is
 * included when authenticated (via ?mine=1) so the form can show status.
 */

// GET /api/reviews?limit=&cursor= — approved platform reviews, newest first.
// Cacheable (SW stale-while-revalidate) — no auth required.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || REVIEWS_CONFIG.listLimit, 1),
      REVIEWS_CONFIG.maxListLimit,
    );
    const cursor = searchParams.get("cursor");
    const mine = searchParams.get("mine") === "1";
    const authorId = searchParams.get("authorId");

    let viewerId: string | null = null;
    if (mine) {
      try {
        const viewer = await getUserFromRequest();
        viewerId = (viewer?.id as string | undefined) ?? null;
      } catch {
        viewerId = null;
      }
    }

    // Platform reviews only (self-pair marker); anonymized authors survive
    // as "Deleted User" rows — never null, never a crash (see select below).
    // Optional authorId scopes to one user's platform review (profile tabs).
    const where: Record<string, unknown> = { status: "APPROVED" };
    if (mine && viewerId) {
      where.OR = [
        { status: "APPROVED" },
        { status: "PENDING", reviewerId: viewerId },
      ];
      delete where.status;
    }
    const authorFilter = typeof authorId === "string" && authorId.length > 0 ? { reviewerId: authorId } : {};

    const rows = await prisma.userReview.findMany({
      where: {
        ...where,
        ...authorFilter,
        // Self-pair marker: reviewer and reviewee are the same user.
        // Prisma can't express column-equality in where, so filter in JS.
      } as never,
      include: { reviewer: { select: REVIEWER_SELECT } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const platform = rows.filter((r) => {
      const rec = r as unknown as { reviewerId: string; revieweeId: string };
      return rec.reviewerId === rec.revieweeId;
    });
    const hasMore = platform.length > limit;
    const reviews = (hasMore ? platform.slice(0, limit) : platform).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt,
      reviewer: r.reviewer ?? { id: "", firstName: "Deleted", lastName: "User", userName: "deleted-user", avatar: null },
    }));
    const nextCursor = hasMore ? reviews[reviews.length - 1].id : null;

    const res = NextResponse.json({ reviews, nextCursor }, { status: 200 });
    // Short edge cache — About page stays fast, moderation stays fresh.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (error) {
    console.error("[reviews] GET failed:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Could not load reviews. Please try again." }, { status: 500 });
  }
}

// POST /api/reviews { rating: 1-5, comment? } — auth required. Upserts the
// caller's platform review (PENDING) + fires the thank-you in-app
// notification (no email, per product rule).
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, "reviews");
  if (!limited.allowed) return limited.response;

  let user: { id: string } | null = null;
  try {
    const u = await getUserFromRequest();
    user = u ? ({ id: u.id as string } as { id: string }) : null;
  } catch {
    user = null;
  }
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in to leave a review." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }
  const { rating, comment } = (body ?? {}) as { rating?: unknown; comment?: unknown };

  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < REVIEWS_CONFIG.minRating || rating > REVIEWS_CONFIG.maxRating) {
    return NextResponse.json(
      { error: `Rating must be a whole number from ${REVIEWS_CONFIG.minRating} to ${REVIEWS_CONFIG.maxRating}.` },
      { status: 400 },
    );
  }
  const cleanComment = typeof comment === "string" ? comment.trim().slice(0, REVIEWS_CONFIG.maxCommentLength) : null;

  try {
    // Upsert keyed by the self-pair unique ([reviewerId, revieweeId]) —
    // ACID single statement, no check-then-write race.
    const saved = await prisma.userReview.upsert({
      where: { reviewerId_revieweeId: { reviewerId: user.id, revieweeId: user.id } },
      create: {
        reviewerId: user.id,
        revieweeId: user.id,
        rating,
        comment: cleanComment || null,
        status: "PENDING",
      },
      update: { rating, comment: cleanComment || null, status: "PENDING" },
      select: { id: true, rating: true, status: true, createdAt: true },
    });

    // Thank-you notification (in-app + push mirror, never email). Best
    // effort — a notification failure must never fail the review write.
    try {
      const { notifyReviewThanks } = await import("@/app/lib/services/notificationService");
      void notifyReviewThanks(user.id);
    } catch (e) {
      console.error("[reviews] thank-you notify failed:", e);
    }

    return NextResponse.json({ review: saved }, { status: 200 });
  } catch (error) {
    console.error("[reviews] POST failed:", error);
    Sentry.captureException(error);
    // Sanitized, offline-aware: never leak Prisma/JSON internals.
    const offline = request.headers.get("x-offline") === "1";
    return NextResponse.json(
      { error: offline ? "You are offline. Your review was not saved — please try again when back online." : "Could not save your review. Please try again." },
      { status: 500 },
    );
  }
}
