import { NextRequest, NextResponse } from "next/server";
import { finalizeDueDeletions } from "@/app/lib/services/accountDeletionService";

/**
 * Cron finalizer for due deletion requests. Guarded by CRON_SECRET when set;
 * admins can also trigger it manually via the admin deletions panel (which
 * passes the admin session — see /api/admin/deletions/finalize).
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("authorization");
      const qs = new URL(request.url).searchParams.get("secret");
      if (auth !== `Bearer ${secret}` && qs !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    const result = await finalizeDueDeletions();
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (e) {
    console.error("process-deletions error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
