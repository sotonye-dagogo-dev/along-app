import { NextRequest, NextResponse } from "next/server";
import { mapProxyService } from "@/app/lib/services/mapProxyService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

/**
 * GET /api/maps/geocode?q=&limit= — forward geocode proxy.
 * Nominatim (server identity headers) → Photon fallback, Redis cached.
 * Keeps browser clients off Nominatim directly (usage-policy compliance).
 * Guest-accessible; bucket-limited.
 */
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, "maps");
  if (!limited.allowed) return limited.response;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (!q) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }
    if (q.length < 3) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }
    if (q.length > 200) {
      return NextResponse.json(
        { error: "Search text is too long. Please keep it under 200 characters." },
        { status: 400 }
      );
    }
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 5, 1), 10);
    const results = await mapProxyService.geocodeForward(q, limit);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.warn("[maps/geocode] request failed", (error as Error)?.message);
    return NextResponse.json(
      { error: "Location search is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}
