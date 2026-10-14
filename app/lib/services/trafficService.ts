import polyline from "@mapbox/polyline";
import { redis } from "@/app/lib/db/redis";
import {
  TRAFFIC_CONFIG,
  adjustDurationForLevels,
  hasTomtomKey,
  heuristicCongestion,
  levelForCongestion,
  type TrafficLevel,
  type TrafficProvider,
} from "@/app/lib/config/traffic";
import { hasMapboxKey, MAP_STACK_CONFIG } from "@/app/lib/config/mapStack";

export interface TrafficCoord {
  lat: number;
  lng: number;
}

export interface TrafficSegment {
  /** Inclusive chunk indices into the route coordinate list. */
  from: number;
  to: number;
  level: TrafficLevel;
}

export interface TrafficResult {
  segments: TrafficSegment[];
  provider: TrafficProvider;
  /** True when levels are modeled estimates, not live probes. */
  estimated: boolean;
  baseDurationMins: number;
  adjustedDurationMins: number;
}

const UPSTREAM_TIMEOUT_MS = 7000;
const MAX_CHUNKS = 12;

function headers(): Record<string, string> {
  return {
    "User-Agent": MAP_STACK_CONFIG.serverIdentity.userAgent,
    Referer: MAP_STACK_CONFIG.serverIdentity.referer,
    Accept: "application/json",
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) }, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function validCoords(coords: TrafficCoord[]): boolean {
  return (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    coords.every(
      (c) =>
        typeof c?.lat === "number" &&
        typeof c?.lng === "number" &&
        Number.isFinite(c.lat) &&
        Number.isFinite(c.lng) &&
        c.lat >= -90 &&
        c.lat <= 90 &&
        c.lng >= -180 &&
        c.lng <= 180
    )
  );
}

export function decodeRouteCoords(encoded: string): TrafficCoord[] {
  try {
    return polyline.decode(encoded).map(([lat, lng]) => ({ lat, lng }));
  } catch {
    return [];
  }
}

/** Split a coordinate list into ≤MAX_CHUNKS contiguous chunks. Pure. */
export function chunkCoords(coords: TrafficCoord[]): { from: number; to: number }[] {
  const n = coords.length;
  if (n < 2) return [];
  const chunks = Math.min(MAX_CHUNKS, n - 1);
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < chunks; i++) {
    const from = Math.floor((i * (n - 1)) / chunks);
    const to = Math.floor(((i + 1) * (n - 1)) / chunks);
    out.push({ from, to: Math.max(to, from + 1) });
  }
  return out;
}

export function trafficCacheKey(coords: TrafficCoord[]): string {
  const sig = coords
    .filter((_, i) => i % Math.max(1, Math.floor(coords.length / 20)) === 0)
    .map((c) => `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`)
    .join(">");
  // Hour bucket: heuristic estimates + live traffic both shift hourly.
  const hour = new Date().getHours();
  return `maps:traffic:${sig}:${hour}`;
}

function finish(
  coords: TrafficCoord[],
  levels: TrafficLevel[],
  provider: TrafficProvider,
  baseDurationMins: number
): TrafficResult {
  const chunks = chunkCoords(coords);
  const counts: Record<TrafficLevel, number> = { low: 0, moderate: 0, heavy: 0 };
  const segments: TrafficSegment[] = chunks.map((c, i) => {
    const level = levels[i] ?? "low";
    counts[level] += 1;
    return { ...c, level };
  });
  const base = Number.isFinite(baseDurationMins) && baseDurationMins > 0 ? Math.round(baseDurationMins) : 0;
  return {
    segments,
    provider,
    estimated: provider === "heuristic",
    baseDurationMins: base,
    adjustedDurationMins: base > 0 ? adjustDurationForLevels(base, counts, Math.max(chunks.length, 1)) : 0,
  };
}

function heuristicLevels(coords: TrafficCoord[], at: Date = new Date()): TrafficLevel[] {
  const chunks = chunkCoords(coords);
  return chunks.map((_, i) => levelForCongestion(heuristicCongestion(i, chunks.length, at)));
}

async function viaMapbox(coords: TrafficCoord[]): Promise<TrafficLevel[] | null> {
  const token =
    process.env.MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const limited = coords.slice(0, 25);
    const joined = limited.map((c) => `${c.lng},${c.lat}`).join(";");
    const url =
      `${MAP_STACK_CONFIG.upstreams.mapbox}/${joined}` +
      `?alternatives=false&geometries=polyline&overview=full&annotations=congestion_numeric,duration&access_token=${encodeURIComponent(token)}`;
    const data = (await fetchJson(url)) as {
      routes?: { legs?: { annotation?: { congestion_numeric?: number[] } }[] }[];
    } | null;
    const legs = data?.routes?.[0]?.legs;
    if (!Array.isArray(legs) || legs.length === 0) return null;
    const flat: number[] = [];
    for (const leg of legs) {
      const nums = leg?.annotation?.congestion_numeric;
      if (Array.isArray(nums)) for (const v of nums) if (typeof v === "number") flat.push(v);
    }
    if (flat.length === 0) return null;
    const chunks = chunkCoords(coords);
    return chunks.map((_, i) => {
      const slice = flat.slice(Math.floor((i * flat.length) / chunks.length), Math.floor(((i + 1) * flat.length) / chunks.length));
      const avg = slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
      return levelForCongestion(avg);
    });
  } catch {
    return null;
  }
}

async function viaTomtom(coords: TrafficCoord[]): Promise<TrafficLevel[] | null> {
  const key = process.env.TOMTOM_TRAFFIC_KEY;
  if (!key) return null;
  try {
    const chunks = chunkCoords(coords);
    // Sample each chunk midpoint (cap 5 upstream calls to bound cost/latency).
    const sampled = chunks.filter((_, i) => i % Math.max(1, Math.floor(chunks.length / 5)) === 0).slice(0, 5);
    const indexed = new Map<number, TrafficLevel>();
    await Promise.all(
      sampled.map(async (_, s) => {
        const chunkIdx = chunks.indexOf(sampled[s]);
        const mid = coords[Math.floor((sampled[s].from + sampled[s].to) / 2)];
        if (!mid) return;
        const url =
          `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
          `?key=${encodeURIComponent(key)}&point=${mid.lat},${mid.lng}`;
        const data = (await fetchJson(url)) as {
          flowSegmentData?: { currentSpeed?: number; freeFlowSpeed?: number };
        } | null;
        const cur = data?.flowSegmentData?.currentSpeed;
        const free = data?.flowSegmentData?.freeFlowSpeed;
        if (typeof cur === "number" && typeof free === "number" && free > 0) {
          indexed.set(chunkIdx, levelForCongestion((1 - cur / free) * 100));
        }
      })
    );
    if (indexed.size === 0) return null;
    // Unsampled chunks inherit the nearest sampled level (or free flow).
    return chunks.map((_, i) => {
      if (indexed.has(i)) return indexed.get(i) as TrafficLevel;
      let best = -1;
      let bestDist = Infinity;
      for (const k of indexed.keys()) {
        const d = Math.abs(k - i);
        if (d < bestDist) {
          bestDist = d;
          best = k;
        }
      }
      return best >= 0 ? (indexed.get(best) as TrafficLevel) : "low";
    });
  } catch {
    return null;
  }
}

/**
 * Keyless-first traffic for a route: Mapbox congestion (keyed) → TomTom
 * flow (keyed) → deterministic heuristic estimate (always). Redis
 * read-through on an hourly bucket; never throws — falls back to an
 * all-`low` heuristic shape so callers can always render.
 */
export async function getTrafficForRoute(
  coords: TrafficCoord[],
  baseDurationMins: number
): Promise<TrafficResult> {
  const safe = validCoords(coords) ? coords.slice(0, 200) : [];
  if (safe.length < 2) {
    return { segments: [], provider: "heuristic", estimated: true, baseDurationMins: 0, adjustedDurationMins: 0 };
  }
  const key = trafficCacheKey(safe);
  try {
    const cached = await redis.get<TrafficResult>(key);
    if (cached && Array.isArray(cached.segments)) return cached;
  } catch {
    // Best-effort cache.
  }
  let result: TrafficResult | null = null;
  for (const name of TRAFFIC_CONFIG.providerOrder) {
    if (name === "mapbox") {
      if (!hasMapboxKey()) continue;
      const levels = await viaMapbox(safe);
      if (levels) result = finish(safe, levels, "mapbox", baseDurationMins);
    } else if (name === "tomtom") {
      if (!hasTomtomKey()) continue;
      const levels = await viaTomtom(safe);
      if (levels) result = finish(safe, levels, "tomtom", baseDurationMins);
    } else {
      result = finish(safe, heuristicLevels(safe), "heuristic", baseDurationMins);
    }
    if (result) break;
  }
  const finalResult = result ?? finish(safe, heuristicLevels(safe), "heuristic", baseDurationMins);
  try {
    await redis.set(key, finalResult, { ex: TRAFFIC_CONFIG.cacheTtlSec });
  } catch {
    // Best-effort.
  }
  return finalResult;
}

export const trafficService = { getTrafficForRoute, decodeRouteCoords, chunkCoords, trafficCacheKey };
