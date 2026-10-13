import { NextRequest, NextResponse } from "next/server";
import { mapProxyService } from "@/app/lib/services/mapProxyService";
import { LOCATION_SUGGESTIONS_CONFIG } from "@/app/lib/config/locationSuggestions";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

/**
 * GET /api/maps/geocode?q=&limit=&lat=&lng= — forward geocode proxy.
 * Broad by design: fast keyless providers (Nominatim with server identity
 * headers + Photon + Open-Meteo) fan out in parallel and merge server-side,
 * with Overpass landmark/building fallback + token-reorder retry only when
 * the fast merge is empty; `lat, lng` coordinate queries resolve to an
 * exact pin. Deduped, optionally re-ranked near the
 * viewer's ?lat=&lng= (nearby first, never filtered). Redis cached.
 * Keeps browser clients off upstream geocoders directly (usage-policy
 * compliance). Guest-accessible; bucket-limited.
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
    if (q.length < LOCATION_SUGGESTIONS_CONFIG.minQueryLength) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }
    if (q.length > LOCATION_SUGGESTIONS_CONFIG.maxQueryLength) {
      return NextResponse.json(
        { error: "Search text is too long. Please keep it under 200 characters." },
        { status: 400 }
      );
    }
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || LOCATION_SUGGESTIONS_CONFIG.limit, 1),
      10
    );
    // Optional viewer bias — validated, never throws, never required.
    const rawLat = Number(searchParams.get("lat"));
    const rawLng = Number(searchParams.get("lng") ?? searchParams.get("lon"));
    const near =
      Number.isFinite(rawLat) && Number.isFinite(rawLng) && rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180
        ? { lat: rawLat, lng: rawLng }
        : null;
    const results = await mapProxyService.geocodeForward(q, limit, near);
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.warn("[maps/geocode] request failed", (error as Error)?.message);
    return NextResponse.json(
      { error: "Location search is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}
