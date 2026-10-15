"use client";

import { useState, useRef, useLayoutEffect, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { AppProgress } from "./";
import {
  TRUST_DISPLAY_CONFIG,
  trustKeysForVariant,
  trustTierForScore,
  type TrustDisplayVariant,
} from "@/app/lib/config/trustDisplay";
import { SCROLLBAR_CONFIG } from "@/app/lib/config/scrollbar";

export interface TrustBreakdown {
  community?: number;
  detail?: number;
  corroboration?: number;
  recency?: number;
  reputation?: number;
  engagement?: number;
  /** Fresh overall score shipped alongside the components (detail + lists). */
  score?: number;
}

export interface TrustBadgeProps {
  level: "low" | "developing" | "verified" | "trusted";
  score: number;
  size?: "sm" | "default";
  showTooltip?: boolean;
  /**
   * Live engine components (see trustBreakdownService `validityBreakdown` —
   * shipped by every post read API, not just the detail view). When provided
   * the tooltip shows real values; otherwise it falls back to the legacy
   * score-derived placeholders so old call sites keep working.
   */
  breakdown?: TrustBreakdown | null;
  /**
   * Display variant — compact surfaces (feed cards) render fewer rows than
   * full surfaces (post detail), but the shared rows are numerically
   * identical because both read the same `breakdown` object.
   */
  variant?: TrustDisplayVariant;
}

const TRUST_CONFIG = {
  low: {
    icon: AlertTriangle,
    label: "Low",
    bg: "bg-trust-low-bg",
    text: "text-trust-low-text",
    border: "border-trust-low-border",
  },
  developing: {
    icon: Clock,
    label: "Developing",
    bg: "bg-trust-developing-bg",
    text: "text-trust-developing-text",
    border: "border-trust-developing-border",
  },
  verified: {
    icon: CheckCircle,
    label: "Verified",
    bg: "bg-trust-verified-bg",
    text: "text-trust-verified-text",
    border: "border-trust-verified-border",
  },
  trusted: {
    icon: ShieldCheck,
    label: "Trusted",
    bg: "bg-trust-trusted-bg",
    text: "text-trust-trusted-text",
    border: "border-trust-trusted-border",
  },
};

const METRICS = TRUST_DISPLAY_CONFIG.fullKeys.map((key) => ({
  label: TRUST_DISPLAY_CONFIG.labels[key],
  description: TRUST_DISPLAY_CONFIG.descriptions[key],
  key,
}));

/** Estimated tooltip width (matches min-w + padding); used for clamping. */
const TOOLTIP_WIDTH = TRUST_DISPLAY_CONFIG.tooltipWidth;
/** Viewport margin the clamped tooltip never crosses. */
const TOOLTIP_MARGIN = TRUST_DISPLAY_CONFIG.tooltipViewportMargin;
/** Max tooltip height before its own scroll takes over. */
const TOOLTIP_MAX_HEIGHT = TRUST_DISPLAY_CONFIG.tooltipMaxHeight;
/** Hover-bridge grace before a mouse-leave closes the tooltip. */
const HOVER_CLOSE_DELAY_MS = TRUST_DISPLAY_CONFIG.hoverCloseDelayMs;

export function TrustBadge({
  level,
  score,
  size = "default",
  showTooltip = true,
  breakdown = null,
  variant = "full",
}: TrustBadgeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  // Viewport-aware placement: edge-aware horizontal anchoring (badges at the
  // card's right edge right-align the tooltip instead of centering it
  // off-screen), clamped to the viewport, flips below the badge when there
  // is no room above — the breakdown is always fully readable.
  const [placement, setPlacement] = useState<{ left: number; top?: number; bottom?: number; maxHeight?: number }>({ left: 0 });
  // Portal target — rendering on document.body escapes transformed ancestors
  // (PostCard hover lift, carousel tapes) that would otherwise re-anchor
  // `position:fixed` and throw the tooltip off-screen on desktop.
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") setPortalEl(document.body);
  }, []);
  // Hover-bridge timer: the portal tooltip is no longer a DOM child of the
  // badge, so travelling the 8px gap fires mouse-leave — the close is
  // delayed and cancelled while the tooltip itself is hovered.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);
  // The breakdown ships a fresh overall score alongside its components, so
  // the badge NUMBER stays in lockstep with the tooltip on every surface
  // (feed card == detail view). Stored-score prop is the fallback.
  const liveScore = breakdown && typeof breakdown.score === "number" && Number.isFinite(breakdown.score)
    ? Math.min(100, Math.max(0, Math.round(breakdown.score)))
    : null;
  const displayScore = liveScore ?? score;
  // Re-derive the tier from the displayed score so label + number can never
  // disagree when live data moves the score past a threshold.
  const displayLevel = liveScore !== null ? trustTierForScore(liveScore) : level;
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const config = TRUST_CONFIG[displayLevel];
  const Icon = config.icon;

  // Real engine components when the caller ships them (live breakdown from
  // every post read API via trustBreakdownService); legacy score-derived
  // placeholders otherwise. Compact surfaces (feed cards) render the
  // configured subset — same keys, same values as the full detail view.
  // Reputation / Engagement rows only appear when real values exist —
  // placeholders never invent them.
  const hasLive = !!breakdown && ["community", "detail", "corroboration", "recency"].every(
    (k) => typeof (breakdown as Record<string, unknown>)[k] === "number"
  );
  const allowedKeys = new Set<string>(trustKeysForVariant(variant));
  const visibleMetrics = METRICS.filter((m) => {
    if (!allowedKeys.has(m.key)) return false;
    if (hasLive) {
      if (m.key === "reputation" || m.key === "engagement") {
        return typeof (breakdown as Record<string, unknown>)[m.key] === "number";
      }
      return true;
    }
    return m.key !== "reputation" && m.key !== "engagement";
  });
  const metricValues = visibleMetrics.map((m, i) => {
    if (hasLive) {
      const v = (breakdown as Record<string, unknown>)[m.key];
      return {
        label: m.label,
        description: m.description,
        value: Math.min(100, Math.max(0, Math.round(Number(v)))),
        live: true as const,
      };
    }
    const offset = (i - 1.5) * 8;
    return {
      label: m.label,
      description: m.description,
      value: Math.min(100, Math.max(0, displayScore + offset)),
      live: false as const,
    };
  });

  const close = useCallback(() => {
    cancelScheduledClose();
    setTooltipOpen(false);
  }, [cancelScheduledClose]);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setTooltipOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [cancelScheduledClose]);

  const openTooltip = useCallback(() => {
    cancelScheduledClose();
    setTooltipOpen(true);
  }, [cancelScheduledClose]);

  useLayoutEffect(() => {
    if (!tooltipOpen) return;
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = TOOLTIP_MARGIN;
      const maxLeft = Math.max(margin, vw - TOOLTIP_WIDTH - margin);
      // Edge-aware anchoring: badges in the right third right-align the
      // tooltip (centering would shove it off-screen), badges in the left
      // third left-align it, otherwise center — then clamp to the viewport.
      const centerX = rect.left + rect.width / 2;
      const centered = centerX - TOOLTIP_WIDTH / 2;
      const anchored =
        centerX > (vw * 2) / 3
          ? Math.min(centered, rect.right - TOOLTIP_WIDTH)
          : centerX < vw / 3
            ? Math.max(centered, rect.left)
            : centered;
      const left = Math.min(Math.max(anchored, margin), maxLeft);
      // Flip below when there isn't room above; cap height to the space
      // actually available so the tooltip scrolls internally instead of
      // overflowing the viewport.
      const estHeight = variant === "compact" ? 240 : 320;
      const above = rect.top > estHeight + 16;
      if (above) {
        setPlacement({ left, bottom: vh - rect.top + 8, maxHeight: Math.min(TOOLTIP_MAX_HEIGHT, rect.top - 16) });
      } else {
        setPlacement({ left, top: rect.bottom + 8, maxHeight: Math.max(120, Math.min(TOOLTIP_MAX_HEIGHT, vh - rect.bottom - 16)) });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // Clicking/tapping anywhere outside the badge + tooltip dismisses it
    // (works for both hover-opened and click-pinned states).
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (
        t &&
        anchorRef.current && !anchorRef.current.contains(t) &&
        tooltipRef.current && !tooltipRef.current.contains(t)
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [tooltipOpen, close, variant]);

  return (
    <div
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={() => showTooltip && openTooltip()}
      onMouseLeave={() => showTooltip && scheduleClose()}
      onFocus={() => showTooltip && openTooltip()}
      onBlur={() => showTooltip && scheduleClose()}
    >
      <button
        type="button"
        aria-label={`Trust score ${displayScore}, ${config.label}. Activate for breakdown.`}
        aria-expanded={tooltipOpen}
        onClick={() => showTooltip && (tooltipOpen ? close() : openTooltip())}
        className={`inline-flex items-center gap-1 radius-pill border cursor-pointer font-sans font-semibold ${config.bg} ${config.text} ${config.border} ${
          size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        }`}
      >
        <Icon size={12} />
        <span>{config.label}</span>
        <span className="font-bold">{displayScore}</span>
      </button>

      {showTooltip && tooltipOpen && portalEl && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          onMouseEnter={openTooltip}
          onMouseLeave={scheduleClose}
          className={`fixed z-[60] bg-bg-card border border-border radius-lg shadow-lg p-4 w-[240px] max-w-[calc(100vw-1rem)] overflow-y-auto ${SCROLLBAR_CONFIG.classes.thin}`}
          style={{
            left: placement.left,
            ...(placement.bottom !== undefined ? { bottom: placement.bottom } : { top: placement.top ?? 0 }),
            ...(placement.maxHeight !== undefined ? { maxHeight: placement.maxHeight } : {}),
          }}
        >
          <p className="text-sm font-semibold text-text-primary mb-3">
            Trust Breakdown
            {metricValues.length > 0 && metricValues[0].live && (
              <span className="ml-2 text-[10px] font-medium text-text-muted">live</span>
            )}
          </p>
          <div className="flex flex-col gap-2">
            {metricValues.map((metric) => (
              <div key={metric.label} className="flex items-center gap-2" title={metric.description}>
                <span className="text-xs text-text-secondary w-24 shrink-0">
                  {metric.label}
                </span>
                <AppProgress value={metric.value} size="sm" className="flex-1" />
                <span className="text-xs text-text-muted w-8 text-right">
                  {metric.value}%
                </span>
              </div>
            ))}
          </div>
        </div>,
        portalEl
      )}
    </div>
  );
}
