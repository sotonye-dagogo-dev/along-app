/**
 * Map pin configuration (config-driven, zero app deps).
 * Single source of truth for route + user-location marker visuals so every
 * renderer (RouteMap, explore, post detail) paints identical, anchor-stable
 * pins that track their coordinates through pan/zoom.
 *
 * Design tokens only — no hardcoded hex. Route dots use the primary scale,
 * the user dot uses the info (blue) scale with a white glory ring + radar
 * ping. Sizes stay small but legible; labels are the 1-based route index.
 */
export interface MapPinsConfig {
  /** react-map-gl Marker anchoring — `center` keeps the dot over its lngLat at any zoom. */
  markerAnchor: "center";
  /** Pixel offset applied to every marker (0 keeps anchor-exact). */
  markerOffset: [number, number];
  routeDot: {
    size: number;
    fontSize: number;
    /** Tailwind token classes for the numbered dot. */
    dotClass: string;
  };
  userDot: {
    coreSize: number;
    coreClass: string;
    ringClass: string;
    radarClass: string;
    accuracyClass: string;
  };
  /**
   * Pin-to-polyline snapping: when a road-snapped trace is on screen, the
   * origin/destination dots render at the trace endpoints (the snapped
   * versions of their geocoded coords, metres apart) so the line visibly
   * meets the dots instead of stopping beside them. Intermediate stops
   * always stay at their exact geocoded coords. Falls back to raw coords
   * when no trace is available.
   */
  snapEndpointsToPolyline: boolean;
  /** Passive user-location tracking defaults (explore + post maps). */
  tracking: {
    enableHighAccuracy: boolean;
    timeoutMs: number;
    maximumAgeMs: number;
    watchMaximumAgeMs: number;
  };
}

export const MAP_PINS_CONFIG: MapPinsConfig = {
  markerAnchor: "center",
  markerOffset: [0, 0],
  routeDot: {
    size: 22,
    fontSize: 11,
    dotClass:
      "bg-primary text-text-inverse border-white shadow-primary",
  },
  userDot: {
    coreSize: 14,
    coreClass: "bg-info-text border-white",
    ringClass: "border-white shadow-md",
    radarClass: "bg-info-text",
    accuracyClass: "bg-info/20 border-info-border/40",
  },
  snapEndpointsToPolyline: true,
  tracking: {
    enableHighAccuracy: false,
    timeoutMs: 8000,
    maximumAgeMs: 60000,
    watchMaximumAgeMs: 30000,
  },
};

/** 1-based label for a route stop — consistent with the step number in the form. */
export function routePinLabel(index: number): string {
  return String(index + 1);
}
