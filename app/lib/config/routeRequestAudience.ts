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
}

export const DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG: RouteRequestAudienceConfig = {
  mode: "community",
  maxRecipients: 500,
  excludeDeleted: true,
};

export const ROUTE_REQUEST_AUDIENCE_LIMITS = {
  minRecipients: 1,
  maxRecipients: 5000,
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
  if (!raw || typeof raw !== "object") return { ...fallback };
  const r = raw as Partial<RouteRequestAudienceConfig>;
  return {
    mode: r.mode === "followers" ? "followers" : "community",
    maxRecipients: sanitizeMax(r.maxRecipients, fallback.maxRecipients),
    excludeDeleted: typeof r.excludeDeleted === "boolean" ? r.excludeDeleted : fallback.excludeDeleted,
  };
}

/** Validate an admin-supplied value; returns an error string or null when valid. */
export function validateRouteRequestAudienceValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return "value must be an object";
  const v = value as Partial<RouteRequestAudienceConfig>;
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
  return null;
}
