/**
 * Platform tour config — fully config/metadata-driven guided tour.
 *
 * Zero app deps (mirrors routeRequestAudience.ts discipline): the steps live
 * in code as the safe hardcoded fallback (§3 fallback discipline) and the
 * operational knobs are admin-editable through the `platformTourConfig`
 * SiteConfig row (merged field-wise over these defaults at read time,
 * served to clients via GET /api/tour which is SWR-cached by the service
 * worker; when offline or unset the bundle defaults still run the tour
 * end-to-end).
 *
 * Targeting strategy: selectors may be a comma list — the first VISIBLE
 * match wins (desktop/mobile parity). Steps whose target cannot become
 * visible within `targetTimeoutMs` degrade gracefully: online → auto-skip
 * to the next step, offline → honest note with Skip/End (see component).
 * Never target layout attributes that redesigns routinely rename.
 */

export const PLATFORM_TOUR_CONFIG_KEY = "platformTourConfig";

/** CustomEvent fired by profile quick links to replay the tour. */
export const TOUR_START_EVENT = "along:tour-start";

export type TourStepPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  id: string;
  /** Dashboard route the step runs on (component navigates when needed). */
  route: string;
  /**
   * CSS selector list; FIRST VISIBLE match is spotlighted. Empty/undefined
   * = centered card step (no spotlight).
   */
  targetSelector?: string;
  /** English fallback copy — locale keys (titleKey/bodyKey) win when set. */
  title: string;
  body: string;
  titleKey?: string;
  bodyKey?: string;
  /** User can interact with the target; tour then offers Continue/End. */
  interactive?: boolean;
  /** Element whose click counts as the interaction (defaults to target). */
  interactionSelector?: string;
  placement?: TourStepPlacement;
}

export interface PlatformTourEndCard {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface PlatformTourDisplayConfig {
  /** Space between the spotlight edge and the real element bounds (px). */
  spotPadPx: number;
  /**
   * Corner radius of the spot ring (px) — clamped to half the smaller
   * target side so small elements read as round points.
   */
  spotRadiusPx: number;
  /** Ring glow thickness (px) around the spot. */
  spotRingPx: number;
  /** Max width of the tooltip card (px). */
  tooltipMaxWidthPx: number;
  /** How long to wait for a step target to appear (ms). */
  targetTimeoutMs: number;
  /** Where the mascot gives up and the app logo takes over. */
  mascotImage: string;
  mascotAlt: string;
}

export interface PlatformTourStorageConfig {
  /** { version, startedAt, stepIndex, completedAt, dismissedAt } blob. */
  stateKey: string;
}

export interface PlatformTourOfflineConfig {
  /** Shown on a step whose page is not reachable while offline. */
  note: string;
  bodyKey?: string;
  endLabel: string;
  skipLabelHint: string;
}

export interface PlatformTourConfig {
  enabled: boolean;
  /** Start once automatically for authenticated users without state flags. */
  autoStart: boolean;
  autoStartDelayMs: number;
  display: PlatformTourDisplayConfig;
  storage: PlatformTourStorageConfig;
  offline: PlatformTourOfflineConfig;
  endCard: PlatformTourEndCard;
  steps: TourStep[];
}

/** SiteConfig-managed subset (generic no-code admin card fields). */
export const PLATFORM_TOUR_MANAGED_FIELDS = [
  "enabled",
  "autoStart",
  "autoStartDelayMs",
] as const;

export const DEFAULT_PLATFORM_TOUR_CONFIG: PlatformTourConfig = {
  enabled: true,
  autoStart: true,
  autoStartDelayMs: 2500,
  display: {
    spotPadPx: 8,
    spotRadiusPx: 24,
    spotRingPx: 4,
    tooltipMaxWidthPx: 360,
    targetTimeoutMs: 6000,
    // Empty string = the app logo mark is the mascot fallback (§3: config
    // value with a safe, always-present fallback).
    mascotImage: "",
    mascotAlt: "Along guide",
  },
  storage: {
    stateKey: "along-tour-state-v1",
  },
  offline: {
    note: "This tour stop opens a page that isn't saved on this device right now.",
    bodyKey: "tour.offlineNote",
    endLabel: "End tour",
    skipLabelHint: "You can skip this stop and keep the tour going.",
  },
  endCard: {
    title: "You know the ropes now",
    body: "Thanks for taking the tour! Share a route, explore what's around you, and come back to this guide anytime from your profile.",
    ctaLabel: "Share your first route",
    ctaHref: "/home",
  },
  steps: [
    {
      id: "welcome",
      route: "/home",
      title: "Welcome to Along",
      body: "A guided stroll through the app. Follow the glow — you can tap the highlighted controls as we go. Take the wheel anytime with Back, Next, or Skip.",
      titleKey: "tour.welcomeTitle",
      bodyKey: "tour.welcomeBody",
    },
    {
      id: "share-route",
      route: "/home",
      targetSelector: '[aria-label="Share a route"]',
      title: "Share your route",
      body: "Post a full journey with stops, fares, and vehicle details. Try tapping it — the composer opens right up.",
      titleKey: "tour.shareTitle",
      bodyKey: "tour.shareBody",
      interactive: true,
      placement: "bottom",
    },
    {
      id: "explore-near-me",
      route: "/explore",
      targetSelector: '[aria-label="Near me"]',
      title: "Explore around you",
      body: "The live map surfaces community routes and places. \"Near me\" re-centers results on your location — give it a go.",
      titleKey: "tour.exploreTitle",
      bodyKey: "tour.exploreBody",
      interactive: true,
      placement: "bottom",
    },
    {
      id: "profile-account",
      route: "/profile",
      targetSelector: "#account",
      title: "Your profile hub",
      body: "Connected accounts, points, email & security, and privacy controls live in this account tab group. Your transport posts live below it.",
      titleKey: "tour.profileTitle",
      bodyKey: "tour.profileBody",
      interactive: true,
      placement: "top",
    },
    {
      id: "notifications",
      route: "/notifications",
      title: "Never miss an update",
      body: "In-app notifications mirror to push and email where wired, so you hear about responses, rewards, and requests wherever you are.",
      titleKey: "tour.notificationsTitle",
      bodyKey: "tour.notificationsBody",
    },
  ],
};

export interface PlatformTourState {
  version: number;
  startedAt: number;
  stepIndex: number;
  completedAt?: number;
  dismissedAt?: number;
}

export const PLATFORM_TOUR_STATE_VERSION = 1;

/** Never-throw parse of the persisted tour state blob. */
export function readTourStateShape(raw: string | null): PlatformTourState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PlatformTourState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== PLATFORM_TOUR_STATE_VERSION) return null;
    if (typeof parsed.startedAt !== "number" || !Number.isFinite(parsed.startedAt)) return null;
    return {
      version: PLATFORM_TOUR_STATE_VERSION,
      startedAt: parsed.startedAt,
      stepIndex: Number.isFinite(parsed.stepIndex) ? Math.max(0, Math.floor(parsed.stepIndex as number)) : 0,
      completedAt: Number.isFinite(parsed.completedAt) ? (parsed.completedAt as number) : undefined,
      dismissedAt: Number.isFinite(parsed.dismissedAt) ? (parsed.dismissedAt as number) : undefined,
    } as PlatformTourState;
  } catch {
    return null;
  }
}

export function isTourTerminal(state: PlatformTourState | null): boolean {
  if (!state) return false;
  return typeof state.completedAt === "number" || typeof state.dismissedAt === "number";
}

/** Clamp any step index (stale resumption, config shrink) into range. */
export function coerceStepIndex(index: number, stepCount: number): number {
  if (!Number.isFinite(index)) return 0;
  if (stepCount <= 0) return 0;
  return Math.min(Math.max(Math.floor(index), 0), stepCount - 1);
}

export function isLastStep(index: number, stepCount: number): boolean {
  return stepCount > 0 && index >= stepCount - 1;
}

/**
 * Merge a stored/admin raw value over the shipped defaults (stored-wins,
 * field-wise; corrupt/partial rows keep working — the same discipline as
 * routeRequestAudience + mergeAdminConfigsWithDefaults).
 */
export function normalizePlatformTourConfig(
  raw: unknown,
  fallback: PlatformTourConfig = DEFAULT_PLATFORM_TOUR_CONFIG,
): PlatformTourConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const value = raw as Partial<PlatformTourConfig>;
  const merged: PlatformTourConfig = { ...fallback };

  if (typeof value.enabled === "boolean") merged.enabled = value.enabled;
  if (typeof value.autoStart === "boolean") merged.autoStart = value.autoStart;
  if (typeof value.autoStartDelayMs === "number" && Number.isFinite(value.autoStartDelayMs)) {
    merged.autoStartDelayMs = Math.min(Math.max(value.autoStartDelayMs, 0), 60000);
  }

  if (value.display && typeof value.display === "object" && !Array.isArray(value.display)) {
    const d = value.display as Partial<PlatformTourDisplayConfig>;
    merged.display = { ...fallback.display };
    if (typeof d.spotPadPx === "number" && Number.isFinite(d.spotPadPx)) {
      merged.display.spotPadPx = Math.min(Math.max(d.spotPadPx, 0), 48);
    }
    if (typeof d.spotRadiusPx === "number" && Number.isFinite(d.spotRadiusPx)) {
      merged.display.spotRadiusPx = Math.min(Math.max(d.spotRadiusPx, 0), 48);
    }
    if (typeof d.spotRingPx === "number" && Number.isFinite(d.spotRingPx)) {
      merged.display.spotRingPx = Math.min(Math.max(d.spotRingPx, 1), 12);
    }
    if (typeof d.tooltipMaxWidthPx === "number" && Number.isFinite(d.tooltipMaxWidthPx)) {
      merged.display.tooltipMaxWidthPx = Math.min(Math.max(d.tooltipMaxWidthPx, 260), 520);
    }
    if (typeof d.targetTimeoutMs === "number" && Number.isFinite(d.targetTimeoutMs)) {
      merged.display.targetTimeoutMs = Math.min(Math.max(d.targetTimeoutMs, 1500), 20000);
    }
    if (typeof d.mascotImage === "string") merged.display.mascotImage = d.mascotImage;
    if (typeof d.mascotAlt === "string" && d.mascotAlt.trim()) merged.display.mascotAlt = d.mascotAlt.trim();
  }

  if (value.storage && typeof value.storage === "object" && !Array.isArray(value.storage)) {
    const s = value.storage as Partial<PlatformTourStorageConfig>;
    if (typeof s.stateKey === "string" && s.stateKey.trim()) {
      merged.storage = { stateKey: s.stateKey.trim() };
    }
  }

  if (value.offline && typeof value.offline === "object" && !Array.isArray(value.offline)) {
    const o = value.offline as Partial<PlatformTourOfflineConfig>;
    merged.offline = { ...fallback.offline };
    if (typeof o.note === "string" && o.note.trim()) merged.offline.note = o.note.trim();
    if (typeof o.bodyKey === "string") merged.offline.bodyKey = o.bodyKey;
    if (typeof o.endLabel === "string" && o.endLabel.trim()) merged.offline.endLabel = o.endLabel.trim();
    if (typeof o.skipLabelHint === "string" && o.skipLabelHint.trim()) {
      merged.offline.skipLabelHint = o.skipLabelHint.trim();
    }
  }

  if (value.endCard && typeof value.endCard === "object" && !Array.isArray(value.endCard)) {
    const e = value.endCard as Partial<PlatformTourEndCard>;
    merged.endCard = { ...fallback.endCard };
    if (typeof e.title === "string" && e.title.trim()) merged.endCard.title = e.title.trim();
    if (typeof e.body === "string" && e.body.trim()) merged.endCard.body = e.body.trim();
    if (typeof e.ctaLabel === "string" && e.ctaLabel.trim()) merged.endCard.ctaLabel = e.ctaLabel.trim();
    if (typeof e.ctaHref === "string" && e.ctaHref.startsWith("/")) merged.endCard.ctaHref = e.ctaHref;
  }

  if (Array.isArray(value.steps) && value.steps.length > 0) {
    const steps = value.steps
      .filter((s): s is TourStep => !!s && typeof s === "object")
      .map((s) => ({
        id: typeof s.id === "string" && s.id.trim() ? s.id.trim() : `step-${Math.random().toString(36).slice(2, 8)}`,
        route: typeof s.route === "string" && s.route.startsWith("/") ? s.route : "/home",
        targetSelector: typeof s.targetSelector === "string" ? s.targetSelector : undefined,
        title: typeof s.title === "string" && s.title.trim() ? s.title.trim() : fallback.steps[0]?.title ?? "Along tour",
        body: typeof s.body === "string" && s.body.trim() ? s.body.trim() : "",
        titleKey: typeof s.titleKey === "string" ? s.titleKey : undefined,
        bodyKey: typeof s.bodyKey === "string" ? s.bodyKey : undefined,
        interactive: typeof s.interactive === "boolean" ? s.interactive : undefined,
        interactionSelector: typeof s.interactionSelector === "string" ? s.interactionSelector : undefined,
        placement: isTourPlacement(s.placement) ? s.placement : undefined,
      }));
    if (steps.length > 0) merged.steps = steps;
  }

  return merged;
}

export function isTourPlacement(value: unknown): value is TourStepPlacement {
  return value === "top" || value === "bottom" || value === "left" || value === "right";
}

/** Admin-config validator body (string | null — null means valid). */
export function validatePlatformTourConfigValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    return "Platform tour config must be an object.";
  }
  const v = value as Record<string, unknown>;
  if ("enabled" in v && typeof v.enabled !== "boolean") return "enabled must be true or false.";
  if ("autoStart" in v && typeof v.autoStart !== "boolean") return "autoStart must be true or false.";
  if ("autoStartDelayMs" in v) {
    if (typeof v.autoStartDelayMs !== "number" || !Number.isFinite(v.autoStartDelayMs) || v.autoStartDelayMs < 0) {
      return "autoStartDelayMs must be a non-negative number of milliseconds.";
    }
    if (v.autoStartDelayMs > 60000) return "autoStartDelayMs must stay under 60000ms.";
  }
  if (v.steps !== undefined) {
    if (!Array.isArray(v.steps)) return "steps must be an array of step objects.";
    for (const step of v.steps) {
      if (!step || typeof step !== "object" || Array.isArray(step)) return "every step must be an object.";
      const s = step as Record<string, unknown>;
      if (typeof s.id !== "string" || !s.id.trim()) return "every step needs a non-empty id.";
      if (typeof s.route !== "string" || !s.route.startsWith("/")) return "every step needs a route starting with '/'.";
      if (typeof s.title !== "string" || !s.title.trim()) return `step '${s.id}' needs a non-empty title.`;
      if (s.placement !== undefined && !isTourPlacement(s.placement)) {
        return `step '${s.id}' placement must be top, bottom, left or right.`;
      }
    }
  }
  if (v.display !== undefined && (typeof v.display !== "object" || v.display === null || Array.isArray(v.display))) {
    return "display must be an object.";
  }
  return null;
}

/** Compact profiling for the tooltip header (first-step welcome flag). */
export function isWelcomeStep(steps: TourStep[], index: number): boolean {
  return index === 0 && steps.length > 0 && !steps[0].targetSelector;
}
