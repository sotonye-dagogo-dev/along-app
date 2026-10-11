import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config";

interface BoardRow {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  avatar: string | null;
  rewardPoints: number;
  rewardTier: string | null;
  postCount: number;
  followerCount: number;
  createdAt?: string | Date;
}

interface RankedRow extends BoardRow {
  rank: number;
}

/**
 * Standard competition ranking ("1, 2, 2, 4"): rows must already be
 * ordered by rewardPoints desc (createdAt asc breaks display ties).
 * Equal points share the same rank so placement always agrees with
 * points — the previous `rank = index + 1` gave different ranks to
 * tied users depending on array position.
 */
function assignCompetitionRanks(rows: BoardRow[]): RankedRow[] {
  let rank = 0;
  let prevPoints: number | null = null;
  return rows.map((row, i) => {
    if (prevPoints === null || row.rewardPoints !== prevPoints) {
      rank = i + 1;
      prevPoints = row.rewardPoints;
    }
    return { ...row, rank };
  });
}

function toBoardRow(u: {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  avatar: string | null;
  rewardPoints: number;
  rewardTier: string | null;
  createdAt?: string | Date;
  _count: { posts: number; followers: number };
}): BoardRow {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    userName: u.userName,
    avatar: u.avatar,
    rewardPoints: u.rewardPoints,
    rewardTier: u.rewardTier,
    postCount: u._count.posts,
    followerCount: u._count.followers,
    createdAt: u.createdAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const viewerId = (user as { id: string }).id;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit")) || 20));

    // Global ranking — safe to share across viewers, 10 min TTL.
    // The cache holds UNRANKED rows; ranks are recomputed on every read
    // so a stale baked rank can never disagree with the stored points.
    // Paginated slices are derived from the ranked full board.
    try {
      const { redis } = await import("@/app/lib/db/redis");
      const cached = await redis.get<{ leaderboard: Array<BoardRow> }>(CACHE_KEYS.leaderboard());
      if (cached?.leaderboard?.length) {
        const ordered = [...cached.leaderboard].sort((a, b) => {
          if (b.rewardPoints !== a.rewardPoints) return b.rewardPoints - a.rewardPoints;
          // Same display tie-break as the DB query (earliest account first).
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });
        const ranked = assignCompetitionRanks(ordered);
        const total = ranked.length;
        const slice = ranked.slice((page - 1) * limit, page * limit);
        const me = ranked.find((e) => e.id === viewerId) ?? null;
        return NextResponse.json({ leaderboard: slice, page, totalPages: Math.max(1, Math.ceil(total / limit)), total, me }, { status: 200 });
      }
    } catch { /* fall through to DB */ }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          userName: true,
          avatar: true,
          rewardPoints: true,
          rewardTier: true,
          createdAt: true,
          _count: { select: { posts: true, followers: true } },
        },
        orderBy: [{ rewardPoints: "desc" }, { createdAt: "asc" }],
        take: 500,
      }),
      prisma.user.count({ where: { isDeleted: false } }).catch(() => null),
    ]);

    const ordered = users.map(toBoardRow);
    const leaderboard = assignCompetitionRanks(ordered);

    try {
      const { redis } = await import("@/app/lib/db/redis");
      await redis.set(CACHE_KEYS.leaderboard(), { leaderboard: ordered }, { ex: CACHE_TTL.leaderboard });
    } catch { /* non-critical */ }

    // Viewer outside the top-500 slice still gets an accurate rank:
    // rank = 1 + users strictly ahead (more points, or same points
    // with an earlier account — the same tie-break as the ordering).
    let me = leaderboard.find((e) => e.id === viewerId) ?? null;
    if (!me) {
      try {
        const viewer = await prisma.user.findUnique({
          where: { id: viewerId },
          select: {
            id: true, firstName: true, lastName: true, userName: true,
            avatar: true, rewardPoints: true, rewardTier: true, createdAt: true,
            _count: { select: { posts: true, followers: true } },
          },
        });
        if (viewer) {
          const ahead = await prisma.user.count({
            where: {
              isDeleted: false,
              OR: [
                { rewardPoints: { gt: viewer.rewardPoints } },
                {
                  rewardPoints: viewer.rewardPoints,
                  createdAt: { lt: viewer.createdAt },
                },
              ],
            },
          });
          me = { ...toBoardRow(viewer), rank: ahead + 1 };
        }
      } catch { /* me stays null — non-critical */ }
    }

    const boardTotal = total ?? leaderboard.length;
    return NextResponse.json({
      leaderboard: leaderboard.slice((page - 1) * limit, page * limit),
      page, totalPages: Math.max(1, Math.ceil(boardTotal / limit)), total: boardTotal, me,
    }, { status: 200 });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
