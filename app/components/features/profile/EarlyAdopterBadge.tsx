'use client';

import React from "react";
import { Sparkles } from "lucide-react";
import {
  EARLY_ADOPTER_BADGE_DISPLAY,
  buildEarlyAdopterTooltip,
} from "@/app/lib/config/earlyAdopter";

interface EarlyAdopterBadgeProps {
  rank: number;
  limit: number;
  label: string;
  className?: string;
}

/**
 * "First N Users #n" profile badge. Purely presentational — visibility is
 * decided server-side (EarlyAdopterStatus) and the caller renders nothing
 * when the badge is disabled or the user doesn't qualify.
 */
export function EarlyAdopterBadge({ rank, limit, label, className }: EarlyAdopterBadgeProps) {
  const tooltip = buildEarlyAdopterTooltip(limit, rank);
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${className ?? ""}`}
      style={{
        background: EARLY_ADOPTER_BADGE_DISPLAY.background,
        border: EARLY_ADOPTER_BADGE_DISPLAY.border,
        color: EARLY_ADOPTER_BADGE_DISPLAY.color,
      }}
    >
      <Sparkles size={12} aria-hidden />
      {label}
    </span>
  );
}

interface EarlyAdopterBadgeFromStatusProps {
  earlyAdopter?: {
    enabled: boolean;
    limit: number;
    rank: number | null;
    isEarlyAdopter: boolean;
    label: string | null;
  } | null;
  className?: string;
}

/** Convenience wrapper for the `earlyAdopter` payload on user APIs. */
export function EarlyAdopterBadgeFromStatus({
  earlyAdopter,
  className,
}: EarlyAdopterBadgeFromStatusProps) {
  if (!earlyAdopter?.enabled || !earlyAdopter.isEarlyAdopter || !earlyAdopter.label || earlyAdopter.rank === null) {
    return null;
  }
  return (
    <EarlyAdopterBadge
      rank={earlyAdopter.rank}
      limit={earlyAdopter.limit}
      label={earlyAdopter.label}
      className={className}
    />
  );
}
