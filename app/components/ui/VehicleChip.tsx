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

  return (
    <span
      title={config.label}
      aria-label={`Vehicle: ${config.label}`}
      className={`inline-flex items-center gap-1.5 radius-pill border font-semibold ${config.bgClass} ${config.textClass} ${border} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      <Icon size={size === "sm" ? 12 : 14} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
