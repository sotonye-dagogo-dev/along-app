import polyline from "@mapbox/polyline";
import { redis } from "@/app/lib/db/redis";
import {
  MAP_STACK_CONFIG,
  LANDMARK_GEOCODE_CONFIG,
  hasMapboxKey,
  hasOrsKey,
  type MapGeocodeProvider,
  type MapRoutingProvider,
} from "@/app/lib/config/mapStack";

/**
 * Server-side map proxy (Sprint 19 keyless stack).
 *
 * Owns ALL upstream map calls so the browser never touches Nominatim,
 * OSRM, ORS or Mapbox directly:
 * - Routing: OSRM demo (keyless, ~1 req/s policy — Redis cache absorbs
 *   repeat traces) → env-gated ORS → env-gated Mapbox → straight-line.
 * - Forward geocode: Nominatim (server UA/Referer, addressdetails+dedupe so
 *   landmarks/buildings/addresses resolve with full labels) + Photon
 *   (street-level labels) + keyless Open-Meteo (populated places only) +
 *   keyless Overpass OSM `name` fallback (landmarks/buildings/addresses that
 *   the index providers miss) merged + deduped, optionally re-ranked near
 *   the viewer.
 * - Reverse geocode: Nominatim reverse → Photon reverse fallback.
 *
 * Every method is never-throw: upstream failures degrade to the next
 * provider, and routing always resolves to at least a straight-line
 * trace. Keyed providers are never attempted without their env keys.
 */

export interface MapPin {
  lat: number;
  lng: number;
}

export interface MapTraceResult {
  polyline: string;
  distance: number;
  duration: number;
  provider: string;
}

/** Client-compatible geocode hit (matches old Nominatim shape). */
export interface MapGeocodeHit {
  display_name: string;
  lat: string;
  lon: string;
  provider: string;
}

const UPSTREAM_TIMEOUT_MS = 8000;

function upstreamHeaders(): Record<string, string> {
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
    const res = await fetch(url, {
      ...init,
      headers: { ...upstreamHeaders(), ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function validPins(pins: MapPin[]): boolean {
  if (!Array.isArray(pins) || pins.length < 2) return false;
  return pins.every(
    (p) =>
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      !isNaN(p.lat) &&
      !isNaN(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180
  );
}

function haversineKm(a: MapPin, b: MapPin): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function approximateDistanceKm(pins: MapPin[]): number {
  let total = 0;
  for (let i = 1; i < pins.length; i++) total += haversineKm(pins[i - 1], pins[i]);
  return Math.round(total * 10) / 10;
}

/** Straight-line fallback — always available, never throws. */
export function straightLineTrace(pins: MapPin[]): MapTraceResult {
  const distance = approximateDistanceKm(pins);
  const encoded = polyline.encode(pins.map((p) => [p.lat, p.lng]));
  return { polyline: encoded, distance, duration: Math.round(distance * 15), provider: "straight" };
}

export function routeCacheKey(pins: MapPin[]): string {
  const sig = pins.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join(">");
  return `maps:route:${sig}`;
}

export function geocodeCacheKey(query: string, limit: number, near?: MapPin | null): string {
  const base = `maps:geocode:${query.trim().toLowerCase().slice(0, 120)}:${limit}`;
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    return `${base}:${near.lat.toFixed(2)},${near.lng.toFixed(2)}`;
  }
  return base;
}

export function reverseCacheKey(lat: number, lng: number): string {
  return `maps:reverse:${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function traceViaOsrm(pins: MapPin[]): Promise<MapTraceResult | null> {
  try {
    const limited = pins.slice(0, 25);
    const coords = limited.map((p) => `${p.lng},${p.lat}`).join(";");
    const url =
      `${MAP_STACK_CONFIG.upstreams.osrm}/${coords}` +
      `?overview=full&geometries=geojson&steps=false`;
    const data = (await fetchJson(url)) as {
      routes?: { geometry?: { coordinates?: number[][] }; distance?: number; duration?: number }[];
    } | null;
    const route = data?.routes?.[0];
    const coordsGeo = route?.geometry?.coordinates;
    if (!route || !Array.isArray(coordsGeo) || coordsGeo.length < 2) return null;
    // GeoJSON is [lng,lat] — polyline.encode wants [lat,lng].
    const encoded = polyline.encode(coordsGeo.map(([lng, lat]) => [lat, lng]));
    const distance =
      typeof route.distance === "number" ? Math.round((route.distance / 1000) * 10) / 10 : approximateDistanceKm(limited);
    const duration =
      typeof route.duration === "number" ? Math.round(route.duration / 60) : Math.round(distance * 2);
    return { polyline: encoded, distance, duration, provider: "osrm" };
  } catch {
    return null;
  }
}

async function traceViaOrs(pins: MapPin[]): Promise<MapTraceResult | null> {
  const key = process.env.OPEN_ROUTE_SERVICE_KEY;
  if (!key) return null;
  try {
    const data = (await fetchJson(MAP_STACK_CONFIG.upstreams.ors, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: key },
      body: JSON.stringify({ coordinates: pins.map((p) => [p.lng, p.lat]), format: "json" }),
    })) as {
      routes?: { geometry?: { coordinates?: number[][] }; summary?: { distance?: number; duration?: number } }[];
    } | null;
    const route = data?.routes?.[0];
    if (!route) return null;
    const raw = route.geometry?.coordinates ?? [];
    const encoded =
      raw.length >= 2
        ? polyline.encode(raw.map(([lng, lat]) => [lat, lng]))
        : polyline.encode(pins.map((p) => [p.lat, p.lng]));
    const distance =
      typeof route.summary?.distance === "number"
        ? Math.round((route.summary.distance / 1000) * 10) / 10
        : approximateDistanceKm(pins);
    const duration =
      typeof route.summary?.duration === "number"
        ? Math.round(route.summary.duration / 60)
        : Math.round(distance * 15);
    return { polyline: encoded, distance, duration, provider: "ors" };
  } catch {
    return null;
  }
}

async function traceViaMapbox(pins: MapPin[]): Promise<MapTraceResult | null> {
  const token =
    process.env.MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const limited = pins.slice(0, 25);
    const coords = limited.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `${MAP_STACK_CONFIG.upstreams.mapbox}/${coords}?alternatives=false&geometries=polyline&overview=full&access_token=${encodeURIComponent(token)}`;
    const data = (await fetchJson(url)) as {
      routes?: { geometry?: string; distance?: number; duration?: number }[];
    } | null;
    const route = data?.routes?.[0];
    if (!route) return null;
    const encoded: string = route.geometry ?? polyline.encode(limited.map((p) => [p.lat, p.lng]));
    const distance =
      typeof route.distance === "number" ? Math.round((route.distance / 1000) * 10) / 10 : approximateDistanceKm(limited);
    const duration = typeof route.duration === "number" ? Math.round(route.duration / 60) : Math.round(distance * 2);
    return { polyline: encoded, distance, duration, provider: "mapbox" };
  } catch {
    return null;
  }
}

/**
 * Keyless-first route trace with Redis read-through. Provider order comes
 * from MAP_STACK_CONFIG.routingOrder; keyed providers are skipped when
 * their env keys are absent. Never throws — falls back to straight-line.
 */
export async function traceRoute(pins: MapPin[]): Promise<MapTraceResult> {
  if (!validPins(pins)) return straightLineTrace(Array.isArray(pins) && pins.length >= 2 ? pins : [{ lat: 0, lng: 0 }, { lat: 0, lng: 0 }]);
  const key = routeCacheKey(pins);
  try {
    const cached = await redis.get<MapTraceResult>(key);
    if (cached && typeof cached.polyline === "string") return cached;
  } catch {
    // Cache is best-effort — fall through to upstream.
  }
  let result: MapTraceResult | null = null;
  let provider: MapRoutingProvider | null = null;
  for (const name of MAP_STACK_CONFIG.routingOrder) {
    if (name === "osrm") {
      provider = name;
      result = await traceViaOsrm(pins);
    } else if (name === "ors") {
      if (!hasOrsKey()) continue;
      provider = name;
      result = await traceViaOrs(pins);
    } else if (name === "mapbox") {
      if (!hasMapboxKey()) continue;
      provider = name;
      result = await traceViaMapbox(pins);
    } else {
      provider = name;
      result = straightLineTrace(pins);
    }
    if (result) break;
  }
  const finalResult = result ?? { ...straightLineTrace(pins), provider: provider ?? "straight" };
  try {
    await redis.set(key, finalResult, { ex: MAP_STACK_CONFIG.cacheTtlSec.route });
  } catch {
    // Best-effort cache write.
  }
  return finalResult;
}

interface NominatimHit {
  display_name?: string;
  lat?: string;
  lon?: string;
}

interface PhotonFeature {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  geometry?: { coordinates?: number[] };
}

function photonLabel(f: PhotonFeature): string | null {
  const p = f.properties;
  if (!p?.name) return null;
  // Street-level granularity: Photon splits addresses into parts — render
  // them so house numbers / streets / districts survive in suggestions
  // (previously only name/city/state/country, which dropped addresses).
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const rest = [street, p.district, p.locality, p.city, p.county, p.state, p.postcode, p.country].filter(
    (s): s is string => typeof s === "string" && s.length > 0 && s !== p.name
  ).join(", ");
  return rest ? `${p.name}, ${rest}` : p.name;
}

async function geocodeViaNominatim(query: string, limit: number): Promise<MapGeocodeHit[] | null> {
  const url =
    `${MAP_STACK_CONFIG.upstreams.nominatim}/search?format=json` +
    `&q=${encodeURIComponent(query)}&limit=${limit}&accept-language=en&addressdetails=1&dedupe=1`;
  const data = (await fetchJson(url)) as NominatimHit[] | null;
  if (!Array.isArray(data) || data.length === 0) return null;
  const hits = data
    .filter((h) => typeof h.display_name === "string" && typeof h.lat === "string" && typeof h.lon === "string")
    .map((h) => ({ display_name: h.display_name as string, lat: h.lat as string, lon: h.lon as string, provider: "nominatim" as const }));
  return hits.length > 0 ? hits : null;
}

async function geocodeViaPhoton(query: string, limit: number): Promise<MapGeocodeHit[] | null> {
  const url =
    `${MAP_STACK_CONFIG.upstreams.photon}/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`;
  const data = (await fetchJson(url)) as { features?: PhotonFeature[] } | null;
  const features = data?.features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const hits: MapGeocodeHit[] = [];
  for (const f of features) {
    const label = photonLabel(f);
    const coords = f.geometry?.coordinates;
    if (!label || !Array.isArray(coords) || coords.length < 2) continue;
    hits.push({ display_name: label, lat: String(coords[1]), lon: String(coords[0]), provider: "photon" });
  }
  return hits.length > 0 ? hits : null;
}

interface OpenMeteoHit {
  name?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  latitude?: number;
  longitude?: number;
}

function openMeteoLabel(h: OpenMeteoHit): string | null {
  if (typeof h.name !== "string" || h.name.length === 0) return null;
  const rest = [h.admin2, h.admin1, h.country].filter(
    (s): s is string => typeof s === "string" && s.length > 0 && s !== h.name
  ).join(", ");
  return rest ? `${h.name}, ${rest}` : h.name;
}

/**
 * Keyless Open-Meteo geocoder (no key, no registration, generous free tier).
 * Same canonical MapGeocodeHit shape as the other providers so callers never
 * branch on provider — parsing differences stay under the hood.
 */
async function geocodeViaOpenMeteo(query: string, limit: number): Promise<MapGeocodeHit[] | null> {
  const url =
    `${MAP_STACK_CONFIG.upstreams.openmeteo}/search?name=${encodeURIComponent(query)}` +
    `&count=${limit}&language=en&format=json`;
  const data = (await fetchJson(url)) as { results?: OpenMeteoHit[] } | null;
  const results = data?.results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const hits: MapGeocodeHit[] = [];
  for (const h of results) {
    const label = openMeteoLabel(h);
    if (!label || typeof h.latitude !== "number" || typeof h.longitude !== "number") continue;
    if (!Number.isFinite(h.latitude) || !Number.isFinite(h.longitude)) continue;
    hits.push({ display_name: label, lat: String(h.latitude), lon: String(h.longitude), provider: "openmeteo" });
  }
  return hits.length > 0 ? hits : null;
}

interface OverpassTags {
  name?: string;
  ["addr:housenumber"]?: string;
  ["addr:street"]?: string;
  ["addr:suburb"]?: string;
  ["addr:city"]?: string;
  ["addr:state"]?: string;
  ["addr:country"]?: string;
  amenity?: string;
  building?: string;
  shop?: string;
  tourism?: string;
}

interface OverpassElement {
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: OverpassTags;
}

function overpassLabel(tags: OverpassTags): string | null {
  const name = typeof tags.name === "string" ? tags.name.trim() : "";
  if (!name) return null;
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(
    (s): s is string => typeof s === "string" && s.length > 0
  ).join(" ");
  const kind = tags.amenity ?? tags.shop ?? tags.tourism ?? (typeof tags.building === "string" ? "building" : "");
  const rest = [street, tags["addr:suburb"], tags["addr:city"], tags["addr:state"], tags["addr:country"]]
    .filter((s): s is string => typeof s === "string" && s.length > 0 && s !== name)
    .join(", ");
  const suffix = rest ? `, ${rest}` : "";
  const kindSuffix = kind && !name.toLowerCase().includes(String(kind).toLowerCase()) ? ` (${kind})` : "";
  return `${name}${suffix}${kindSuffix}`.slice(0, 220);
}

function escapeOverpassRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80);
}

/**
 * Keyless Overpass landmark/building/address fallback (no key, no
 * registration). Queries OSM nodes/ways/relations whose `name` matches —
 * exactly the landmark/building class Open-Meteo can never answer and the
 * index providers sometimes miss. Last-resort only: gated by
 * LANDMARK_GEOCODE_CONFIG.minQueryLength, capped element count, shared 8s
 * fetch guard. Never throws — any failure resolves to null so the merge
 * keeps the already-collected hits.
 */
async function geocodeViaOverpass(query: string, limit: number): Promise<MapGeocodeHit[] | null> {
  const q = query.trim().slice(0, 80);
  if (q.length < LANDMARK_GEOCODE_CONFIG.overpassMinQueryLength) return null;
  const safe = escapeOverpassRegex(q);
  if (!safe) return null;
  const cap = Math.min(Math.max(limit, 1), LANDMARK_GEOCODE_CONFIG.overpassMaxElements);
  const timeout = LANDMARK_GEOCODE_CONFIG.overpassTimeoutSec;
  const ql = `[out:json][timeout:${timeout}];(nwr["name"~"${safe}",i];);out center ${cap};`;
  let data: { elements?: OverpassElement[] } | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(`${MAP_STACK_CONFIG.upstreams.overpass}/interpreter`, {
        method: "POST",
        headers: {
          "User-Agent": MAP_STACK_CONFIG.serverIdentity.userAgent,
          Referer: MAP_STACK_CONFIG.serverIdentity.referer,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: `data=${encodeURIComponent(ql)}`,
        signal: controller.signal,
      });
      if (!res.ok) return null;
      data = (await res.json()) as { elements?: OverpassElement[] };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
  const elements = data?.elements;
  if (!Array.isArray(elements) || elements.length === 0) return null;
  const hits: MapGeocodeHit[] = [];
  for (const el of elements.slice(0, cap)) {
    try {
      const tags = el.tags;
      if (!tags) continue;
      const label = overpassLabel(tags);
      const lat = typeof el.lat === "number" ? el.lat : el.center?.lat;
      const lon = typeof el.lon === "number" ? el.lon : el.center?.lon;
      if (!label || typeof lat !== "number" || typeof lon !== "number") continue;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      hits.push({ display_name: label, lat: String(lat), lon: String(lon), provider: "overpass" });
    } catch {
      continue;
    }
  }
  return hits.length > 0 ? hits : null;
}

/** Dedup key: normalized label + coords rounded to ~100m (same place, all providers). */
export function geocodeDedupKey(hit: MapGeocodeHit): string {
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  const coords =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(3)},${lon.toFixed(3)}`
      : `${hit.lat},${hit.lon}`;
  return `${hit.display_name.trim().toLowerCase()}|${coords}`;
}

/** Distance re-rank: when the viewer shared a position, nearer hits sort first. Never filters. */
export function rankGeocodeHits(hits: MapGeocodeHit[], near?: MapPin | null): MapGeocodeHit[] {
  if (!near || !Number.isFinite(near.lat) || !Number.isFinite(near.lng)) return hits;
  const origin: MapPin = near;
  return [...hits].sort((a, b) => {
    const da = haversineKm(origin, { lat: Number(a.lat), lng: Number(a.lon) });
    const db = haversineKm(origin, { lat: Number(b.lat), lng: Number(b.lon) });
    const sa = Number.isFinite(da) ? da : Number.MAX_SAFE_INTEGER;
    const sb = Number.isFinite(db) ? db : Number.MAX_SAFE_INTEGER;
    return sa - sb;
  });
}

/**
 * Forward geocode via server proxy — ALL keyless providers fire (in
 * geocodeOrder) and hits merge + dedupe into one suggestion list, so a place
 * buried in one source still surfaces from another. Optionally re-ranked near
 * the viewer's position when `near` is supplied (nearby first, never
 * filtered). Never throws.
 */
export async function geocodeForward(query: string, limit = 5, near?: MapPin | null): Promise<MapGeocodeHit[]> {
  const q = query.trim().slice(0, 200);
  if (q.length < 2) return [];
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const key = geocodeCacheKey(q, safeLimit, near);
  try {
    const cached = await redis.get<MapGeocodeHit[]>(key);
    if (Array.isArray(cached)) return cached;
  } catch {
    // Best-effort.
  }
  const merged: MapGeocodeHit[] = [];
  const seen = new Set<string>();
  const pushAll = (hits: MapGeocodeHit[] | null) => {
    if (!hits) return;
    for (const h of hits) {
      if (typeof h.display_name !== "string" || h.display_name.length === 0) continue;
      const k = geocodeDedupKey(h);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(h);
    }
  };
  // Round-robin one batch per provider (bounded fan-out, same timeout discipline).
  // Overpass runs last and self-gates on query length; unknown future
  // providers fall through safely (no branch = no crash, no missed merge).
  for (const name of MAP_STACK_CONFIG.geocodeOrder) {
    const attempt: MapGeocodeProvider = name;
    if (attempt === "nominatim") pushAll(await geocodeViaNominatim(q, safeLimit));
    else if (attempt === "photon") pushAll(await geocodeViaPhoton(q, safeLimit));
    else if (attempt === "openmeteo") pushAll(await geocodeViaOpenMeteo(q, safeLimit));
    else if (attempt === "overpass") pushAll(await geocodeViaOverpass(q, safeLimit));
    else pushAll(await geocodeViaOpenMeteo(q, safeLimit));
    if (merged.length >= safeLimit * MAP_STACK_CONFIG.geocodeOrder.length) break;
  }
  const finalHits = rankGeocodeHits(merged, near).slice(0, safeLimit);
  try {
    await redis.set(key, finalHits, { ex: MAP_STACK_CONFIG.cacheTtlSec.geocode });
  } catch {
    // Best-effort.
  }
  return finalHits;
}

/** Reverse geocode via server proxy. Returns a label or null. Never throws. */
export async function geocodeReverse(lat: number, lng: number): Promise<string | null> {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) return null;
  const key = reverseCacheKey(lat, lng);
  try {
    const cached = await redis.get<string>(key);
    if (typeof cached === "string" && cached.length > 0) return cached;
  } catch {
    // Best-effort.
  }
  // Nominatim reverse (server-side identity headers).
  const nomUrl =
    `${MAP_STACK_CONFIG.upstreams.nominatim}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=en`;
  const nom = (await fetchJson(nomUrl)) as { display_name?: string } | null;
  let label: string | null = typeof nom?.display_name === "string" ? nom.display_name : null;
  // Photon reverse fallback.
  if (!label) {
    const photon = (await fetchJson(
      `${MAP_STACK_CONFIG.upstreams.photon}/reverse?lat=${lat}&lon=${lng}&lang=en`
    )) as { features?: PhotonFeature[] } | null;
    const first = photon?.features?.[0];
    label = first ? photonLabel(first) : null;
  }
  if (label) {
    try {
      await redis.set(key, label, { ex: MAP_STACK_CONFIG.cacheTtlSec.reverse });
    } catch {
      // Best-effort.
    }
  }
  return label;
}

export const mapProxyService = {
  traceRoute,
  geocodeForward,
  geocodeReverse,
  straightLineTrace,
  routeCacheKey,
  geocodeCacheKey,
  reverseCacheKey,
  geocodeDedupKey,
  rankGeocodeHits,
};
