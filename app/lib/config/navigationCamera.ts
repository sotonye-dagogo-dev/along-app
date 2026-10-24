/**
 * Live-navigation camera policy (Sprint 91, config-driven, zero app deps).
 *
 * Navigation starts camera-centred: the map follows every GPS fix and
 * rotates so the user's heading is "up" (Google-Maps style). The camera
 * yields to the user immediately — panning/zooming/pinching pauses
 * following without ending it, then re-centres after `idleResumeMs` of
 * inactivity. The on-map toggle interchanges between:
 *
 * - `centered` → action "North up": release the camera and adopt true
 *   north (free exploration, no auto-return).
 * - `free` → action "Center": re-centre on the user and follow their
 *   heading again.
 *
 * All thresholds live here so the RouteMap component stays declarative and
 * the pure helpers below are directly unit-testable. No provider/API
 * dependency — the map remains keyless and costless.
 */
import { shouldDeferFit } from "./mapView";

export type NavigationCameraMode = "centered" | "free";

export interface NavigationCameraConfig {
  /** Idle window after the last gesture before the centred camera resumes. */
  idleResumeMs: number;
  /** Poll interval for the token-guarded idle-resume watcher. */
  pollMs: number;
  /** Zoom used while following the live user fix. */
  followZoom: number;
  /** Animation duration for a GPS-tick follow step. */
  followDurationMs: number;
  /** Animation duration for an explicit re-centre. */
  centerDurationMs: number;
  /** Animation duration when releasing to true north. */
  northUpDurationMs: number;
  /** Ignore heading changes smaller than this (degrees) to avoid jitter. */
  headingJitterDeg: number;
  /** On-map control chrome (design tokens only). */
  controlClass: string;
  labels: {
    /** Action offered while following (releases to true north). */
    releaseAction: string;
    releaseAria: string;
    releaseHint: string;
    /** Action offered while free/paused (returns to heading-up follow). */
    centerAction: string;
    centerAria: string;
    centerHint: string;
  };
}

export const NAVIGATION_CAMERA_CONFIG: NavigationCameraConfig = {
  idleResumeMs: 6000,
  pollMs: 250,
  followZoom: 15,
  followDurationMs: 550,
  centerDurationMs: 650,
  northUpDurationMs: 450,
  headingJitterDeg: 4,
  controlClass:
    "absolute bottom-16 right-2 z-[5] flex items-center gap-1.5 px-2.5 py-1.5 radius-pill border border-border bg-bg-card/90 backdrop-blur-sm text-text-primary text-[11px] font-semibold shadow-md hover:bg-bg-card transition-colors cursor-pointer",
  labels: {
    releaseAction: "North up",
    releaseAria: "Stop following and show true north",
    releaseHint: "Map follows your heading. Tap to explore in true north.",
    centerAction: "Center",
    centerAria: "Center the map on your location and heading",
    centerHint: "Map is free. Tap to follow your location and heading again.",
  },
};

/** Normalise a geolocation heading into [0, 360); invalid values become null. */
export function normalizeHeading(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = ((value % 360) + 360) % 360;
  return Number.isFinite(normalized) ? normalized : null;
}

/** Shortest angular distance between two bearings, in degrees (0–180). */
export function bearingDelta(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return Number.isFinite(diff) ? diff : 0;
}

/**
 * Only rotate the camera when the new heading differs meaningfully from the
 * current bearing — stationary fixes often repeat with ±1–3° noise, which
 * would otherwise make a heading-up map twitch continuously.
 */
export function shouldRotateToHeading(
  next: number | null,
  current: number,
  thresholdDeg: number = NAVIGATION_CAMERA_CONFIG.headingJitterDeg
): boolean {
  if (next === null) return false;
  if (!Number.isFinite(current)) return true;
  return bearingDelta(next, current) >= Math.max(0, thresholdDeg);
}

export interface NavigationCameraResumeInput {
  mode: NavigationCameraMode;
  /** True while a pointer/wheel/key gesture is actively down. */
  interacting: boolean;
  /** Epoch ms of the last gesture; null when the user never interacted. */
  lastInteractionAt: number | null;
  now: number;
  idleDelayMs?: number;
}

/**
 * Pure gate for "may the centred camera resume now?". A free (explicitly
 * decentred) camera never auto-resumes; a centred camera waits for gesture
 * end plus the idle window.
 */
export function shouldResumeNavigationCamera(input: NavigationCameraResumeInput): boolean {
  if (input.mode !== "centered") return false;
  return !shouldDeferFit({
    interacting: input.interacting,
    lastInteractionAt: input.lastInteractionAt,
    now: input.now,
    idleDelayMs: input.idleDelayMs ?? NAVIGATION_CAMERA_CONFIG.idleResumeMs,
  });
}
