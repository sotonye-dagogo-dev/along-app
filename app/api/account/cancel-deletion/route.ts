import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { cancelAccountDeletion } from "@/app/lib/services/accountDeletionService";

export async function POST() {
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await cancelAccountDeletion(user.id as string);
    if (!result.ok) return NextResponse.json({ error: result.error ?? "Failed" }, { status: 400 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("cancel-deletion error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
