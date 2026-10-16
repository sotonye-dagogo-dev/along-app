/**
 * Map tracing tooltip configuration (config-driven, zero app deps).
 *
 * Single source of truth for the tap-on-tracing tooltips on every map:
 * - `detailed` mode (post detail + navigation guide): tapping the route
 *   tracing shows the traffic level for that stretch, the estimated time
 *   for that movement, its distance share, and the live/estimated note.
 * - `mini` mode (post-card feed maps): per-card traffic lookups are
 *   disabled to protect rate limits, so tapping the tracing shows a light
 *   prompt that links out to the post detail / navigation guide where the
 *   full traffic + tracing data lives.
 *
 * Design tokens / copy only — no hardcoded UI strings in renderers. All
 * helpers are pure with safe fallbacks so tooltips never throw on
 * degenerate geometries.
 */

import type { TrafficLevel } from "@/app/lib/config/traffic";

export type MapTooltipMode = "detailed" | "mini";
export type MapTooltipModePreference = "auto" | MapTooltipMode;

export interface MapSegmentTooltipConfig {
  /** Card chrome for the tooltip (token classes only). */
  cardClass: string;
  /** Title shown above the segment facts. */
  title: string;
  /** Per-stretch time row label (the value is appended by the renderer). */
  stretchTimeLabel: string;
  /** Per-stretch distance row label. */
  stretchDistanceLabel: string;
  /** Note appended when the level is low (free flow). */
  freeFlowNote: string;
  /** Estimated vs live provider notes (mirrors the traffic legend). */
  estimatedNote: string;
  liveNote: string;
  closeLabel: string;
  /** Tap hint rendered under the overlay stats (empty hides it). */
  tapHint: string;
}

export interface MapMiniTooltipConfig {
  title: string;
  body: string;
  viewPostLabel: string;
  navigateLabel: string;
  closeLabel: string;
  cardClass: string;
}

export interface MapTooltipsConfig {
  detailed: MapSegmentTooltipConfig;
  mini: MapMiniTooltipConfig;
  /**
   * Invisible tap-target line width (px) over the visible tracing. The
   * visible line is ~3.5px — too thin to tap reliably on mobile — so a
   * wider transparent hit line sits on the same geometry.
   */
  hitLineWidth: number;
  /** Max width of the tooltip card (CSS). */
  cardMaxWidth: string;
}

export const MAP_TOOLTIPS_CONFIG: MapTooltipsConfig = {
  detailed: {
    cardClass:
      "rounded-md bg-bg-card border border-border shadow-lg p-3 text-left",
    title: "This stretch",
    stretchTimeLabel: "Est.",
    stretchDistanceLabel: "Distance",
    freeFlowNote: "Free flow on this stretch.",
    estimatedNote: "Estimated from typical conditions.",
    liveNote: "Live traffic right now.",
    closeLabel: "Close stretch details",
    tapHint: "Tap the route line to see traffic for that stretch",
  },
  mini: {
    title: "Route preview",
    body: "Mini maps stay light — open the post for full traffic, tracings and the step-by-step navigation guide.",
    viewPostLabel: "View post",
    navigateLabel: "Open navigation guide",
    closeLabel: "Close map info",
    cardClass:
      "rounded-md bg-bg-card border border-border shadow-lg p-3 text-left",
  },
  hitLineWidth: 18,
  cardMaxWidth: "13rem",
};

/** Resolve the effective tooltip mode. `auto` follows traffic depth. */
export function resolveTooltipMode(
  preference: MapTooltipModePreference | undefined,
  showTraffic: boolean
): MapTooltipMode {
  if (preference === "detailed" || preference === "mini") return preference;
  return showTraffic ? "detailed" : "mini";
}

export interface TooltipCoord {
  lat: number;
  lng: number;
}

/**
 * Midpoint of a route slice (pure). Falls back to the slice start, then to
 * the route start, then null — callers render nothing on null.
 */
export function segmentMidpoint(
  coords: TooltipCoord[],
  from: number,
  to: number
): TooltipCoord | null {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const n = coords.length;
  const a = Math.max(0, Math.min(n - 1, Math.floor(from)));
  const b = Math.max(0, Math.min(n - 1, Math.ceil(to)));
  const mid = coords[Math.floor((a + b) / 2)] ?? coords[a] ?? coords[0] ?? null;
  if (!mid || !Number.isFinite(mid.lat) || !Number.isFinite(mid.lng)) return null;
  return { lat: mid.lat, lng: mid.lng };
}

/** Share of the route a slice covers (0..1, pure, clamped). */
export function segmentShare(
  coordsLength: number,
  from: number,
  to: number
): number {
  if (!Number.isFinite(coordsLength) || coordsLength < 2) return 0;
  const span = Math.max(1, Math.ceil(to) - Math.floor(from));
  return Math.max(0, Math.min(1, span / Math.max(1, coordsLength - 1)));
}

/**
 * Estimated minutes for one stretch (pure). Splits the base duration
 * evenly across the geometry and scales by the level delay factor, with a
 * 1-minute floor whenever a base duration exists.
 */
export function segmentEstMins(
  baseMins: number,
  from: number,
  to: number,
  coordsLength: number,
  level: TrafficLevel,
  delayFactor: number
): number {
  if (!Number.isFinite(baseMins) || baseMins <= 0) return 0;
  const share = segmentShare(coordsLength, from, to);
  if (share <= 0) return 0;
  void level;
  return Math.max(1, Math.round(baseMins * share * delayFactor));
}

/** Distance share (km, 1 decimal) for one stretch. Pure. */
export function segmentDistanceKm(
  totalKm: number,
  from: number,
  to: number,
  coordsLength: number
): number {
  if (!Number.isFinite(totalKm) || totalKm <= 0) return 0;
  const share = segmentShare(coordsLength, from, to);
  return Math.round(totalKm * share * 10) / 10;
}

/**
 * Index of the coordinate nearest to a tap (pure). Equirectangular
 * distance is plenty for tooltip anchoring — no haversine needed.
 */
export function nearestCoordIndex(
  coords: TooltipCoord[],
  lat: number,
  lng: number
): number {
  if (!Array.isArray(coords) || coords.length === 0) return -1;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return -1;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const dLat = c.lat - lat;
    const dLng = c.lng - lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export interface RemappedSegmentLike {
  from: number;
  to: number;
  level: TrafficLevel;
}

/** Segment containing a coord index, or null (pure). */
export function segmentForIndex<T extends RemappedSegmentLike>(
  segments: T[],
  index: number
): T | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  if (!Number.isFinite(index) || index < 0) return null;
  for (const s of segments) {
    if (index >= s.from && index <= s.to) return s;
  }
  return null;
}

/**
 * Parse a `traffic-line-{from}-{to}` layer id back to its segment bounds
 * (pure, null when the id is not a traffic layer).
 */
export function parseTrafficLayerId(
  layerId: unknown
): { from: number; to: number } | null {
  if (typeof layerId !== "string") return null;
  const m = /^traffic-line-(\d+)-(\d+)$/.exec(layerId);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return null;
  return { from, to };
}
