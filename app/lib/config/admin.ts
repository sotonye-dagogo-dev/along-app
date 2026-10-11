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
    { id: "first10", label: "First 10 signups", count: 10 },
    { id: "first25", label: "First 25 signups", count: 25 },
    { id: "first50", label: "First 50 signups", count: 50 },
    { id: "first100", label: "First 100 signups", count: 100 },
  ],
  /** Quick presets select the earliest-joined N users (createdAt asc), not the first N rows on screen. */
  firstNBySignupOrder: true,
  actions: ["selectAll", "invert", "undo", "clear"] as const,
} as const;

export type AdminBulkActionId = (typeof ADMIN_BULK_SELECT_META.actions)[number];

/**
 * Dashboard data-period toggle — mirrors the user analytics period selector
 * (7/30/90 days) so overview KPIs + signups chart actualize end-to-end.
 * `GET /api/admin/stats?period=` accepts these values; default keeps the
 * legacy 7-day view.
 */
export const ADMIN_DASHBOARD_PERIODS = {
  options: [
    { value: "7", label: "Last 7 days", days: 7 },
    { value: "30", label: "Last 30 days", days: 30 },
    { value: "90", label: "Last 90 days", days: 90 },
  ],
  defaultPeriod: "7",
  /** Clamp guard for the stats API (mirrors analytics 365-day ceiling). */
  minDays: 7,
  maxDays: 90,
} as const;

export type AdminDashboardPeriod =
  (typeof ADMIN_DASHBOARD_PERIODS.options)[number]["value"];

/** Normalize a raw ?period= query value to a supported day count. */
export function parseAdminDashboardPeriod(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) {
    const fallback = ADMIN_DASHBOARD_PERIODS.options.find(
      (o) => o.value === ADMIN_DASHBOARD_PERIODS.defaultPeriod
    );
    return fallback?.days ?? 7;
  }
  if (n <= 7) return 7;
  if (n <= 30) return 30;
  return 90;
}

/**
 * Admin user-deletion copy + behaviour — keeps the 7-day grace request flow
 * and adds the destructive safe path (immediate finalize through the same
 * anonymize pipeline). All UI strings live here so warnings/undo/recovery
 * copy stays consistent across the users table + deletions queue.
 */
export const ADMIN_USER_DELETION_META = {
  requestTitle: "Request deletion?",
  requestDescription:
    "The account and its posts are archived immediately and anonymized after the 7-day grace period. Likes and bookmarks are removed; anonymised posts are retained. The user can reverse until then — reversal restores everything.",
  requestConfirmLabel: "Request deletion",
  requestSuccess: "Deletion requested — 7-day grace started",
  requestUndoMessage: "Deletion request started (7-day grace)",
  requestUndoLabel: "Undo",
  cancelTitle: "Reverse this deletion request?",
  cancelDescription:
    "The account and its posts are restored from the archive. The user is notified in-app (no email, per anti-abuse policy).",
  cancelConfirmLabel: "Reverse request",
  cancelSuccess: "Deletion request reversed — account restored",
  cancelReRequestLabel: "Re-request",
  deleteNowTitle: "Delete this account now?",
  deleteNowDescription:
    "This skips the 7-day grace and anonymizes the account immediately through the same safe pipeline (posts retained anonymised; likes, bookmarks, follows and push subscriptions removed). This cannot be undone in-app — recovery within 30 days is only possible off-platform from database backups.",
  deleteNowConfirmLabel: "Delete now",
  deleteNowSuccess: "Account deleted and anonymized",
  deleteNowRecoveryNote:
    "Recovery within 30 days is handled off-platform from backups — contact the original email.",
  bulkDeleteNowTitle: "Delete selected accounts now?",
  selfDeleteGuard: "Use your profile to delete your own account",
  lastAdminGuard:
    "Last admin cannot be deleted — promote another admin first",
} as const;

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
