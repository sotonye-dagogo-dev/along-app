/**
 * Traffic overlay configuration (config-driven, zero app deps).
 *
 * Provider reality: none of the employed map providers yields traffic
 * keyless (OSRM demo has no speeds; ORS has no traffic; Mapbox congestion
 * needs a key; geocoders are not traffic sources). So the stack is:
 *   1. `mapbox` — Directions `congestion_numeric` annotations, ONLY when a
 *      Mapbox key is configured (same envs as mapStack.hasMapboxKey()).
 *   2. `tomtom` — TomTom Traffic Flow segment API, ONLY when the optional
 *      `TOMTOM_TRAFFIC_KEY` env is set (free tier, no other integration).
 *   3. `heuristic` — ALWAYS available, keyless, deterministic estimate from
 *      time-of-day rush curves + weekend dampening + urban factor. Results
 *      are explicitly flagged `estimated: true` so the UI can label them
 *      honestly ("estimated traffic") instead of implying live probes.
 *
 * Levels: `low` keeps the base route color; `moderate` paints yellow and
 * `heavy` paints red, per the product directive. Colors are hex constants
 * here (map paint needs concrete values; the legend dots reuse the same
 * constants so swatch and line can never diverge).
 */

export type TrafficLevel = "low" | "moderate" | "heavy";
export type TrafficProvider = "mapbox" | "tomtom" | "heuristic";

export interface TrafficLevelMeta {
  label: string;
  /** Map line color for the level. */
  color: string;
  /** Duration multiplier applied to the level's share of the route. */
  delayFactor: number;
}

export interface TrafficConfig {
  /** Provider attempt order — `heuristic` must stay last (always works). */
  providerOrder: TrafficProvider[];
  levels: Record<TrafficLevel, TrafficLevelMeta>;
  /**
   * Numeric-congestion → level thresholds (Mapbox `congestion_numeric`
   * is 0..100 per coordinate; TomTom flow maps to the same 0..100 scale
   * via (1 - speed/FreeFlow) before these thresholds).
   */
  thresholds: { moderateAt: number; heavyAt: number };
  /** Redis TTL (seconds) for traffic read-through — traffic is volatile. */
  cacheTtlSec: number;
  /** Max coordinates sampled per traffic lookup (bounds upstream cost). */
  maxSamplePoints: number;
  /** Rush windows in WAT (Africa/Lagos) driving the heuristic estimate. */
  rushWindows: { morning: [number, number]; evening: [number, number] };
  /** Heuristic delay blend: moderate/heavy shares scale the base duration. */
  legend: {
    title: string;
    estimatedNote: string;
    liveNote: string;
    dismissLabel: string;
    openLabel: string;
    durationSuffix: string;
  };
}

export const TRAFFIC_CONFIG: TrafficConfig = {
  providerOrder: ["mapbox", "tomtom", "heuristic"],
  levels: {
    low: { label: "Free flow", color: "#00623B", delayFactor: 1 },
    moderate: { label: "Medium traffic", color: "#EAB308", delayFactor: 1.15 },
    heavy: { label: "Heavy traffic", color: "#DC2626", delayFactor: 1.35 },
  },
  thresholds: { moderateAt: 35, heavyAt: 65 },
  cacheTtlSec: 300,
  maxSamplePoints: 60,
  rushWindows: { morning: [7, 10], evening: [16, 20] },
  legend: {
    title: "Traffic",
    estimatedNote: "Estimated from typical conditions — refresh when online for the latest.",
    liveNote: "Live traffic for this route right now.",
    dismissLabel: "Close traffic legend",
    openLabel: "About traffic colors",
    durationSuffix: "with traffic",
  },
};

/** True when the optional TomTom traffic override is configured (server-only env). */
export function hasTomtomKey(): boolean {
  // Trimmed: pasted Vercel values may carry stray whitespace/newlines that
  // would otherwise count as "configured" and fire failing upstream calls.
  const raw = process.env.TOMTOM_TRAFFIC_KEY;
  return typeof raw === "string" ? raw.trim().length > 0 : false;
}

/** congestionNumeric (0..100) → level via config thresholds. Pure. */
export function levelForCongestion(value: number): TrafficLevel {
  if (!Number.isFinite(value)) return "low";
  if (value >= TRAFFIC_CONFIG.thresholds.heavyAt) return "heavy";
  if (value >= TRAFFIC_CONFIG.thresholds.moderateAt) return "moderate";
  return "low";
}

/**
 * Deterministic 0..100 congestion score for a segment index at an hour —
 * the heuristic core. Hash-based (no Math.random) so server estimates,
 * re-renders and re-fetches agree exactly. Rush peaks (WAT morning/evening
 * on weekdays) push scores up; nights/weekends stay free-flow.
 */
export function heuristicCongestion(segmentIndex: number, segmentCount: number, at: Date = new Date()): number {
  const hour = at.getHours();
  const day = at.getDay(); // 0 Sun … 6 Sat
  const weekend = day === 0 || day === 6;
  const [m0, m1] = TRAFFIC_CONFIG.rushWindows.morning;
  const [e0, e1] = TRAFFIC_CONFIG.rushWindows.evening;
  const inRush = (hour >= m0 && hour < m1) || (hour >= e0 && hour < e1);
  const base = weekend ? 12 : inRush ? 58 : 26;
  // Deterministic spread ±22 from a tiny integer hash (segment + hour).
  let h = (segmentIndex * 2654435761 + segmentCount * 40503 + hour * 97) >>> 0;
  h ^= h >> 15;
  h = (h * 2246822519) >>> 0;
  h ^= h >> 13;
  const spread = (h % 45) - 22; // -22..+22
  const urban = segmentCount > 8 ? 6 : 0; // longer urban routes skew heavier
  return Math.max(0, Math.min(100, base + spread + urban));
}

/** Blend a base duration by per-level segment shares. Pure. */
export function adjustDurationForLevels(
  baseMins: number,
  counts: Record<TrafficLevel, number>,
  total: number
): number {
  if (!Number.isFinite(baseMins) || total <= 0) return Math.round(baseMins);
  const { levels } = TRAFFIC_CONFIG;
  const blended =
    (counts.low / total) * levels.low.delayFactor +
    (counts.moderate / total) * levels.moderate.delayFactor +
    (counts.heavy / total) * levels.heavy.delayFactor;
  return Math.max(Math.round(baseMins * blended), Math.round(baseMins));
}

export interface RemappableTrafficSegment {
  from: number;
  to: number;
  level: TrafficLevel;
}

/**
 * Remap traffic segments computed for one geometry length onto a new
 * geometry length (pure). The tracer first draws a straight pins line and
 * then swaps in the road-snapped trace (10× the points): raw `from`/`to`
 * indices from the old geometry would collapse onto a tiny head slice of
 * the new line and the traffic colors would "vanish". Fractional remapping
 * keeps each chunk's *share* of the route, so the overlay persists across
 * every tracing update with logical fallbacks (empty → [], degenerate →
 * clamped to the new line).
 */
export function remapTrafficSegments<T extends RemappableTrafficSegment>(
  segments: T[],
  newLength: number
): T[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  if (!Number.isFinite(newLength) || newLength < 2) return [];
  const oldLength = Math.max(...segments.map((s) => s.to)) + 1;
  if (!Number.isFinite(oldLength) || oldLength < 2) return [];
  // Same geometry generation — indices already agree, no work needed.
  if (oldLength === Math.round(newLength)) return segments;
  const n = Math.floor(newLength);
  return segments.map((s) => {
    const fracFrom = s.from / oldLength;
    const fracToExclusive = (s.to + 1) / oldLength;
    const from = Math.max(0, Math.min(n - 2, Math.floor(fracFrom * n)));
    const to = Math.max(from + 1, Math.min(n - 1, Math.ceil(fracToExclusive * n) - 1));
    return { ...s, from, to };
  });
}
