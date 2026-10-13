/**
 * Location-suggestion tuning (config-driven, zero app deps).
 *
 * Single source of truth for the keyless location autocomplete consumed via
 * the internal `/api/maps/geocode` proxy by RouteStepInput, ShareRouteModal
 * and RequestRouteModal. Broad by design: suggestions must fire for exact
 * addresses, buildings/landmarks, roads/streets, towns/cities, postal codes,
 * states/provinces/countries and `lat, lng` coordinates — in any token order
 * — with nearby hits ranked first when the viewer shared a position
 * (rank-only bias via `geoBias`, never filtered, never prompted).
 *
 * Latency contract: the proxy fans providers out in PARALLEL inside
 * `providerTimeoutMs` each, so a slow provider can never starve the fast
 * ones (the sequential fan-out was the "only exact addresses fire"
 * regression — every broad query waited out the slowest upstream past the
 * serverless budget and returned blank).
 */

export interface LocationSuggestionsConfig {
  /** Min trimmed chars before any fetch fires (route + all clients share). */
  minQueryLength: number;
  /** Max trimmed chars accepted (route 400s beyond this). */
  maxQueryLength: number;
  /** Keystroke debounce before firing the proxy request (ms). */
  debounceMs: number;
  /** Default `limit=` sent to the proxy (server still clamps 1..10). */
  limit: number;
  /**
   * Per-provider race budget (ms). Each upstream must answer within this or
   * its leg resolves null and the merge keeps the fast hits. Keeps the worst
   * case (round-1 + fallback round-2) inside the serverless budget.
   */
  providerTimeoutMs: number;
  /**
   * When true, Overpass (slow global OSM `name` scan) runs ONLY as a
   * last-resort fallback when the fast providers merged nothing — never on
   * the hot path.
   */
  overpassFallbackOnly: boolean;
  /**
   * When true and round-1 (+overpass) merged nothing, the fast providers are
   * retried once with reversed token order ("Nigeria Lagos" → "Lagos,
   * Nigeria") in the same fallback batch — order-tolerant suggestions.
   */
  tokenReorderFallback: boolean;
  /** Redis TTL (sec) for EMPTY merges (short — OSM data changes daily). */
  emptyTtlSec: number;
  /** `provider` tag for coordinate-query hits (`lat, lng` fast-path). */
  coordinateProviderName: string;
}

export const LOCATION_SUGGESTIONS_CONFIG: LocationSuggestionsConfig = {
  minQueryLength: 2,
  maxQueryLength: 200,
  debounceMs: 350,
  limit: 6,
  providerTimeoutMs: 4000,
  overpassFallbackOnly: true,
  tokenReorderFallback: true,
  emptyTtlSec: 3600,
  coordinateProviderName: "coordinates",
};

export interface ParsedCoordinates {
  lat: number;
  lng: number;
}

/**
 * Parses `lat, lng` coordinate queries ("6.5244, 3.3792", "6.5244 3.3792",
 * "6.5244;3.3792"). Range-validated so postal codes ("100001"), house
 * numbers ("2 Pockock") and fare ranges ("400-500") never match. Null when
 * the text is not a coordinate pair — callers fall through to providers.
 */
export function parseCoordinateQuery(raw: string): ParsedCoordinates | null {
  try {
    const text = (raw ?? "").trim();
    if (!text) return null;
    const match = /^(-?\d{1,3}(?:\.\d+)?)[,;\s]+(-?\d{1,3}(?:\.\d+)?)$/.exec(text);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Reversed-token fallback query for order-tolerance ("Nigeria Lagos Ikeja"
 * → "Ikeja, Lagos, Nigeria"). Null for single-token queries (nothing to
 * reorder) or when reversal is a no-op. Capped to `maxQueryLength`.
 */
export function reorderQueryTokens(raw: string): string | null {
  try {
    const text = (raw ?? "").trim().slice(0, LOCATION_SUGGESTIONS_CONFIG.maxQueryLength);
    if (!text) return null;
    const tokens = text.split(/[,;\s]+/).filter((t) => t.length > 0);
    if (tokens.length < 2) return null;
    const reversed = [...tokens].reverse().join(", ");
    if (reversed.toLowerCase() === tokens.join(", ").toLowerCase()) return null;
    return reversed.slice(0, LOCATION_SUGGESTIONS_CONFIG.maxQueryLength);
  } catch {
    return null;
  }
}

/**
 * Builds the internal geocode proxy URL (never an upstream URL — clients
 * must not call providers browser-direct). Callers append
 * `biasQuerySuffix(bias)` for nearby-first ranking when available.
 */
export function buildGeocodeUrl(query: string, limit: number = LOCATION_SUGGESTIONS_CONFIG.limit): string {
  const fallback = LOCATION_SUGGESTIONS_CONFIG.limit;
  const parsed = Math.floor(Number(limit));
  const safe = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 10) : fallback;
  return `/api/maps/geocode?q=${encodeURIComponent((query ?? "").trim())}&limit=${safe}`;
}
