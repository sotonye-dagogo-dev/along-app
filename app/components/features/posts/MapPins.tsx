"use client";

import { MAP_PINS_CONFIG, routePinLabel } from "@/app/lib/config/mapPins";

interface MapRoutePinProps {
  index: number;
  total: number;
  label?: string;
}

/**
 * Shared numbered route dot — small, anchor-centered, token-styled.
 * Rendered inside a react-map-gl `Marker` with `anchor="center"` + zero
 * offset so the dot sits exactly on its lngLat through pan/zoom. The
 * number is the 1-based stop index, matching the step list in the form.
 */
export function MapRoutePin({ index, total, label }: MapRoutePinProps) {
  const { routeDot } = MAP_PINS_CONFIG;
  const text = routePinLabel(index);
  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: routeDot.size, height: routeDot.size }}
      title={label ?? (total > 1 ? `Stop ${text} of ${total}` : `Stop ${text}`)}
      aria-label={label ?? `Stop ${text} of ${total}`}
      role="img"
    >
      <div
        className={`flex items-center justify-center rounded-full font-bold border-2 ${routeDot.dotClass}`}
        style={{ width: routeDot.size, height: routeDot.size, fontSize: routeDot.fontSize, lineHeight: 1 }}
      >
        {text}
      </div>
    </div>
  );
}

interface MapUserDotProps {
  accuracy?: number;
  heading?: number | null;
}

/**
 * Shared user-location dot — small info-blue core, white glory ring,
 * radar ping + accuracy halo, all from design tokens. Anchor-centered
 * like route pins so it tracks the GPS fix exactly.
 */
export function MapUserDot({ accuracy, heading }: MapUserDotProps) {
  const { userDot } = MAP_PINS_CONFIG;
  const showAccuracy = typeof accuracy === "number" && accuracy > 0 && accuracy < 1000;
  const haloSize = showAccuracy
    ? Math.min(64, Math.max(24, (accuracy as number) / 3))
    : 0;
  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: 32, height: 32 }}
      title="Your location"
      aria-label="Your location"
      role="img"
    >
      {showAccuracy && (
        <div
          className={`absolute rounded-full border ${userDot.accuracyClass}`}
          style={{ width: haloSize, height: haloSize }}
        />
      )}
      {heading !== null && heading !== undefined && (
        <div
          className="absolute w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "10px solid var(--color-info-text)",
            top: -2,
            transform: `rotate(${heading}deg)`,
            transformOrigin: "50% 16px",
          }}
        />
      )}
      <div
        className={`relative rounded-full border-2 ${userDot.coreClass} ${userDot.ringClass}`}
        style={{ width: userDot.coreSize, height: userDot.coreSize }}
      >
        <div className={`absolute inset-0 rounded-full animate-ping opacity-40 ${userDot.radarClass}`} />
      </div>
    </div>
  );
}
