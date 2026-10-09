import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { queryAudit } from "@/app/lib/services/auditService";

/** Admin audit trail — GET ?action=&entity=&actorId=&cursor=&limit= */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const data = await queryAudit({
      action: searchParams.get("action") ?? undefined,
      entity: searchParams.get("entity") ?? undefined,
      actorId: searchParams.get("actorId") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: Number(searchParams.get("limit")) || 20,
    });
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("admin audit GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
