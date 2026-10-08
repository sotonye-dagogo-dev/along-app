/**
 * Admin layout + metrics + bulk-selection metadata.
 *
 * Config-driven: layout breakpoints, sidebar behaviour, metric trend rules,
 * bulk-selection quick presets, and site-config field editors all live here
 * so admin UI stays metadata-driven and non-breaking.
 */

export const ADMIN_LAYOUT_CONFIG = {
  sidebarWidth: 240,
  collapsedWidth: 72,
  mobileBreakpoint: "lg",
  storageKey: "along:admin-sidebar-collapsed",
  contentMaxWidth: 1280,
} as const;

export const ADMIN_METRICS_META = {
  /** When value and delta are both zero → show neutral "No change", never up/down. */
  neutralWhenZero: true,
  trends: [
    { id: "totalUsers", label: "Total Users" },
    { id: "postsToday", label: "Posts Today" },
    { id: "avgValidity", label: "Avg Validity Score" },
    { id: "openBugs", label: "Open Bug Reports" },
  ],
} as const;

export const ADMIN_BULK_SELECT_META = {
  quickPresets: [
    { id: "first10", label: "First 10", count: 10 },
    { id: "first25", label: "First 25", count: 25 },
    { id: "first50", label: "First 50", count: 50 },
  ],
  actions: ["selectAll", "invert", "undo", "clear"] as const,
} as const;

export type AdminBulkActionId = (typeof ADMIN_BULK_SELECT_META.actions)[number];

/** Site-config field editor kinds for non-programmer admins (no raw JSON). */
export type SiteConfigFieldKind = "text" | "number" | "boolean" | "json";

export interface SiteConfigEditorMeta {
  key: string;
  title: string;
  description: string;
  kind: SiteConfigFieldKind;
}

export const SITE_CONFIG_EDITORS: SiteConfigEditorMeta[] = [
  {
    key: "earlyAdopterConfig",
    title: "Early Adopters Badge",
    description: "Toggle + limit + label for the First N Users badge.",
    kind: "json",
  },
  {
    key: "emailConfig",
    title: "Email Sender",
    description: "From name / address used for transactional mail.",
    kind: "json",
  },
  {
    key: "maintenanceMode",
    title: "Maintenance Mode",
    description: "Simple on/off platform flag (boolean).",
    kind: "boolean",
  },
  {
    key: "announcementBanner",
    title: "Announcement Banner",
    description: "Short text banner shown platform-wide.",
    kind: "text",
  },
  {
    key: "inviteRewardPoints",
    title: "Invite Reward Points",
    description: "Points awarded per accepted invite (number).",
    kind: "number",
  },
];

export function inferConfigKind(key: string, value: unknown): SiteConfigFieldKind {
  const known = SITE_CONFIG_EDITORS.find((e) => e.key === key);
  if (known) return known.kind;
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "text";
  return "json";
}

export function formatDelta(deltaPct: number | null, value: number): {
  label: string;
  direction: "up" | "down" | "flat";
} {
  if (deltaPct === null || deltaPct === undefined || Number.isNaN(deltaPct)) {
    return { label: "No data", direction: "flat" };
  }
  // Zero value with zero movement must never render as positive/negative.
  if (value === 0 && deltaPct === 0) {
    return { label: "No change", direction: "flat" };
  }
  if (deltaPct === 0) return { label: "No change", direction: "flat" };
  const sign = deltaPct > 0 ? "+" : "";
  return {
    label: `${sign}${deltaPct.toFixed(1)}%`,
    direction: deltaPct > 0 ? "up" : "down",
  };
}
