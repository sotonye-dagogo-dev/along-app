import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { requestAccountDeletion } from "@/app/lib/services/accountDeletionService";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let reason: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.reason === "string") reason = body.reason;
    } catch { /* reason optional */ }
    const result = await requestAccountDeletion(user.id as string, reason);
    if (!result.ok) return NextResponse.json({ error: result.error ?? "Failed" }, { status: 400 });
    return NextResponse.json({ success: true, scheduledFor: result.scheduledFor, requestId: result.requestId }, { status: 200 });
  } catch (e) {
    console.error("delete-request error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
