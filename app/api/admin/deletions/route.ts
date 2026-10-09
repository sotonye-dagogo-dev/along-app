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
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const where: Record<string, unknown> = {};
    if (status && ["PENDING", "CANCELLED", "COMPLETED"].includes(status)) where.status = status;
    const requests = await prisma.accountDeletionRequest.findMany({
      where: where as never,
      orderBy: { requestedAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, userName: true, firstName: true, lastName: true, email: true, isDeleted: true } } },
    });
    const pendingCount = await prisma.accountDeletionRequest.count({ where: { status: "PENDING" } });
    return NextResponse.json({ requests, pendingCount }, { status: 200 });
  } catch (e) {
    console.error("admin deletions list error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
