import { NextRequest, NextResponse } from "next/server";
import { fetchListings } from "@/app/lib/integrations/transact";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId") || undefined;
    const type = searchParams.get("type") || undefined;
    const listings = await fetchListings({ postId, type });
    return NextResponse.json({ listings }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
