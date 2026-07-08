import { NextRequest, NextResponse } from "next/server";
import { fetchEvents } from "@/app/lib/integrations/tega";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : undefined;
    const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : undefined;
    const radius = searchParams.get("radius") ? Number(searchParams.get("radius")) : undefined;
    const events = await fetchEvents({ lat, lng, radius });
    return NextResponse.json({ events }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
