import { NextRequest, NextResponse } from "next/server";
import { trafficService } from "@/app/lib/services/trafficService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

/**
 * POST /api/maps/traffic — traffic overlay for a route.
 * Body: { coords: [{ lat, lng }, ...] (2..200), baseDurationMins?: number }
 * or { polyline: string, baseDurationMins?: number }.
 * Keyed live providers (Mapbox congestion / TomTom flow) only when their
 * env keys exist; otherwise a deterministic keyless estimate explicitly
 * flagged `estimated: true`. Sanitized errors; guest-open (map previews
 * need it pre-login); maps-bucket limited.
 */
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, "maps");
  if (!limited.allowed) return limited.response;

  try {
    const body = await request.json();
    const { coords, polyline, baseDurationMins } = body ?? {};

    let list: { lat: number; lng: number }[] | null = null;
    if (Array.isArray(coords)) list = coords;
    else if (typeof polyline === "string" && polyline.length > 0) {
      list = trafficService.decodeRouteCoords(polyline);
    }
    if (!list || list.length < 2) {
      return NextResponse.json(
        { error: "At least 2 route coordinates (or a polyline) are required." },
        { status: 400 }
      );
    }
    if (list.length > 200) {
      return NextResponse.json(
        { error: "Too many coordinates — 200 maximum per traffic lookup." },
        { status: 400 }
      );
    }
    for (const c of list) {
      if (typeof c?.lat !== "number" || typeof c?.lng !== "number") {
        return NextResponse.json(
          { error: "Each coordinate must have lat and lng as numbers." },
          { status: 400 }
        );
      }
    }
    const base =
      typeof baseDurationMins === "number" && Number.isFinite(baseDurationMins) && baseDurationMins >= 0
        ? Math.round(baseDurationMins)
        : 0;
    const result = await trafficService.getTrafficForRoute(list, base);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.warn("[maps/traffic] request failed", (error as Error)?.message);
    return NextResponse.json(
      { error: "We couldn't load traffic right now. The route still shows without it." },
      { status: 500 }
    );
  }
}
