/**
 * Map camera / recenter behaviour config (Sprint 72).
 *
 * Baseline recentering (fit-to-route, single-pin flyTo) is DEFERRED while
 * the user is interacting with the map (pan/zoom/keyboard) and for
 * `recenterIdleDelayMs` after the last interaction. Post cards and the
 * post-detail map pass a `userLocation` that ticks on every GPS watch fix —
 * without this gate those ticks yank the camera out from under a pan.
 * Explicit user requests (follow-user nav, the "Find on map" focus fly-to)
 * bypass the deferral by design.
 */
export const MAP_VIEW_CONFIG = {
  /** Idle time (ms) after the last interaction before a pending fit may run. */
  recenterIdleDelayMs: 3000,
  /** Poll interval (ms) for the token-guarded idle watcher loop. */
  interactionPollMs: 250,
} as const;

export interface FitDeferralInput {
  /** True while a gesture (drag/wheel/keys) is actively down. */
  interacting: boolean;
  /** Epoch ms of the last interaction; null when the user never touched the map. */
  lastInteractionAt: number | null;
  /** Current epoch ms. */
  now: number;
  /** Override for tests; defaults to MAP_VIEW_CONFIG.recenterIdleDelayMs. */
  idleDelayMs?: number;
}

/**
 * Pure gate for "may the baseline fit run right now?" — shared by the
 * RouteMap idle watcher and unit tests. Never-interacted → not deferred
 * (first fit is instant, same as before this change).
 */
export function shouldDeferFit(input: FitDeferralInput): boolean {
  if (input.interacting) return true;
  if (input.lastInteractionAt === null) return false;
  const delay = input.idleDelayMs ?? MAP_VIEW_CONFIG.recenterIdleDelayMs;
  return input.now - input.lastInteractionAt < delay;
}
