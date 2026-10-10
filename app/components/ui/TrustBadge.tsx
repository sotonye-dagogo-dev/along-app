"use client";

import { useState, useRef, useLayoutEffect, useCallback } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { AppProgress } from "./";

export interface TrustBreakdown {
  community?: number;
  detail?: number;
  corroboration?: number;
  recency?: number;
  reputation?: number;
  engagement?: number;
}

export interface TrustBadgeProps {
  level: "low" | "developing" | "verified" | "trusted";
  score: number;
  size?: "sm" | "default";
  showTooltip?: boolean;
  /**
   * Live engine components (see GET /api/posts/[id] `validityBreakdown`).
   * When provided the tooltip shows real values; otherwise it falls back to
   * the legacy score-derived placeholders so old call sites keep working.
   */
  breakdown?: TrustBreakdown | null;
}

const TRUST_CONFIG = {
  low: {
    icon: AlertTriangle,
    label: "Low",
    bg: "bg-[#FEE2E2]",
    text: "text-[#7F1D1D]",
  },
  developing: {
    icon: Clock,
    label: "Developing",
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  verified: {
    icon: CheckCircle,
    label: "Verified",
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  trusted: {
    icon: ShieldCheck,
    label: "Trusted",
    bg: "bg-[#DBEAFE]",
    text: "text-[#1E3A8A]",
  },
};

const METRICS = [
  { label: "Community", key: "community" },
  { label: "Detail", key: "detail" },
  { label: "Corroboration", key: "corroboration" },
  { label: "Recency", key: "recency" },
  { label: "Reputation", key: "reputation" },
  { label: "Engagement", key: "engagement" },
] as const;

/** Estimated tooltip width (matches min-w + padding); used for clamping. */
const TOOLTIP_WIDTH = 240;

export function TrustBadge({
  level,
  score,
  size = "default",
  showTooltip = true,
  breakdown = null,
}: TrustBadgeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  // Viewport-aware placement: clamped horizontally, flips below the badge
  // when there is no room above — the breakdown is always fully readable.
  const [placement, setPlacement] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const config = TRUST_CONFIG[level];
  const Icon = config.icon;

  // Real engine components when the caller ships them (live breakdown from
  // the detail API); legacy score-derived placeholders otherwise. Reputation
  // / Engagement rows only appear when real values exist — placeholders never
  // invent them.
  const hasLive = !!breakdown && ["community", "detail", "corroboration", "recency"].every(
    (k) => typeof (breakdown as Record<string, unknown>)[k] === "number"
  );
  const visibleMetrics = METRICS.filter((m) => {
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
        value: Math.min(100, Math.max(0, Math.round(Number(v)))),
        live: true as const,
      };
    }
    const offset = (i - 1.5) * 8;
    return {
      label: m.label,
      value: Math.min(100, Math.max(0, score + offset)),
      live: false as const,
    };
  });

  const close = useCallback(() => setTooltipOpen(false), []);

  useLayoutEffect(() => {
    if (!tooltipOpen) return;
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const margin = 8;
      // Center on the badge, then clamp so the whole tooltip stays on-screen.
      const idealLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      const left = Math.min(Math.max(idealLeft, margin), Math.max(margin, vw - TOOLTIP_WIDTH - margin));
      // Flip below when there isn't room above (tooltip ≈ 190px tall).
      const above = rect.top > 210;
      setPlacement(
        above
          ? { left, bottom: window.innerHeight - rect.top + 8 }
          : { left, top: rect.bottom + 8 }
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [tooltipOpen, close]);

  return (
    <div
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={() => showTooltip && setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocus={() => showTooltip && setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
    >
      <button
        type="button"
        aria-label={`Trust score ${score}, ${config.label}. Activate for breakdown.`}
        aria-expanded={tooltipOpen}
        onClick={() => showTooltip && setTooltipOpen((v) => !v)}
        className={`inline-flex items-center gap-1 radius-pill ${config.bg} ${config.text} border-none cursor-pointer font-sans ${
          size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        }`}
      >
        <Icon size={12} />
        <span>{config.label}</span>
        <span className="font-bold">{score}</span>
      </button>

      {showTooltip && tooltipOpen && (
        <div
          role="tooltip"
          className="fixed z-[60] bg-bg-card border border-border radius-lg shadow-lg p-4 w-[240px] max-w-[calc(100vw-1rem)]"
          style={{
            left: placement.left,
            ...(placement.bottom !== undefined ? { bottom: placement.bottom } : { top: placement.top ?? 0 }),
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
              <div key={metric.label} className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
