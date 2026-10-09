/**
 * Canonical route-pin builder (config-driven, zero app deps).
 * Single source of truth for turning a stored post into the ordered pin
 * list every map renderer consumes — so the post view traces the SAME
 * start → stop(s) → destination sequence the share-preview traced.
 *
 * Stored shape (authoritative):
 * - `startLat/startLng` = origin coord
 * - `waypoints[]`       = INTERMEDIATE stops only (excludes origin +
 *   destination — this is what the composer sends)
 * - `endLat/endLng`     = destination coord
 * - `routes[]`          = step metadata (location labels), same order as
 *   pins: [origin, ...intermediates, destination]
 *
 * The previous post-detail builder mapped `waypoints` as the FULL route,
 * which dropped origin/destination whenever waypoints existed — and when
 * waypoints were absent (dropped server-side) the map fell back to
 * start → destination, silently skipping every intermediate stop. Both
 * failure modes are fixed here: origin + intermediates + destination are
 * always composed in order, and (0,0) placeholders are filtered.
 */

export interface StoredRouteStepLike {
  location?: string;
}

export interface StoredWaypointLike {
  lat: number;
  lng: number;
}

export interface RoutePinLike {
  lat: number;
  lng: number;
  label: string;
  type: "origin" | "waypoint" | "destination";
}

export interface BuildRoutePinsInput {
  routes?: StoredRouteStepLike[] | unknown;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  waypoints?: StoredWaypointLike[] | null | unknown;
}

function isFiniteCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Narrows an unknown lat/lng pair to a usable coordinate, or null. */
function usableCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * Builds the ordered [origin, ...stops, destination] pin list for a post.
 * Labels come from `routes[i]` so dot N always matches step N.
 */
export function buildRoutePinsFromPost(input: BuildRoutePinsInput): RoutePinLike[] {
  const routes = Array.isArray(input.routes) ? (input.routes as StoredRouteStepLike[]) : [];
  const rawWps = Array.isArray(input.waypoints) ? (input.waypoints as StoredWaypointLike[]) : [];
  const waypoints = rawWps.filter(
    (w): w is StoredWaypointLike =>
      !!w && typeof w === "object" && usableCoord((w as StoredWaypointLike).lat, (w as StoredWaypointLike).lng) !== null
  );

  const pins: RoutePinLike[] = [];
  const origin = usableCoord(input.startLat, input.startLng);
  if (origin) {
    pins.push({
      lat: origin.lat,
      lng: origin.lng,
      label: routes[0]?.location ?? "Start",
      type: "origin",
    });
  }
  waypoints.forEach((w, i) => {
    pins.push({
      lat: w.lat,
      lng: w.lng,
      label: routes[i + 1]?.location ?? "",
      type: "waypoint",
    });
  });
  const dest = usableCoord(input.endLat, input.endLng);
  if (dest) {
    pins.push({
      lat: dest.lat,
      lng: dest.lng,
      label: routes.length > 0 ? (routes[routes.length - 1]?.location ?? "End") : "End",
      type: "destination",
    });
  }
  if (pins.length === 0) return [];

  // Type pass: single pin is the origin; otherwise first=origin,
  // last=destination, middle=waypoint (labels already carry step order).
  return pins.map((p, i) => ({
    ...p,
    type: (pins.length === 1 ? "origin" : i === 0 ? "origin" : i === pins.length - 1 ? "destination" : "waypoint") as RoutePinLike["type"],
  }));
}

/** Ordered lat/lng list for the routing/trace API (same order as pins). */
export function buildTraceInputFromPins(pins: Pick<RoutePinLike, "lat" | "lng">[]): { lat: number; lng: number }[] {
  return pins.map((p) => ({ lat: p.lat, lng: p.lng }));
}

export const ROUTE_PINS_CONFIG = {
  /** Mini/feed maps skip the server trace (perf) — straight-line is enough at 100px. */
  miniMapLiveTrace: false,
  /** Post-detail maps fetch a road-snapped trace like the composer preview. */
  detailMapLiveTrace: true,
} as const;
