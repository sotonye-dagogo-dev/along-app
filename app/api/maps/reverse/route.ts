import { NextRequest, NextResponse } from "next/server";
import { mapProxyService } from "@/app/lib/services/mapProxyService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

/**
 * GET /api/maps/reverse?lat=&lng= — reverse geocode proxy.
 * Nominatim reverse (server identity headers) → Photon reverse fallback,
 * Redis cached. Guest-accessible; bucket-limited.
 */
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, "maps");
  if (!limited.allowed) return limited.response;

  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng") ?? searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Valid lat and lng query params are required." },
        { status: 400 }
      );
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "Coordinates are out of range." },
        { status: 400 }
      );
    }
    const label = await mapProxyService.geocodeReverse(lat, lng);
    return NextResponse.json({ label }, { status: 200 });
  } catch (error) {
    console.warn("[maps/reverse] request failed", (error as Error)?.message);
    return NextResponse.json(
      { error: "We couldn't look up that location right now." },
      { status: 500 }
    );
  }
}
