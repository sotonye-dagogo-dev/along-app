/**
 * Platform tour config — fully config/metadata-driven guided tour.
 *
 * Only sibling config imports (share-route event names) — no components, no
 * network, no storage. The steps live in code as the safe hardcoded fallback
 * (§3 fallback discipline) and the
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

import {
  SHARE_ROUTE_OPEN_EVENT,
  SHARE_ROUTE_TAB_EVENT,
  type ShareRouteTabId,
} from "./shareRoute";

export const PLATFORM_TOUR_CONFIG_KEY = "platformTourConfig";

/** CustomEvent fired by profile quick links to replay the tour. */
export const TOUR_START_EVENT = "along:tour-start";

export type TourStepPlacement = "top" | "bottom" | "left" | "right";

/** Viewport scrolling used to bring a spotlight target into view. */
export type TourScrollBlock = "start" | "center" | "end" | "nearest";
export type TourScrollBehavior = "smooth" | "auto";

export interface PlatformTourScrollConfig {
  /** Smooth-scroll a step target into view before spotlighting it. */
  enabled: boolean;
  behavior: TourScrollBehavior;
  block: TourScrollBlock;
  /** Skip the scroll when the target is already comfortably visible. */
  onlyWhenOffscreen: boolean;
  /** Breathing room used by the offscreen check (px). */
  visibilityMarginPx: number;
  /** Let a freshly-opened modal/tab settle before scrolling (ms). */
  delayMs: number;
}

/** Optional window CustomEvent fired by a tour step. */
export interface TourStepEvent {
  /** Must be an `along:*` event name (validated/normalized). */
  event: string;
  /** Optional flat string payload exposed as `event.detail`. */
  detail?: Record<string, string>;
}

/**
 * Who a step is for. The tour filters its step list per viewer so guests get
 * the auth walkthrough and signed-in users never see it.
 */
export type TourAudience = "all" | "guest" | "authenticated";

export interface TourStep {
  id: string;
  /** Route the step runs on (component navigates when needed). */
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
  /**
   * Whether the viewer may end/skip the whole tour from this step
   * (default true). Set false on pivotal teaching stops where the following
   * steps are essential — Next stays available, End/X/Escape do not.
   */
  allowEnd?: boolean;
  placement?: TourStepPlacement;
  /** Viewer filter (default "all"). */
  audience?: TourAudience;
  /** Per-step target wait override (ms); falls back to display.targetTimeoutMs. */
  timeoutMs?: number;
  /** Fire when the step becomes active (e.g. switch the composer tab). */
  activateEvent?: TourStepEvent;
  /**
   * Fire when Next advances past this step unless the user already interacted
   * with the target (e.g. open the composer the tour is about to cover).
   */
  advanceEvent?: TourStepEvent;
  /** Per-step scroll override; defaults to `config.scroll.enabled`. */
  scrollIntoView?: boolean;
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
  /** Max width of the tooltip card (px). The card keeps this width (viewport-capped) so short and long copy render consistently. */
  tooltipMaxWidthPx: number;
  /** Gap between the spotlighted target and the tooltip/spot card (px). */
  tooltipGapPx: number;
  /** Minimum breathing room kept between the card and every viewport edge (px). */
  tooltipMarginPx: number;
  /** Hard cap on card height as a share of the viewport (0..1) before it scrolls internally. */
  tooltipMaxHeightRatio: number;
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

/**
 * Resume behaviour after a refresh/relaunch. Interrupted runs are never
 * silently hijacked: by default a small dismissible prompt offers to pick up
 * where the viewer left off (`autoResume` opts back into the old silent
 * resume for deployments that prefer it).
 */
export interface PlatformTourResumeConfig {
  enabled: boolean;
  promptDelayMs: number;
  autoResume: boolean;
  message: string;
  actionLabel: string;
  dismissLabel: string;
}

export interface PlatformTourGuestConfig {
  /** Guests may run the tour (auth steps included) when true. */
  enabled: boolean;
}

export interface PlatformTourConfig {
  enabled: boolean;
  /** Start once automatically for viewers without state flags. */
  autoStart: boolean;
  autoStartDelayMs: number;
  /** Paths where auto-start is allowed (guests + signed-in users). */
  autoStartRoutes: string[];
  guest: PlatformTourGuestConfig;
  resume: PlatformTourResumeConfig;
  display: PlatformTourDisplayConfig;
  scroll: PlatformTourScrollConfig;
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
  // Auto-start only on the dashboard feed — auth/FAQ/public pages get the
  // tour through an explicit trigger so a first-time visitor is never
  // hijacked mid-signup.
  autoStartRoutes: ["/home"],
  guest: {
    enabled: true,
  },
  resume: {
    enabled: true,
    promptDelayMs: 1200,
    autoResume: false,
    message: "Your platform tour is paused — pick up where you left off?",
    actionLabel: "Resume tour",
    dismissLabel: "Not now",
  },
  display: {
    spotPadPx: 8,
    spotRadiusPx: 24,
    spotRingPx: 4,
    tooltipMaxWidthPx: 360,
    tooltipGapPx: 12,
    tooltipMarginPx: 12,
    tooltipMaxHeightRatio: 0.78,
    targetTimeoutMs: 6000,
    // Empty string = the app logo mark is the mascot fallback (§3: config
    // value with a safe, always-present fallback).
    mascotImage: "",
    mascotAlt: "Along guide",
  },
  scroll: {
    enabled: true,
    behavior: "smooth",
    block: "center",
    // Scrolling only when needed avoids needless page jumps for targets that
    // are already in view (especially inside the composer modal).
    onlyWhenOffscreen: true,
    visibilityMarginPx: 12,
    delayMs: 120,
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
      body: "A guided stroll through the app. Follow the glow — you can tap the highlighted controls as we go. Use Back and Next to move, and most stops let you Skip.",
      titleKey: "tour.welcomeTitle",
      bodyKey: "tour.welcomeBody",
      audience: "all",
    },
    {
      id: "auth-sign-in",
      route: "/login",
      targetSelector: '[data-tour="login-email"]',
      title: "Sign in your way",
      body: "Use email and password, continue with Google, or keep browsing as a guest. Signing in unlocks posting, bookmarks, and notifications.",
      titleKey: "tour.authLoginTitle",
      bodyKey: "tour.authLoginBody",
      audience: "guest",
      placement: "bottom",
    },
    {
      id: "auth-register",
      route: "/register",
      targetSelector: '[data-tour="register-email"]',
      title: "Create your account",
      body: "A name, username, email, and password is all it takes. We then send a 6-digit code to verify your email before your first post.",
      titleKey: "tour.authRegisterTitle",
      bodyKey: "tour.authRegisterBody",
      audience: "guest",
      placement: "bottom",
    },
    {
      id: "post-overview",
      route: "/home",
      targetSelector: '[data-tour="feed-route-post"]',
      title: "Read a route post",
      body: "Every route card shows who shared it, the stops in order, fares, and vehicle chips. Open its title for the full route, photos, comments, and the map.",
      titleKey: "tour.postOverviewTitle",
      bodyKey: "tour.postOverviewBody",
      placement: "bottom",
      audience: "all",
      // Feed data can still be loading when the tour arrives — give posts a
      // full display time window before politely skipping.
      timeoutMs: 6000,
    },
    {
      id: "post-trust",
      route: "/home",
      targetSelector: '[data-tour="post-trust"]',
      title: "Trust badge and breakdown",
      body: "The trust badge is the route's community-verified score. Hover or tap it to see the breakdown: community votes, route detail, corroboration, recency, and engagement.",
      titleKey: "tour.postTrustTitle",
      bodyKey: "tour.postTrustBody",
      placement: "top",
      audience: "all",
      timeoutMs: 6000,
    },
    {
      id: "post-actions",
      route: "/home",
      targetSelector: '[data-tour="post-actions"]',
      title: "Reactions affect validity",
      body: "Likes and useful comments support a route's validity, while dislikes and reports lower it. Accurate routes rise in the feed and earn stronger trust badges.",
      titleKey: "tour.postActionsTitle",
      bodyKey: "tour.postActionsBody",
      placement: "top",
      audience: "all",
      timeoutMs: 6000,
    },
    {
      id: "post-navigate",
      route: "/home",
      targetSelector: '[data-tour="post-navigate"]',
      title: "Navigate the route",
      body: "Tap Navigate to open the live guide — turn-by-turn stops, the map tracing, distance, time, and fare. Explore it at your own pace; press Next when you're ready for the next stop.",
      titleKey: "tour.postNavigateTitle",
      bodyKey: "tour.postNavigateBody",
      // Awareness-only: viewers can still tap Navigate, but the tour does not
      // wait for it and does not offer End here — the following sharing,
      // request, explore and profile stops are essential walkthrough content.
      allowEnd: false,
      placement: "top",
      audience: "all",
      timeoutMs: 6000,
    },
    {
      id: "share-route",
      route: "/home",
      targetSelector: '[aria-label="Share a route"]',
      title: "Share your route",
      body: "Post a full journey with stops, fares, and vehicle details. Try tapping it — the composer opens right up and the tour waits for you.",
      titleKey: "tour.shareTitle",
      bodyKey: "tour.shareBody",
      interactive: true,
      // If the viewer presses Next without tapping the trigger, open the
      // composer for them — the following steps live inside it.
      advanceEvent: { event: SHARE_ROUTE_OPEN_EVENT },
      placement: "bottom",
      audience: "all",
    },
    {
      id: "composer-locations",
      route: "/home",
      targetSelector: '[data-tour="route-origin"]',
      title: "Find any location",
      body: "Type a place, address, landmark, coordinates, or plus code — suggestions appear as you type. Every stop uses the same field, so you can build the whole journey.",
      titleKey: "tour.composerLocationsTitle",
      bodyKey: "tour.composerLocationsBody",
      placement: "bottom",
      audience: "all",
      timeoutMs: 3500,
    },
    {
      id: "composer-locate",
      route: "/home",
      targetSelector: '[data-tour="route-locate"]',
      title: "Use your current location",
      body: "This fills a stop with your live position — handy for the origin. You can also pick a suggestion from the dropdown or place the stop on the map instead.",
      titleKey: "tour.composerLocateTitle",
      bodyKey: "tour.composerLocateBody",
      placement: "top",
      audience: "all",
      timeoutMs: 3500,
    },
    {
      id: "composer-find-on-map",
      route: "/home",
      targetSelector: '[data-tour="route-find-on-map"]',
      title: "Find it on the map",
      body: "Open the preview and tap the exact point to set this stop. The map shows the live tracing and traffic for the whole route as you build it.",
      titleKey: "tour.composerFindMapTitle",
      bodyKey: "tour.composerFindMapBody",
      placement: "top",
      audience: "all",
      timeoutMs: 3500,
    },
    {
      id: "composer-score",
      route: "/home",
      targetSelector: '[data-tour="route-score"]',
      title: "Build a strong route score",
      body: "The Route Quality Score grows with clear locations, fares, vehicle details, and a helpful description. A higher score earns trust badges and better reach.",
      titleKey: "tour.composerScoreTitle",
      bodyKey: "tour.composerScoreBody",
      // Switch the composer to the Score tab so the step's content is visible
      // while the always-on Score tab button stays spotlighted.
      activateEvent: { event: SHARE_ROUTE_TAB_EVENT, detail: { tab: "score" as ShareRouteTabId } },
      placement: "left",
      audience: "all",
      timeoutMs: 3500,
    },
    {
      id: "route-request",
      route: "/home",
      targetSelector: '[data-tour="route-request-trigger"]',
      title: "Ask for a route",
      body: "Can't find a journey? Tap Request to say where you're going from and to, plus details like budget, time of day, or luggage. The community replies with full routes.",
      titleKey: "tour.routeRequestTitle",
      bodyKey: "tour.routeRequestBody",
      interactive: true,
      // The trigger lives in the composer header: reopen it if the viewer
      // pressed Next through the composer steps and the modal was closed.
      activateEvent: { event: SHARE_ROUTE_OPEN_EVENT },
      placement: "bottom",
      audience: "all",
      timeoutMs: 4000,
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
      audience: "all",
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
      audience: "authenticated",
    },
    {
      id: "notifications",
      route: "/notifications",
      title: "Never miss an update",
      body: "In-app notifications mirror to push and email where wired, so you hear about responses, rewards, and requests wherever you are.",
      titleKey: "tour.notificationsTitle",
      bodyKey: "tour.notificationsBody",
      audience: "authenticated",
    },
  ],
};

export interface PlatformTourState {
  version: number;
  startedAt: number;
  /** Index in the FULL config step list (stable across audience filters). */
  stepIndex: number;
  /** Current step id — preferred over the index when resuming. */
  stepId?: string;
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
      stepId: typeof parsed.stepId === "string" && parsed.stepId.trim() ? parsed.stepId.trim() : undefined,
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

export function isTourAudience(value: unknown): value is TourAudience {
  return value === "all" || value === "guest" || value === "authenticated";
}

export interface VisibleTourStep {
  step: TourStep;
  /** Index of this step in the FULL config list (persisted in state). */
  configIndex: number;
}

/** Filter the full step list to the steps this viewer may see. */
export function selectVisibleTourSteps(steps: TourStep[], isGuest: boolean): VisibleTourStep[] {
  return steps.flatMap((step, configIndex) => {
    const audience = step.audience ?? "all";
    const visible =
      audience === "all" ||
      (audience === "guest" && isGuest) ||
      (audience === "authenticated" && !isGuest);
    return visible ? [{ step, configIndex }] : [];
  });
}

/**
 * Map a persisted position onto the current (possibly audience-filtered)
 * step list. Prefer the step id (survives auth transitions that remove
 * steps); otherwise take the first visible step at/after the stored index.
 * Never returns an out-of-range position for a non-empty list.
 */
export function resolveTourResumeIndex(visibleSteps: VisibleTourStep[], state: PlatformTourState | null): number {
  if (visibleSteps.length === 0) return 0;
  if (!state) return 0;
  if (state.stepId) {
    const byId = visibleSteps.findIndex((entry) => entry.step.id === state.stepId);
    if (byId >= 0) return byId;
  }
  const atOrAfter = visibleSteps.findIndex((entry) => entry.configIndex >= state.stepIndex);
  if (atOrAfter >= 0) return atOrAfter;
  return visibleSteps.length - 1;
}

/** True when the current pathname is allowed to auto-start the tour. */
export function isTourAutoStartRoute(pathname: string, routes: string[]): boolean {
  if (!pathname) return false;
  return routes.some((route) => route.startsWith("/") && pathname.startsWith(route));
}

/** Per-step target wait, clamped to the display knob's safe range. */
export function tourStepTimeoutMs(step: TourStep | undefined, config: PlatformTourConfig): number {
  const fallback = config.display.targetTimeoutMs;
  const raw = step?.timeoutMs;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(raw, 1000), 20000);
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
  if (Array.isArray(value.autoStartRoutes)) {
    const routes = value.autoStartRoutes.filter(
      (route): route is string => typeof route === "string" && route.startsWith("/") && route.length > 1,
    );
    if (routes.length > 0) merged.autoStartRoutes = Array.from(new Set(routes));
  }

  if (value.guest && typeof value.guest === "object" && !Array.isArray(value.guest)) {
    const g = value.guest as Partial<PlatformTourGuestConfig>;
    merged.guest = { ...fallback.guest };
    if (typeof g.enabled === "boolean") merged.guest.enabled = g.enabled;
  }

  if (value.resume && typeof value.resume === "object" && !Array.isArray(value.resume)) {
    const r = value.resume as Partial<PlatformTourResumeConfig>;
    merged.resume = { ...fallback.resume };
    if (typeof r.enabled === "boolean") merged.resume.enabled = r.enabled;
    if (typeof r.autoResume === "boolean") merged.resume.autoResume = r.autoResume;
    if (typeof r.promptDelayMs === "number" && Number.isFinite(r.promptDelayMs)) {
      merged.resume.promptDelayMs = Math.min(Math.max(r.promptDelayMs, 0), 60000);
    }
    if (typeof r.message === "string" && r.message.trim()) merged.resume.message = r.message.trim();
    if (typeof r.actionLabel === "string" && r.actionLabel.trim()) merged.resume.actionLabel = r.actionLabel.trim();
    if (typeof r.dismissLabel === "string" && r.dismissLabel.trim()) merged.resume.dismissLabel = r.dismissLabel.trim();
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
    if (typeof d.tooltipGapPx === "number" && Number.isFinite(d.tooltipGapPx)) {
      merged.display.tooltipGapPx = Math.min(Math.max(d.tooltipGapPx, 0), 48);
    }
    if (typeof d.tooltipMarginPx === "number" && Number.isFinite(d.tooltipMarginPx)) {
      merged.display.tooltipMarginPx = Math.min(Math.max(d.tooltipMarginPx, 8), 48);
    }
    if (typeof d.tooltipMaxHeightRatio === "number" && Number.isFinite(d.tooltipMaxHeightRatio)) {
      merged.display.tooltipMaxHeightRatio = Math.min(Math.max(d.tooltipMaxHeightRatio, 0.5), 0.95);
    }
    if (typeof d.targetTimeoutMs === "number" && Number.isFinite(d.targetTimeoutMs)) {
      merged.display.targetTimeoutMs = Math.min(Math.max(d.targetTimeoutMs, 1500), 20000);
    }
    if (typeof d.mascotImage === "string") merged.display.mascotImage = d.mascotImage;
    if (typeof d.mascotAlt === "string" && d.mascotAlt.trim()) merged.display.mascotAlt = d.mascotAlt.trim();
  }

  if (value.scroll && typeof value.scroll === "object" && !Array.isArray(value.scroll)) {
    const sc = value.scroll as Partial<PlatformTourScrollConfig>;
    merged.scroll = { ...fallback.scroll };
    if (typeof sc.enabled === "boolean") merged.scroll.enabled = sc.enabled;
    if (isTourScrollBehavior(sc.behavior)) merged.scroll.behavior = sc.behavior;
    if (isTourScrollBlock(sc.block)) merged.scroll.block = sc.block;
    if (typeof sc.onlyWhenOffscreen === "boolean") merged.scroll.onlyWhenOffscreen = sc.onlyWhenOffscreen;
    if (typeof sc.visibilityMarginPx === "number" && Number.isFinite(sc.visibilityMarginPx)) {
      merged.scroll.visibilityMarginPx = Math.min(Math.max(sc.visibilityMarginPx, 0), 120);
    }
    if (typeof sc.delayMs === "number" && Number.isFinite(sc.delayMs)) {
      merged.scroll.delayMs = Math.min(Math.max(sc.delayMs, 0), 2000);
    }
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
        allowEnd: typeof s.allowEnd === "boolean" ? s.allowEnd : undefined,
        placement: isTourPlacement(s.placement) ? s.placement : undefined,
        audience: isTourAudience(s.audience) ? s.audience : undefined,
        timeoutMs:
          typeof s.timeoutMs === "number" && Number.isFinite(s.timeoutMs)
            ? Math.min(Math.max(s.timeoutMs, 1000), 20000)
            : undefined,
        activateEvent: normalizeTourStepEvent(s.activateEvent),
        advanceEvent: normalizeTourStepEvent(s.advanceEvent),
        scrollIntoView: typeof s.scrollIntoView === "boolean" ? s.scrollIntoView : undefined,
      }));
    if (steps.length > 0) merged.steps = steps;
  }

  return merged;
}

export function isTourPlacement(value: unknown): value is TourStepPlacement {
  return value === "top" || value === "bottom" || value === "left" || value === "right";
}

export function isTourScrollBlock(value: unknown): value is TourScrollBlock {
  return value === "start" || value === "center" || value === "end" || value === "nearest";
}

export function isTourScrollBehavior(value: unknown): value is TourScrollBehavior {
  return value === "smooth" || value === "auto";
}

const TOUR_EVENT_NAME = /^along:[a-z0-9-]+$/;

/**
 * Never-throw event action parser. Only `along:*` names are accepted (the
 * config is code-shipped; this also keeps admin-overridden rows harmless) and
 * the detail payload is a small flat string map.
 */
export function normalizeTourStepEvent(value: unknown): TourStepEvent | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.event !== "string" || !TOUR_EVENT_NAME.test(v.event)) return undefined;
  let detail: Record<string, string> | undefined;
  if (v.detail && typeof v.detail === "object" && !Array.isArray(v.detail)) {
    const entries = Object.entries(v.detail as Record<string, unknown>)
      .filter(([key, val]) => /^[a-zA-Z0-9_-]{1,32}$/.test(key) && typeof val === "string")
      .slice(0, 8) as [string, string][];
    if (entries.length > 0) detail = Object.fromEntries(entries);
  }
  return detail ? { event: v.event, detail } : { event: v.event };
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
  if ("autoStartRoutes" in v) {
    if (!Array.isArray(v.autoStartRoutes)) return "autoStartRoutes must be an array of paths.";
    if (v.autoStartRoutes.some((route) => typeof route !== "string" || !route.startsWith("/"))) {
      return "every autoStartRoutes entry must start with '/'.";
    }
  }
  if ("guest" in v) {
    if (typeof v.guest !== "object" || v.guest === null || Array.isArray(v.guest)) return "guest must be an object.";
    const guest = v.guest as Record<string, unknown>;
    if ("enabled" in guest && typeof guest.enabled !== "boolean") return "guest.enabled must be true or false.";
  }
  if ("resume" in v) {
    if (typeof v.resume !== "object" || v.resume === null || Array.isArray(v.resume)) return "resume must be an object.";
    const resume = v.resume as Record<string, unknown>;
    if ("enabled" in resume && typeof resume.enabled !== "boolean") return "resume.enabled must be true or false.";
    if ("autoResume" in resume && typeof resume.autoResume !== "boolean") {
      return "resume.autoResume must be true or false.";
    }
    if ("promptDelayMs" in resume) {
      if (
        typeof resume.promptDelayMs !== "number" ||
        !Number.isFinite(resume.promptDelayMs) ||
        resume.promptDelayMs < 0
      ) {
        return "resume.promptDelayMs must be a non-negative number of milliseconds.";
      }
      if (resume.promptDelayMs > 60000) return "resume.promptDelayMs must stay under 60000ms.";
    }
    for (const field of ["message", "actionLabel", "dismissLabel"] as const) {
      if (field in resume && (typeof resume[field] !== "string" || !(resume[field] as string).trim())) {
        return `resume.${field} must be a non-empty string.`;
      }
    }
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
      if (s.audience !== undefined && !isTourAudience(s.audience)) {
        return `step '${s.id}' audience must be all, guest or authenticated.`;
      }
      if (s.timeoutMs !== undefined) {
        if (typeof s.timeoutMs !== "number" || !Number.isFinite(s.timeoutMs) || s.timeoutMs < 1000) {
          return `step '${s.id}' timeoutMs must be at least 1000ms.`;
        }
        if (s.timeoutMs > 20000) return `step '${s.id}' timeoutMs must stay under 20000ms.`;
      }
      if (s.scrollIntoView !== undefined && typeof s.scrollIntoView !== "boolean") {
        return `step '${s.id}' scrollIntoView must be true or false.`;
      }
      if (s.allowEnd !== undefined && typeof s.allowEnd !== "boolean") {
        return `step '${s.id}' allowEnd must be true or false.`;
      }
      for (const field of ["activateEvent", "advanceEvent"] as const) {
        if (s[field] === undefined) continue;
        const event = s[field];
        if (!event || typeof event !== "object" || Array.isArray(event)) {
          return `step '${s.id}' ${field} must be an object with an along:* event name.`;
        }
        const ev = event as Record<string, unknown>;
        if (typeof ev.event !== "string" || !/^along:[a-z0-9-]+$/.test(ev.event)) {
          return `step '${s.id}' ${field}.event must be an along:* event name.`;
        }
        if (ev.detail !== undefined) {
          if (!ev.detail || typeof ev.detail !== "object" || Array.isArray(ev.detail)) {
            return `step '${s.id}' ${field}.detail must be a flat string map.`;
          }
          if (Object.values(ev.detail as Record<string, unknown>).some((val) => typeof val !== "string")) {
            return `step '${s.id}' ${field}.detail values must be strings.`;
          }
        }
      }
    }
  }
  if (v.display !== undefined && (typeof v.display !== "object" || v.display === null || Array.isArray(v.display))) {
    return "display must be an object.";
  }
  if (v.scroll !== undefined && (typeof v.scroll !== "object" || v.scroll === null || Array.isArray(v.scroll))) {
    return "scroll must be an object.";
  }
  if (v.scroll && typeof v.scroll === "object" && !Array.isArray(v.scroll)) {
    const scroll = v.scroll as Record<string, unknown>;
    if ("enabled" in scroll && typeof scroll.enabled !== "boolean") return "scroll.enabled must be true or false.";
    if ("behavior" in scroll && !isTourScrollBehavior(scroll.behavior)) {
      return "scroll.behavior must be smooth or auto.";
    }
    if ("block" in scroll && !isTourScrollBlock(scroll.block)) {
      return "scroll.block must be start, center, end or nearest.";
    }
    if ("onlyWhenOffscreen" in scroll && typeof scroll.onlyWhenOffscreen !== "boolean") {
      return "scroll.onlyWhenOffscreen must be true or false.";
    }
    if ("visibilityMarginPx" in scroll && (typeof scroll.visibilityMarginPx !== "number" || !Number.isFinite(scroll.visibilityMarginPx) || scroll.visibilityMarginPx < 0 || scroll.visibilityMarginPx > 120)) {
      return "scroll.visibilityMarginPx must be between 0 and 120.";
    }
    if ("delayMs" in scroll && (typeof scroll.delayMs !== "number" || !Number.isFinite(scroll.delayMs) || scroll.delayMs < 0 || scroll.delayMs > 2000)) {
      return "scroll.delayMs must be between 0 and 2000.";
    }
  }
  if (v.display && typeof v.display === "object" && !Array.isArray(v.display)) {
    const display = v.display as Record<string, unknown>;
    if ("tooltipGapPx" in display && (typeof display.tooltipGapPx !== "number" || !Number.isFinite(display.tooltipGapPx) || display.tooltipGapPx < 0 || display.tooltipGapPx > 48)) {
      return "display.tooltipGapPx must be between 0 and 48.";
    }
    if ("tooltipMarginPx" in display && (typeof display.tooltipMarginPx !== "number" || !Number.isFinite(display.tooltipMarginPx) || display.tooltipMarginPx < 8 || display.tooltipMarginPx > 48)) {
      return "display.tooltipMarginPx must be between 8 and 48.";
    }
    if ("tooltipMaxHeightRatio" in display && (typeof display.tooltipMaxHeightRatio !== "number" || !Number.isFinite(display.tooltipMaxHeightRatio) || display.tooltipMaxHeightRatio < 0.5 || display.tooltipMaxHeightRatio > 0.95)) {
      return "display.tooltipMaxHeightRatio must be between 0.5 and 0.95.";
    }
  }
  return null;
}

/** Compact profiling for the tooltip header (first-step welcome flag). */
export function isWelcomeStep(steps: TourStep[], index: number): boolean {
  return index === 0 && steps.length > 0 && !steps[0].targetSelector;
}

export interface TourSpotRectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourViewportSize {
  width: number;
  height: number;
}

export type TourTooltipPlacement = TourStepPlacement | "center";

export interface TourTooltipLayout {
  /** Placement actually used (may differ from the step's request after flip). */
  placement: TourTooltipPlacement;
  /** Card width in px — always explicit so copy length cannot shrink it. */
  width: number;
  left: number;
  top: number;
  /** Card max-height; content scrolls internally beyond this. */
  maxHeight: number;
}

interface TooltipCandidate {
  placement: TourStepPlacement;
  left: number;
  top: number;
  overflow: number;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function candidateOverflow(
  left: number,
  top: number,
  width: number,
  height: number,
  viewport: TourViewportSize,
  margin: number,
): number {
  const horizontal = Math.max(0, margin - left) + Math.max(0, left + width - (viewport.width - margin));
  const vertical = Math.max(0, margin - top) + Math.max(0, top + height - (viewport.height - margin));
  return horizontal + vertical;
}

/**
 * Viewport-safe tooltip layout (pure).
 *
 * Guarantees:
 * - the card keeps a consistent, explicit width (capped only by the viewport)
 * - the card never renders below/above the safe viewport area where its
 *   actions would be unreachable: requested placement is used when it fits,
 *   otherwise it flips to the opposite side / another side, and finally
 *   clamps with internal scrolling
 * - centered steps (welcome/end) are vertically centered with the same caps
 *
 * `measuredHeight` comes from the rendered card; when 0 a conservative
 * estimate is used for the first pass.
 */
export function resolveTourTooltipLayout(
  requested: TourStepPlacement | undefined,
  spot: TourSpotRectLike | null,
  viewport: TourViewportSize,
  config: PlatformTourConfig,
  measuredHeight = 0,
): TourTooltipLayout {
  const margin = Math.max(8, config.display.tooltipMarginPx);
  const gap = Math.max(0, config.display.tooltipGapPx);
  const safeWidth = Math.max(0, viewport.width - margin * 2);
  const width = Math.max(0, Math.min(config.display.tooltipMaxWidthPx, safeWidth));
  const maxHeight = Math.max(
    120,
    Math.min(viewport.height - margin * 2, viewport.height * config.display.tooltipMaxHeightRatio),
  );
  const estimatedHeight = Math.min(maxHeight, Math.max(120, Math.round(maxHeight * 0.55)));
  const height = Math.min(maxHeight, Math.max(80, measuredHeight || estimatedHeight));

  if (!spot || width <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    const centeredHeight = Math.min(maxHeight, Math.max(80, measuredHeight || 220));
    return {
      placement: "center",
      width,
      left: Math.max(0, (viewport.width - width) / 2),
      top: clampValue(
        (viewport.height - centeredHeight) / 2,
        margin,
        Math.max(margin, viewport.height - centeredHeight - margin),
      ),
      maxHeight,
    };
  }

  const opposite: Record<TourStepPlacement, TourStepPlacement> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const order: TourStepPlacement[] = requested
    ? [requested, opposite[requested], "bottom", "top", "right", "left"]
    : ["bottom", "top", "right", "left"];
  const seen = new Set<TourStepPlacement>();

  const candidates: TooltipCandidate[] = [];
  for (const placement of order) {
    if (seen.has(placement)) continue;
    seen.add(placement);
    let left = 0;
    let top = 0;
    if (placement === "top" || placement === "bottom") {
      left = clampValue(spot.left + spot.width / 2 - width / 2, margin, Math.max(margin, viewport.width - width - margin));
      top = placement === "top" ? spot.top - gap - height : spot.top + spot.height + gap;
    } else {
      left = placement === "left" ? spot.left - gap - width : spot.left + spot.width + gap;
      left = clampValue(left, margin, Math.max(margin, viewport.width - width - margin));
      top = clampValue(
        spot.top + spot.height / 2 - height / 2,
        margin,
        Math.max(margin, viewport.height - height - margin),
      );
    }
    candidates.push({
      placement,
      left,
      top,
      overflow: candidateOverflow(left, top, width, height, viewport, margin),
    });
  }

  const best =
    candidates.find((candidate) => candidate.overflow === 0) ??
    candidates.reduce((winner, candidate) => (candidate.overflow < winner.overflow ? candidate : winner));

  return {
    placement: best.placement,
    width,
    left: clampValue(best.left, margin, Math.max(margin, viewport.width - width - margin)),
    top: clampValue(best.top, margin, Math.max(margin, viewport.height - height - margin)),
    maxHeight,
  };
}
