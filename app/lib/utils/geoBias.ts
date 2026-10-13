/**
 * Viewer-position bias for location suggestions (client, never throws).
 *
 * Contract:
 * - NEVER triggers a permission prompt: position is read only when the page
 *   already holds a grant (permissions API says "granted") or a fresh cached
 *   fix exists from an earlier explicit "use my location" tap.
 * - Cached in memory + localStorage (`along-bias-coords`, 30-min TTL) so
 *   repeat keystrokes never touch geolocation.
 * - Callers append `&lat=&lng=` to `/api/maps/geocode`; the server only
 *   RE-RANKS (nearby first, never filtered), so a missing/stale bias degrades
 *   to the unranked list — never to an error or an empty list.
 */

export interface BiasCoords {
  lat: number;
  lng: number;
}

const STORAGE_KEY = "along-bias-coords";
const CACHE_TTL_MS = 30 * 60 * 1000;
const FIX_TIMEOUT_MS = 2500;

let memoryBias: { coords: BiasCoords; at: number } | null = null;

function readStored(): BiasCoords | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; at?: unknown };
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    if (parsed.lat < -90 || parsed.lat > 90 || parsed.lng < -180 || parsed.lng > 180) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

/** Persist a known-good fix for later suggestion ranking (best-effort). */
export function rememberBiasCoords(coords: BiasCoords): void {
  memoryBias = { coords, at: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...coords, at: Date.now() }));
  } catch {
    /* private-mode safe */
  }
}

function freshMemory(): BiasCoords | null {
  if (!memoryBias) return null;
  if (Date.now() - memoryBias.at > CACHE_TTL_MS) {
    memoryBias = null;
    return null;
  }
  return memoryBias.coords;
}

async function permissionGranted(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return false;
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state === "granted";
  } catch {
    return false;
  }
}

function currentFix(): Promise<BiasCoords | null> {
  return new Promise((resolve) => {
    try {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null);
        return;
      }
      const timer = setTimeout(() => resolve(null), FIX_TIMEOUT_MS);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
            resolve(null);
            return;
          }
          rememberBiasCoords(coords);
          resolve(coords);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { timeout: FIX_TIMEOUT_MS, maximumAge: CACHE_TTL_MS }
      );
    } catch {
      resolve(null);
    }
  });
}

/**
 * Best-effort viewer coords for suggestion ranking. Resolves fast from cache;
 * only touches geolocation when permission is already granted. Never rejects.
 */
export async function getBiasCoords(): Promise<BiasCoords | null> {
  try {
    const mem = freshMemory();
    if (mem) return mem;
    if (typeof window === "undefined") return null;
    const stored = readStored();
    if (stored) {
      memoryBias = { coords: stored, at: Date.now() };
      return stored;
    }
    if (!(await permissionGranted())) return null;
    return await currentFix();
  } catch {
    return null;
  }
}

/** `&lat=..&lng=..` suffix for geocode URLs ("" when no bias — callers stay valid). */
export function biasQuerySuffix(coords: BiasCoords | null): string {
  if (!coords) return "";
  return `&lat=${coords.lat}&lng=${coords.lng}`;
}

/** Sync peek at cached bias only (memory → localStorage, never geolocation). */
export function peekBiasCoords(): BiasCoords | null {
  try {
    const mem = freshMemory();
    if (mem) return mem;
    if (typeof window === "undefined") return null;
    const stored = readStored();
    if (stored) {
      memoryBias = { coords: stored, at: Date.now() };
      return stored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Fast bias for autocomplete keystrokes: cached coords resolve immediately;
 * a cold lookup races the permission/geolocation path against `timeoutMs`
 * (default 120ms) so suggestions never wait on a 2.5s GPS fix. Never rejects.
 */
export async function getBiasCoordsQuick(timeoutMs = 120): Promise<BiasCoords | null> {
  try {
    const fast = peekBiasCoords();
    if (fast) return fast;
    const raced = await Promise.race([
      getBiasCoords(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(0, timeoutMs))),
    ]);
    return raced;
  } catch {
    return null;
  }
}
