import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { CREATE_POST_SCHEMA } from "@/app/lib/schemas/post";
import { validityEngine, computeRouteDetailScore, computePostDetailScore, detailContextFromPost } from "@/app/lib/services/ValidityEngine";
import { qstashService } from "@/app/lib/services/qstashService";
import { POST_SUBMIT_CONFIG } from "@/app/lib/config/postSubmit";
import { normalizeRouteSteps } from "@/app/lib/config/routeSteps";
import { idempotencyService } from "@/app/lib/services/idempotencyService";

const POST_AUTHOR_INCLUDE = {
  user: {
    select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
  },
};

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
      const flattened = parsed.error.flatten();
      // Config-driven sanitized first message (PII-safe, capped) alongside
      // the full flattened details (existing shape — non-breaking).
      const { firstRouteServerMessage } = await import("@/app/lib/config/routeValidation");
      const friendly = firstRouteServerMessage(flattened, "Validation failed");
      // Observable server log: previously only the client saw "Validation failed"
      // with no console/server trace, which made real payload bugs invisible.
      console.warn("[POST /api/posts] validation failed", JSON.stringify(flattened));
      return NextResponse.json(
        { error: "Validation failed", ...(friendly ? { message: friendly } : {}), details: flattened },
        { status: 400 }
      );
    }

    const { title, routes: rawRoutes, images, tags, region, startLat, startLng, endLat, endLng, waypoints, totalDistanceKm, estimatedMins, type, description, quotedPostId, requestLat, requestLng } = parsed.data;
    // Destination is the final stop — strip any fare/vehicle it carries so
    // stored rows never imply a leg beyond the destination (clients already
    // hide + strip; this is the server-side backstop for old clients).
    const routes = normalizeRouteSteps(rawRoutes);

    // Idempotency (ACID double-submit protection): the composer sends one
    // `clientMutationId` per editing session. A replayed key returns the
    // original post instead of inserting a second row. The header read is
    // defensive so non-standard request shapes never break posting.
    const idempotencyKey =
      typeof request.headers?.get === "function"
        ? (request.headers.get(POST_SUBMIT_CONFIG.idempotencyHeader) ?? "")
        : "";
    let claimedKey = false;
    if (idempotencyKey.trim()) {
      const replayId = idempotencyService.replayOf(idempotencyKey);
      if (replayId) {
        const existing = await prisma.post.findUnique({ where: { id: replayId }, include: POST_AUTHOR_INCLUDE });
        if (existing) {
          return NextResponse.json({ post: existing, deduplicated: true }, { status: 200 });
        }
      }
      if (!idempotencyService.claim(idempotencyKey)) {
        return NextResponse.json(
          { error: "This post is already being published. Please wait a moment." },
          { status: 409 }
        );
      }
      claimedKey = true;
    }

    let quotedAuthorId: string | null = null;
    if (quotedPostId) {
      const quoted = await prisma.post.findUnique({
        where: { id: quotedPostId },
        select: { userId: true },
      });
      if (!quoted) {
        if (claimedKey) idempotencyService.release(idempotencyKey);
        return NextResponse.json({ error: "The quoted post no longer exists." }, { status: 400 });
      }
      quotedAuthorId = quoted.userId;
    }

    // Score first so the insert below is a single atomic write (no
    // create-then-update window where a retry could double-insert).
    // Canonical scorer (shared with the recompute worker) + the SAME live
    // corroboration evidence the read paths use (tag/geo/route blend over
    // ±windowDays) + author reputation at post time. A fresh post has no
    // votes yet, so endorsement/response legs are 0 — the score matches what
    // the worker recomputes instead of flashing an optimistic value.
    // Best-effort lookups never block the post on failure (fallbacks below).
    // Detail covers the whole post (stops + photos + tags + description +
    // vehicles/fares) — the same context the read paths derive — so rich
    // posts no longer freeze at the leg-text-only 42.
    let routeDetailScore = computePostDetailScore(
      routes,
      detailContextFromPost({ routes, images: images ?? [], tags: tags ?? [], description: description ?? null })
    );
    if (!Number.isFinite(routeDetailScore)) routeDetailScore = computeRouteDetailScore(routes);
    if (!Number.isFinite(routeDetailScore)) routeDetailScore = Math.min(100, routes.length * 20);
    let similarityRatio = 0;
    let authorFollowerCount = 0;
    let authorVerified = false;
    let authorAgeDays = 0;
    try {
      const author = await prisma.user.findUnique({
        where: { id: user.id as string },
        select: { verified: true, createdAt: true },
      });
      authorVerified = author?.verified ?? false;
      if (author?.createdAt) {
        authorAgeDays = Math.max(0, (Date.now() - new Date(author.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      }
      try {
        authorFollowerCount = await prisma.follow.count({ where: { followingId: user.id as string } });
      } catch { authorFollowerCount = 0; }
      try {
        const { computeCorroborationForPost } = await import(
          "@/app/lib/services/trustBreakdownService"
        );
        similarityRatio = await computeCorroborationForPost(
          prisma,
          {
            id: "",
            likes: 0,
            dislikes: 0,
            views: 0,
            routes,
            tags: tags ?? [],
            createdAt: new Date(),
            startLat: startLat ?? null,
            startLng: startLng ?? null,
            endLat: endLat ?? null,
            endLng: endLng ?? null,
            region: region ?? null,
            type,
            quotedPostId: quotedPostId ?? null,
          },
          new Date()
        );
      } catch {
        similarityRatio = 0;
      }
    } catch {
      // Fallbacks keep scoring honest on DB failure (no optimistic flash).
      similarityRatio = 0;
    }
    const validityResult = await validityEngine.evaluate({
      likes: 0,
      dislikes: 0,
      routeDetailScore,
      similarityRatio,
      createdAt: new Date(),
      authorFollowerCount,
      authorVerified,
      authorAgeDays,
    });

    let post;
    try {
      post = await prisma.post.create({
        data: {
          userId: user.id as string,
          title,
          type,
          description: description ?? null,
          quotedPostId: quotedPostId ?? null,
          routes: routes as never,
          images: images ?? [],
          tags: tags ?? [],
          region: region ?? null,
          startLat: startLat ?? null,
          startLng: startLng ?? null,
          endLat: endLat ?? null,
          endLng: endLng ?? null,
          waypoints: (waypoints ?? []) as never,
          totalDistanceKm: totalDistanceKm ?? null,
          estimatedMins: estimatedMins ?? null,
          validityScore: validityResult.score,
          validityTier: validityResult.tier,
        },
        include: POST_AUTHOR_INCLUDE,
      });
    } catch (e) {
      // Creation failed — release the key so a user retry can go through.
      if (claimedKey) idempotencyService.release(idempotencyKey);
      throw e;
    }
    if (claimedKey) idempotencyService.complete(idempotencyKey, post.id);

    // Invalidate author's own feed cache immediately as well as followers (fire-and-forget with error swallow inside service)
    qstashService.publishRewardsAward({ userId: user.id as string, actionKey: "CREATE_POST" });
    qstashService.publishFeedInvalidation({ followersOfUserId: user.id as string, userIds: [user.id as string] });
    qstashService.publishValidityRecompute({ postId: post.id });

    // Fan-out notifications for route requests/responses/uploads —
    // non-blocking, never throws.
    // - ROUTE_REQUEST → community-wide (followers first, then recent members
    //   up to the admin-capped audience — no follow relationship required).
    // - ROUTE_RESPONSE → the request author (your request got an answer).
    // - ROUTE / ROUTE_RESPONSE → followers as NEW_ROUTE (someone you follow
    //   shared a route). The request author is excluded from the follower
    //   fan-out so they never get two notifications for one response.
    try {
      const { createNotification, getFollowerIds, getRouteRequestAudienceIds } = await import("@/app/lib/services/notificationService");
      const actorName = `${(user as { firstName?: string }).firstName ?? ""} ${(user as { lastName?: string }).lastName ?? ""}`.trim() || "Someone";
      if (type === "ROUTE_REQUEST") {
        let audience: string[] = [];
        try {
          // Ephemeral request fix for optimistic nearby filtering (never
          // persisted, never logged): explicit one-shot fix wins, otherwise
          // the request's own start coords. Invalid/absent degrades to the
          // full community audience inside the service (graceful fallback).
          const fixLat = requestLat ?? startLat ?? null;
          const fixLng = requestLng ?? startLng ?? null;
          audience = await getRouteRequestAudienceIds(user.id as string, {
            requestLat: fixLat,
            requestLng: fixLng,
          });
        } catch {
          audience = await getFollowerIds(user.id as string);
        }
        void createNotification({
          type: "ROUTE_REQUEST",
          actorId: user.id as string,
          message: `${actorName} is looking for a route: "${title}"`,
          postId: post.id,
          recipientIds: audience,
        });
      } else if (type === "ROUTE_RESPONSE" && quotedAuthorId) {
        void createNotification({
          type: "ROUTE_RESPONSE",
          actorId: user.id as string,
          message: `${actorName} responded to your route request: "${title}"`,
          postId: post.id,
          recipientIds: [quotedAuthorId],
        });
        const followers = (await getFollowerIds(user.id as string)).filter((id) => id !== quotedAuthorId);
        void createNotification({
          type: "NEW_ROUTE",
          actorId: user.id as string,
          message: `${actorName} shared a new route: "${title}"`,
          postId: post.id,
          recipientIds: followers,
        });
      } else if (type === "ROUTE" || type === "ROUTE_RESPONSE") {
        const followers = await getFollowerIds(user.id as string);
        void createNotification({
          type: "NEW_ROUTE",
          actorId: user.id as string,
          message: `${actorName} shared a new route: "${title}"`,
          postId: post.id,
          recipientIds: followers,
        });
      }
    } catch { /* notifications are non-critical */ }

    // Optimistically clear Redis cache for author so immediate refresh sees the new post even before QStash worker runs — never blocks response
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const { CACHE_KEYS } = await import("@/app/lib/config");
      await redis.del(CACHE_KEYS.feed(user.id as string));
    } catch { /* non-critical */ }

    return NextResponse.json({ post }, { status: 201 });
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
    const userId = searchParams.get("userId");
    const typeParam = searchParams.get("type");
    const likedBy = searchParams.get("likedBy");
    const bookmarkedBy = searchParams.get("bookmarkedBy");
    // Owner-only archived library (?archived=true with ?userId=self). Any
    // other viewer asking for it silently gets the normal (unarchived) list.
    const archivedOnly = searchParams.get("archived") === "true";

    const validTypes = new Set(["ROUTE", "ROUTE_REQUEST", "ROUTE_RESPONSE"]);
    // Comma-separated types power the profile Routes tab
    // (?type=ROUTE,ROUTE_RESPONSE = actual routes, requests excluded).
    const requestedTypes = (typeParam ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => validTypes.has(t));
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (requestedTypes.length === 1) where.type = requestedTypes[0];
    else if (requestedTypes.length > 1) where.type = { in: requestedTypes };
    if (likedBy) where.postLikes = { some: { userId: likedBy, type: "LIKE" } };
    if (bookmarkedBy) where.postBookmarks = { some: { userId: bookmarkedBy } };

    // Archived posts stay hidden from public listings. Exception: an owner
    // browsing their own profile (?userId=self) gets the archive library via
    // ?archived=true, and their normal tabs exclude archived posts.
    let viewerId: string | null = null;
    try {
      const viewer = await getUserFromRequest();
      viewerId = (viewer?.id as string | undefined) ?? null;
    } catch { viewerId = null; }
    const ownerView = !!userId && !!viewerId && userId === viewerId;
    // Deleted users: personalized tabs are always empty (likes/bookmarks
    // wiped on finalize); their retained anonymised posts stay visible on
    // the generic deleted profile regardless of archived flag.
    if ((likedBy || bookmarkedBy) && (likedBy ?? bookmarkedBy)) {
      try {
        const targetId = (likedBy ?? bookmarkedBy) as string;
        const target = await prisma.user.findUnique({ where: { id: targetId }, select: { isDeleted: true } });
        if (target?.isDeleted) {
          return NextResponse.json({ posts: [], nextCursor: null }, { status: 200 });
        }
      } catch { /* fall through to normal query */ }
    }
    let targetIsDeleted = false;
    if (userId) {
      try {
        const target = await prisma.user.findUnique({ where: { id: userId }, select: { isDeleted: true } });
        targetIsDeleted = !!target?.isDeleted;
      } catch { targetIsDeleted = false; }
    }
    if (targetIsDeleted) {
      // Generic deleted profile: show retained posts (archived or not).
      if (archivedOnly) where.isArchived = true;
      // else: no isArchived constraint — all posts visible, attributed anonymously.
    } else if (ownerView && archivedOnly) where.isArchived = true;
    else where.isArchived = false;

    const fetchArgs = {
      ...(Object.keys(where).length > 0 ? { where } : {}),
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        user: {
          select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true },
        },
        // Response linkage for ROUTE_RESPONSE rows so profile tabs (and any
        // card built from this list) render the "Responding to" block and
        // edit flows can forward it. Additive — plain rows otherwise.
        quotedPost: {
          select: {
            id: true,
            title: true,
            type: true,
            createdAt: true,
            user: { select: { id: true, userName: true, firstName: true, lastName: true, avatar: true, avatarConfig: true } },
          },
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
        // Strip additive columns (avatarConfig select, isArchived filter,
        // quotedPost include) so reads keep working if the moderation or
        // route-request migrations have not applied yet.
        const { isArchived: _drop, ...restWhere } = (fetchArgs as { where?: Record<string, unknown> }).where ?? {};
        void _drop;
        const fallbackArgs = {
          ...fetchArgs,
          ...((fetchArgs as { where?: unknown }).where ? { where: restWhere } : {}),
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

    // Viewer-scoped interaction enrichment (PROFILE_POSTS_CONFIG.interactionFields)
    // so profile tabs render the same like/bookmark state as the feed.
    // Never throws — enrichment failure returns plain rows.
    let enriched = resultPosts;
    if (viewerId) {
      try {
        const ids = (resultPosts as { id: string }[]).map((p) => p.id);
        if (ids.length > 0) {
          const [likes, dislikes, bookmarks] = await Promise.all([
            prisma.like.findMany({ where: { postId: { in: ids }, userId: viewerId, type: "LIKE" }, select: { postId: true } }).catch(() => [] as { postId: string }[]),
            prisma.like.findMany({ where: { postId: { in: ids }, userId: viewerId, type: "DISLIKE" }, select: { postId: true } }).catch(() => [] as { postId: string }[]),
            prisma.bookmark.findMany({ where: { postId: { in: ids }, userId: viewerId }, select: { postId: true } }).catch(() => [] as { postId: string }[]),
          ]);
          const liked = new Set(likes.map((l) => l.postId));
          const disliked = new Set(dislikes.map((l) => l.postId));
          const saved = new Set(bookmarks.map((b) => b.postId));
          enriched = (resultPosts as Record<string, unknown>[]).map((p) => ({
            ...p,
            _isLiked: liked.has(p.id as string),
            _isDisliked: disliked.has(p.id as string),
            _isBookmarked: saved.has(p.id as string),
          }));
        }
      } catch { /* plain rows */ }
    }

    // Canonical live trust breakdowns (same service + engine as the detail
    // view) so feed cards, profile tabs, bookmarks and explore rows carry
    // the SAME corroboration/detail/community/recency values as the detail
    // tooltip. Best-effort — failures keep the stored rows.
    let withTrust = enriched;
    try {
      const { attachLiveBreakdownsToPosts } = await import(
        "@/app/lib/services/trustBreakdownService"
      );
      withTrust = await attachLiveBreakdownsToPosts(
        prisma,
        enriched as { id: string }[]
      );
    } catch { /* stored rows */ }

    return NextResponse.json({ posts: withTrust, nextCursor }, { status: 200 });
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
