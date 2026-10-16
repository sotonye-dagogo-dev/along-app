"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { memoryCache } from "@/app/lib/cache/memoryCache";
import { TRAFFIC_CONFIG, rebaseTrafficResult, trafficClientKey } from "@/app/lib/config/traffic";
import { adjustDurationForVehicleAndTraffic } from "@/app/lib/config/journeyTime";
import { adjustDurationForLevels } from "@/app/lib/config/traffic";
import type { TrafficResult } from "@/app/lib/services/trafficService";

export interface TrafficPin {
  lat: number;
  lng: number;
}

function sigFor(pins: TrafficPin[]): string {
  return pins.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(">");
}

interface StoredTraffic {
  value: TrafficResult;
  expiresAt: number;
}

function readPersistent(key: string): StoredTraffic | null {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTraffic;
    if (!parsed || typeof parsed.expiresAt !== "number" || !parsed.value) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistent(key: string, value: TrafficResult, ttlSec: number): void {
  try {
    if (typeof window === "undefined" || !("localStorage" in window)) return;
    const payload: StoredTraffic = { value, expiresAt: Date.now() + ttlSec * 1000 };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota/private-mode — memory cache still covers the session.
  }
}

/**
 * Shared traffic hook — debounced `POST /api/maps/traffic` with a layered
 * cache + silent fallback (the route renders untrafficked when offline,
 * rate-limited, or failed).
 *
 * Caching strategy (config-driven via TRAFFIC_CONFIG):
 * - memory (per-session, `clientCacheTtlSec`) + localStorage (survives
 *   remounts/back-nav, same TTL) serve instant hits — revisiting the same map
 *   seconds later renders traffic immediately instead of flashing the bare
 *   line while the refetch flies (the reported bug).
 * - stale-while-revalidate: results up to `clientStaleSec` old still render
 *   while a background refresh runs, so flaky networks keep the last good
 *   overlay instead of dropping it.
 * - `refreshIntervalSec` revalidates while mounted so traffic stays somewhat
 *   live without hammering the rate-limited proxy (hourly server bucket +
 *   this cadence bound upstream cost).
 * - geometry-scoped cache key (pins + vehicle, NOT the base duration): the
 *   segment levels are reusable and `rebaseTrafficResult` rescales minutes
 *   when the base settles (pins estimate → road-snapped trace), so a base
 *   change never triggers a redundant lookup.
 *
 * Persistence contract: the last good result is KEPT across geometry swaps
 * and across mount cycles, remapped proportionally by the renderer.
 */
export function useRouteTraffic(
  coords: TrafficPin[] | null | undefined,
  baseDurationMins?: number | null,
  vehicle?: string | null
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
  const mode = typeof vehicle === "string" && vehicle.trim().length > 0 ? vehicle.trim().toLowerCase() : "";
  const [traffic, setTraffic] = useState<TrafficResult | null>(null);
  const seqRef = useRef(0);

  // Re-base cached levels onto the current base without refetching.
  const rebase = (result: TrafficResult | null): TrafficResult | null => {
    if (!result || base <= 0) return result;
    if (result.baseDurationMins === base) return result;
    try {
      if (mode) {
        return rebaseTrafficResult(result, base, (b, counts, total) =>
          adjustDurationForVehicleAndTraffic(b, counts, total, mode)
        );
      }
      return rebaseTrafficResult(result, base, (b, counts, total) =>
        adjustDurationForLevels(b, counts, total)
      );
    } catch {
      return result;
    }
  };

  useEffect(() => {
    if (!sig) {
      setTraffic(null);
      return;
    }
    const cacheKey = trafficClientKey(sig, mode || "auto");
    const ttl = TRAFFIC_CONFIG.clientCacheTtlSec;
    const staleWindow = TRAFFIC_CONFIG.clientCacheTtlSec + TRAFFIC_CONFIG.clientStaleSec;
    const now = Date.now();

    // 1. Instant paths: memory, then persisted. Stale entries still render
    //    while a background refresh runs (stale-while-revalidate).
    const mem = memoryCache.get<TrafficResult>(cacheKey);
    let staleEntry: TrafficResult | null = null;
    if (mem && Array.isArray(mem.segments)) {
      setTraffic(rebase(mem));
      return;
    }
    const stored = readPersistent(cacheKey);
    if (stored && Array.isArray(stored.value?.segments)) {
      const ageSec = (now - (stored.expiresAt - ttl * 1000)) / 1000;
      if (ageSec <= ttl) {
        memoryCache.set(cacheKey, stored.value, ttl);
        setTraffic(rebase(stored.value));
        return;
      }
      if (ageSec <= staleWindow) {
        staleEntry = stored.value;
        setTraffic(rebase(stored.value));
      }
    }
    // NOTE: a previous good result for another geometry is intentionally KEPT
    // while the refetch for the new geometry is in flight — the map remaps
    // the old chunks proportionally so colors persist instead of flashing off.

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchOnce = async (isBackground: boolean) => {
      const seq = ++seqRef.current;
      try {
        const res = await fetch("/api/maps/traffic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coords: valid,
            baseDurationMins: base,
            ...(mode ? { vehicle: mode } : {}),
          }),
        });
        if (!res.ok) return; // silent — last good stays on screen
        const data = (await res.json()) as TrafficResult;
        if (cancelled || seq !== seqRef.current || !Array.isArray(data?.segments)) return;
        memoryCache.set(cacheKey, data, ttl);
        writePersistent(cacheKey, data, ttl);
        setTraffic(data);
      } catch {
        // silent — offline/failed keeps the base route (+ stale overlay).
        if (!isBackground && staleEntry) setTraffic(rebase(staleEntry));
      }
    };

    const timer = setTimeout(() => void fetchOnce(false), TRAFFIC_CONFIG.debounceMs);
    // Somewhat-live refresh while mounted (bounded by the server hourly
    // bucket + maps rate-limit bucket upstream).
    if (TRAFFIC_CONFIG.refreshIntervalSec > 0) {
      interval = setInterval(() => void fetchOnce(true), TRAFFIC_CONFIG.refreshIntervalSec * 1000);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, mode]);

  // Base-only changes re-derive minutes locally — no network.
  useEffect(() => {
    setTraffic((prev) => {
      if (!prev || base <= 0 || prev.baseDurationMins === base) return prev;
      return rebase(prev) ?? prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, mode]);

  return { traffic };
}
