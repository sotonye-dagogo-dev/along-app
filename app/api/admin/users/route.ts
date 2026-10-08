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
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const search = searchParams.get("q");
    // Future-proof filter: ?earlyAdopter=true lists the earliest-joined users
    // first (badge qualification order) for rewards/audience tooling.
    const earlyAdopterOnly = searchParams.get("earlyAdopter") === "true";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { userName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (earlyAdopterOnly && !cursor) {
      const { buildEarlyAdopterLabel } = await import(
        "@/app/lib/config/earlyAdopter"
      );
      let badgeLimit = 100;
      let template = "First {N} Users #{rank}";
      try {
        const stored = await prisma.siteConfig.findUnique({
          where: { key: "earlyAdopterConfig" },
        });
        if (stored?.value && typeof stored.value === "object") {
          const cfg = stored.value as { limit?: unknown; badgeLabelTemplate?: unknown };
          if (typeof cfg.limit === "number" && Number.isFinite(cfg.limit)) {
            badgeLimit = Math.max(1, Math.floor(cfg.limit));
          }
          if (typeof cfg.badgeLabelTemplate === "string" && cfg.badgeLabelTemplate.trim()) {
            template = cfg.badgeLabelTemplate;
          }
        }
      } catch {
        /* defaults */
      }
      const take = Math.min(limit, badgeLimit);
      const earliest = await prisma.user.findMany({
        take,
        where: where as never,
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          role: true,
          rewardTier: true,
          rewardPoints: true,
          verified: true,
          _count: { select: { posts: true } },
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const ranked = earliest.map((u, i) => ({
        ...u,
        earlyAdopterRank: i + 1,
        earlyAdopterLabel: buildEarlyAdopterLabel(
          { limit: badgeLimit, badgeLabelTemplate: template },
          i + 1
        ),
      }));
      return NextResponse.json({ users: ranked, nextCursor: null }, { status: 200 });
    }

    const users = await prisma.user.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: where as never,
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        role: true,
        rewardTier: true,
        rewardPoints: true,
        verified: true,
        _count: { select: { posts: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const hasMore = users.length > limit;
    const result = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? result[result.length - 1].id : null;

    return NextResponse.json({ users: result, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("Admin users list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role required" }, { status: 400 });
    }

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: "USER", verified: false },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Admin user action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
