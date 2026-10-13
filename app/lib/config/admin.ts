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

/**
 * Admin cursor-pagination meta (config-driven, bulk-safe).
 * Cursor "View more" APPENDS windows so bulk selection (a Set of ids held
 * outside the list) is never lost — page-number replacement is what caused
 * the deferred bulk-select state risk. `pageSize` matches the API default.
 */
export const ADMIN_PAGINATION_META = {
  defaultLimit: 20,
  maxLimit: 50,
  viewMoreLabel: "View more",
} as const;

/**
 * Admin table sort meta — every admin table offers asc/desc sort over an
 * allow-listed field set. `defaultSort` preserves each API's legacy order
 * (non-breaking); the UI sends ?sort=&dir= which APIs validate against
 * `allowed` before applying.
 */
export interface AdminSortOption {
  id: string;
  label: string;
  sort: string;
  dir: "asc" | "desc";
}

export const ADMIN_TABLE_SORT_META: Record<string, { options: AdminSortOption[]; defaultId: string }> = {
  bugs: {
    defaultId: "newest",
    options: [
      { id: "newest", label: "Newest first", sort: "createdAt", dir: "desc" },
      { id: "oldest", label: "Oldest first", sort: "createdAt", dir: "asc" },
      { id: "title-az", label: "Title A–Z", sort: "title", dir: "asc" },
      { id: "title-za", label: "Title Z–A", sort: "title", dir: "desc" },
      { id: "status", label: "Status", sort: "status", dir: "asc" },
      { id: "category", label: "Category", sort: "category", dir: "asc" },
    ],
  },
  users: {
    defaultId: "newest",
    options: [
      { id: "newest", label: "Newest first", sort: "createdAt", dir: "desc" },
      { id: "oldest", label: "Oldest first", sort: "createdAt", dir: "asc" },
      { id: "username-az", label: "Username A–Z", sort: "userName", dir: "asc" },
      { id: "points-desc", label: "Most points", sort: "rewardPoints", dir: "desc" },
      { id: "points-asc", label: "Fewest points", sort: "rewardPoints", dir: "asc" },
    ],
  },
  posts: {
    defaultId: "newest",
    options: [
      { id: "newest", label: "Newest first", sort: "createdAt", dir: "desc" },
      { id: "oldest", label: "Oldest first", sort: "createdAt", dir: "asc" },
      { id: "validity-desc", label: "Highest validity", sort: "validityScore", dir: "desc" },
      { id: "likes-desc", label: "Most liked", sort: "likes", dir: "desc" },
    ],
  },
  reviews: {
    defaultId: "newest",
    options: [
      { id: "newest", label: "Newest first", sort: "createdAt", dir: "desc" },
      { id: "oldest", label: "Oldest first", sort: "createdAt", dir: "asc" },
    ],
  },
} as const;

export type AdminBulkActionId = (typeof ADMIN_BULK_SELECT_META.actions)[number];

/**
 * Admin users deletion-lifecycle filters — metadata-driven so the tablist,
 * the API `?deletion=` query value, and future filters stay in one place.
 * `active` (non-deleted) is the complement of `pending` + `deleted`: accounts
 * that are neither anonymized nor inside the 7-day grace window.
 */
export const ADMIN_USER_FILTERS = {
  options: [
    { id: "all", label: "All", query: null, description: "Every account including archived and deleted." },
    { id: "active", label: "Active", query: "active", description: "Non-deleted accounts with no pending deletion request." },
    { id: "pending", label: "Deletion pending", query: "pending", description: "Accounts inside the 7-day reversible grace window." },
    { id: "deleted", label: "Deleted", query: "deleted", description: "Fully anonymized accounts (no in-app recovery)." },
  ],
  defaultFilter: "all",
} as const;

export type AdminUserFilterId =
  (typeof ADMIN_USER_FILTERS.options)[number]["id"];

/** Normalize a raw filter id (tab state, query param) to a known option. */
export function parseAdminUserFilter(raw: unknown): AdminUserFilterId {
  const id = String(raw ?? "").trim().toLowerCase();
  const known = ADMIN_USER_FILTERS.options.find((o) => o.id === id);
  return (known?.id ?? ADMIN_USER_FILTERS.defaultFilter) as AdminUserFilterId;
}

/** Resolve the `?deletion=` query value for a filter id (null = no filter). */
export function deletionQueryForFilter(filterId: string): string | null {
  const found = ADMIN_USER_FILTERS.options.find((o) => o.id === filterId);
  return found ? (found.query as string | null) : null;
}

/**
 * Per-row admin user action ids. Deleted (fully anonymized) accounts expose
 * view-only — verify / resend-code / role changes cannot revive personal data
 * and recovery is off-platform from backups only.
 */
export const ADMIN_USER_ROW_ACTIONS = {
  ids: [
    "verify",
    "unverify",
    "resend",
    "makeAdmin",
    "demote",
    "view",
    "requestDeletion",
    "cancelDeletion",
    "deleteNow",
  ],
  /** Actions stripped for fully-deleted accounts (everything except view). */
  deletedHidden: [
    "verify",
    "unverify",
    "resend",
    "makeAdmin",
    "demote",
    "requestDeletion",
    "cancelDeletion",
    "deleteNow",
  ],
  viewOnlyFallbackNote:
    "Deleted accounts are view-only — recovery is handled off-platform from backups.",
} as const;

export type AdminUserRowActionId =
  (typeof ADMIN_USER_ROW_ACTIONS.ids)[number];

export interface AdminUserDeletionState {
  isDeleted?: boolean | null;
  deletionScheduledFor?: string | null;
}

/** True when the account is fully anonymized (post-grace, irreversible in-app). */
export function isDeletedAdminUser(
  user: AdminUserDeletionState | null | undefined
): boolean {
  try {
    return (user as { isDeleted?: unknown })?.isDeleted === true;
  } catch {
    return false;
  }
}

/**
 * Pure allow-list for row actions given deletion state. Never throws —
 * unknown states fall back to the pre-change (full) set minus nothing, and
 * deleted always collapses to view-only.
 */
export function allowedUserRowActions(
  user: AdminUserDeletionState | null | undefined
): AdminUserRowActionId[] {
  if (isDeletedAdminUser(user)) return ["view"];
  const pending = Boolean(
    !isDeletedAdminUser(user) &&
      (user as { deletionScheduledFor?: unknown } | null | undefined)
        ?.deletionScheduledFor
  );
  if (pending) {
    return [
      "verify",
      "unverify",
      "resend",
      "makeAdmin",
      "demote",
      "view",
      "cancelDeletion",
      "deleteNow",
    ];
  }
  return [
    "verify",
    "unverify",
    "resend",
    "makeAdmin",
    "demote",
    "view",
    "requestDeletion",
    "deleteNow",
  ];
}

/** Convenience: should this action id render for the given user? */
export function canShowUserRowAction(
  actionId: string,
  user: AdminUserDeletionState | null | undefined
): boolean {
  try {
    return (allowedUserRowActions(user) as string[]).includes(actionId);
  } catch {
    return false;
  }
}

/**
 * Row-actions dropdown metadata — one compact trigger keeps long action lists
 * from elongating rows and prevents mis-taps. Colors are preserved per item
 * via `className` passthrough (see AppTableRowActions).
 */
export const ADMIN_TABLE_ACTIONS_META = {
  triggerLabel: "Row actions",
  triggerAriaLabel: "Open row actions",
  align: "end",
  emptyLabel: "—",
} as const;

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
