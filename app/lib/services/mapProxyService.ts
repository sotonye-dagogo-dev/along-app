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
import {
  LOCATION_SUGGESTIONS_CONFIG,
  parseCoordinateQuery,
  parsePlusCodeQuery,
  reorderQueryTokens,
  stripLeadingHouseNumber,
} from "@/app/lib/config/locationSuggestions";

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
 * Latency contract (broad-suggestion fix): the fast providers fire in
 * PARALLEL inside LOCATION_SUGGESTIONS_CONFIG.providerTimeoutMs each, so a
 * slow upstream can never starve suggestions past the serverless budget
 * (the old sequential fan-out blanked every broad query). Overpass runs
 * ONLY as a last-resort fallback when the fast merge is empty, and a
 * token-reorder retry covers reversed input order — both in ONE fallback
 * batch, so worst case stays ~2 budgets.
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

/**
 * Races an upstream leg against a config budget — slow providers resolve
 * null instead of stalling the merge. Never throws; timer always cleared.
 */
function bounded<T>(fn: () => Promise<T | null>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, Math.max(50, ms));
    fn().then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      }
    );
  });
}

async function geocodeViaNominatim(
  query: string,
  limit: number,
  near?: MapPin | null
): Promise<MapGeocodeHit[] | null> {
  // Deliberately broad: no featuretype/country filter, so one query class
  // covers addresses, streets, cities, postal codes, states and countries.
  let url =
    `${MAP_STACK_CONFIG.upstreams.nominatim}/search?format=json` +
    `&q=${encodeURIComponent(query)}&limit=${limit}&accept-language=en&addressdetails=1&dedupe=1`;
  // Upstream location bias (rank-only: bounded=0 never filters, the server
  // re-rank stays the final word). Passes the granted-only viewer position
  // so nearby streets/towns surface before far same-name matches.
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    const d = 0.75;
    url += `&viewbox=${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}&bounded=0`;
  }
  const data = (await fetchJson(url)) as NominatimHit[] | null;
  if (!Array.isArray(data) || data.length === 0) return null;
  const hits = data
    .filter((h) => typeof h.display_name === "string" && typeof h.lat === "string" && typeof h.lon === "string")
    .map((h) => ({ display_name: h.display_name as string, lat: h.lat as string, lon: h.lon as string, provider: "nominatim" as const }));
  return hits.length > 0 ? hits : null;
}

async function geocodeViaPhoton(
  query: string,
  limit: number,
  near?: MapPin | null
): Promise<MapGeocodeHit[] | null> {
  let url =
    `${MAP_STACK_CONFIG.upstreams.photon}/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`;
  // Photon-native location bias (rank-only, same contract as viewbox above).
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    url += `&lat=${near.lat}&lon=${near.lng}`;
  }
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

function overpassAddressLabel(tags: OverpassTags): string | null {
  const street = typeof tags["addr:street"] === "string" ? tags["addr:street"].trim() : "";
  const num = typeof tags["addr:housenumber"] === "string" ? tags["addr:housenumber"].trim() : "";
  if (!street && !num) return null;
  const name = typeof tags.name === "string" ? tags.name.trim() : "";
  if (name) return overpassLabel(tags);
  const line1 = [num, street].filter(Boolean).join(" ");
  const rest = [tags["addr:suburb"], tags["addr:city"], tags["addr:state"], tags["addr:country"]]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(", ");
  const label = rest ? `${line1}, ${rest}` : line1;
  return label ? label.slice(0, 220) : null;
}

/**
 * Keyless Overpass address recall for house-numbered queries the fast index
 * providers miss ("2 Pockock Street"). Matches `addr:housenumber` +
 * `addr:street` on OSM nodes/ways/relations. Round-2 only — never on the
 * happy path. Never throws.
 */
async function geocodeViaOverpassAddress(
  houseNumber: string,
  street: string,
  limit: number
): Promise<MapGeocodeHit[] | null> {
  const num = houseNumber.trim().slice(0, 12);
  const streetSafe = escapeOverpassRegex(street.trim().slice(0, 60));
  if (!num || !streetSafe) return null;
  const cap = Math.min(Math.max(limit, 1), LANDMARK_GEOCODE_CONFIG.overpassMaxElements);
  const timeout = LANDMARK_GEOCODE_CONFIG.overpassTimeoutSec;
  const ql =
    `[out:json][timeout:${timeout}];(` +
    `nwr["addr:housenumber"="${num.replace(/"/g, "")}"]["addr:street"~"${streetSafe}",i];` +
    `);out center ${cap};`;
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
      const label = overpassAddressLabel(tags);
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
 * Forward geocode via server proxy — broad by design. The fast keyless
 * providers fire in PARALLEL (one shared budget each) and hits merge +
 * dedupe into one suggestion list, so a place buried in one source still
 * surfaces from another. Explicit location intents are pinned first:
 * - `lat, lng` (optionally parenthesised) → exact pin, plus an optional
 *   bounded reverse-geocode label for a human-readable place name.
 * - Plus Code (Open Location Code, full or short) → offline local decode;
 *   short codes recover against the viewer bias (`near`).
 * When the fast merge is empty, ONE fallback batch runs Overpass
 * (landmark scan + house-numbered address recall), a token-reorder retry
 * and a house-number-stripped retry of the fast providers (order- and
 * number-tolerant input like "Nigeria Lagos" / "2 Pockock Street").
 * Optionally re-ranked near the viewer's position when `near` is supplied
 * (nearby first, never filtered). Never throws.
 */
export async function geocodeForward(query: string, limit = LOCATION_SUGGESTIONS_CONFIG.limit, near?: MapPin | null): Promise<MapGeocodeHit[]> {
  const q = query.trim().slice(0, LOCATION_SUGGESTIONS_CONFIG.maxQueryLength);
  if (q.length < LOCATION_SUGGESTIONS_CONFIG.minQueryLength) return [];
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
  const budget = LOCATION_SUGGESTIONS_CONFIG.providerTimeoutMs;
  const coordName = LOCATION_SUGGESTIONS_CONFIG.coordinateProviderName;
  const plusName = LOCATION_SUGGESTIONS_CONFIG.plusCodeProviderName;
  // Location intents — exact user input, pinned ahead of provider hits.
  // Coordinate fast-path: raw "lat, lng" (optionally parenthesised) is an
  // exact pin. Range-gated by parseCoordinateQuery, so postal codes and
  // house numbers never take this path. Plus codes decode offline (keyless
  // providers do not resolve them); short codes recover against `near`.
  const coords = parseCoordinateQuery(q);
  const plusPin = parsePlusCodeQuery(q, near && Number.isFinite(near.lat) && Number.isFinite(near.lng) ? near : null);
  const intentPin: MapGeocodeHit | null = coords
    ? {
        display_name: q,
        lat: String(coords.lat),
        lon: String(coords.lng),
        provider: coordName,
      }
    : plusPin
      ? {
          display_name: plusPin.code,
          lat: String(plusPin.lat),
          lon: String(plusPin.lng),
          provider: plusName,
        }
      : null;
  // Bounded reverse enrich for coordinate/plus-code intents — parallel with
  // the fast providers so the happy path pays no extra latency. Failure is
  // silent: the raw pin alone is still a valid suggestion.
  const reverseEnrich: Promise<string | null> = intentPin
    ? bounded(() => geocodeReverse(Number(intentPin.lat), Number(intentPin.lon)), budget)
    : Promise.resolve(null);
  const runProvider = (name: MapGeocodeProvider, text: string): Promise<MapGeocodeHit[] | null> => {
    if (name === "nominatim") return bounded(() => geocodeViaNominatim(text, safeLimit, near), budget);
    if (name === "photon") return bounded(() => geocodeViaPhoton(text, safeLimit, near), budget);
    if (name === "openmeteo") return bounded(() => geocodeViaOpenMeteo(text, safeLimit), budget);
    if (name === "overpass") return bounded(() => geocodeViaOverpass(text, safeLimit), budget);
    // Unknown future providers fall through safely (no branch = no crash).
    return bounded(() => geocodeViaOpenMeteo(text, safeLimit), budget);
  };
  const fastOrder = MAP_STACK_CONFIG.geocodeOrder.filter((n) => n !== "overpass");
  // Round 1 — fast providers in PARALLEL (previously sequential: every broad
  // query waited out the slowest upstream and blanked past the budget).
  // Overpass joins round 1 only when explicitly configured out of
  // fallback-only mode; by default it stays a last resort (see round 2).
  const round1Order = LOCATION_SUGGESTIONS_CONFIG.overpassFallbackOnly
    ? fastOrder
    : MAP_STACK_CONFIG.geocodeOrder;
  const [round1, reverseLabel] = await Promise.all([
    Promise.all(round1Order.map((name) => runProvider(name, q))),
    reverseEnrich,
  ]);
  // Intent pins first (raw pin, then optional reverse label), then providers.
  if (intentPin) {
    pushAll([intentPin]);
    if (typeof reverseLabel === "string" && reverseLabel.length > 0) {
      pushAll([
        {
          display_name: reverseLabel,
          lat: intentPin.lat,
          lon: intentPin.lon,
          provider: intentPin.provider,
        },
      ]);
    }
  }
  round1.forEach(pushAll);
  // Round 2 — only when nothing merged: Overpass fallback + token-reorder
  // retry + house-number-stripped address recall in ONE parallel batch
  // (single extra budget, never two).
  if (merged.length === 0) {
    const round2: Promise<MapGeocodeHit[] | null>[] = [];
    if (LOCATION_SUGGESTIONS_CONFIG.overpassFallbackOnly && MAP_STACK_CONFIG.geocodeOrder.includes("overpass")) {
      round2.push(runProvider("overpass", q));
    }
    const reordered = LOCATION_SUGGESTIONS_CONFIG.tokenReorderFallback ? reorderQueryTokens(q) : null;
    if (reordered) {
      for (const name of fastOrder) round2.push(runProvider(name, reordered));
    }
    // Numeric-address recall: "2 Pockock Street" → retry fast providers with
    // "Pockock Street" and an Overpass addr:housenumber/addr:street scan.
    // Config-gated and merge-empty-only, so the happy path is unchanged.
    if (LOCATION_SUGGESTIONS_CONFIG.numericAddressFallback) {
      const numericMatch = /^(\d{1,6})\s+(.+)$/.exec(q);
      const stripped = stripLeadingHouseNumber(q);
      if (numericMatch && stripped) {
        for (const name of fastOrder) round2.push(runProvider(name, stripped));
        if (MAP_STACK_CONFIG.geocodeOrder.includes("overpass")) {
          round2.push(
            bounded(
              () => geocodeViaOverpassAddress(numericMatch[1], numericMatch[2], safeLimit),
              budget
            )
          );
        }
      }
    }
    if (round2.length > 0) {
      const round2Hits = await Promise.all(round2);
      round2Hits.forEach(pushAll);
    }
  }
  // Explicit coordinates / plus codes are exact user intent — pin them first
  // even when a viewer bias would otherwise rank nearer provider hits above
  // them. Short plus codes that could not be recovered (no `near`) fall
  // through to provider hits only.
  const pinned = new Set([coordName, plusName]);
  const ranked = rankGeocodeHits(merged, near);
  const finalHits = [
    ...ranked.filter((h) => pinned.has(h.provider)),
    ...ranked.filter((h) => !pinned.has(h.provider)),
  ].slice(0, safeLimit);
  try {
    // Empty merges cache SHORT (OSM gains places daily; a 30-day empty
    // would blank newly-mapped names). Hits keep the long geocode TTL.
    const ttl = finalHits.length === 0 ? LOCATION_SUGGESTIONS_CONFIG.emptyTtlSec : MAP_STACK_CONFIG.cacheTtlSec.geocode;
    await redis.set(key, finalHits, { ex: ttl });
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
