import { NextRequest, NextResponse } from "next/server";
import { mapProxyService } from "@/app/lib/services/mapProxyService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

/**
 * POST /api/maps/route — keyless-first route trace proxy.
 * Body: { pins: [{ lat, lng }, ...] } (2..25 pins).
 * OSRM (keyless, cached) → env-gated ORS → env-gated Mapbox → straight-line.
 * Sanitized errors; never leaks upstream details. Auth: open (ShareRouteModal
 * live preview needs it pre-login for drafts; bucket-limited).
 */
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, "maps");
  if (!limited.allowed) return limited.response;

  try {
    const body = await request.json();
    const { pins } = body ?? {};

    if (!pins || !Array.isArray(pins) || pins.length < 2) {
      return NextResponse.json(
        { error: "At least 2 pins (lat/lng objects) are required." },
        { status: 400 }
      );
    }
    if (pins.length > 25) {
      return NextResponse.json(
        { error: "Too many pins — 25 maximum per trace." },
        { status: 400 }
      );
    }
    for (const pin of pins) {
      if (typeof pin?.lat !== "number" || typeof pin?.lng !== "number") {
        return NextResponse.json(
          { error: "Each pin must have lat and lng as numbers." },
          { status: 400 }
        );
      }
    }

    const result = await mapProxyService.traceRoute(pins);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.warn("[maps/route] request failed", (error as Error)?.message);
    return NextResponse.json(
      { error: "We couldn't trace that route right now. Please try again." },
      { status: 500 }
    );
  }
}
