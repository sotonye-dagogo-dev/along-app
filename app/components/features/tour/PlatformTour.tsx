"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Compass, X } from "lucide-react";
import { AppButton } from "@/app/components/ui/AppButton";
import AppLogo from "@/app/components/ui/AppLogo";
import {
  DEFAULT_PLATFORM_TOUR_CONFIG,
  PLATFORM_TOUR_STATE_VERSION,
  TOUR_START_EVENT,
  coerceStepIndex,
  isLastStep,
  isTourAutoStartRoute,
  isTourPlacement,
  isTourTerminal,
  normalizePlatformTourConfig,
  readTourStateShape,
  resolveTourResumeIndex,
  selectVisibleTourSteps,
  tourStepTimeoutMs,
  type PlatformTourConfig,
  type TourStep,
  type TourStepPlacement,
  type VisibleTourStep,
} from "@/app/lib/config/platformTour";
import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { useTranslation } from "@/app/providers/I18nProvider";
import { useAuth } from "@/app/hooks/useAuth";

/** One-past-viewport scrim — intentionally dark in both themes (modal parity). */
const SCRIM_SHADOW = "0 0 0 9999px rgba(10, 10, 10, 0.62)";
const CONFIG_ENDPOINT = "/api/tour";

type TourPhase = "finding" | "ready" | "interacted" | "offline-blocked";

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

const ttf = (t: (key: string) => string, key: string, fallback: string): string => {
  try {
    const value = t(key);
    return value === key ? fallback : value;
  } catch {
    return fallback;
  }
};

function isElementVisible(el: Element): el is HTMLElement {
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return el.getClientRects().length > 0;
}

/** Comma-selector list → first visible match (desktop/mobile parity). */
function findStepTarget(selector: string | undefined): HTMLElement | null {
  if (!selector || !selector.trim()) return null;
  const parts = selector.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    try {
      for (const candidate of document.querySelectorAll(part)) {
        if (isElementVisible(candidate)) return candidate as HTMLElement;
      }
    } catch {
      // Invalid selector (admin typo) — try the next part.
    }
  }
  return null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounded point ring around the real element bounds (§ config knobs). */
function computeSpotRect(el: HTMLElement, config: PlatformTourConfig): SpotRect {
  const rect = el.getBoundingClientRect();
  const pad = config.display.spotPadPx;
  const halfMinSide = Math.min(rect.width, rect.height) / 2;
  const borderRadius = clampNumber(
    Math.min(config.display.spotRadiusPx, halfMinSide),
    4,
    config.display.spotRadiusPx,
  );
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius,
  };
}

function tooltipPosition(
  placement: TourStepPlacement,
  spot: SpotRect,
  maxWidth: number,
  viewportW: number,
  viewportH: number,
): React.CSSProperties {
  const gap = 12;
  const margin = 12;
  const width = Math.min(maxWidth, viewportW - margin * 2);
  const clampLeft = (left: number) => clampNumber(left, margin, Math.max(margin, viewportW - width - margin));
  const style: React.CSSProperties = { maxWidth: width };
  if (placement === "left" || placement === "right") {
    const left = placement === "left" ? spot.left - width - gap : spot.left + spot.width + gap;
    style.left = clampLeft(left);
    style.top = clampNumber(spot.top, margin, Math.max(margin, viewportH - 90));
  } else {
    style.width = width;
    style.left = clampLeft(spot.left + spot.width / 2 - width / 2);
    if (placement === "top" && spot.top > 110) {
      style.bottom = viewportH - spot.top + gap;
    } else {
      style.top = spot.top + spot.height + gap;
    }
  }
  return style;
}

const centeredStyle = { left: "50%", transform: "translateX(-50%)", top: "34%" } as const;

function readState(config: PlatformTourConfig) {
  try {
    return readTourStateShape(window.localStorage.getItem(config.storage.stateKey));
  } catch {
    return null;
  }
}

interface TourStatePatch {
  stepIndex?: number;
  stepId?: string | null;
  startedAt?: number;
  completedAt?: number | null;
  dismissedAt?: number | null;
}

function writeState(config: PlatformTourConfig, patch: TourStatePatch) {
  try {
    const current = readState(config);
    const next = {
      version: PLATFORM_TOUR_STATE_VERSION,
      startedAt: current?.startedAt ?? Date.now(),
      stepIndex: current?.stepIndex ?? 0,
      stepId: current?.stepId,
      completedAt: current?.completedAt,
      dismissedAt: current?.dismissedAt,
      ...patch,
    };
    if (patch.completedAt === null || patch.dismissedAt === null) {
      delete (next as Record<string, unknown>).completedAt;
      delete (next as Record<string, unknown>).dismissedAt;
    }
    if (patch.stepId === null) delete (next as Record<string, unknown>).stepId;
    window.localStorage.setItem(config.storage.stateKey, JSON.stringify(next));
  } catch {
    // Storage unavailable — the tour still runs for this session.
  }
}

/** Write the current visible step's full-config index + stable id. */
function persistStep(config: PlatformTourConfig, entry: VisibleTourStep | undefined, visibleIndex: number) {
  writeState(config, {
    stepIndex: entry?.configIndex ?? Math.max(visibleIndex, 0),
    stepId: entry?.step.id ?? null,
    completedAt: null,
    dismissedAt: null,
  });
}

export default function PlatformTour() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isOnline } = useOnlineStatus();
  const { isGuest, isLoading: authLoading } = useAuth();
  const [config, setConfig] = useState<PlatformTourConfig>(DEFAULT_PLATFORM_TOUR_CONFIG);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<TourPhase>("finding");
  const [spot, setSpot] = useState<SpotRect | null>(null);
  const [endCard, setEndCard] = useState(false);
  const [mascotFailed, setMascotFailed] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ index: number } | null>(null);
  const bootstrapRef = useRef(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const findTokenRef = useRef(0);

  const visibleSteps = React.useMemo(
    () => selectVisibleTourSteps(config.steps, isGuest),
    [config.steps, isGuest],
  );
  const stepCount = visibleSteps.length;
  const enabled = config.enabled && stepCount > 0 && (!isGuest || config.guest.enabled);
  const currentEntry: VisibleTourStep | undefined = enabled ? visibleSteps[stepIndex] : undefined;
  const step: TourStep | undefined = currentEntry?.step;
  const centered = !step?.targetSelector;

  const tt = useCallback((key: string, fallback: string) => ttf(t, key, fallback), [t]);

  // Non-blocking config sync: the served copy wins when reachable (and
  // warms the SWR cache); bundled defaults keep the tour alive offline.
  useEffect(() => {
    let cancelled = false;
    fetch(CONFIG_ENDPOINT)
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const tour = (data as { tour?: unknown } | null)?.tour;
        if (tour) setConfig(normalizePlatformTourConfig(tour, DEFAULT_PLATFORM_TOUR_CONFIG));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const beginTour = useCallback(
    (visibleIndex: number) => {
      const index = coerceStepIndex(visibleIndex, visibleSteps.length);
      setActive(true);
      setEndCard(false);
      setResumePrompt(null);
      setPhase("finding");
      setStepIndex(index);
      persistStep(config, visibleSteps[index], index);
    },
    [config, visibleSteps],
  );

  // Bootstrap reads the latest config/steps without re-arming on every
  // config fetch (the served copy resolving mid-delay used to cancel the
  // pending auto-start timer).
  const bootstrapConfigRef = useRef({ config, visibleSteps, beginTour });
  bootstrapConfigRef.current = { config, visibleSteps, beginTour };

  // Bootstrap: resume an interrupted tour, else auto-start once on an
  // allowed route, else wait for the replay event (profile/FAQ triggers).
  useEffect(() => {
    if (!enabled || bootstrapRef.current || authLoading) return;
    bootstrapRef.current = true;
    const latest = bootstrapConfigRef.current;
    const stored = readState(latest.config);
    if (isTourTerminal(stored)) return;

    let timer = 0;
    if (stored) {
      // Interrupted run (refresh/relaunch/full-page auth redirect). Never
      // hijack the screen: offer a small resume prompt, or honour the
      // configured silent auto-resume.
      const index = resolveTourResumeIndex(latest.visibleSteps, stored);
      const delay = Math.max(latest.config.resume.promptDelayMs, 0);
      if (latest.config.resume.autoResume) {
        timer = window.setTimeout(() => latest.beginTour(index), delay);
      } else if (latest.config.resume.enabled) {
        timer = window.setTimeout(() => setResumePrompt({ index }), delay);
      } else {
        timer = window.setTimeout(() => latest.beginTour(index), Math.min(delay, 400));
      }
      return () => window.clearTimeout(timer);
    }

    if (!latest.config.autoStart) return;
    if (!isTourAutoStartRoute(window.location.pathname, latest.config.autoStartRoutes)) return;
    timer = window.setTimeout(
      () => latest.beginTour(0),
      Math.max(latest.config.autoStartDelayMs, 0),
    );
    return () => window.clearTimeout(timer);
  }, [enabled, authLoading]);

  // Replay trigger (profile quick links, FAQ/footer launch buttons).
  useEffect(() => {
    if (!enabled) return;
    const onStart = () => beginTour(0);
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [enabled, beginTour]);

  const resetVisuals = useCallback(() => {
    setSpot(null);
    setPhase("finding");
    targetRef.current = null;
    findTokenRef.current += 1;
  }, []);

  const writeTerminal = useCallback(
    (completed: boolean) => {
      writeState(config, completed ? { completedAt: Date.now() } : { dismissedAt: Date.now() });
    },
    [config],
  );

  const closeTour = useCallback(() => {
    setActive(false);
    setEndCard(false);
    setResumePrompt(null);
    resetVisuals();
  }, [resetVisuals]);

  const skip = useCallback(() => {
    writeTerminal(false);
    closeTour();
  }, [writeTerminal, closeTour]);

  const finish = useCallback(() => {
    // Last Next → completed + thank-you card with CTA.
    writeTerminal(true);
    setEndCard(true);
    resetVisuals();
  }, [writeTerminal, resetVisuals]);

  const goNext = useCallback(() => {
    if (!step) return;
    if (isLastStep(stepIndex, stepCount)) {
      finish();
      return;
    }
    const nextIndex = stepIndex + 1;
    persistStep(config, visibleSteps[nextIndex], nextIndex);
    setStepIndex(nextIndex);
    resetVisuals();
  }, [step, stepIndex, stepCount, config, visibleSteps, finish, resetVisuals]);

  const goPrev = useCallback(() => {
    if (stepIndex <= 0) return;
    const prevIndex = stepIndex - 1;
    persistStep(config, visibleSteps[prevIndex], prevIndex);
    setStepIndex(prevIndex);
    setEndCard(false);
    resetVisuals();
  }, [stepIndex, config, visibleSteps, resetVisuals]);

  // Step activation: navigate when needed, poll for the first visible
  // target, then spotlight it. Missing target degrades by connectivity:
  // online → auto-advance; offline → honest stop with Skip/End.
  useEffect(() => {
    if (!active || !enabled || endCard || !step) return;
    const token = (findTokenRef.current += 1);
    const onRoute = () => window.location.pathname.startsWith(step.route);
    if (!step.targetSelector?.trim()) {
      if (!onRoute()) router.push(step.route);
      setPhase("ready");
      return;
    }
    const navigated = !onRoute();
    if (navigated) router.push(step.route);
    const startedAt = Date.now();
    const timeoutMs = tourStepTimeoutMs(step, config);
    setPhase("finding");
    const tick = () => {
      if (token !== findTokenRef.current) return;
      // Never spotlight a look-alike control on the previous page while the
      // router transition is still in flight.
      if (!onRoute()) {
        if (Date.now() - startedAt >= timeoutMs) {
          if (isOnline) {
            if (isLastStep(stepIndex, stepCount)) finish();
            else goNext();
          } else {
            setPhase("offline-blocked");
          }
          return;
        }
        window.setTimeout(tick, 140);
        return;
      }
      const target = findStepTarget(step.targetSelector);
      if (target) {
        targetRef.current = target;
        setSpot(computeSpotRect(target, config));
        setPhase("ready");
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        if (isOnline) {
          // Target never showed up (page failed to load, layout drifted):
          // keep the tour usable — advance politely.
          if (isLastStep(stepIndex, stepCount)) {
            finish();
          } else {
            goNext();
          }
          return;
        }
        setPhase("offline-blocked");
        return;
      }
      window.setTimeout(tick, 140);
    };
    const kickoff = window.setTimeout(tick, navigated ? 240 : 60);
    return () => window.clearTimeout(kickoff);
  }, [active, enabled, endCard, stepIndex, stepCount, step, config, router, isOnline, goNext, finish]);

  // Spot follows scroll/resize (rAF-throttled) while a target is visible.
  useEffect(() => {
    if (!active || phase !== "ready") return;
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = targetRef.current;
        if (!target || !target.isConnected) return;
        try {
          if (!isElementVisible(target)) return;
          const next = computeSpotRect(target, config);
          setSpot((prev) =>
            prev &&
            Math.abs(prev.top - next.top) < 0.5 &&
            Math.abs(prev.left - next.left) < 0.5 &&
            prev.width === next.width &&
            prev.height === next.height
              ? prev
              : next,
          );
        } catch {
          // Detached mid-frame — next event re-checks.
        }
      });
    };
    remeasure();
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [active, phase, stepIndex, config]);

  // Interactive steps wait for a real interaction on the target element —
  // the overlay is pointer-events-free so the app stays fully operable.
  useEffect(() => {
    if (!active || phase !== "ready" || !step?.interactive) return;
    const selector = (step.interactionSelector || step.targetSelector || "").trim();
    if (!selector) return;
    const onCaptureClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      try {
        if (target.closest(selector)) setPhase("interacted");
      } catch {
        // Invalid selector — the wait simply stays active.
      }
    };
    document.addEventListener("click", onCaptureClick, true);
    return () => document.removeEventListener("click", onCaptureClick, true);
  }, [active, phase, step?.interactive, step?.interactionSelector, step?.targetSelector]);

  // Escape exits the tour.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, skip]);

  // Move focus to the primary control after each step switch / resume ask.
  useEffect(() => {
    if ((!active && !resumePrompt) || (active && phase === "finding")) return;
    primaryButtonRef.current?.focus({ preventScroll: true });
  }, [active, resumePrompt, stepIndex, phase, endCard]);

  // A live sign-in/out can shrink the audience-filtered list mid-tour.
  useEffect(() => {
    if (!active || stepCount === 0) return;
    if (stepIndex > stepCount - 1) setStepIndex(stepCount - 1);
  }, [active, stepCount, stepIndex]);

  if (!enabled || (!active && !resumePrompt)) return null;

  const offlineNote = tt(config.offline.bodyKey ?? "tour.offlineNote", config.offline.note);
  const tooltipVisible =
    active && !resumePrompt && !endCard && phase !== "offline-blocked" && (centered || !!spot);
  const title = endCard
    ? tt("tour.thanksTitle", config.endCard.title)
    : phase === "offline-blocked"
      ? tt("tour.offlineStopTitle", "Offline stop")
      : (tt(step?.titleKey ?? "", step?.title ?? "") || step?.title || "Along");
  const body = endCard
    ? tt("tour.thanksBody", config.endCard.body)
    : phase === "interacted"
      ? tt("tour.interactedNote", "Nice — got it. Continue the tour or wrap up here.")
      : phase === "offline-blocked"
        ? offlineNote
        : (tt(step?.bodyKey ?? "", step?.body ?? "") || step?.body || "");
  const nextLabel = isLastStep(stepIndex, stepCount) ? tt("tour.finish", "Finish") : tt("tour.next", "Next");

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      role="dialog"
      aria-label={tt("tour.ariaLabel", "Platform tour")}
    >
      {resumePrompt && !active ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto absolute left-4 right-4 top-20 mx-auto max-w-md bg-bg-card border border-border shadow-md p-3.5 flex items-start gap-3"
          style={{ borderRadius: "var(--radius-lg, 12px)" }}
        >
          <Compass size={18} className="text-primary shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">{tt("tour.resumeTitle", "Tour paused")}</p>
            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
              {tt("tour.resumeMessage", config.resume.message)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <AppButton
                variant="primary"
                size="sm"
                onClick={() => beginTour(resumePrompt.index)}
                ref={(node) => {
                  primaryButtonRef.current = node;
                }}
              >
                {tt("tour.resumeAction", config.resume.actionLabel)}
              </AppButton>
              <AppButton variant="ghost" size="sm" onClick={() => setResumePrompt(null)}>
                {tt("tour.resumeDismiss", config.resume.dismissLabel)}
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      {spot && !endCard && phase === "ready" && (
        <div
          aria-hidden="true"
          className="absolute pointer-events-none border-2 border-primary motion-safe:animate-pulse"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            borderRadius: spot.borderRadius,
            boxShadow: SCRIM_SHADOW,
          }}
        />
      )}

      {!endCard && phase === "offline-blocked" ? (
        <div
          aria-live="polite"
          className="pointer-events-auto absolute left-4 right-4 mx-auto bg-bg-card border border-border shadow-md p-4"
          style={{ ...centeredStyle, borderRadius: "var(--radius-lg, 12px)" }}
        >
          <div className="flex items-start gap-2.5">
            <Compass size={18} className="text-primary shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              <p className="text-sm text-text-secondary mt-1">{body}</p>
              <p className="text-xs text-text-muted mt-1">{tt("tour.offlineSkipHint", config.offline.skipLabelHint)}</p>
            </div>
            <button
              type="button"
              onClick={skip}
              aria-label={tt("tour.skip", "Skip tour")}
              className="text-text-muted hover:text-text-secondary focus-visible:outline focus-visible:outline-primary rounded-circle p-1 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <AppButton variant="secondary" size="sm" onClick={isLastStep(stepIndex, stepCount) ? finish : goNext}>
              {tt("tour.offlineSkipLabel", "Skip this stop")}
            </AppButton>
            <AppButton variant="ghost" size="sm" onClick={skip}>
              {config.offline.endLabel}
            </AppButton>
          </div>
        </div>
      ) : null}

      {tooltipVisible ? (
        <div
          aria-live="polite"
          className="pointer-events-auto absolute bg-bg-card border border-border shadow-md p-4"
          style={{
            ...(!centered && spot
              ? tooltipPosition(
                  isTourPlacement(step?.placement) ? (step!.placement as TourStepPlacement) : "bottom",
                  spot!,
                  config.display.tooltipMaxWidthPx,
                  window.innerWidth,
                  window.innerHeight,
                )
              : centeredStyle),
            borderRadius: "var(--radius-lg, 12px)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-full overflow-hidden border border-border bg-primary-muted grid place-items-center w-10 h-10">
              {config.display.mascotImage && !mascotFailed ? (
                <Image
                  src={config.display.mascotImage}
                  alt={config.display.mascotAlt}
                  width={40}
                  height={40}
                  className="object-cover w-10 h-10"
                  unoptimized
                  onError={() => setMascotFailed(true)}
                />
              ) : (
                <AppLogo size="sm" showText={false} linkTo="" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-text-primary leading-snug">{title}</h3>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">{body}</p>
            </div>
            <button
              type="button"
              onClick={skip}
              aria-label={tt("tour.skip", "Skip tour")}
              className="text-text-muted hover:text-text-secondary focus-visible:outline focus-visible:outline-primary rounded-circle p-1 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-3" aria-hidden="true">
            {stepCount <= 20 &&
              visibleSteps.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === stepIndex ? "w-4 bg-primary" : "w-1.5 bg-border"
                  }`}
                />
              ))}
            <span className="ml-auto text-xs text-text-muted whitespace-nowrap">
              {tt("tour.stepOf", "{n} of {m}")
                .replace("{n}", String(stepIndex + 1))
                .replace("{m}", String(stepCount))}
            </span>
          </div>
          {phase !== "finding" &&
            (phase === "interacted" ? (
              <div className="flex items-center gap-2 mt-3">
                <AppButton variant="secondary" size="sm" onClick={skip}>
                  {tt("tour.endTour", "End tour")}
                </AppButton>
                <AppButton
                  variant="primary"
                  size="sm"
                  onClick={goNext}
                  ref={(node) => {
                    primaryButtonRef.current = node;
                  }}
                >
                  {nextLabel}
                  <ChevronRight size={14} aria-hidden />
                </AppButton>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-3">
                <AppButton
                  variant="ghost"
                  size="sm"
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                  icon={<ChevronLeft size={14} aria-hidden />}
                >
                  {tt("tour.prev", "Back")}
                </AppButton>
                <AppButton
                  variant="primary"
                  size="sm"
                  onClick={goNext}
                  ref={(node) => {
                    primaryButtonRef.current = node;
                  }}
                >
                  {nextLabel}
                  <ChevronRight size={14} aria-hidden />
                </AppButton>
              </div>
            ))}
        </div>
      ) : null}

      {endCard ? (
        <div
          aria-live="polite"
          className="pointer-events-auto absolute bg-bg-card border border-border shadow-md p-5 text-center"
          style={{ ...centeredStyle, borderRadius: "var(--radius-lg, 12px)", maxWidth: 360 }}
        >
          <div className="mx-auto rounded-full overflow-hidden border border-border bg-primary-muted grid place-items-center w-12 h-12">
            {config.display.mascotImage && !mascotFailed ? (
              <Image
                src={config.display.mascotImage}
                alt={config.display.mascotAlt}
                width={48}
                height={48}
                className="object-cover w-12 h-12"
                unoptimized
                onError={() => setMascotFailed(true)}
              />
            ) : (
              <AppLogo size="md" showText={false} linkTo="" />
            )}
          </div>
          <h3 className="text-base font-bold text-text-primary mt-3">{title}</h3>
          <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">{body}</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <AppButton
              variant="primary"
              size="sm"
              onClick={() => {
                router.push(config.endCard.ctaHref);
                closeTour();
              }}
              ref={(node) => {
                primaryButtonRef.current = node;
              }}
            >
              {tt("tour.thanksCta", config.endCard.ctaLabel)}
            </AppButton>
            <AppButton variant="ghost" size="sm" onClick={closeTour}>
              {tt("tour.thanksDone", "Done")}
            </AppButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
