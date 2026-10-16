/**
 * Journey-time configuration (config-driven, zero app deps).
 *
 * Single source of truth for vehicle-aware travel estimates:
 * - average speeds per vehicle (km/h, urban Nigerian context)
 * - traffic sensitivity per vehicle (0 = immune, 1 = fully affected)
 *
 * Product directive: trekking speed differs from cars/bikes, and some modes
 * (trekking, bikes, boats, trains) are not overly influenced by road
 * traffic. All helpers are pure with logical fallbacks (unknown vehicle →
 * default road speed, full traffic sensitivity) so callers never throw.
 */

export type JourneyVehicle = string;

export interface JourneyVehicleMeta {
  /** Mean urban speed in km/h used for duration estimates. */
  avgSpeedKmh: number;
  /**
   * Share of the traffic delay that applies to this mode (0..1).
   * 0 = immune (trains/boats/trekking), 1 = fully exposed (cars/buses).
   */
  trafficSensitivity: number;
  /** Human note for docs/FAQs (why this mode behaves this way). */
  note: string;
}

export interface JourneyTimeConfig {
  /** Per-vehicle tuning. Unknown keys fall back to `defaultVehicle`. */
  vehicles: Record<string, JourneyVehicleMeta>;
  /** Fallback vehicle key when the mode is missing/unknown. */
  defaultVehicle: string;
  /** Minimum displayed duration (minutes) — avoids "0 min" for short hops. */
  minDurationMins: number;
  /** Road-distance fudge over straight-line haversine (road ≈ 1.3× crow-flies). */
  roadFactor: number;
  /** Fallback urban speed when no vehicle context exists (km/h). */
  fallbackSpeedKmh: number;
  /**
   * Modes whose durations are recomputed from distance (not trusted from
   * driving-trace providers): OSRM/Mapbox durations assume cars, so slow or
   * rail/water modes must be re-derived from their own speed.
   */
  recomputeFromDistance: string[];
}

export const JOURNEY_TIME_CONFIG: JourneyTimeConfig = {
  vehicles: {
    // Active human-powered — walking pace, pavements/paths bypass traffic.
    trekking: {
      avgSpeedKmh: 5,
      trafficSensitivity: 0.05,
      note: "Walking pace; footpaths bypass road congestion almost entirely.",
    },
    // Bicycle — lane-splitting + cycle paths dodge most jams, slower cruise.
    bike: {
      avgSpeedKmh: 16,
      trafficSensitivity: 0.35,
      note: "Cycles filter through traffic but cruise slower than motors.",
    },
    // Motorised road modes — fully exposed to congestion at urban speeds.
    keke: {
      avgSpeedKmh: 25,
      trafficSensitivity: 0.9,
      note: "Three-wheelers share lanes with cars in mixed traffic.",
    },
    bus: {
      avgSpeedKmh: 22,
      trafficSensitivity: 1,
      note: "Buses run fixed road lanes with frequent stops.",
    },
    taxi: {
      avgSpeedKmh: 28,
      trafficSensitivity: 1,
      note: "Cars/taxis move with general road traffic.",
    },
    car: {
      avgSpeedKmh: 30,
      trafficSensitivity: 1,
      note: "Private cars move with general road traffic.",
    },
    bolt: {
      avgSpeedKmh: 30,
      trafficSensitivity: 1,
      note: "Ride-hail cars move with general road traffic.",
    },
    // Water / rail — segregated rights-of-way, immune to road traffic.
    boat: {
      avgSpeedKmh: 18,
      trafficSensitivity: 0,
      note: "Ferries run on waterways — road traffic does not apply.",
    },
    train: {
      avgSpeedKmh: 60,
      trafficSensitivity: 0,
      note: "Rail runs on its own corridor — road traffic does not apply.",
    },
  },
  defaultVehicle: "bus",
  minDurationMins: 1,
  roadFactor: 1.3,
  fallbackSpeedKmh: 22,
  recomputeFromDistance: ["trekking", "bike", "boat", "train"],
};

function normalizeVehicle(vehicle: unknown): string | null {
  if (typeof vehicle !== "string") return null;
  const key = vehicle.trim().toLowerCase();
  return key.length > 0 ? key : null;
}

/** Mean speed (km/h) for a vehicle, falling back to the default road speed. Pure. */
export function speedForVehicle(vehicle: unknown): number {
  const key = normalizeVehicle(vehicle);
  if (key && JOURNEY_TIME_CONFIG.vehicles[key]) {
    return JOURNEY_TIME_CONFIG.vehicles[key].avgSpeedKmh;
  }
  const fallback = JOURNEY_TIME_CONFIG.vehicles[JOURNEY_TIME_CONFIG.defaultVehicle];
  return fallback?.avgSpeedKmh ?? JOURNEY_TIME_CONFIG.fallbackSpeedKmh;
}

/** Traffic sensitivity (0..1) for a vehicle — unknown modes assume full exposure. Pure. */
export function trafficSensitivityForVehicle(vehicle: unknown): number {
  const key = normalizeVehicle(vehicle);
  if (key && JOURNEY_TIME_CONFIG.vehicles[key]) {
    return JOURNEY_TIME_CONFIG.vehicles[key].trafficSensitivity;
  }
  return 1;
}

/** True when a mode must be re-derived from distance (never trust car trace durations). Pure. */
export function shouldRecomputeFromDistance(vehicle: unknown): boolean {
  const key = normalizeVehicle(vehicle);
  if (!key) return false;
  return JOURNEY_TIME_CONFIG.recomputeFromDistance.includes(key);
}

/**
 * Traffic delay factor for one leg at its worst level, scaled by the
 * vehicle's sensitivity (pure). Immune modes stay near 1x, road modes take
 * the full chunk delay. Unknown vehicles assume full exposure (safe
 * fallback, mirrors adjustDurationForVehicleAndTraffic).
 */
export function legTrafficFactor(level: string, vehicle: unknown = null): number {
  const delay = level === "heavy" ? 1.35 : level === "moderate" ? 1.15 : 1;
  const sensitivity = trafficSensitivityForVehicle(vehicle);
  return 1 + (delay - 1) * sensitivity;
}

/** Duration (mins) for a distance at a vehicle's speed. Pure, min-clamped. */
export function estimateDurationMins(distanceKm: number, vehicle: unknown = null): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const speed = speedForVehicle(vehicle);
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.max(
    JOURNEY_TIME_CONFIG.minDurationMins,
    Math.round((distanceKm / speed) * 60)
  );
}

/**
 * Blend a base duration by per-level segment shares, scaled by the
 * vehicle's traffic sensitivity. Pure.
 *
 * sensitivity 0 → base unchanged (immune modes); 1 → full traffic blend
 * (identical to the legacy traffic-only adjustment). Unknown vehicles
 * behave as fully exposed (safe fallback).
 */
export function adjustDurationForVehicleAndTraffic(
  baseMins: number,
  counts: { low: number; moderate: number; heavy: number },
  total: number,
  vehicle: unknown = null
): number {
  if (!Number.isFinite(baseMins) || total <= 0) return Math.round(baseMins);
  const base = Math.round(baseMins);
  // Legacy traffic blend factors (mirror TRAFFIC_CONFIG delay factors without
  // importing it — this config stays dependency-free).
  const blended =
    (counts.low / total) * 1 +
    (counts.moderate / total) * 1.15 +
    (counts.heavy / total) * 1.35;
  const sensitivity = trafficSensitivityForVehicle(vehicle);
  const scaled = 1 + (blended - 1) * sensitivity;
  return Math.max(base, Math.round(base * scaled));
}

export interface JourneyStepLike {
  vehicle?: unknown;
}

/**
 * Dominant (most frequent) non-destination vehicle across route steps.
 * Destination is the final stop — its vehicle (if a legacy row carries one)
 * never describes an onward leg, so it is excluded. Returns null when no
 * leg carries a vehicle (callers fall back to the default road speed).
 * Pure.
 */
export function dominantVehicleForSteps(steps: JourneyStepLike[] | unknown): string | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const counts = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    // Skip the destination leg (final stop has no onward travel).
    if (steps.length > 0 && i === steps.length - 1) continue;
    const raw = (steps[i] as JourneyStepLike | null)?.vehicle;
    const key = normalizeVehicle(raw);
    if (!key) continue;
    // Only count known vehicles — unknown strings fall back downstream.
    if (!JOURNEY_TIME_CONFIG.vehicles[key]) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  return best;
}

/**
 * Resolve the display duration for a route preview/detail:
 * - driving-like modes trust the road-trace duration when available
 * - slow/rail/water modes recompute from the traced distance (car-trace
 *   durations would be wildly wrong for a trek or a ferry)
 * - falls back to the vehicle estimate from pins when no trace exists.
 * Pure.
 */
export function resolveJourneyDuration(
  tracedDistanceKm: number | null | undefined,
  tracedDurationMins: number | null | undefined,
  fallbackDurationMins: number | null | undefined,
  vehicle: unknown = null
): number {
  const distanceOk =
    typeof tracedDistanceKm === "number" && Number.isFinite(tracedDistanceKm) && tracedDistanceKm > 0;
  const durationOk =
    typeof tracedDurationMins === "number" && Number.isFinite(tracedDurationMins) && tracedDurationMins > 0;
  if (shouldRecomputeFromDistance(vehicle) && distanceOk) {
    return estimateDurationMins(tracedDistanceKm as number, vehicle);
  }
  if (durationOk) return Math.round(tracedDurationMins as number);
  if (
    typeof fallbackDurationMins === "number" &&
    Number.isFinite(fallbackDurationMins) &&
    (fallbackDurationMins as number) > 0
  ) {
    return Math.round(fallbackDurationMins as number);
  }
  if (distanceOk) return estimateDurationMins(tracedDistanceKm as number, vehicle);
  return 0;
}
