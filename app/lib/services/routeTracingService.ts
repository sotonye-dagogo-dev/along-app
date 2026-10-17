import { mapProxyService, type MapPin } from "@/app/lib/services/mapProxyService";

interface TraceResult {
  polyline: string;
  distance: number;
  duration: number;
  provider?: string;
}

/**
 * Route tracing facade (Sprint 19: keyless-first).
 *
 * Delegates to `mapProxyService.traceRoute` — single ownership of the
 * provider chain: OSRM demo (keyless, cached) → env-gated ORS → env-gated
 * Mapbox → straight-line fallback. Keyed providers are never attempted
 * without their env keys, so tracing works with ALL map keys unset.
 *
 * Non-breaking vehicle-aware extension: `trace(pins, { vehicle })` runs the
 * mode-aware profile pass (walking/cycling on keyed providers) first and
 * falls back to the same legacy driving chain on any failure.
 *
 * Kept as a thin class wrapper so existing server imports
 * (`routeTracingService.trace(pins)`) keep working unchanged.
 */
class RouteTracingService {
  async trace(pins: MapPin[], opts?: { vehicle?: string | null }): Promise<TraceResult> {
    if (pins.length < 2) {
      throw new Error("At least 2 pins required");
    }

    // Validate pins (same contract as before — invalid input still throws).
    for (const p of pins) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number" || isNaN(p.lat) || isNaN(p.lng)) {
        throw new Error("Invalid pin coordinates");
      }
      if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
        throw new Error("Pin coordinates out of bounds");
      }
    }

    return mapProxyService.traceRoute(pins, opts);
  }
}

export const routeTracingService = new RouteTracingService();
