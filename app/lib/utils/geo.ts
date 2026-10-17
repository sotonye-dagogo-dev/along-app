/**
 * Shared client-side geo helpers: distance estimates, geolocation and
 * reverse geocoding. Used by the share-route preview (live estimates) and
 * location inputs ("use my current location" autofill).
 */

import { LOCATION_FEEDBACK_CONFIG } from "@/app/lib/config/locationFeedback";
import { speedForVehicle } from "@/app/lib/config/journeyTime";

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const AVG_URBAN_SPEED_KMH = 22; // danfo/keke/bus mixed traffic (legacy fallback — vehicle-aware callers pass a mode)

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const val = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
}

export interface RouteEstimate {
  distanceKm: number;
  durationMins: number;
}

/**
 * Instant, offline-friendly straight-line estimate for a pin sequence.
 * Non-breaking vehicle-aware extension: pass a vehicle key (e.g. "trekking",
 * "bike", "boat", "train") to estimate at that mode's speed; omitted →
 * the legacy mixed-traffic average.
 */
export function estimateRoute(points: GeoPoint[], vehicle?: string | null): RouteEstimate {
  if (points.length < 2) return { distanceKm: 0, durationMins: 0 };
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  // Road travel is typically ~1.3x straight-line distance
  const distanceKm = Math.round(total * 1.3 * 10) / 10;
  let speedKmh = AVG_URBAN_SPEED_KMH;
  try {
    if (typeof vehicle === "string" && vehicle.trim().length > 0) {
      const s = speedForVehicle(vehicle);
      if (Number.isFinite(s) && s > 0) speedKmh = s;
    }
  } catch {
    // Fall back to the legacy average.
  }
  const durationMins = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
  return { distanceKm, durationMins };
}

/** Stable cache key for a pin sequence (3dp ≈ 110m granularity). */
export function traceSignature(points: GeoPoint[]): string {
  return points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join(">");
}

/**
 * Client memory-cache key for a traced route. Vehicle-aware traces can
 * differ per mode (walking/cycling profiles), so the mode joins the key;
 * no vehicle keeps the legacy `route-trace:{sig}` shape.
 */
export function traceCacheKey(sig: string, vehicle?: string | null): string {
  const mode = typeof vehicle === "string" ? vehicle.trim().toLowerCase() : "";
  return mode ? `route-trace:${sig}:${mode}` : `route-trace:${sig}`;
}

/** Minimal step shape the Find-on-map resolver needs. */
export interface FindOnMapStep {
  lat?: number;
  lng?: number;
}

export interface FindOnMapTarget {
  lat: number;
  lng: number;
  /** Which rule produced the target (tests + debugging). */
  source: "coords" | "previous" | "bias";
}

function findOnMapCoord(
  steps: readonly FindOnMapStep[],
  index: number,
  source: "coords" | "previous",
): FindOnMapTarget | null {
  const s = steps[index];
  if (!s || typeof s.lat !== "number" || typeof s.lng !== "number") return null;
  if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return null;
  if (s.lat === 0 && s.lng === 0) return null;
  return { lat: s.lat, lng: s.lng, source };
}

/**
 * Pure focus-target resolver for the "Find on map" CTA (Sprint 72).
 *
 * Non-network rules only: this stop's pinned coords → the nearest previous
 * stop with coords (backwards walk — a typed stop with no pin yet should
 * open focused near what's already on the route) → the granted viewer bias.
 * The caller layers the async steps between them (geocoding this stop's
 * typed text after `coords`, GPS after `bias`) and opens the preview
 * regardless — a null target just skips the fly-to.
 */
export function resolveFindOnMapTarget(
  steps: readonly FindOnMapStep[],
  index: number,
  bias?: { lat: number; lng: number } | null,
): FindOnMapTarget | null {
  const direct = findOnMapCoord(steps, index, "coords");
  if (direct) return direct;
  for (let i = index - 1; i >= 0; i--) {
    const prev = findOnMapCoord(steps, i, "previous");
    if (prev) return prev;
  }
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    return { lat: bias.lat, lng: bias.lng, source: "bias" };
  }
  return null;
}

/** Resolves the browser geolocation fix. Rejects with a friendly message. */
export function getCurrentPosition(timeoutMs = 8000): Promise<GeoPoint & { accuracy?: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error(LOCATION_FEEDBACK_CONFIG.unsupported));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? LOCATION_FEEDBACK_CONFIG.deniedWithTypingHint
              : `${LOCATION_FEEDBACK_CONFIG.unavailable} — type the location instead`
          )
        ),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

/** Reverse geocodes a fix to a human-readable address (null on failure). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // Keyless stack: resolve via the internal server proxy (cached,
    // policy-compliant). No browser-direct upstream calls.
    if (typeof window !== "undefined") {
      const res = await fetch(`/api/maps/reverse?lat=${lat}&lng=${lng}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { label?: string | null };
      return typeof data.label === "string" && data.label.length > 0 ? data.label : null;
    }
    return null;
  } catch {
    return null;
  }
}
