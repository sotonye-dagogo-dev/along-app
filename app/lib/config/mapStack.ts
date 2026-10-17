/**
 * Keyless map stack configuration (config-driven, zero app deps).
 *
 * Long-term answer to recurring map API-key failures: the renderer,
 * router and geocoder all work with NO keys configured. Keyed providers
 * (Mapbox / ORS / MapTiler / Stadia / Geoapify / Carto) are demoted to
 * optional overrides that are only consulted when their env vars exist.
 *
 * Stack (verified 2026-10-08):
 * - Tiles   → OpenFreeMap keyless vector styles (free, no limits, no
 *             registration/keys, MapLibre-native). Raster fallbacks are
 *             keyless Carto basemaps (plain, NO `?apiKey=`), OSM standard,
 *             then Esri world street map.
 * - Routing → OSRM demo via SERVER proxy + Redis cache (demo policy is
 *             ~1 req/s with no SLA — never call browser-direct), then
 *             env-gated ORS / Mapbox, then straight-line fallback.
 * - Geocode → `/api/maps/*` server proxy (Nominatim server-side with
 *             proper User-Agent/Referer + Photon + keyless Open-Meteo
 *             + keyless Overpass landmark/address fallback, merged +
 *             deduped, optionally re-ranked near the viewer). Nominatim and
 *             Photon already index OSM landmarks/buildings/addresses by name;
 *             Open-Meteo covers cities only, so Overpass (OSM `name` search,
 *             no key, no registration) closes the landmark/building gap as a
 *             last-resort provider. Browser-direct Nominatim calls violate
 *             usage policy and are banned.
 *
 * Single source of truth for: tile style URLs, dark-mode mapping,
 * raster fallback chain, provider orders, cache TTLs, attributions,
 * server identity headers, and the shared MapLibre style builders
 * consumed by RouteMap + explore page.
 */

export type MapVectorStyleName = "liberty" | "bright" | "positron";
export type MapRoutingProvider = "osrm" | "ors" | "mapbox" | "straight";
export type MapGeocodeProvider = "nominatim" | "photon" | "openmeteo" | "overpass";

/**
 * Routing profile segments per provider for a vehicle mode. `null` =
 * that provider has no profile for the mode (e.g. the keyless OSRM demo
 * serves driving only) → the mode-aware pass skips it. Absent fields merge
 * over `defaultRoutingProfiles`, so road vehicles need no entries at all.
 */
export interface RoutingProfiles {
  osrm?: string | null;
  ors?: string | null;
  mapbox?: string | null;
}

export interface MapStackConfig {
  /** Keyless vector tile styles (OpenFreeMap, no registration). */
  vectorStyles: Record<MapVectorStyleName, string>;
  /** Default vector style for light / dark themes. */
  defaultVectorStyle: { light: MapVectorStyleName; dark: MapVectorStyleName };
  /**
   * CSS filter applied to the canvas in dark mode. Kept at `"none"` so dark
   * mode renders the exact same light-theme tiles (verified clearer) with no
   * wash-out. Renderers skip injecting the style block when `"none"`.
   */
  darkCanvasFilter: string;
  /** Keyless raster fallback chain (NO apiKey params anywhere). */
  rasterFallbacks: { light: string[]; dark: string[] };
  /** Routing provider attempt order — `straight` must stay last. */
  routingOrder: MapRoutingProvider[];
  /** Geocode provider attempt order. */
  geocodeOrder: MapGeocodeProvider[];
  /** Server-side upstream endpoints (never called browser-direct). */
  upstreams: {
    osrm: string;
    nominatim: string;
    photon: string;
    /** Keyless Open-Meteo geocoding (no key, no registration). */
    openmeteo: string;
    /** Keyless Overpass API (OSM landmark/building/address fallback). */
    overpass: string;
    ors: string;
    mapbox: string;
  };
  /**
   * Profile-aware routing bases for the mode-aware trace pass (vehicle-aware
   * tracings). The legacy `upstreams.{osrm,ors,mapbox}` URLs stay the
   * default-chain contract (base + default profile, byte-identical).
   */
  routingBases: { osrm: string; ors: string; mapbox: string };
  /** Profiles for `no vehicle` / road vehicles — the legacy driving chain. */
  defaultRoutingProfiles: RoutingProfiles;
  /**
   * Per-vehicle profile overrides keyed by vehicle registry keys (missing
   * key → default profiles, so road vehicles — taxi/car/bolt/bus/keke —
   * need no entries). `null` = provider unsupported for that mode.
   */
  routingProfiles: Record<string, RoutingProfiles>;
  /** Identity headers the server proxy sends upstream (policy compliance). */
  serverIdentity: { userAgent: string; referer: string };
  /** Redis TTLs (seconds) for proxy read-through caches. */
  cacheTtlSec: { route: number; geocode: number; reverse: number };
  /** Attributions per tile source (rendered by the map footer). */
  attributions: { openfreemap: string; carto: string; osm: string; esri: string };
  /** Hosts worth preconnecting (keyless only — no mapbox/api-key hosts). */
  preconnectHosts: string[];
}

export const MAP_STACK_CONFIG: MapStackConfig = {
  vectorStyles: {
    liberty: "https://tiles.openfreemap.org/styles/liberty",
    bright: "https://tiles.openfreemap.org/styles/bright",
    positron: "https://tiles.openfreemap.org/styles/positron",
  },
  defaultVectorStyle: { light: "liberty", dark: "liberty" },
  // Dark keeps the light visual params verbatim (clearer tiles in both
  // themes): no canvas filter, and the dark raster chain mirrors light.
  darkCanvasFilter: "none",
  rasterFallbacks: {
    light: [
      "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    ],
    dark: [
      "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    ],
  },
  routingOrder: ["osrm", "ors", "mapbox", "straight"],
  geocodeOrder: ["nominatim", "photon", "openmeteo", "overpass"],
  upstreams: {
    osrm: "https://router.project-osrm.org/route/v1/driving",
    nominatim: "https://nominatim.openstreetmap.org",
    photon: "https://photon.komoot.io",
    openmeteo: "https://geocoding-api.open-meteo.com/v1",
    overpass: "https://overpass-api.de/api",
    ors: "https://api.openrouteservice.org/v2/directions/driving-car",
    mapbox: "https://api.mapbox.com/directions/v5/mapbox/driving",
  },
  routingBases: {
    osrm: "https://router.project-osrm.org/route/v1",
    ors: "https://api.openrouteservice.org/v2/directions",
    mapbox: "https://api.mapbox.com/directions/v5/mapbox",
  },
  defaultRoutingProfiles: { osrm: "driving", ors: "driving-car", mapbox: "driving" },
  // Non-road modes only — everything else (taxi/car/bolt/bus/keke) inherits
  // the driving default. The keyless OSRM demo hosts the driving profile
  // exclusively, so walking/cycling rows set `osrm: null` and rely on the
  // keyed providers (ORS/Mapbox) when configured, else the legacy chain.
  routingProfiles: {
    trekking: { osrm: null, ors: "foot-walking", mapbox: "walking" },
    bike: { osrm: null, ors: "cycling-regular", mapbox: "cycling" },
    // No water/rail profiles exist on the stack — legacy driving fallback
    // keeps a road-shaped trace (never a bare straight line).
    boat: { osrm: null, ors: null, mapbox: null },
    train: { osrm: null, ors: null, mapbox: null },
  },
  serverIdentity: {
    userAgent: "AlongApp/1.0 (https://www.alongng.com)",
    referer: "https://www.alongng.com/",
  },
  cacheTtlSec: { route: 86400, geocode: 2592000, reverse: 2592000 },
  attributions: {
    openfreemap: "&copy; <a href=\"https://openfreemap.org/\">OpenFreeMap</a> &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
    carto: "&copy; <a href=\"https://carto.com/\">CARTO</a> &copy; OpenStreetMap",
    osm: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
    esri: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
  },
  preconnectHosts: ["https://tiles.openfreemap.org", "https://tile.openstreetmap.org"],
};

/** Primary keyless vector style URL for a theme. */
export function vectorStyleUrl(isDark: boolean): string {
  const name = isDark
    ? MAP_STACK_CONFIG.defaultVectorStyle.dark
    : MAP_STACK_CONFIG.defaultVectorStyle.light;
  return MAP_STACK_CONFIG.vectorStyles[name];
}

/** Keyless raster tile URL at a fallback depth (0 = first fallback). */
export function rasterFallbackTile(isDark: boolean, depth = 0): string {
  const chain = isDark
    ? MAP_STACK_CONFIG.rasterFallbacks.dark
    : MAP_STACK_CONFIG.rasterFallbacks.light;
  return chain[Math.min(depth, chain.length - 1)];
}

/** Depth of the raster fallback chain (for onError step-down bounds). */
export function rasterFallbackDepth(): number {
  return MAP_STACK_CONFIG.rasterFallbacks.light.length;
}

/** Normalized routing profiles for a vehicle key (missing/unknown → default driving chain). */
export function resolveRoutingProfiles(vehicle?: string | null): RoutingProfiles {
  try {
    const key = typeof vehicle === "string" ? vehicle.trim().toLowerCase() : "";
    const overrides = key.length > 0 ? MAP_STACK_CONFIG.routingProfiles[key] : undefined;
    const base = MAP_STACK_CONFIG.defaultRoutingProfiles;
    if (!overrides) return { ...base };
    return { ...base, ...overrides };
  } catch {
    return { ...MAP_STACK_CONFIG.defaultRoutingProfiles };
  }
}

/** True when the profiles resolve to the legacy driving chain (URL/cache contract). */
export function isDefaultRoutingProfiles(profiles: RoutingProfiles): boolean {
  const osrm = profiles.osrm ?? null;
  const ors = profiles.ors ?? null;
  const mapbox = profiles.mapbox ?? null;
  // All-null (boat/train) → no mode-aware provider exists, the legacy chain
  // runs either way — share its cache key instead of forking a duplicate.
  if (osrm === null && ors === null && mapbox === null) return true;
  const d = MAP_STACK_CONFIG.defaultRoutingProfiles;
  return (
    osrm === (d.osrm ?? null) &&
    ors === (d.ors ?? null) &&
    mapbox === (d.mapbox ?? null)
  );
}

/**
 * Stable cache-slug for non-default profiles (e.g. `p-x_foot-walking_walking`);
 * null when the profiles ARE the default → callers keep the legacy key, so
 * existing cached driving traces never invalidate.
 */
export function routingProfileSlug(profiles: RoutingProfiles): string | null {
  if (isDefaultRoutingProfiles(profiles)) return null;
  const part = (v?: string | null): string =>
    typeof v === "string" && v.trim().length > 0 ? v.trim().toLowerCase() : "x";
  const raw = `p-${part(profiles.osrm)}_${part(profiles.ors)}_${part(profiles.mapbox)}`;
  return raw.replace(/[^a-z0-9_.-]+/g, "-");
}

export interface MapLibreRasterStyle {
  version: 8;
  sources: {
    basemap: {
      type: "raster";
      tiles: string[];
      tileSize: number;
      attribution: string;
    };
  };
  layers: { id: string; type: "raster"; source: string; minzoom: number; maxzoom: number }[];
}

/** Builds the shared keyless raster style (vector fails → this). */
export function buildRasterMapStyle(isDark: boolean, depth = 0): MapLibreRasterStyle {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [rasterFallbackTile(isDark, depth)],
        tileSize: 256,
        attribution: isDark
          ? MAP_STACK_CONFIG.attributions.carto
          : MAP_STACK_CONFIG.attributions.carto,
      },
    },
    layers: [
      { id: "basemap-layer", type: "raster", source: "basemap", minzoom: 0, maxzoom: 20 },
    ],
  };
}

/**
 * Ordered style stack for a theme: keyless vector first, then each
 * raster fallback. Renderers walk down the stack on tile/error failure.
 * The style entries are `string | MapLibreRasterStyle` — pass straight
 * to react-map-gl `mapStyle` (typed as never at the call site, as before).
 */
export function getMapStyleStack(isDark: boolean): (string | MapLibreRasterStyle)[] {
  const stack: (string | MapLibreRasterStyle)[] = [vectorStyleUrl(isDark)];
  for (let depth = 0; depth < rasterFallbackDepth(); depth++) {
    stack.push(buildRasterMapStyle(isDark, depth));
  }
  return stack;
}

/** True when a keyed routing override is configured (server-only env). */
export function hasOrsKey(): boolean {
  return !!process.env.OPEN_ROUTE_SERVICE_KEY;
}

/** True when a keyed Mapbox override is configured (server-only env). */
export function hasMapboxKey(): boolean {
  // Trimmed: pasted Vercel values may carry stray whitespace/newlines that
  // would otherwise count as "configured" and fire failing upstream calls.
  const raw =
    process.env.MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return typeof raw === "string" ? raw.trim().length > 0 : false;
}

/**
 * Landmark / building / address geocode tuning (config-driven, zero app deps).
 *
 * - Nominatim + Photon already index OSM named features (landmarks,
 *   buildings, streets + house numbers) — no param change needed to *enable*
 *   them, but Nominatim requests carry `addressdetails=1&dedupe=1` so full
 *   addresses survive, and Photon labels render street-level granularity.
 * - Open-Meteo only knows populated places (name/admin/country), so it can
 *   never answer a landmark/building query — Overpass (keyless OSM `name`
 *   search) runs LAST as the gap-closer, only for queries long enough to
 *   keep the global scan bounded. It never throws and never blocks the merge:
 *   timeouts / empty results degrade to the already-merged hits.
 */
export interface LandmarkGeocodeConfig {
  /** Min trimmed query length before Overpass is attempted (bounded scans). */
  overpassMinQueryLength: number;
  /** Max Overpass elements parsed per query (cap before canonical mapping). */
  overpassMaxElements: number;
  /** Overpass QL timeout (seconds, mirrored in the query + fetch guard). */
  overpassTimeoutSec: number;
}

export const LANDMARK_GEOCODE_CONFIG: LandmarkGeocodeConfig = {
  overpassMinQueryLength: 4,
  overpassMaxElements: 5,
  overpassTimeoutSec: 10,
};
/**
 * Expanded-map overlay configuration (config-driven, zero app deps).
 *
 * The expanded map renders as a contained centered dialog (backdrop +
 * max-width panel) instead of a full-bleed `fixed inset-0 w-100vw` layer,
 * so it can never spill past its column into the desktop suggestions rail
 * or cause horizontal overflow (`100vw` includes the scrollbar). Design
 * tokens only — no hardcoded hex.
 */
export interface MapExpandConfig {
  /** Overlay wrapper: fixed, centered, padded — never full-bleed. */
  overlayClass: string;
  /** Clickable scrim behind the panel (closes on click when enabled). */
  backdropClass: string;
  /** Panel width cap — keeps the dialog inside the viewport on desktop. */
  panelMaxWidthClass: string;
  /** Panel height (CSS height for the map panel, e.g. "80vh"). */
  panelHeight: string;
  /** Panel chrome: rounded, card surface, clipped map canvas. */
  panelClass: string;
  /** Clicking the backdrop closes the expanded map. */
  closeOnBackdropClick: boolean;
  /** Pressing Escape closes the expanded map. */
  closeOnEscape: boolean;
  /** Accessible name for the expanded dialog + minimize action. */
  dialogLabel: string;
  minimizeLabel: string;
}

export const MAP_EXPAND_CONFIG: MapExpandConfig = {
  // z-[70] sits above the live-navigation modal (z-[60]) so expanding the
  // map FROM the navigation guide renders on top instead of vanishing
  // behind the modal backdrop. Detail-page expansion is unaffected.
  overlayClass: "fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6",
  backdropClass: "absolute inset-0 bg-black/60 backdrop-blur-sm",
  panelMaxWidthClass: "max-w-4xl",
  panelHeight: "80vh",
  panelClass:
    "relative w-full overflow-hidden radius-lg bg-bg-card border border-border shadow-lg",
  closeOnBackdropClick: true,
  closeOnEscape: true,
  dialogLabel: "Expanded route map",
  minimizeLabel: "Minimize map",
};
