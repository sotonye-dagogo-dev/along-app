import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getDeletionStatus } from "@/app/lib/services/accountDeletionService";

export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { pending } = await getDeletionStatus(user.id as string);
    if (!pending) return NextResponse.json({ pending: null }, { status: 200 });
    return NextResponse.json({
      pending: {
        id: pending.id,
        requestedAt: pending.requestedAt,
        scheduledFor: pending.scheduledFor,
        reason: pending.reason,
      },
    }, { status: 200 });
  } catch (e) {
    console.error("deletion-status error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
