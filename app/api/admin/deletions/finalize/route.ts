import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { finalizeDueDeletions, requestAccountDeletion } from "@/app/lib/services/accountDeletionService";

/**
 * Admin-triggered deletion pipeline (safe, same grace-period flow).
 * POST { action: "finalizeDue" } runs the cron finalizer on demand.
 * POST { action: "request", userId, reason } starts the 7-day flow for a user.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action ?? "finalizeDue";
    if (action === "request") {
      const { userId, reason } = body as { userId?: string; reason?: string };
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      if (userId === (user.id as string)) return NextResponse.json({ error: "Use your profile to delete your own account" }, { status: 400 });
      const result = await requestAccountDeletion(userId, reason);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, scheduledFor: result.scheduledFor }, { status: 200 });
    }
    const result = await finalizeDueDeletions(50, user.id as string);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (e) {
    console.error("admin deletions finalize error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
