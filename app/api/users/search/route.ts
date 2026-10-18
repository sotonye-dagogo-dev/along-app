import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { clampPageLimit } from "@/app/lib/config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] }, { status: 200 });
    }

    // Mention typeahead sends no `limit` → search surface default (10),
    // exactly the fixed size it has always had.
    const limit = clampPageLimit(searchParams.get("limit"), "search");

    const users = await prisma.user.findMany({
      where: {
        // Deleted/archived accounts are never searchable on user surfaces.
        isDeleted: false,
        deletionScheduledFor: null,
        OR: [
          { userName: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        avatar: true,
        avatarConfig: true,
        verified: true,
      },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Search users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
