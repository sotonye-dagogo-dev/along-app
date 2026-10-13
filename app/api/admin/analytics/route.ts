import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { parseAdminDashboardPeriod } from "@/app/lib/config/admin";
import { ADMIN_ANALYTICS_CONFIG } from "@/app/lib/config/charts";

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * GET /api/admin/analytics?period=7|30|90
 *
 * Comprehensive platform-wide analytics for the dedicated admin analytics
 * page. Period-aware (window vs previous equal window), null-safe, and
 * non-breaking: additive alongside /api/admin/stats (which the overview
 * keeps using). Failures return 500 with a sanitized message — no stack
 * or column details leak.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const periodDays = parseAdminDashboardPeriod(searchParams.get("period"));

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const windowStart = new Date(todayStart.getTime() - (periodDays - 1) * 86400000);
    const prevWindowStart = new Date(windowStart.getTime() - periodDays * 86400000);
    const prevWindowEnd = windowStart;

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const bucketize = <T extends { createdAt: Date }>(items: T[]) => {
      const days: { date: string; count: number }[] = [];
      for (let i = periodDays - 1; i >= 0; i--) {
        const start = new Date(todayStart.getTime() - i * 86400000);
        const end = new Date(start.getTime() + 86400000);
        const count = items.filter((u) => u.createdAt >= start && u.createdAt < end).length;
        days.push({ date: dayKey(start), count });
      }
      return days;
    };

    const [
      totalUsers,
      signupsInPeriod,
      signupsPrevPeriod,
      postsInPeriod,
      postsPrevPeriod,
      usersSeriesRaw,
      postsSeriesRaw,
      likesSeriesRaw,
      openBugs,
      avgValidityAgg,
      avgValidityPrevAgg,
      topPosts,
      roleGroups,
      tierGroups,
      contributors,
      validityScores,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: windowStart } } }),
      prisma.user.count({ where: { createdAt: { gte: prevWindowStart, lt: prevWindowEnd } } }),
      prisma.post.count({ where: { createdAt: { gte: windowStart } } }),
      prisma.post.count({ where: { createdAt: { gte: prevWindowStart, lt: prevWindowEnd } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      prisma.like.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      prisma.bugReport.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.post.aggregate({ _avg: { validityScore: true } }),
      prisma.post.aggregate({
        _avg: { validityScore: true },
        where: { createdAt: { gte: prevWindowStart, lt: prevWindowEnd } },
      }),
      prisma.post.findMany({
        select: { id: true, title: true, validityScore: true, likes: true, views: true },
        // Top-route correctness: only live ROUTEs qualify (archived + route
        // requests excluded), deterministic tie-break so the true top-N can
        // never be skipped by unstable ordering.
        where: { isArchived: false, type: { not: "ROUTE_REQUEST" } } as never,
        orderBy: [{ validityScore: "desc" }, { likes: "desc" }, { id: "asc" }],
        take: 8,
      }),
      prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
      prisma.user.groupBy({ by: ["rewardTier"], _count: { rewardTier: true } }),
      prisma.user.findMany({
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          avatar: true,
          avatarConfig: true,
          verified: true,
          _count: { select: { posts: true } },
        },
        orderBy: { posts: { _count: "desc" } },
        take: 8,
      }),
      prisma.post.findMany({ select: { validityScore: true } }),
    ]);

    const likesInPeriod = likesSeriesRaw.length;
    const likesPrev = await prisma.like
      .count({ where: { createdAt: { gte: prevWindowStart, lt: prevWindowEnd } } })
      .catch(() => 0);

    const avgValidity = Math.round((avgValidityAgg._avg.validityScore ?? 0) * 10) / 10;
    const avgValidityPrev = Math.round((avgValidityPrevAgg._avg.validityScore ?? 0) * 10) / 10;

    const buckets = ADMIN_ANALYTICS_CONFIG.validityBuckets.map((b) => ({
      id: b.id,
      label: b.label,
      count: validityScores.filter((p) => p.validityScore >= b.min && p.validityScore <= b.max).length,
    }));

    return NextResponse.json(
      {
        period: periodDays,
        kpis: {
          totalUsers,
          postsInPeriod,
          likesInPeriod,
          avgValidity,
          openBugs,
          signupsInPeriod,
        },
        deltas: {
          totalUsers: pctChange(signupsInPeriod, signupsPrevPeriod),
          postsInPeriod: pctChange(postsInPeriod, postsPrevPeriod),
          likesInPeriod: pctChange(likesInPeriod, likesPrev),
          avgValidity: pctChange(avgValidity, avgValidityPrev),
          openBugs: openBugs === 0 ? 0 : null,
          signupsInPeriod: pctChange(signupsInPeriod, signupsPrevPeriod),
        },
        series: {
          signups: bucketize(usersSeriesRaw),
          posts: bucketize(postsSeriesRaw),
          likes: bucketize(likesSeriesRaw),
        },
        validityBuckets: buckets,
        roles: roleGroups.map((g) => ({ id: g.role, label: g.role, count: g._count.role })),
        tiers: tierGroups.map((g) => ({ id: g.rewardTier, label: g.rewardTier, count: g._count.rewardTier })),
        topPosts: topPosts.map((p) => ({
          id: p.id,
          title: p.title,
          validityScore: p.validityScore,
          likes: p.likes,
          views: p.views,
        })),
        topContributors: contributors.map((c) => ({
          id: c.id,
          userName: c.userName,
          firstName: c.firstName,
          lastName: c.lastName,
          avatar: c.avatar,
          avatarConfig: (c as { avatarConfig?: unknown }).avatarConfig ?? null,
          verified: (c as { verified?: unknown }).verified ?? false,
          posts: c._count.posts,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
