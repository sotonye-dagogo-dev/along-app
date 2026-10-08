/**
 * Early-adopter ("First N users") badge configuration.
 *
 * Config-driven + admin-manageable: the live values live in the `SiteConfig`
 * `earlyAdopterConfig` row (seeded from DEFAULT_EARLY_ADOPTER_CONFIG, editable
 * via /api/admin/config + the Config admin page's dedicated Early Adopters
 * card). This module holds the hardcoded fallback, the SiteConfig key, label
 * formatting, validation, and badge display metadata — zero app deps.
 */

export const EARLY_ADOPTER_CONFIG_KEY = "earlyAdopterConfig";

export interface EarlyAdopterConfig {
  /** Master switch — when false no badge is shown anywhere. */
  enabled: boolean;
  /** How many earliest-joined users qualify (ranked by User.createdAt asc). */
  limit: number;
  /**
   * Badge label template. Supports {N} (configured total) and {rank}
   * (the user's join rank, 1-based). Default renders e.g. "First 100 Users #42".
   */
  badgeLabelTemplate: string;
}

export const DEFAULT_EARLY_ADOPTER_CONFIG: EarlyAdopterConfig = {
  enabled: true,
  limit: 100,
  badgeLabelTemplate: "First {N} Users #{rank}",
};

export const EARLY_ADOPTER_LIMITS = {
  minLimit: 1,
  maxLimit: 100000,
  maxLabelLength: 80,
} as const;

/** Admin UI metadata (drives the Config page card — metadata-driven). */
export const EARLY_ADOPTER_CONFIG_META = {
  key: EARLY_ADOPTER_CONFIG_KEY,
  title: "Early Adopters Badge",
  description:
    "Toggle the “First N Users #n” badge shown on user profiles. Qualification is automatic: the N earliest-joined users by account creation date.",
  fields: [
    {
      name: "enabled",
      label: "Show badge on profiles",
      type: "boolean",
      hint: "Master switch for badge visibility everywhere.",
    },
    {
      name: "limit",
      label: "First N users",
      type: "number",
      hint: "Total number of earliest users that qualify.",
    },
    {
      name: "badgeLabelTemplate",
      label: "Badge label",
      type: "text",
      hint: "Use {N} for the total and {rank} for the user's number.",
    },
  ],
} as const;

/** Badge display metadata (colors, icon name, tooltip). */
export const EARLY_ADOPTER_BADGE_DISPLAY = {
  icon: "Sparkles",
  background: "linear-gradient(135deg, #7c3aed22, #f59e0b22)",
  border: "1px solid #a78bfa55",
  color: "#7c3aed",
  tooltipTemplate: "Among the first {N} members to join (#{rank})",
} as const;

function sanitizeLimit(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(
    EARLY_ADOPTER_LIMITS.maxLimit,
    Math.max(EARLY_ADOPTER_LIMITS.minLimit, Math.floor(n))
  );
}

function sanitizeTemplate(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim().slice(0, EARLY_ADOPTER_LIMITS.maxLabelLength);
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Merge a stored SiteConfig value over the defaults (never throws). */
export function normalizeEarlyAdopterConfig(
  raw: unknown,
  fallback: EarlyAdopterConfig = DEFAULT_EARLY_ADOPTER_CONFIG
): EarlyAdopterConfig {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const r = raw as Partial<EarlyAdopterConfig>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : fallback.enabled,
    limit: sanitizeLimit(r.limit, fallback.limit),
    badgeLabelTemplate: sanitizeTemplate(
      r.badgeLabelTemplate,
      fallback.badgeLabelTemplate
    ),
  };
}

/** Validate an admin-supplied value; returns an error string or null when valid. */
export function validateEarlyAdopterConfigValue(
  value: unknown
): string | null {
  if (!value || typeof value !== "object") return "value must be an object";
  const v = value as Partial<EarlyAdopterConfig>;
  if (typeof v.enabled !== "boolean") return "enabled must be a boolean";
  const n = Number(v.limit);
  if (!Number.isFinite(n) || Math.floor(n) < EARLY_ADOPTER_LIMITS.minLimit)
    return `limit must be an integer >= ${EARLY_ADOPTER_LIMITS.minLimit}`;
  if (Math.floor(n) > EARLY_ADOPTER_LIMITS.maxLimit)
    return `limit must be <= ${EARLY_ADOPTER_LIMITS.maxLimit}`;
  if (typeof v.badgeLabelTemplate !== "string" || v.badgeLabelTemplate.trim().length === 0)
    return "badgeLabelTemplate must be a non-empty string";
  if (v.badgeLabelTemplate.length > EARLY_ADOPTER_LIMITS.maxLabelLength)
    return `badgeLabelTemplate must be <= ${EARLY_ADOPTER_LIMITS.maxLabelLength} chars`;
  return null;
}

/** Render e.g. "First 100 Users #42" from template + rank. */
export function buildEarlyAdopterLabel(
  config: Pick<EarlyAdopterConfig, "limit" | "badgeLabelTemplate">,
  rank: number
): string {
  return config.badgeLabelTemplate
    .split("{N}")
    .join(String(config.limit))
    .split("{rank}")
    .join(String(rank));
}

/** Render the tooltip text for a rank. */
export function buildEarlyAdopterTooltip(
  limit: number,
  rank: number
): string {
  return EARLY_ADOPTER_BADGE_DISPLAY.tooltipTemplate
    .split("{N}")
    .join(String(limit))
    .split("{rank}")
    .join(String(rank));
}
