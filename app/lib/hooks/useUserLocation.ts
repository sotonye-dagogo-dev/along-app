"use client";

import { useEffect, useState } from "react";
import { MAP_PINS_CONFIG } from "@/app/lib/config/mapPins";

export interface UserFix {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
}

interface UseUserLocationOptions {
  /** Skip all geolocation work when false (default true). */
  enabled?: boolean;
  /** Keep a watchPosition subscription so the fix tracks movement (default true). */
  watch?: boolean;
}

/**
 * Shared passive user-location hook (config-driven, reusable).
 * Requests a one-shot fix on mount (no view jump — callers decide whether
 * to centre) and keeps a watchPosition subscription so the user dot tracks
 * movement. Denials/unavailability resolve to null and fail softly; callers
 * surface feedback on explicit "locate me" actions instead.
 */
export function useUserLocation({ enabled = true, watch = true }: UseUserLocationOptions = {}): UserFix | null {
  const [fix, setFix] = useState<UserFix | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const { enableHighAccuracy, timeoutMs, maximumAgeMs, watchMaximumAgeMs } = MAP_PINS_CONFIG.tracking;
    let cancelled = false;
    let watchId: number | null = null;
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setFix({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
          });
        },
        () => { /* silent — explicit locate buttons explain on demand */ },
        { enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs }
      );
      if (watch) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (cancelled) return;
            setFix({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
            });
          },
          () => { /* keep last known fix */ },
          { enableHighAccuracy, timeout: timeoutMs, maximumAge: watchMaximumAgeMs }
        );
      }
    } catch { /* geolocation unavailable */ }
    return () => {
      cancelled = true;
      try {
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
      } catch { /* ignore */ }
    };
  }, [enabled, watch]);

  return fix;
}
