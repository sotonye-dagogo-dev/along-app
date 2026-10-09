"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { memoryCache } from "@/app/lib/cache/memoryCache";
import { estimateRoute, traceSignature } from "@/app/lib/utils/geo";

export interface TracePin {
  lat: number;
  lng: number;
}

export interface RouteTrace {
  polyline: string;
  distance: number;
  duration: number;
}

const TRACE_CACHE_TTL = 600;
const TRACE_DEBOUNCE_MS = 800;

function isUsable(p: TracePin): boolean {
  return (
    typeof p?.lat === "number" &&
    typeof p?.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0)
  );
}

/**
 * Shared road-snapped trace hook — the same pipeline the share-preview
 * uses (instant client estimate + debounced `/api/routes/trace` with a
 * 10-min memory cache + silent straight-line fallback). Post views pass
 * their canonical pins; the hook returns the live trace (or null while
 * estimating/offline) plus display-ready distance/duration.
 *
 * Non-breaking: pure client hook, no API changes, safe to mount anywhere.
 */
export function useRouteTrace(pins: TracePin[] | null | undefined) {
  const validPins = useMemo(() => (Array.isArray(pins) ? pins.filter(isUsable) : []), [pins]);
  const sig = validPins.length >= 2 ? traceSignature(validPins) : "";
  const estimate = useMemo(
    () => estimateRoute(validPins.length >= 2 ? validPins : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig]
  );
  const [trace, setTrace] = useState<(RouteTrace & { sig: string }) | null>(null);
  const [tracing, setTracing] = useState(false);
  const disabledRef = useRef(false);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!sig) {
      setTrace(null);
      setTracing(false);
      return;
    }
    const cached = memoryCache.get<RouteTrace>(`route-trace:${sig}`);
    if (cached) {
      setTrace({ ...cached, sig });
      setTracing(false);
      return;
    }
    if (disabledRef.current) return;
    const seq = ++seqRef.current;
    setTracing(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/routes/trace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pins: validPins }),
        });
        if (res.status === 429) {
          disabledRef.current = true;
          return;
        }
        if (!res.ok) throw new Error("trace failed");
        const data = (await res.json()) as { polyline?: string; distance?: number; duration?: number };
        if (seq !== seqRef.current || !data.polyline) return;
        const entry: RouteTrace = {
          polyline: data.polyline,
          distance: typeof data.distance === "number" ? data.distance : estimate.distanceKm,
          duration: typeof data.duration === "number" ? data.duration : estimate.durationMins,
        };
        memoryCache.set(`route-trace:${sig}`, entry, TRACE_CACHE_TTL);
        setTrace({ ...entry, sig });
      } catch {
        // silent — estimate stays on screen
      } finally {
        if (seq === seqRef.current) setTracing(false);
      }
    }, TRACE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const liveTrace = trace && trace.sig === sig ? trace : null;
  return {
    liveTrace,
    tracing,
    displayDistance: liveTrace ? liveTrace.distance : estimate.distanceKm,
    displayDuration: liveTrace ? liveTrace.duration : estimate.durationMins,
  };
}
