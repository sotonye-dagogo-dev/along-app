"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { AppProgress } from "./";

export interface TrustBadgeProps {
  level: "low" | "developing" | "verified" | "trusted";
  score: number;
  size?: "sm" | "default";
  showTooltip?: boolean;
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
];

export function TrustBadge({
  level,
  score,
  size = "default",
  showTooltip = true,
}: TrustBadgeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const config = TRUST_CONFIG[level];
  const Icon = config.icon;

  const metricValues = METRICS.map((m, i) => {
    const offset = (i - 1.5) * 8;
    return {
      label: m.label,
      value: Math.min(100, Math.max(0, score + offset)),
    };
  });

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocus={() => setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
    >
      <div
        className={`inline-flex items-center gap-1 radius-pill ${config.bg} ${config.text} ${
          size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        }`}
      >
        <Icon size={12} />
        <span>{config.label}</span>
        <span className="font-bold">{score}</span>
      </div>

      {showTooltip && tooltipOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-bg-card border border-border radius-lg shadow-lg p-4 min-w-[220px] z-50">
          <p className="text-sm font-semibold text-text-primary mb-3">
            Trust Breakdown
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
