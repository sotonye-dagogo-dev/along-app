import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";

export async function GET() {
  try {
    const user = await getUserFromRequest() as { id: string; googleId: string | null; password: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const hasGoogle = !!user.googleId;
    const hasPassword = !!user.password && user.password.length > 0;
    return NextResponse.json({ hasGoogle, hasPassword }, { status: 200 });
  } catch (error) {
    console.error("Link status error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
