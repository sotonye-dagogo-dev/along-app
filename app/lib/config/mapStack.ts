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
 *             proper User-Agent/Referer + Photon fallback). Browser-direct
 *             Nominatim calls violate usage policy and are banned.
 *
 * Single source of truth for: tile style URLs, dark-mode mapping,
 * raster fallback chain, provider orders, cache TTLs, attributions,
 * server identity headers, and the shared MapLibre style builders
 * consumed by RouteMap + explore page.
 */

export type MapVectorStyleName = "liberty" | "bright" | "positron";
export type MapRoutingProvider = "osrm" | "ors" | "mapbox" | "straight";
export type MapGeocodeProvider = "nominatim" | "photon";

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
    ors: string;
    mapbox: string;
  };
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
  geocodeOrder: ["nominatim", "photon"],
  upstreams: {
    osrm: "https://router.project-osrm.org/route/v1/driving",
    nominatim: "https://nominatim.openstreetmap.org",
    photon: "https://photon.komoot.io",
    ors: "https://api.openrouteservice.org/v2/directions/driving-car",
    mapbox: "https://api.mapbox.com/directions/v5/mapbox/driving",
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
  return !!(
    process.env.MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  );
}

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
  overlayClass: "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6",
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
