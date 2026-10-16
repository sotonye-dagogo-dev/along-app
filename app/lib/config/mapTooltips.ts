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

/** Ordered stop index (1-based) label for a leg endpoint. Pure. */
export function legEndpointLabel(
  pinIndex: number,
  totalPins: number,
  pinLabel?: string | null
): string {
  if (!Number.isFinite(pinIndex) || !Number.isFinite(totalPins) || totalPins <= 0) {
    return typeof pinLabel === "string" && pinLabel.trim().length > 0 ? pinLabel.trim() : "Stop";
  }
  const idx = Math.max(0, Math.min(totalPins - 1, Math.floor(pinIndex)));
  if (typeof pinLabel === "string" && pinLabel.trim().length > 0) {
    const trimmed = pinLabel.trim();
    return trimmed.length > 28 ? `${trimmed.slice(0, 27)}…` : trimmed;
  }
  if (idx === 0) return "Origin";
  if (idx === totalPins - 1) return "Destination";
  return `Stop ${idx + 1}`;
}

/** "Origin → Stop 2" style label for the leg starting at `legIndex`. Pure. */
export function legRangeLabel(
  legIndex: number,
  pins: { label?: string | null }[] | null | undefined
): string {
  const total = Array.isArray(pins) ? pins.length : 0;
  if (!Array.isArray(pins) || total < 2) return "";
  if (!Number.isFinite(legIndex) || legIndex < 0 || legIndex >= total - 1) return "";
  const from = legEndpointLabel(legIndex, total, pins[legIndex]?.label);
  const to = legEndpointLabel(legIndex + 1, total, pins[legIndex + 1]?.label);
  return `${from} → ${to}`;
}

/** "Stretch 2 of 4" counter label. Empty string when not computable. Pure. */
export function legCounterLabel(legIndex: number, totalLegs: number): string {
  if (!Number.isFinite(legIndex) || !Number.isFinite(totalLegs)) return "";
  if (totalLegs <= 0 || legIndex < 0 || legIndex >= totalLegs) return "";
  return `Stretch ${Math.floor(legIndex) + 1} of ${Math.floor(totalLegs)}`;
}

/**
 * Nearest route-coord index for every pin (pure). Returns a monotonic
 * non-decreasing border list clamped to the geometry, so consecutive pins
 * that geocode to the same snapped point collapse to a zero-length leg
 * instead of an inverted range. Empty when inputs are degenerate.
 */
export function pinBordersOnRoute(
  coords: TooltipCoord[] | null | undefined,
  pins: { lat: number; lng: number }[] | null | undefined
): number[] {
  if (!Array.isArray(coords) || coords.length < 2) return [];
  if (!Array.isArray(pins) || pins.length < 2) return [];
  const borders: number[] = [];
  for (const pin of pins) {
    if (!pin || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) {
      borders.push(borders.length === 0 ? 0 : borders[borders.length - 1]);
      continue;
    }
    const idx = nearestCoordIndex(coords, pin.lat, pin.lng);
    const clamped = idx < 0 ? 0 : Math.max(0, Math.min(coords.length - 1, idx));
    const prev = borders.length === 0 ? 0 : borders[borders.length - 1];
    borders.push(Math.max(prev, clamped));
  }
  // Pin the route ends: the snapped trace starts/ends at the stops, so the
  // first border is the trace head and the last is the trace tail even when
  // geocoding jitter pulls a pin slightly off the line.
  borders[0] = 0;
  borders[borders.length - 1] = coords.length - 1;
  return borders;
}

/** Leg containing a coord index, or -1 (pure). */
export function legIndexForCoord(borders: number[] | null | undefined, index: number): number {
  if (!Array.isArray(borders) || borders.length < 2) return -1;
  if (!Number.isFinite(index) || index < 0) return -1;
  for (let leg = 0; leg < borders.length - 1; leg++) {
    const from = borders[leg];
    const to = borders[leg + 1];
    if (index >= from && index <= to) {
      // Shared border points belong to the earlier leg, except the final
      // tail point which belongs to the last leg.
      if (index === to && leg < borders.length - 2) continue;
      return leg;
    }
  }
  // Clamp out-of-range taps to the nearest end leg instead of nothing.
  if (index < borders[0]) return 0;
  return borders.length - 2;
}

/** Bounds of one leg, or null (pure). */
export function legBounds(
  borders: number[] | null | undefined,
  legIndex: number
): { from: number; to: number } | null {
  if (!Array.isArray(borders) || borders.length < 2) return null;
  if (!Number.isFinite(legIndex) || legIndex < 0 || legIndex >= borders.length - 1) return null;
  const from = Math.max(0, Math.floor(borders[legIndex]));
  const to = Math.max(from + 1, Math.ceil(borders[legIndex + 1]));
  return { from, to };
}

/** Worst traffic level overlapping a coord range (heavy > moderate > low). Pure. */
export function worstLevelInRange<T extends RemappedSegmentLike>(
  segments: T[] | null | undefined,
  from: number,
  to: number
): TrafficLevel {
  if (!Array.isArray(segments) || segments.length === 0) return "low";
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  let worst: TrafficLevel = "low";
  for (const s of segments) {
    if (!s || s.to < lo || s.from > hi) continue;
    if (s.level === "heavy") return "heavy";
    if (s.level === "moderate") worst = "moderate";
  }
  return worst;
}

function haversineKmPure(a: TooltipCoord, b: TooltipCoord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Share of the route's travelled length covered by a slice (0..1, pure).
 * Uses polyline length (haversine sum) rather than point counts, so a long
 * highway leg reports a larger share than a short hop even when both carry
 * the same number of snapped points. Falls back to count-share on
 * degenerate geometry.
 */
export function legLengthShare(
  coords: TooltipCoord[] | null | undefined,
  from: number,
  to: number
): number {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  const n = coords.length;
  const lo = Math.max(0, Math.min(n - 1, Math.floor(Math.min(from, to))));
  const hi = Math.max(0, Math.min(n - 1, Math.ceil(Math.max(from, to))));
  if (hi <= lo) return 0;
  let total = 0;
  let slice = 0;
  for (let i = 1; i < n; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
      continue;
    }
    const d = haversineKmPure(a, b);
    if (!Number.isFinite(d) || d < 0) continue;
    total += d;
    if (i > lo && i <= hi) slice += d;
  }
  if (!(total > 0)) return segmentShare(n, from, to);
  const share = slice / total;
  return Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0;
}

/** Leg distance (km, 1 decimal) from the route total. Pure. */
export function legDistanceKm(
  totalKm: number,
  coords: TooltipCoord[] | null | undefined,
  from: number,
  to: number
): number {
  if (!Number.isFinite(totalKm) || totalKm <= 0) return 0;
  const share = legLengthShare(coords, from, to);
  if (share <= 0) return 0;
  return Math.round(totalKm * share * 10) / 10;
}

/**
 * Leg time estimate (mins) from the route base, scaled by the leg's own
 * traffic delay factor. Pure, with the same 1-minute floor as the chunk
 * helper whenever a base duration exists.
 */
export function legEstMins(
  baseMins: number,
  coords: TooltipCoord[] | null | undefined,
  from: number,
  to: number,
  delayFactor: number
): number {
  if (!Number.isFinite(baseMins) || baseMins <= 0) return 0;
  const share = legLengthShare(coords, from, to);
  if (share <= 0) return 0;
  const factor = Number.isFinite(delayFactor) && delayFactor > 0 ? delayFactor : 1;
  return Math.max(1, Math.round(baseMins * share * factor));
}

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
