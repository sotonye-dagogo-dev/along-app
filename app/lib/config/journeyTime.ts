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
  /**
   * Typical wait to load/board before departure (minutes). Public transport
   * in Nigeria often waits for passengers; private cars only need settling.
   */
  boardingWaitMins: number;
  /** Minutes added per intermediate stop for pick-ups/drop-offs/checks. */
  perStopDwellMins: number;
  /**
   * Typical minutes lost once per journey to tolls and roadside levies
   * ("agberos"). 0 for modes with a segregated right-of-way.
   */
  checkpointDelayMins: number;
  /**
   * Multiplier applied to provider free-flow durations (OSRM/ORS/Mapbox).
   * Those providers model ideal car flow; local mixed traffic runs slower.
   * Distance-derived estimates are already calibrated via `avgSpeedKmh`, so
   * this is only used when a provider duration is trusted.
   */
  providerCalibration: number;
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
  /** Hard cap on journey overhead so a corrupted stop count can never explode ETA. */
  maxOverheadMins: number;
  /** Stop counts above this are ignored (defensive bound). */
  maxStopsCounted: number;
}

export const JOURNEY_TIME_CONFIG: JourneyTimeConfig = {
  vehicles: {
    // Active human-powered — walking pace, pavements/paths bypass traffic.
    trekking: {
      avgSpeedKmh: 5,
      trafficSensitivity: 0.05,
      note: "Walking pace; footpaths bypass road congestion almost entirely.",
      boardingWaitMins: 0,
      perStopDwellMins: 0,
      checkpointDelayMins: 0,
      providerCalibration: 1,
    },
    // Bicycle — lane-splitting + cycle paths dodge most jams, slower cruise.
    bike: {
      avgSpeedKmh: 16,
      trafficSensitivity: 0.35,
      note: "Cycles filter through traffic but cruise slower than motors.",
      boardingWaitMins: 0,
      perStopDwellMins: 0.5,
      checkpointDelayMins: 0,
      providerCalibration: 1,
    },
    // Motorised road modes — fully exposed to congestion at urban speeds.
    keke: {
      avgSpeedKmh: 25,
      trafficSensitivity: 0.9,
      note: "Three-wheelers share lanes with cars in mixed traffic.",
      boardingWaitMins: 3,
      perStopDwellMins: 1,
      checkpointDelayMins: 1,
      providerCalibration: 1.15,
    },
    bus: {
      avgSpeedKmh: 22,
      trafficSensitivity: 1,
      note: "Buses run fixed road lanes with frequent stops.",
      boardingWaitMins: 5,
      perStopDwellMins: 1.5,
      checkpointDelayMins: 1.5,
      providerCalibration: 1.18,
    },
    taxi: {
      avgSpeedKmh: 28,
      trafficSensitivity: 1,
      note: "Cars/taxis move with general road traffic.",
      boardingWaitMins: 1,
      perStopDwellMins: 0.75,
      checkpointDelayMins: 1.5,
      providerCalibration: 1.2,
    },
    car: {
      avgSpeedKmh: 30,
      trafficSensitivity: 1,
      note: "Private cars move with general road traffic.",
      boardingWaitMins: 0.5,
      perStopDwellMins: 0.5,
      checkpointDelayMins: 1.5,
      providerCalibration: 1.18,
    },
    bolt: {
      avgSpeedKmh: 30,
      trafficSensitivity: 1,
      note: "Ride-hail cars move with general road traffic.",
      boardingWaitMins: 1,
      perStopDwellMins: 0.75,
      checkpointDelayMins: 1.5,
      providerCalibration: 1.2,
    },
    // Water / rail — segregated rights-of-way, immune to road traffic.
    boat: {
      avgSpeedKmh: 18,
      trafficSensitivity: 0,
      note: "Ferries run on waterways — road traffic does not apply.",
      boardingWaitMins: 5,
      perStopDwellMins: 1,
      checkpointDelayMins: 0,
      providerCalibration: 1,
    },
    train: {
      avgSpeedKmh: 60,
      trafficSensitivity: 0,
      note: "Rail runs on its own corridor — road traffic does not apply.",
      boardingWaitMins: 8,
      perStopDwellMins: 1,
      checkpointDelayMins: 0,
      providerCalibration: 1,
    },
  },
  defaultVehicle: "bus",
  minDurationMins: 1,
  roadFactor: 1.3,
  fallbackSpeedKmh: 22,
  recomputeFromDistance: ["trekking", "bike", "boat", "train"],
  maxOverheadMins: 45,
  maxStopsCounted: 20,
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

function vehicleMetaFor(vehicle: unknown): JourneyVehicleMeta {
  const key = normalizeVehicle(vehicle);
  if (key && JOURNEY_TIME_CONFIG.vehicles[key]) return JOURNEY_TIME_CONFIG.vehicles[key];
  const fallback = JOURNEY_TIME_CONFIG.vehicles[JOURNEY_TIME_CONFIG.defaultVehicle];
  if (fallback) return fallback;
  return {
    avgSpeedKmh: JOURNEY_TIME_CONFIG.fallbackSpeedKmh,
    trafficSensitivity: 1,
    note: "Generic road vehicle.",
    boardingWaitMins: 0,
    perStopDwellMins: 0,
    checkpointDelayMins: 0,
    providerCalibration: 1,
  };
}

function coerceStopCount(stops: unknown): number {
  if (typeof stops !== "number" || !Number.isFinite(stops) || stops <= 0) return 0;
  return Math.min(Math.floor(stops), Math.max(0, JOURNEY_TIME_CONFIG.maxStopsCounted));
}

/**
 * Local journey overhead (minutes) beyond moving time: boarding/loading,
 * pick-up & drop-off dwell per intermediate stop, and one toll/agbero
 * checkpoint allowance. Public transport carries the largest boarding wait.
 * Pure, hard-capped so corrupt stop counts can never produce absurd ETAs.
 */
export function journeyOverheadMins(vehicle: unknown = null, intermediateStops: unknown = 0): number {
  const meta = vehicleMetaFor(vehicle);
  const stops = coerceStopCount(intermediateStops);
  const dwell = Math.max(0, meta.perStopDwellMins) * stops;
  const boarding = Math.max(0, meta.boardingWaitMins);
  const checkpoint = Math.max(0, meta.checkpointDelayMins);
  const total = boarding + dwell + checkpoint;
  return Math.min(Math.max(0, JOURNEY_TIME_CONFIG.maxOverheadMins), Math.max(0, total));
}

/**
 * Calibrate a provider's free-flow duration for local mixed traffic. The
 * provider chain (OSRM/ORS/Mapbox) models an ideal car run; observed
 * Nigerian urban times run slower. Non-road/immune modes keep 1x. Pure.
 */
export function calibrateProviderDurationMins(providerMins: number, vehicle: unknown = null): number {
  if (!Number.isFinite(providerMins) || providerMins <= 0) return 0;
  const meta = vehicleMetaFor(vehicle);
  const calibration =
    Number.isFinite(meta.providerCalibration) && meta.providerCalibration > 0
      ? meta.providerCalibration
      : 1;
  return Math.max(0, providerMins * calibration);
}

/**
 * Full distance-based estimate: moving time at the vehicle's local speed
 * plus boarding/dwell/checkpoint overhead. This is what the composer's
 * offline preview uses (no provider duration required). Pure.
 */
export function estimateJourneyDurationMins(
  distanceKm: number,
  vehicle: unknown = null,
  intermediateStops: unknown = 0
): number {
  const travel = estimateDurationMins(distanceKm, vehicle);
  if (travel <= 0) return 0;
  const total = travel + journeyOverheadMins(vehicle, intermediateStops);
  return Math.max(JOURNEY_TIME_CONFIG.minDurationMins, Math.round(total));
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

export interface JourneyDurationOptions {
  /**
   * Number of intermediate stops (between origin and destination). Feeds the
   * pick-up/drop-off dwell overhead. Omit for 0.
   */
  intermediateStops?: number;
  /** Disable provider free-flow calibration (defaults to enabled). */
  calibrateProvider?: boolean;
  /** Disable all boarding/dwell/checkpoint overhead (defaults to enabled). */
  includeOverhead?: boolean;
}

/**
 * Resolve the display duration for a route preview/detail:
 * - driving-like modes trust the road-trace duration when available,
 *   calibrated for local mixed-traffic speeds plus boarding/stop/toll time
 * - slow/rail/water modes recompute from the traced distance (car-trace
 *   durations would be wildly wrong for a trek or a ferry)
 * - falls back to the vehicle estimate from pins when no trace exists.
 *
 * The fallback is treated as already complete (the client estimate includes
 * overhead), so overhead is never added twice. Pure.
 */
export function resolveJourneyDuration(
  tracedDistanceKm: number | null | undefined,
  tracedDurationMins: number | null | undefined,
  fallbackDurationMins: number | null | undefined,
  vehicle: unknown = null,
  options: JourneyDurationOptions = {}
): number {
  const distanceOk =
    typeof tracedDistanceKm === "number" && Number.isFinite(tracedDistanceKm) && tracedDistanceKm > 0;
  const durationOk =
    typeof tracedDurationMins === "number" && Number.isFinite(tracedDurationMins) && tracedDurationMins > 0;
  const stops = options.intermediateStops ?? 0;
  const includeOverhead = options.includeOverhead !== false;
  const overhead = includeOverhead ? journeyOverheadMins(vehicle, stops) : 0;

  if (shouldRecomputeFromDistance(vehicle) && distanceOk) {
    const travel = estimateDurationMins(tracedDistanceKm as number, vehicle);
    return Math.max(JOURNEY_TIME_CONFIG.minDurationMins, Math.round(travel + overhead));
  }
  if (durationOk) {
    const calibrated =
      options.calibrateProvider === false
        ? Math.round(tracedDurationMins as number)
        : Math.round(calibrateProviderDurationMins(tracedDurationMins as number, vehicle));
    return Math.max(JOURNEY_TIME_CONFIG.minDurationMins, Math.round(calibrated + overhead));
  }
  if (
    typeof fallbackDurationMins === "number" &&
    Number.isFinite(fallbackDurationMins) &&
    (fallbackDurationMins as number) > 0
  ) {
    return Math.round(fallbackDurationMins as number);
  }
  if (distanceOk) return estimateJourneyDurationMins(tracedDistanceKm as number, vehicle, stops);
  return 0;
}
