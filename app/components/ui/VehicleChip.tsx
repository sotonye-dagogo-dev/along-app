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
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 radius-pill ${config.bgClass} ${config.textClass} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      <Icon size={size === "sm" ? 12 : 14} />
      <span>{config.label}</span>
    </span>
  );
}
