/**
 * Shared client-side geo helpers: distance estimates, geolocation and
 * reverse geocoding. Used by the share-route preview (live estimates) and
 * location inputs ("use my current location" autofill).
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const AVG_URBAN_SPEED_KMH = 22; // danfo/keke/bus mixed traffic

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

/** Instant, offline-friendly straight-line estimate for a pin sequence. */
export function estimateRoute(points: GeoPoint[]): RouteEstimate {
  if (points.length < 2) return { distanceKm: 0, durationMins: 0 };
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  // Road travel is typically ~1.3x straight-line distance
  const distanceKm = Math.round(total * 1.3 * 10) / 10;
  const durationMins = Math.max(1, Math.round((distanceKm / AVG_URBAN_SPEED_KMH) * 60));
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
      reject(new Error("Location is not available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied — type the location instead"
              : "Couldn't get your location — type the location instead"
          )
        ),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

/** Reverse geocodes a fix to a human-readable address (null on failure). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=en`,
      { headers: { "User-Agent": "AlongApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
