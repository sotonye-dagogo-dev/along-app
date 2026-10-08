import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    // Genuine "no baseline" case: only report movement when there is
    // something to compare. current===0 → flat 0; current>0 → null (new).
    if (current === 0) return 0;
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
    const prevWeekStart = new Date(todayStart.getTime() - 13 * 86400000);
    const prevWeekEnd = new Date(todayStart.getTime() - 7 * 86400000);

    const [
      totalUsers,
      prevTotalUsers,
      postsToday,
      postsYesterday,
      postsThisWeek,
      postsPrevWeek,
      openBugs,
      openBugsPrev,
      avgValidityAgg,
      avgValidityPrevAgg,
      signups7d,
      topPosts,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { lt: weekStart } } }),
      prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.post.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      prisma.post.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.post.count({ where: { createdAt: { gte: prevWeekStart, lt: prevWeekEnd } } }),
      prisma.bugReport.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.bugReport.count({
        where: { status: { notIn: ["RESOLVED", "CLOSED"] }, createdAt: { lt: weekStart } },
      }),
      prisma.post.aggregate({ _avg: { validityScore: true } }),
      prisma.post.aggregate({
        _avg: { validityScore: true },
        where: { createdAt: { lt: weekStart } },
      }),
      (async () => {
        const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86400000);
        const recentUsers = await prisma.user.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true },
        });
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const start = new Date(todayStart.getTime() - i * 86400000);
          const end = new Date(start.getTime() + 86400000);
          const count = recentUsers.filter(u => u.createdAt >= start && u.createdAt < end).length;
          days.push({ date: start.toISOString().slice(0, 10), count });
        }
        return days;
      })(),
      prisma.post.findMany({
        select: { id: true, title: true, validityScore: true },
        orderBy: { validityScore: "desc" },
        take: 5,
      }),
      prisma.user.findMany({
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          rewardTier: true,
          createdAt: true,
          _count: { select: { posts: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    const avgValidity = Math.round((avgValidityAgg._avg.validityScore ?? 0) * 10) / 10;
    const avgValidityPrev = Math.round((avgValidityPrevAgg._avg.validityScore ?? 0) * 10) / 10;

    return NextResponse.json({
      totalUsers,
      postsToday,
      avgValidity,
      openBugs,
      signups7d,
      topPosts: topPosts.map(p => ({ id: p.id, title: p.title, validityScore: p.validityScore })),
      recentUsers,
      deltas: {
        totalUsers: pctChange(totalUsers, prevTotalUsers),
        postsToday: pctChange(postsToday, postsYesterday),
        postsWeek: pctChange(postsThisWeek, postsPrevWeek),
        avgValidity: pctChange(avgValidity, avgValidityPrev),
        openBugs: openBugs === 0 ? 0 : pctChange(openBugs, openBugsPrev),
      },
      previous: {
        totalUsers7dAgo: prevTotalUsers,
        postsYesterday,
        avgValidityPrev,
        openBugsPrev,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
