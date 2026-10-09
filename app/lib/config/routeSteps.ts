/**
 * Route-step configuration (config-driven, zero app deps).
 * Single source of truth for the "destination has no fare/vehicle" rule:
 * the last step of a route IS the destination, so fare (cost to travel
 * further) and vehicle (means to travel further) are meaningless there.
 *
 * - UI rule: every renderer (ShareRouteModal composer, PostCard, post
 *   detail, NavigationGuide) hides fare + vehicle inputs/badges on the
 *   destination step via `isDestinationStep`.
 * - Data rule: `normalizeRouteSteps` strips fare/vehicle from the
 *   destination before submit (client) and before insert/update (server),
 *   so stored rows carry no misleading leg costs. The strip is
 *   non-breaking — readers ALSO hide the last step's fare/vehicle even
 *   when legacy rows still carry them.
 */

export interface RouteStepLike {
  location?: string;
  description?: string;
  vehicle?: string;
  fare?: number;
  lat?: number;
  lng?: number;
}

export interface RouteStepsConfig {
  /** Hide the fare input/badge on the destination (final) step. */
  destinationHidesFare: boolean;
  /** Hide the vehicle input/badge on the destination (final) step. */
  destinationHidesVehicle: boolean;
  /** Hint shown in the composer where the destination fare/vehicle inputs were. */
  destinationHint: string;
  /** Aria labels for the hidden-input hint region. */
  destinationHintAriaLabel: string;
}

export const ROUTE_STEPS_CONFIG: RouteStepsConfig = {
  destinationHidesFare: true,
  destinationHidesVehicle: true,
  destinationHint: "Destination — no fare or vehicle needed, you're already there.",
  destinationHintAriaLabel: "Destination needs no fare or vehicle",
};

/** True when `index` is the final step of a `total`-step route. */
export function isDestinationStep(index: number, total: number): boolean {
  return total > 0 && index === total - 1;
}

/** True when the step's fare should be rendered (never on the destination). */
export function showStepFare(index: number, total: number): boolean {
  return !ROUTE_STEPS_CONFIG.destinationHidesFare || !isDestinationStep(index, total);
}

/** True when the step's vehicle should be rendered (never on the destination). */
export function showStepVehicle(index: number, total: number): boolean {
  return !ROUTE_STEPS_CONFIG.destinationHidesVehicle || !isDestinationStep(index, total);
}

/**
 * Strips fare/vehicle from the destination step so stored payloads never
 * imply a cost/leg beyond the final stop. Non-destination steps pass
 * through untouched; single-step arrays are returned as-is (the API's
 * min-2 validation still applies downstream).
 */
export function normalizeRouteSteps<T extends RouteStepLike>(steps: T[]): T[] {
  if (steps.length === 0) return steps;
  return steps.map((step, i) =>
    isDestinationStep(i, steps.length)
      ? ({ ...step, vehicle: undefined, fare: undefined } as T)
      : step
  );
}
