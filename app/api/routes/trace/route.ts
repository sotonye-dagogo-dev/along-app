import { NextRequest, NextResponse } from "next/server";
import { mapProxyService } from "@/app/lib/services/mapProxyService";
import { RATE_LIMITS } from "@/app/lib/config/rateLimits";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const config = RATE_LIMITS.trace;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: RATE_LIMITS.trace.message ?? "Rate limit exceeded" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { pins } = body;

    if (!pins || !Array.isArray(pins) || pins.length < 2) {
      return NextResponse.json(
        { error: "At least 2 pins (lat/lng objects) required" },
        { status: 400 }
      );
    }

    for (const pin of pins) {
      if (typeof pin.lat !== "number" || typeof pin.lng !== "number") {
        return NextResponse.json(
          { error: "Each pin must have lat and lng as numbers" },
          { status: 400 }
        );
      }
    }

    // Sprint 19: delegate to the keyless-first map proxy (OSRM → env-gated
    // ORS/Mapbox → straight-line). Contract unchanged: { polyline,
    // distance, duration, provider }.
    const result = await mapProxyService.traceRoute(pins);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Route trace error:", error);
    return NextResponse.json(
      { error: "Failed to trace route" },
      { status: 500 }
    );
  }
}
