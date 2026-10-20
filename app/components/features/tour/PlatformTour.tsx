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
  isTourPlacement,
  isTourTerminal,
  normalizePlatformTourConfig,
  readTourStateShape,
  type PlatformTourConfig,
  type TourStep,
  type TourStepPlacement,
} from "@/app/lib/config/platformTour";
import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { useTranslation } from "@/app/providers/I18nProvider";

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
      completedAt: current?.completedAt,
      dismissedAt: current?.dismissedAt,
      ...patch,
    };
    if (patch.completedAt === null || patch.dismissedAt === null) {
      delete (next as Record<string, unknown>).completedAt;
      delete (next as Record<string, unknown>).dismissedAt;
    }
    window.localStorage.setItem(config.storage.stateKey, JSON.stringify(next));
  } catch {
    // Storage unavailable — the tour still runs for this session.
  }
}

export default function PlatformTour() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isOnline } = useOnlineStatus();
  const [config, setConfig] = useState<PlatformTourConfig>(DEFAULT_PLATFORM_TOUR_CONFIG);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<TourPhase>("finding");
  const [spot, setSpot] = useState<SpotRect | null>(null);
  const [endCard, setEndCard] = useState(false);
  const [mascotFailed, setMascotFailed] = useState(false);
  const bootstrapRef = useRef(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const findTokenRef = useRef(0);

  const stepCount = config.steps.length;
  const enabled = config.enabled && stepCount > 0;
  const step: TourStep | undefined = enabled ? config.steps[stepIndex] : undefined;
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

  // Bootstrap: resume an interrupted tour, else auto-start once, else wait
  // for the replay event (profile quick link).
  useEffect(() => {
    if (!enabled || bootstrapRef.current) return;
    bootstrapRef.current = true;
    if (isTourTerminal(readState(config))) return;
    const resumed = readState(config);
    const delay = resumed ? 400 : Math.max(config.autoStartDelayMs, 0);
    if (!resumed && !config.autoStart) return;
    const timer = window.setTimeout(() => {
      setActive(true);
      setStepIndex(coerceStepIndex(resumed?.stepIndex ?? 0, stepCount));
      writeState(config, { stepIndex: resumed?.stepIndex ?? 0, completedAt: null, dismissedAt: null });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, stepCount, config]);

  // Replay trigger (CustomEvent from profile quick links).
  useEffect(() => {
    if (!enabled) return;
    const onStart = () => {
      setActive(true);
      setEndCard(false);
      setPhase("finding");
      setStepIndex(0);
      writeState(config, { stepIndex: 0, completedAt: null, dismissedAt: null });
    };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [enabled, config]);

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
    writeState(config, { stepIndex: nextIndex });
    setStepIndex(nextIndex);
    resetVisuals();
  }, [step, stepIndex, stepCount, config, finish, resetVisuals]);

  const goPrev = useCallback(() => {
    if (stepIndex <= 0) return;
    const prevIndex = stepIndex - 1;
    writeState(config, { stepIndex: prevIndex });
    setStepIndex(prevIndex);
    setEndCard(false);
    resetVisuals();
  }, [stepIndex, config, resetVisuals]);

  // Step activation: navigate when needed, poll for the first visible
  // target, then spotlight it. Missing target degrades by connectivity:
  // online → auto-advance; offline → honest stop with Skip/End.
  useEffect(() => {
    if (!active || !enabled || endCard || !step) return;
    const token = (findTokenRef.current += 1);
    if (!step.targetSelector?.trim()) {
      if (!window.location.pathname.startsWith(step.route)) router.push(step.route);
      setPhase("ready");
      return;
    }
    let navigated = false;
    if (!window.location.pathname.startsWith(step.route)) {
      navigated = true;
      router.push(step.route);
    }
    const startedAt = Date.now();
    setPhase("finding");
    const tick = () => {
      if (token !== findTokenRef.current) return;
      const target = findStepTarget(step.targetSelector);
      if (target) {
        targetRef.current = target;
        setSpot(computeSpotRect(target, config));
        setPhase("ready");
        return;
      }
      if (Date.now() - startedAt >= config.display.targetTimeoutMs) {
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

  // Move focus to the primary control after each step switch.
  useEffect(() => {
    if (!active || phase === "finding") return;
    primaryButtonRef.current?.focus({ preventScroll: true });
  }, [active, stepIndex, phase, endCard]);

  if (!enabled || !active) return null;

  const offlineNote = tt(config.offline.bodyKey ?? "tour.offlineNote", config.offline.note);
  const tooltipVisible = !endCard && phase !== "offline-blocked" && (centered || !!spot);
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
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label={tt("tour.ariaLabel", "Platform tour")}>
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
          className="absolute left-4 right-4 mx-auto bg-bg-card border border-border shadow-md p-4"
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
          className="absolute bg-bg-card border border-border shadow-md p-4"
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
              config.steps.map((_, idx) => (
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
          className="absolute bg-bg-card border border-border shadow-md p-5 text-center"
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
