import { NextRequest, NextResponse } from "next/server";
import { mapProxyService } from "@/app/lib/services/mapProxyService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { MAP_STACK_CONFIG } from "@/app/lib/config/mapStack";

/**
 * GET /api/maps/style?name= — sanitized vector-style proxy.
 *
 * Renderers load vector styles through this same-origin endpoint (see
 * `vectorStyleUrl` in mapStack config) instead of hitting OpenFreeMap
 * browser-direct. The server fetches the whitelisted style (Redis
 * read-through, 8s budget, server identity headers), passes it through the
 * data-driven-null sanitizer (maplibre-gl-js#7856 "Expected value to be of
 * type number, but found null instead"), and returns the hardened JSON with
 * long-lived cache headers. Unknown names → 404; upstream down with no
 * stale copy → 502 (the map raster-fallback ladder handles it). Guest-
 * accessible; bucket-limited. Never throws a raw stack to the client.
 */
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, "maps");
  if (!limited.allowed) return limited.response;

  try {
    const name = (new URL(request.url).searchParams.get("name") ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "A style name is required (e.g. ?name=liberty)." },
        { status: 400 }
      );
    }
    const style = await mapProxyService.getMapStyleDocument(name);
    if (!style) {
      const known = Object.keys(MAP_STACK_CONFIG.vectorStyles).join(", ");
      return NextResponse.json(
        { error: `Unknown map style "${name}". Available: ${known || "none"}.` },
        { status: 404 }
      );
    }
    return NextResponse.json(style, {
      status: 200,
      headers: {
        "Cache-Control": `public, max-age=${MAP_STACK_CONFIG.cacheTtlSec.style}, stale-while-revalidate=${MAP_STACK_CONFIG.cacheTtlSec.style}`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.warn("[maps/style] request failed", (error as Error)?.message);
    return NextResponse.json(
      { error: "Map style is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}
