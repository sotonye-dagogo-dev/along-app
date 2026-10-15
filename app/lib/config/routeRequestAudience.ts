/**
 * Route-request notification audience configuration.
 *
 * Config-driven + admin-manageable: the live values live in the `SiteConfig`
 * `routeRequestAudience` row (seeded from DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG,
 * editable via /api/admin/config + the Config admin page). This module holds the
 * hardcoded fallback, the SiteConfig key, normalization, validation, and admin
 * UI metadata — zero app deps.
 *
 * Directive: route-request notifications fire for the whole community, whether
 * or not the requester is followed by / following the recipient. Followers are
 * still guaranteed a notification (they are prioritized first), then the net
 * widens to recent community members up to `maxRecipients` so a large user
 * base can never explode the NotificationRecipient fan-out in one write.
 */

export const ROUTE_REQUEST_AUDIENCE_CONFIG_KEY = "routeRequestAudience";

export interface RouteRequestLocationFilterConfig {
  /**
   * Optimistic nearby-first filtering. When true AND the request carries an
   * ephemeral location (requestLat/requestLng, never persisted), recipients
   * with a known fix inside `radiusKm` are notified first. When too few
   * nearby recipients exist (< `minNearby`), the fan-out falls back to the
   * full community audience — nobody is ever silently dropped for lack of
   * location data. Default true (optimistic, safe fallback).
   */
  enabled: boolean;
  /** Radius in km for "nearby" (1–500). */
  radiusKm: number;
  /** Minimum nearby recipients before filtering applies (1–100). */
  minNearby: number;
}

export interface RouteRequestAudienceConfig {
  /**
   * Audience mode. `community` (default) notifies followers first, then fills
   * with recent community members up to maxRecipients. `followers` restores the
   * legacy followers-only behaviour without a code change.
   */
  mode: "community" | "followers";
  /** Hard cap on recipient rows per route-request notification. */
  maxRecipients: number;
  /** When true, soft-deleted/anonymized accounts are excluded (default true). */
  excludeDeleted: boolean;
  /** Optimistic location filtering (optional — absent in older rows = defaults). */
  location?: RouteRequestLocationFilterConfig;
}

export const DEFAULT_ROUTE_REQUEST_LOCATION_FILTER: RouteRequestLocationFilterConfig = {
  enabled: true,
  radiusKm: 50,
  minNearby: 3,
};

export const DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG: RouteRequestAudienceConfig = {
  mode: "community",
  maxRecipients: 500,
  excludeDeleted: true,
  location: { ...DEFAULT_ROUTE_REQUEST_LOCATION_FILTER },
};

export const ROUTE_REQUEST_AUDIENCE_LIMITS = {
  minRecipients: 1,
  maxRecipients: 5000,
  minRadiusKm: 1,
  maxRadiusKm: 500,
  minNearby: 1,
  maxNearby: 100,
} as const;

/** Admin UI metadata (drives the Config page card — metadata-driven). */
export const ROUTE_REQUEST_AUDIENCE_META = {
  key: ROUTE_REQUEST_AUDIENCE_CONFIG_KEY,
  title: "Route Request Audience",
  description:
    "Who gets notified when someone posts a route request. Community notifies followers first, then recent members up to the cap — no follow relationship needed.",
  fields: [
    {
      name: "mode",
      label: "Audience mode",
      type: "text",
      hint: '"community" (followers first, then everyone) or "followers" (legacy).',
    },
    {
      name: "maxRecipients",
      label: "Max recipients per request",
      type: "number",
      hint: "Cap on notification rows per request (1–5000).",
    },
    {
      name: "excludeDeleted",
      label: "Exclude deleted accounts",
      type: "boolean",
      hint: "Skip soft-deleted/anonymized accounts.",
    },
    {
      name: "location.enabled",
      label: "Optimistic nearby filtering",
      type: "boolean",
      hint: "When the request carries a location, prefer nearby members; falls back to everyone when too few are nearby.",
    },
    {
      name: "location.radiusKm",
      label: "Nearby radius (km)",
      type: "number",
      hint: "What counts as nearby (1–500 km).",
    },
    {
      name: "location.minNearby",
      label: "Minimum nearby to filter",
      type: "number",
      hint: "Filter only when at least this many nearby members exist (1–100); otherwise everyone is notified.",
    },
  ],
} as const;

function sanitizeMax(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(
    ROUTE_REQUEST_AUDIENCE_LIMITS.maxRecipients,
    Math.max(ROUTE_REQUEST_AUDIENCE_LIMITS.minRecipients, Math.floor(n))
  );
}

/** Merge a stored SiteConfig value over the defaults (never throws). */
export function normalizeRouteRequestAudienceConfig(
  raw: unknown,
  fallback: RouteRequestAudienceConfig = DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG
): RouteRequestAudienceConfig {
  if (!raw || typeof raw !== "object") {
    return {
      ...fallback,
      location: { ...(fallback.location ?? DEFAULT_ROUTE_REQUEST_LOCATION_FILTER) },
    };
  }
  const r = raw as Partial<RouteRequestAudienceConfig> & { location?: unknown };
  const fallbackLoc = fallback.location ?? DEFAULT_ROUTE_REQUEST_LOCATION_FILTER;
  const rawLoc =
    r.location && typeof r.location === "object" && !Array.isArray(r.location)
      ? (r.location as Partial<RouteRequestLocationFilterConfig>)
      : {};
  const radiusRaw = Number((rawLoc as { radiusKm?: unknown }).radiusKm);
  const nearbyRaw = Number((rawLoc as { minNearby?: unknown }).minNearby);
  return {
    mode: r.mode === "followers" ? "followers" : "community",
    maxRecipients: sanitizeMax(r.maxRecipients, fallback.maxRecipients),
    excludeDeleted: typeof r.excludeDeleted === "boolean" ? r.excludeDeleted : fallback.excludeDeleted,
    location: {
      enabled:
        typeof rawLoc.enabled === "boolean" ? rawLoc.enabled : fallbackLoc.enabled,
      radiusKm: Number.isFinite(radiusRaw)
        ? Math.min(
            ROUTE_REQUEST_AUDIENCE_LIMITS.maxRadiusKm,
            Math.max(ROUTE_REQUEST_AUDIENCE_LIMITS.minRadiusKm, Math.floor(radiusRaw))
          )
        : fallbackLoc.radiusKm,
      minNearby: Number.isFinite(nearbyRaw)
        ? Math.min(
            ROUTE_REQUEST_AUDIENCE_LIMITS.maxNearby,
            Math.max(ROUTE_REQUEST_AUDIENCE_LIMITS.minNearby, Math.floor(nearbyRaw))
          )
        : fallbackLoc.minNearby,
    },
  };
}

/** Validate an admin-supplied value; returns an error string or null when valid. */
export function validateRouteRequestAudienceValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return "value must be an object";
  const v = value as Partial<RouteRequestAudienceConfig> & { location?: unknown };
  if (v.mode !== undefined && v.mode !== "community" && v.mode !== "followers")
    return 'mode must be "community" or "followers"';
  if (v.maxRecipients !== undefined) {
    const n = Number(v.maxRecipients);
    if (!Number.isFinite(n) || Math.floor(n) < ROUTE_REQUEST_AUDIENCE_LIMITS.minRecipients)
      return `maxRecipients must be an integer >= ${ROUTE_REQUEST_AUDIENCE_LIMITS.minRecipients}`;
    if (Math.floor(n) > ROUTE_REQUEST_AUDIENCE_LIMITS.maxRecipients)
      return `maxRecipients must be <= ${ROUTE_REQUEST_AUDIENCE_LIMITS.maxRecipients}`;
  }
  if (v.excludeDeleted !== undefined && typeof v.excludeDeleted !== "boolean")
    return "excludeDeleted must be a boolean";
  if (v.location !== undefined) {
    if (!v.location || typeof v.location !== "object" || Array.isArray(v.location))
      return "location must be an object";
    const loc = v.location as Partial<RouteRequestLocationFilterConfig>;
    if (loc.enabled !== undefined && typeof loc.enabled !== "boolean")
      return "location.enabled must be a boolean";
    if (loc.radiusKm !== undefined) {
      const n = Number(loc.radiusKm);
      if (!Number.isFinite(n)) return "location.radiusKm must be a number";
      if (Math.floor(n) < ROUTE_REQUEST_AUDIENCE_LIMITS.minRadiusKm)
        return `location.radiusKm must be >= ${ROUTE_REQUEST_AUDIENCE_LIMITS.minRadiusKm}`;
      if (Math.floor(n) > ROUTE_REQUEST_AUDIENCE_LIMITS.maxRadiusKm)
        return `location.radiusKm must be <= ${ROUTE_REQUEST_AUDIENCE_LIMITS.maxRadiusKm}`;
    }
    if (loc.minNearby !== undefined) {
      const n = Number(loc.minNearby);
      if (!Number.isFinite(n)) return "location.minNearby must be a number";
      if (Math.floor(n) < ROUTE_REQUEST_AUDIENCE_LIMITS.minNearby)
        return `location.minNearby must be >= ${ROUTE_REQUEST_AUDIENCE_LIMITS.minNearby}`;
      if (Math.floor(n) > ROUTE_REQUEST_AUDIENCE_LIMITS.maxNearby)
        return `location.minNearby must be <= ${ROUTE_REQUEST_AUDIENCE_LIMITS.maxNearby}`;
    }
  }
  return null;
}
