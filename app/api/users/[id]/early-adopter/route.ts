import { NextRequest, NextResponse } from "next/server";
import { getEarlyAdopterStatus } from "@/app/lib/services/earlyAdopterService";

/**
 * GET /api/users/:id/early-adopter
 * Public, config-driven badge status for one user. Rank is derived from the
 * already-recorded User.createdAt (ordered asc, id asc tie-break) — no new
 * columns, no migration. Returns 404 for unknown users.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User id required" }, { status: 400 });
    }
    const status = await getEarlyAdopterStatus(id);
    if (status.rank === null && status.enabled) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ earlyAdopter: status }, { status: 200 });
  } catch (error) {
    console.error("Early adopter status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
