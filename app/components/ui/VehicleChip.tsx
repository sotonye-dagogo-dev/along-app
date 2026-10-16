"use client";

import type { VehicleType } from "@/app/lib/types";
import { VEHICLE_REGISTRY } from "@/app/lib/config";

export interface VehicleChipProps {
  type: VehicleType;
  size?: "sm" | "default";
}

export function VehicleChip({
  type,
  size = "default",
}: VehicleChipProps) {
  const config = VEHICLE_REGISTRY[type];
  // Unknown/legacy strings render nothing instead of crashing on
  // `config.icon` (callers cast free-form route JSON to VehicleType).
  if (!config) return null;
  const Icon = config.icon;
  const border = config.borderClass ?? "";

  // Flag structure mirrors the route-request flag (`bg-warning
  // text-warning-text border-warning-border`): saturated wash + dark label +
  // visible border + shadow so the badge reads as a badge on white cards in
  // light theme. The icon carries a heavier stroke for the same reason.
  return (
    <span
      title={config.label}
      aria-label={`Vehicle: ${config.label}`}
      className={`inline-flex items-center gap-1.5 radius-pill border font-semibold shadow-xs ${config.bgClass} ${config.textClass} ${border} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      <Icon size={size === "sm" ? 12 : 14} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
