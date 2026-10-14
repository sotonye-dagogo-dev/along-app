"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { memoryCache } from "@/app/lib/cache/memoryCache";
import type { TrafficResult } from "@/app/lib/services/trafficService";

export interface TrafficPin {
  lat: number;
  lng: number;
}

const TRAFFIC_CACHE_TTL = 120;
const TRAFFIC_DEBOUNCE_MS = 900;

function sigFor(pins: TrafficPin[]): string {
  return pins.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(">");
}

/**
 * Shared traffic hook — debounced `POST /api/maps/traffic` with a short
 * memory cache + silent null fallback (the route renders untrafficked when
 * offline, rate-limited, or failed). Callers pass canonical route coords +
 * the base duration; the hook returns per-chunk levels and the adjusted
 * duration. Non-breaking: pure client hook, safe to mount anywhere.
 */
export function useRouteTraffic(
  coords: TrafficPin[] | null | undefined,
  baseDurationMins?: number | null
) {
  const valid = useMemo(
    () =>
      (Array.isArray(coords) ? coords : []).filter(
        (c) =>
          typeof c?.lat === "number" &&
          typeof c?.lng === "number" &&
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lng) &&
          !(c.lat === 0 && c.lng === 0)
      ),
    [coords]
  );
  const sig = valid.length >= 2 ? sigFor(valid) : "";
  const base = typeof baseDurationMins === "number" && Number.isFinite(baseDurationMins) ? Math.round(baseDurationMins) : 0;
  const [traffic, setTraffic] = useState<TrafficResult | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!sig) {
      setTraffic(null);
      return;
    }
    const cacheKey = `route-traffic:${sig}:${base}`;
    const cached = memoryCache.get<TrafficResult>(cacheKey);
    if (cached) {
      setTraffic(cached);
      return;
    }
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/maps/traffic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coords: valid, baseDurationMins: base }),
        });
        if (!res.ok) return; // silent — untrafficked line stays
        const data = (await res.json()) as TrafficResult;
        if (seq !== seqRef.current || !Array.isArray(data?.segments)) return;
        memoryCache.set(cacheKey, data, TRAFFIC_CACHE_TTL);
        setTraffic(data);
      } catch {
        // silent — offline/failed keeps the base route
      }
    }, TRAFFIC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, base]);

  return { traffic };
}
