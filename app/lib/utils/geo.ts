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
