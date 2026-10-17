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
  /**
   * When true and round-1 merged nothing, house-numbered address queries
   * ("2 Pockock Street") are retried without the leading number and via an
   * Overpass `addr:housenumber` scan — round-2 only, so the happy path is
   * unchanged.
   */
  numericAddressFallback: boolean;
  /** Redis TTL (sec) for EMPTY merges (short — OSM data changes daily). */
  emptyTtlSec: number;
  /** `provider` tag for coordinate-query hits (`lat, lng` fast-path). */
  coordinateProviderName: string;
  /** `provider` tag for Plus Code (Open Location Code) hits. */
  plusCodeProviderName: string;
  /** Input placeholder shared by location fields (config-driven copy). */
  locationPlaceholder: string;
  /** Empty-suggestion dropdown copy (config-driven). */
  locationEmptyStateHint: string;
}

export const LOCATION_SUGGESTIONS_CONFIG: LocationSuggestionsConfig = {
  minQueryLength: 2,
  maxQueryLength: 200,
  debounceMs: 350,
  limit: 6,
  providerTimeoutMs: 4000,
  overpassFallbackOnly: true,
  tokenReorderFallback: true,
  numericAddressFallback: true,
  emptyTtlSec: 3600,
  coordinateProviderName: "coordinates",
  plusCodeProviderName: "plus-codes",
  locationPlaceholder: "Place, address, coords, or plus code…",
  locationEmptyStateHint: "Type a place, address, coordinates, or plus code",
};

export interface ParsedCoordinates {
  lat: number;
  lng: number;
}

/**
 * Parses `lat, lng` coordinate queries ("6.5244, 3.3792", "6.5244 3.3792",
 * "6.5244;3.3792") — with or without enclosing parentheses/brackets
 * ("(6.5244, 3.3792)", "[6.5244, 3.3792]"). Range-validated so postal codes
 * ("100001"), house numbers ("2 Pockock") and fare ranges ("400-500") never
 * match. Null when the text is not a coordinate pair — callers fall through
 * to providers.
 */
export function parseCoordinateQuery(raw: string): ParsedCoordinates | null {
  try {
    const text = (raw ?? "").trim();
    if (!text) return null;
    // Optional enclosing wrappers (balanced or not) — users paste "(lat, lng)"
    // from map apps, chat, or logs. Stripped once each side before the pair
    // match so nested junk ("((a, b))") still collapses to the pair.
    const unwrapped = text
      .replace(/^[([]+\s*/, "")
      .replace(/\s*[)\]]+$/, "")
      .trim();
    const match = /^(-?\d{1,3}(?:\.\d+)?)[,;\s]+(-?\d{1,3}(?:\.\d+)?)$/.exec(unwrapped);
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
 * Shared house-number strip for the round-2 numeric-address recall. Returns
 * the query without a leading house number ("2 Pockock Street" → "Pockock
 * Street") or null when the text has no leading number / is only a number.
 */
export function stripLeadingHouseNumber(raw: string): string | null {
  try {
    const text = (raw ?? "").trim();
    if (!text) return null;
    const match = /^\d{1,6}\s+(.+)$/.exec(text);
    if (!match) return null;
    const rest = match[1].trim();
    // A bare second number ("400 500") is not an address — leave it alone.
    if (!rest || /^-?\d/.test(rest)) return null;
    return rest;
  } catch {
    return null;
  }
}

/**
 * Plus Code (Open Location Code) helpers — offline, keyless, no upstream.
 * Algorithm ported from google/open-location-code (Apache-2.0) and validated
 * against its test_data vectors. Used because free keyless providers
 * (Nominatim, Photon) do not resolve plus codes; local decode is the correct
 * approach. Short codes (missing leading digits) are recovered against a
 * reference point (viewer bias or a locality geocoded earlier).
 */
const OLC_ALPHABET = "23456789CFGHJMPQRVWX";
const OLC_ENCODING_BASE = 20;
const OLC_LATITUDE_MAX = 90;
const OLC_LONGITUDE_MAX = 180;
const OLC_PAIR_CODE_LENGTH = 10;
const OLC_SEPARATOR_POSITION = 8;
const OLC_MAX_DIGIT_COUNT = 15;
const OLC_GRID_CODE_LENGTH = OLC_MAX_DIGIT_COUNT - OLC_PAIR_CODE_LENGTH; // 5
const OLC_GRID_COLUMNS = 4;
const OLC_GRID_ROWS = 5;
const OLC_PAIR_FIRST_PLACE_VALUE = Math.pow(OLC_ENCODING_BASE, OLC_PAIR_CODE_LENGTH / 2 - 1); // 20^4
const OLC_PAIR_PRECISION = Math.pow(OLC_ENCODING_BASE, 3); // 20^3
const OLC_GRID_LAT_FIRST_PLACE_VALUE = Math.pow(OLC_GRID_ROWS, OLC_GRID_CODE_LENGTH - 1); // 5^4
const OLC_GRID_LNG_FIRST_PLACE_VALUE = Math.pow(OLC_GRID_COLUMNS, OLC_GRID_CODE_LENGTH - 1); // 4^4
const OLC_FINAL_LAT_PRECISION = OLC_PAIR_PRECISION * Math.pow(OLC_GRID_ROWS, OLC_GRID_CODE_LENGTH); // 2.5e7
const OLC_FINAL_LNG_PRECISION = OLC_PAIR_PRECISION * Math.pow(OLC_GRID_COLUMNS, OLC_GRID_CODE_LENGTH); // 8.192e6

function olcAlphabetOnly(s: string): boolean {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    if (OLC_ALPHABET.indexOf(s.charAt(i)) === -1) return false;
  }
  return true;
}

/** First-pair range check (mirrors official `isFull`). */
function olcDigitsDecodable(digitsOnly: string): boolean {
  if (digitsOnly.length < 2) return false;
  const firstLat = OLC_ALPHABET.indexOf(digitsOnly.charAt(0)) * OLC_ENCODING_BASE;
  if (firstLat >= OLC_LATITUDE_MAX * 2) return false;
  const firstLng = OLC_ALPHABET.indexOf(digitsOnly.charAt(1)) * OLC_ENCODING_BASE;
  if (firstLng >= OLC_LONGITUDE_MAX * 2) return false;
  return true;
}

export type PlusCodeKind = "full" | "short";

/**
 * Classifies raw input as a full or short Plus Code, or null when it is not
 * one. Accepts codes with or without the `+` separator (users paste both);
 * a bare 8- or 10-char run of the OLC alphabet is treated as a full code.
 * Short codes (missing leading digits, separator before position 8) are
 * returned as `"short"` — callers must supply a reference to recover them.
 * False-positive guard: the alphabet contains C/F/G/H/J/M/P/Q/R/V/W/X, so
 * plain words almost never classify; `+` is required for anything shorter
 * than 8 chars.
 */
export function classifyPlusCode(raw: string): PlusCodeKind | null {
  try {
    const text = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (!text || text.length < 2) return null;
    // Reject mixed junk early — plus codes use the OLC alphabet, optional
    // `+`, and padding `0` on full codes only (checked below).
    if (!/^[23456789CFGHJMPQRVWX0+]+$/.test(text)) return null;
    if (!text.includes("+")) {
      // Bare code: only unambiguous full lengths (with separator stripped).
      if (text.length !== 8 && text.length !== 10) return null;
      return olcDigitsDecodable(text) ? "full" : null;
    }
    const idx = text.indexOf("+");
    if (text.lastIndexOf("+") !== idx) return null;
    // Separator must sit on an even boundary, at most at position 8.
    if (idx > OLC_SEPARATOR_POSITION || idx % 2 !== 0) return null;
    const head = text.slice(0, idx);
    const tail = text.slice(idx + 1);
    // At most one separator; after it: nothing (padded full / short) or ≥2
    // digits (a single trailing digit is not a legal OLC cell).
    if (tail.length === 1) return null;
    if (tail.length > 0 && !olcAlphabetOnly(tail)) return null;
    if (head.includes("0")) {
      // Padding `0` is only legal on full codes (separator at 8), as a
      // single trailing even-length group, never leading, and the code must
      // end with `+`.
      if (idx !== OLC_SEPARATOR_POSITION || tail.length > 0) return null;
      if (head.charAt(0) === "0") return null;
      const padMatch = /0+$/.exec(head);
      if (!padMatch || padMatch[0].length % 2 !== 0 || padMatch[0].length > 6) return null;
      const body = head.slice(0, head.length - padMatch[0].length);
      if (!olcAlphabetOnly(body) || !olcDigitsDecodable(body)) return null;
      return "full";
    }
    // Empty head ("+G6") is a legal short code (missing everything before
    // the separator); a non-empty head must be pure alphabet.
    if (head.length > 0 && !olcAlphabetOnly(head)) return null;
    if (idx === OLC_SEPARATOR_POSITION) {
      return olcDigitsDecodable(head + tail) ? "full" : null;
    }
    // Short code: separator before position 8 (missing leading digits).
    return "short";
  } catch {
    return null;
  }
}

export interface DecodedPlusCode {
  latLo: number;
  lngLo: number;
  latHi: number;
  lngHi: number;
  centerLat: number;
  centerLng: number;
  codeLength: number;
}

/**
 * Decodes a full Plus Code to its cell's bounding box + center. Null when
 * the code is not a valid full code (callers fall through to providers or
 * attempt short-code recovery first).
 */
export function decodePlusCode(raw: string): DecodedPlusCode | null {
  try {
    if (classifyPlusCode(raw) !== "full") return null;
    const text = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const digitsOnly = text.replace("+", "").replace(/0/g, "");
    if (!olcDigitsDecodable(digitsOnly)) return null;
    let normalLat = -OLC_LATITUDE_MAX * OLC_PAIR_PRECISION;
    let normalLng = -OLC_LONGITUDE_MAX * OLC_PAIR_PRECISION;
    let gridLat = 0;
    let gridLng = 0;
    const pairDigits = Math.min(digitsOnly.length, OLC_PAIR_CODE_LENGTH);
    let pv = OLC_PAIR_FIRST_PLACE_VALUE;
    for (let i = 0; i < pairDigits; i += 2) {
      normalLat += OLC_ALPHABET.indexOf(digitsOnly.charAt(i)) * pv;
      normalLng += OLC_ALPHABET.indexOf(digitsOnly.charAt(i + 1)) * pv;
      if (i < pairDigits - 2) pv /= OLC_ENCODING_BASE;
    }
    let latPrecision = pv / OLC_PAIR_PRECISION;
    let lngPrecision = pv / OLC_PAIR_PRECISION;
    if (digitsOnly.length > OLC_PAIR_CODE_LENGTH) {
      let rowpv = OLC_GRID_LAT_FIRST_PLACE_VALUE;
      let colpv = OLC_GRID_LNG_FIRST_PLACE_VALUE;
      const gridDigits = Math.min(digitsOnly.length, OLC_MAX_DIGIT_COUNT);
      for (let i = OLC_PAIR_CODE_LENGTH; i < gridDigits; i++) {
        const digitVal = OLC_ALPHABET.indexOf(digitsOnly.charAt(i));
        const row = Math.floor(digitVal / OLC_GRID_COLUMNS);
        const col = digitVal % OLC_GRID_COLUMNS;
        gridLat += row * rowpv;
        gridLng += col * colpv;
        if (i < gridDigits - 1) {
          rowpv /= OLC_GRID_ROWS;
          colpv /= OLC_GRID_COLUMNS;
        }
      }
      latPrecision = rowpv / OLC_FINAL_LAT_PRECISION;
      lngPrecision = colpv / OLC_FINAL_LNG_PRECISION;
    }
    const latLo = normalLat / OLC_PAIR_PRECISION + gridLat / OLC_FINAL_LAT_PRECISION;
    const lngLo = normalLng / OLC_PAIR_PRECISION + gridLng / OLC_FINAL_LNG_PRECISION;
    const latHi = latLo + latPrecision;
    const lngHi = lngLo + lngPrecision;
    return {
      latLo,
      lngLo,
      latHi,
      lngHi,
      centerLat: Math.min(latLo + latPrecision / 2, OLC_LATITUDE_MAX),
      centerLng: Math.min(lngLo + lngPrecision / 2, OLC_LONGITUDE_MAX),
      codeLength: Math.min(digitsOnly.length, OLC_MAX_DIGIT_COUNT),
    };
  } catch {
    return null;
  }
}

/**
 * Encodes lat/lng to a Plus Code of `codeLength` digits (default 10).
 * Used internally by short-code recovery; also handy for tests. Null on
 * non-finite input.
 */
export function encodePlusCode(latitude: number, longitude: number, codeLength = 10): string | null {
  try {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const len = Math.min(OLC_MAX_DIGIT_COUNT, Math.max(2, Math.floor(codeLength)));
    if (len < OLC_PAIR_CODE_LENGTH && len % 2 !== 0) return null;
    let latVal = Math.floor(latitude * OLC_FINAL_LAT_PRECISION);
    latVal += OLC_LATITUDE_MAX * OLC_FINAL_LAT_PRECISION;
    if (latVal < 0) latVal = 0;
    else if (latVal >= 2 * OLC_LATITUDE_MAX * OLC_FINAL_LAT_PRECISION) {
      latVal = 2 * OLC_LATITUDE_MAX * OLC_FINAL_LAT_PRECISION - 1;
    }
    let lngVal = Math.floor(longitude * OLC_FINAL_LNG_PRECISION);
    lngVal += OLC_LONGITUDE_MAX * OLC_FINAL_LNG_PRECISION;
    const wrap = 2 * OLC_LONGITUDE_MAX * OLC_FINAL_LNG_PRECISION;
    if (lngVal < 0) lngVal = (lngVal % wrap) + wrap;
    else if (lngVal >= wrap) lngVal = lngVal % wrap;
    const code: string[] = new Array(OLC_MAX_DIGIT_COUNT + 1).fill("");
    code[OLC_SEPARATOR_POSITION] = "+";
    if (len > OLC_PAIR_CODE_LENGTH) {
      for (let i = OLC_MAX_DIGIT_COUNT - OLC_PAIR_CODE_LENGTH; i >= 1; i--) {
        const latDigit = latVal % OLC_GRID_ROWS;
        const lngDigit = lngVal % OLC_GRID_COLUMNS;
        code[OLC_SEPARATOR_POSITION + 2 + i] = OLC_ALPHABET.charAt(latDigit * OLC_GRID_COLUMNS + lngDigit);
        latVal = Math.floor(latVal / OLC_GRID_ROWS);
        lngVal = Math.floor(lngVal / OLC_GRID_COLUMNS);
      }
    } else {
      latVal = Math.floor(latVal / Math.pow(OLC_GRID_ROWS, OLC_GRID_CODE_LENGTH));
      lngVal = Math.floor(lngVal / Math.pow(OLC_GRID_COLUMNS, OLC_GRID_CODE_LENGTH));
    }
    code[OLC_SEPARATOR_POSITION + 1] = OLC_ALPHABET.charAt(latVal % OLC_ENCODING_BASE);
    code[OLC_SEPARATOR_POSITION + 2] = OLC_ALPHABET.charAt(lngVal % OLC_ENCODING_BASE);
    latVal = Math.floor(latVal / OLC_ENCODING_BASE);
    lngVal = Math.floor(lngVal / OLC_ENCODING_BASE);
    for (let i = OLC_PAIR_CODE_LENGTH / 2 + 1; i >= 0; i -= 2) {
      code[i] = OLC_ALPHABET.charAt(latVal % OLC_ENCODING_BASE);
      code[i + 1] = OLC_ALPHABET.charAt(lngVal % OLC_ENCODING_BASE);
      latVal = Math.floor(latVal / OLC_ENCODING_BASE);
      lngVal = Math.floor(lngVal / OLC_ENCODING_BASE);
    }
    if (len >= OLC_SEPARATOR_POSITION) return code.slice(0, len + 1).join("");
    return code.slice(0, len).join("") + "0".repeat(OLC_SEPARATOR_POSITION - len) + "+";
  } catch {
    return null;
  }
}

/** Canonical full code: uppercase, `+` at position 8 (pad when bare). */
function olcCanonicalFull(text: string): string | null {
  const t = text.trim().toUpperCase().replace(/\s+/g, "");
  const kind = classifyPlusCode(t);
  if (kind !== "full") return null;
  if (!t.includes("+")) return `${t.slice(0, 8)}+${t.slice(8)}`;
  return t;
}

/**
 * Recovers the nearest full Plus Code to a reference point from a short
 * code (official recoverNearest). Full codes pass through (canonicalized).
 * Null when the input is not a code or the reference is unusable.
 */
export function recoverNearestPlusCode(
  shortCode: string,
  referenceLat: number,
  referenceLng: number
): string | null {
  try {
    const kind = classifyPlusCode(shortCode);
    if (!kind) return null;
    if (kind === "full") return olcCanonicalFull(shortCode);
    if (!Number.isFinite(referenceLat) || !Number.isFinite(referenceLng)) return null;
    const code = shortCode.trim().toUpperCase().replace(/\s+/g, "");
    const idx = code.indexOf("+");
    const paddingLength = OLC_SEPARATOR_POSITION - idx;
    const resolution = Math.pow(20, 2 - paddingLength / 2);
    const halfResolution = resolution / 2;
    const refLat = Math.min(OLC_LATITUDE_MAX, Math.max(-OLC_LATITUDE_MAX, referenceLat));
    let refLng = referenceLng;
    while (refLng < -OLC_LONGITUDE_MAX) refLng += 360;
    while (refLng >= OLC_LONGITUDE_MAX) refLng -= 360;
    // Official recoverNearest: encode the reference at full precision and
    // take the leading `paddingLength` characters as the missing prefix.
    const refFull = encodePlusCode(refLat, refLng, 10);
    if (!refFull) return null;
    const prefix = refFull.slice(0, paddingLength);
    if (!olcAlphabetOnly(prefix)) return null;
    const area = decodePlusCode(prefix + code);
    if (!area) return null;
    let centerLat = area.centerLat;
    let centerLng = area.centerLng;
    if (refLat + halfResolution < centerLat && centerLat - resolution >= -OLC_LATITUDE_MAX) {
      centerLat -= resolution;
    } else if (refLat - halfResolution > centerLat && centerLat + resolution <= OLC_LATITUDE_MAX) {
      centerLat += resolution;
    }
    if (refLng + halfResolution < centerLng) {
      centerLng -= resolution;
    } else if (refLng - halfResolution > centerLng) {
      centerLng += resolution;
    }
    return encodePlusCode(centerLat, centerLng, area.codeLength);
  } catch {
    return null;
  }
}

export interface ParsedPlusCode {
  lat: number;
  lng: number;
  /** Canonical full code (uppercase, separator at position 8). */
  code: string;
  isShort: boolean;
}

/**
 * Parses a Plus Code query to a pin. Full codes resolve without a reference;
 * short codes need `{ lat, lng }` (viewer bias or a locality resolved
 * earlier). Null when the text is not a recoverable code — callers fall
 * through to providers.
 */
export function parsePlusCodeQuery(
  raw: string,
  reference?: { lat: number; lng: number } | null
): ParsedPlusCode | null {
  try {
    const kind = classifyPlusCode(raw);
    if (!kind) return null;
    const text = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (kind === "full") {
      const full = olcCanonicalFull(text);
      if (!full) return null;
      const area = decodePlusCode(full);
      if (!area) return null;
      return { lat: area.centerLat, lng: area.centerLng, code: full, isShort: false };
    }
    if (!reference || !Number.isFinite(reference.lat) || !Number.isFinite(reference.lng)) return null;
    const recovered = recoverNearestPlusCode(text, reference.lat, reference.lng);
    if (!recovered) return null;
    const area = decodePlusCode(recovered);
    if (!area) return null;
    return { lat: area.centerLat, lng: area.centerLng, code: recovered, isShort: true };
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
  // Non-positive / non-numeric limits fall back to the configured default
  // (the server still clamps 1..10, but the client contract is "default
  // unless a valid positive limit was asked for"); oversized limits clamp.
  const safe = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 10) : fallback;
  return `/api/maps/geocode?q=${encodeURIComponent((query ?? "").trim())}&limit=${safe}`;
}
