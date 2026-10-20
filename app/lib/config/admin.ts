/**
 * Admin layout + metrics + bulk-selection metadata.
 *
 * Config-driven: layout breakpoints, sidebar behaviour, metric trend rules,
 * bulk-selection quick presets, and site-config field editors all live here
 * so admin UI stays metadata-driven and non-breaking.
 */

import { DEFAULT_EARLY_ADOPTER_CONFIG } from "./earlyAdopter";
import { validateEarlyAdopterConfigValue } from "./earlyAdopter";
import { DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG } from "./routeRequestAudience";
import { validateRouteRequestAudienceValue } from "./routeRequestAudience";
import {
  DEFAULT_PLATFORM_TOUR_CONFIG,
  validatePlatformTourConfigValue,
} from "./platformTour";
import {
  DEFAULT_FEED_CONFIG,
  FEED_DIVERSITY_CONFIG,
  FEED_STREAM_CONFIG,
} from "./feedAlgorithm";
import { validateFeedDiversityConfigValue } from "./feedAlgorithm";
import { DEFAULT_EMAIL_CONFIG } from "./email";
import { INVITE_CONFIG } from "./inviteConfig";
import { PAGINATION_CONFIG } from "./pagination";
import {
  normalizeAnnouncements,
  isSafeAnnouncementHref,
  SITE_NOTICE_CONFIG,
} from "./siteNotice";

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
 * the deferred bulk-select state risk. `defaultLimit`/`maxLimit` mirror the
 * admin API's clamp (`PAGINATION_CONFIG.admin`) so UI and API can never drift.
 */
export const ADMIN_PAGINATION_META = {
  defaultLimit: PAGINATION_CONFIG.admin.defaultLimit,
  maxLimit: PAGINATION_CONFIG.admin.maxLimit,
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
    key: "routeRequestAudience",
    title: "Route Request Audience",
    description: "Community vs followers-only + max recipients per request.",
    kind: "json",
  },
  {
    key: "feedDiversity",
    title: "Feed Diversity",
    description: "Max consecutive runs, lookahead window, jitter weight.",
    kind: "json",
  },
  {
    key: "feedAlgorithm",
    title: "Feed Algorithm Weights",
    description: "Follow / tag / trending / discovery scoring weights (advanced JSON).",
    kind: "json",
  },
  {
    key: "feedStream",
    title: "Feed Stream",
    description: "Pagination + polling + cache windows (advanced JSON).",
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
    key: "refreshNotice",
    title: "Refresh Notice",
    description:
      "After maintenance/deploys, ask clients to refresh so they pick up fresh code + data (keeps sessions and drafts).",
    kind: "boolean",
  },
  // `announcementBanner` (legacy single-string banner) is DEPRECATED — the
  // rich `announcements` list below supersedes it. Kept registered only so
  // stored values + validators stay back-compatible; no admin editor.
  {
    key: "announcements",
    title: "Announcements",
    description:
      "Multiple announcements with optional call-to-action buttons (list editor below).",
    kind: "json",
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

/**
 * Hardcoded admin-config defaults registry — the Config Studio's
 * "shipped defaults" twin of the Email Studio (`DEFAULT_EMAIL_TEMPLATES`)
 * and Blog Studio (`getDefaultBlogPosts`).
 *
 * Contract (mirrors both studios, DB-aware):
 * - Readers merge stored SiteConfig rows OVER these defaults at read time
 *   (`mergeAdminConfigsWithDefaults`) — stored wins per key, new shipped
 *   defaults backfill automatically without a migration.
 * - Hardcoded updates NEVER overwrite DB-saved versions; the explicit
 *   `restore` path (API `PUT { restore: key }` → row deleted) is the only
 *   way a default shines through again.
 * - The Config page renders every entry here even when the DB row is
 *   missing, so a fresh database still shows a fully configurable board
 *   with no programming knowledge required.
 */
export interface AdminConfigDefault {
  key: string;
  title: string;
  description: string;
  kind: SiteConfigFieldKind;
  defaultValue: unknown;
}

export const ADMIN_CONFIG_DEFAULTS: AdminConfigDefault[] = [
  {
    key: "earlyAdopterConfig",
    title: "Early Adopters Badge",
    description:
      "Toggle + limit + label for the First N Users badge. Qualification is automatic (N earliest-joined users).",
    kind: "json",
    defaultValue: { ...DEFAULT_EARLY_ADOPTER_CONFIG },
  },
  {
    key: "platformTourConfig",
    title: "Platform Tour",
    description:
      "Guided spotlight tour switches: on/off, auto-start for new users, and the start delay. Step content ships with the bundle.",
    kind: "json",
    defaultValue: {
      enabled: DEFAULT_PLATFORM_TOUR_CONFIG.enabled,
      autoStart: DEFAULT_PLATFORM_TOUR_CONFIG.autoStart,
      autoStartDelayMs: DEFAULT_PLATFORM_TOUR_CONFIG.autoStartDelayMs,
    },
  },
  {
    key: "feedDiversity",
    title: "Feed Diversity",
    description:
      "Max consecutive runs, lookahead window, jitter weight. Worst case degrades to relevance order.",
    kind: "json",
    defaultValue: { ...FEED_DIVERSITY_CONFIG },
  },
  {
    key: "feedAlgorithm",
    title: "Feed Algorithm Weights",
    description:
      "Follow / tag / trending / discovery scoring weights. Stored rows merge by spread — partial edits keep working.",
    kind: "json",
    defaultValue: { ...DEFAULT_FEED_CONFIG },
  },
  {
    key: "feedStream",
    title: "Feed Stream",
    description:
      "Pagination + polling + cache windows for the home feed stream.",
    kind: "json",
    defaultValue: { ...FEED_STREAM_CONFIG },
  },
  {
    key: "emailConfig",
    title: "Email Sender",
    description: "From name / address used for transactional mail.",
    kind: "json",
    defaultValue: { ...DEFAULT_EMAIL_CONFIG },
  },
  {
    key: "maintenanceMode",
    title: "Maintenance Mode",
    description: "Simple on/off platform flag (boolean).",
    kind: "boolean",
    defaultValue: false,
  },
  {
    key: "refreshNotice",
    title: "Refresh Notice",
    description:
      "When on, a 'kindly refresh' strip prompts clients to safely refresh — clears stale caches, reboots the service worker, keeps sessions + drafts. Default off.",
    kind: "boolean",
    defaultValue: false,
  },
  {
    // Deprecated: superseded by the rich `announcements` list. No admin UI —
    // registered so stored rows + merge/validate stay back-compatible.
    key: "announcementBanner",
    title: "Announcement Banner (deprecated)",
    description:
      "Deprecated — use the Announcements list instead. Kept only for stored-value back-compat; no longer editable.",
    kind: "text",
    defaultValue: "",
  },
  {
    key: "announcements",
    title: "Announcements",
    description:
      "Rich announcement list with optional CTA per entry (max 5). Empty list hides them.",
    kind: "json",
    defaultValue: [],
  },
  {
    key: "inviteRewardPoints",
    title: "Invite Reward Points",
    description: "Points awarded per accepted invite (number).",
    kind: "number",
    defaultValue: INVITE_CONFIG.pointsForInviteAccepted,
  },
  {
    key: "routeRequestAudience",
    title: "Route Request Audience",
    description:
      "Who gets notified on a route request. Community = followers first, then recent members up to the cap (no follow needed).",
    kind: "json",
    defaultValue: { ...DEFAULT_ROUTE_REQUEST_AUDIENCE_CONFIG },
  },
];

/** Shipped default entry for a key, or undefined for ad-hoc custom keys. */
export function getAdminConfigDefault(key: string): AdminConfigDefault | undefined {
  try {
    return ADMIN_CONFIG_DEFAULTS.find((d) => d.key === String(key ?? ""));
  } catch {
    return undefined;
  }
}

export type AdminConfigSource = "default" | "customized" | "custom";

export interface MergedAdminConfig {
  key: string;
  value: unknown;
  /** default = shipped fallback (no DB row); customized = DB row over a shipped default; custom = ad-hoc key with no shipped default. */
  source: AdminConfigSource;
  /** Shipped fallback value when one exists (for "Default: …" display + restore). */
  defaultValue?: unknown;
}

/**
 * Merge stored SiteConfig rows over the shipped defaults (never throws).
 * Stored wins per key; missing known keys backfill from defaults with
 * `source: "default"`; unknown stored keys pass through as `"custom"`.
 * Pure — safe for API + client + tests.
 */
export function mergeAdminConfigsWithDefaults(
  stored: { key: string; value: unknown }[]
): MergedAdminConfig[] {
  try {
    const rows = Array.isArray(stored) ? stored : [];
    const seen = new Set<string>();
    const merged: MergedAdminConfig[] = [];
    for (const row of rows) {
      const key = String((row as { key?: unknown })?.key ?? "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const def = getAdminConfigDefault(key);
      merged.push({
        key,
        value: (row as { value?: unknown })?.value,
        source: def ? "customized" : "custom",
        ...(def ? { defaultValue: def.defaultValue } : {}),
      });
    }
    for (const def of ADMIN_CONFIG_DEFAULTS) {
      if (seen.has(def.key)) continue;
      merged.push({
        key: def.key,
        value: def.defaultValue,
        source: "default",
        defaultValue: def.defaultValue,
      });
    }
    merged.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return merged;
  } catch {
    return [];
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function finiteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Central admin-config validator — one gate for every known key so the
 * API rejects bad shapes with a clear 400 instead of silently storing a
 * row that degrades to defaults at read time. Unknown (ad-hoc) keys
 * pass (generic kind editors validate them). Never throws.
 */export function validateAdminConfigValue(key: string, value: unknown): string | null {
  try {
    const k = String(key ?? "");
    if (k === "earlyAdopterConfig") return validateEarlyAdopterConfigValue(value);
    if (k === "routeRequestAudience") return validateRouteRequestAudienceValue(value);
    if (k === "platformTourConfig") return validatePlatformTourConfigValue(value);
    if (k === "feedDiversity") return validateFeedDiversityConfigValue(value);
    if (k === "feedAlgorithm") {
      if (!isPlainObject(value)) return "value must be an object";
      const numericKeys = [
        "followingWeight",
        "matchingTagsWeight",
        "trendingWeight",
        "ownPostsWeight",
        "discoveryWeight",
        "openRequestWeight",
        "locationBonus",
        "cacheTtlSeconds",
        "pageSize",
      ];
      for (const field of numericKeys) {
        const raw = (value as Record<string, unknown>)[field];
        if (raw === undefined) continue;
        if (finiteNumber(raw) === null) return `${field} must be a number`;
      }
      const pageSize = (value as Record<string, unknown>).pageSize;
      if (pageSize !== undefined && Math.floor(Number(pageSize)) < 1)
        return "pageSize must be an integer >= 1";
      return null;
    }
    if (k === "feedStream") {
      if (!isPlainObject(value)) return "value must be an object";
      const numericKeys = ["pageSize", "pollIntervalMs", "freshSec", "retentionSec", "maxExcludeIds"];
      for (const field of numericKeys) {
        const raw = (value as Record<string, unknown>)[field];
        if (raw === undefined) continue;
        if (finiteNumber(raw) === null) return `${field} must be a number`;
      }
      return null;
    }
    if (k === "emailConfig") {
      if (!isPlainObject(value)) return "value must be an object";
      const v = value as Record<string, unknown>;
      for (const field of ["fromName", "fromEmail", "replyTo"]) {
        const raw = v[field];
        if (raw === undefined) continue;
        if (typeof raw !== "string" || raw.trim().length === 0)
          return `${field} must be a non-empty string`;
      }
      const mail = v.fromEmail;
      if (mail !== undefined && !String(mail).includes("@"))
        return "fromEmail must be a valid email address";
      return null;
    }
    if (k === "maintenanceMode") {
      return typeof value === "boolean" ? null : "value must be a boolean";
    }
    if (k === "refreshNotice") {
      return typeof value === "boolean" ? null : "value must be a boolean";
    }
    if (k === "announcementBanner") {
      if (typeof value !== "string") return "value must be a string";
      if (value.length > 500) return "value must be <= 500 chars";
      return null;
    }
    if (k === "announcements") {
      if (!Array.isArray(value)) return "value must be a list of announcements";
      if (value.length > SITE_NOTICE_CONFIG.announcement.maxItems)
        return `at most ${SITE_NOTICE_CONFIG.announcement.maxItems} announcements allowed`;
      for (const [index, raw] of value.entries()) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          return `announcement #${index + 1} must be an object`;
        const item = raw as Record<string, unknown>;
        if (typeof item.body !== "string" || item.body.trim().length === 0)
          return `announcement #${index + 1} needs a non-empty body`;
        if (String(item.body).length > SITE_NOTICE_CONFIG.announcement.maxChars)
          return `announcement #${index + 1} body must be <= ${SITE_NOTICE_CONFIG.announcement.maxChars} chars`;
        if (
          item.ctaLabel !== undefined &&
          item.ctaLabel !== null &&
          typeof item.ctaLabel !== "string"
        )
          return `announcement #${index + 1} CTA label must be a string`;
        if (
          typeof item.ctaLabel === "string" &&
          item.ctaLabel.length > SITE_NOTICE_CONFIG.announcement.maxCtaLabelChars
        )
          return `announcement #${index + 1} CTA label must be <= ${SITE_NOTICE_CONFIG.announcement.maxCtaLabelChars} chars`;
        if (item.ctaHref !== undefined && item.ctaHref !== null) {
          if (typeof item.ctaHref !== "string")
            return `announcement #${index + 1} CTA link must be a string`;
          if (!isSafeAnnouncementHref(item.ctaHref.trim()))
            return `announcement #${index + 1} CTA link must be an internal path (/…) or https:// URL`;
        }
        // Round-trip through the normalizer — stored rows always match the
        // shape the banner island renders (no silent drops at read time).
        if (normalizeAnnouncements([item]).length !== 1)
          return `announcement #${index + 1} is not displayable (empty body?)`;
      }
      return null;
    }
    if (k === "inviteRewardPoints") {
      const n = finiteNumber(value);
      if (n === null || Math.floor(n) < 0) return "value must be a number >= 0";
      if (Math.floor(n) > 100000) return "value must be <= 100000";
      return null;
    }
    return null;
  } catch {
    return "invalid value";
  }
}

/**
 * No-code card metadata for the Config Studio — every card below renders
 * as toggles / text / number inputs (never raw JSON), so non-programmer
 * admins can configure the platform. Early Adopters + Feed Diversity keep
 * their bespoke cards on the page (same metadata shape, richer editors);
 * everything here renders through one generic `SimpleConfigCard`.
 *
 * Single-field cards use field id `"value"` (primitive read/write);
 * multi-field cards read/write an object spread-merged over the shipped
 * default (partial stored rows keep working, same as feedService).
 */
export interface AdminSimpleFieldMeta {
  id: string;
  label: string;
  hint: string;
  type: "text" | "number" | "boolean";
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface AdminSimpleCardMeta {
  key: string;
  title: string;
  description: string;
  fields: AdminSimpleFieldMeta[];
}

export const ADMIN_SIMPLE_CONFIG_CARDS: AdminSimpleCardMeta[] = [
  {
    key: "maintenanceMode",
    title: "Maintenance Mode",
    description: "Simple on/off platform flag. No code, no JSON.",
    fields: [
      {
        id: "value",
        label: "Enable maintenance mode",
        hint: "When on, the platform shows a maintenance notice.",
        type: "boolean",
      },
    ],
  },
  {
    key: "refreshNotice",
    title: "Refresh Notice",
    description:
      "Post-maintenance strip that asks clients to safely refresh — keeps signed-in sessions and drafts, clears stale caches, reboots the service worker.",
    fields: [
      {
        id: "value",
        label: "Show 'kindly refresh' notice",
        hint: "Default off. Turn on after deploys/maintenance so clients pick up fresh code + data.",
        type: "boolean",
      },
    ],
  },
  // `announcementBanner` card removed — deprecated by the rich Announcements
  // list editor above (key stays registered in ADMIN_CONFIG_DEFAULTS for
  // back-compat; hidden via ADMIN_DEPRECATED_CONFIG_KEYS).
  {
    key: "inviteRewardPoints",
    title: "Invite Reward Points",
    description: "Points awarded per accepted invite.",
    fields: [
      {
        id: "value",
        label: "Points per accepted invite",
        hint: "Whole number, 0 or more.",
        type: "number",
        min: 0,
        max: 100000,
        step: 1,
      },
    ],
  },
  {
    key: "feedAlgorithm",
    title: "Feed Algorithm Weights",
    description:
      "Follow / tag / trending / discovery scoring weights. Small numbers tune the mix — the feed never drops rows.",
    fields: [
      { id: "followingWeight", label: "Following", hint: "Affinity for followed authors.", type: "number", min: 0, max: 5, step: 0.05 },
      { id: "matchingTagsWeight", label: "Matching tags", hint: "Affinity for your tags.", type: "number", min: 0, max: 5, step: 0.05 },
      { id: "trendingWeight", label: "Trending", hint: "Boost for trending posts.", type: "number", min: 0, max: 5, step: 0.05 },
      { id: "ownPostsWeight", label: "Own posts", hint: "So your own posts keep surfacing.", type: "number", min: 0, max: 5, step: 0.05 },
      { id: "discoveryWeight", label: "Discovery", hint: "Out-of-network recent posts.", type: "number", min: 0, max: 5, step: 0.05 },
      { id: "openRequestWeight", label: "Open requests", hint: "Boost for open route requests.", type: "number", min: 0, max: 5, step: 0.05 },
      { id: "locationBonus", label: "Nearby bonus", hint: "Extra for routes near you.", type: "number", min: 0, max: 5, step: 0.05 },
      { id: "pageSize", label: "Page size", hint: "Posts per feed page.", type: "number", min: 1, max: 50, step: 1 },
      { id: "cacheTtlSeconds", label: "Cache TTL (s)", hint: "Feed cache lifetime.", type: "number", min: 0, max: 3600, step: 30 },
    ],
  },
  {
    key: "feedStream",
    title: "Feed Stream",
    description: "Pagination + polling + cache windows for the home feed stream.",
    fields: [
      { id: "pageSize", label: "Page size", hint: "Posts per stream request.", type: "number", min: 1, max: 50, step: 1 },
      { id: "pollIntervalMs", label: "Poll interval (ms)", hint: "Background new-post checks.", type: "number", min: 5000, max: 300000, step: 5000 },
      { id: "freshSec", label: "Fresh window (s)", hint: "Cached feed serves without network.", type: "number", min: 0, max: 600, step: 5 },
      { id: "retentionSec", label: "Retention (s)", hint: "Stale feed kept for instant paint.", type: "number", min: 60, max: 7200, step: 60 },
      { id: "maxExcludeIds", label: "Max exclude ids", hint: "Cap on pagination dedup ids.", type: "number", min: 10, max: 1000, step: 10 },
    ],
  },
  {
    key: "routeRequestAudience",
    title: "Route Request Audience",
    description: "Who gets notified on a route request — no code, no JSON.",
    fields: [
      { id: "mode", label: "Audience mode", hint: '"community" notifies everyone (followers first); "followers" is legacy.', type: "text", placeholder: "community" },
      { id: "maxRecipients", label: "Max recipients", hint: "Cap on notification rows per request.", type: "number", min: 1, max: 5000, step: 1 },
      { id: "excludeDeleted", label: "Exclude deleted accounts", hint: "Skip soft-deleted accounts.", type: "boolean" },
    ],
  },
  {
    key: "platformTourConfig",
    title: "Platform Tour",
    description: "Guided spotlight tour switches — no code, no JSON. Step content ships with the bundle.",
    fields: [
      { id: "enabled", label: "Tour enabled", hint: "When on, the guided tour (spotlight + steps) is available.", type: "boolean" },
      { id: "autoStart", label: "Auto-start", hint: "Start the tour once automatically for signed-in users who haven't taken it.", type: "boolean" },
      { id: "autoStartDelayMs", label: "Auto-start delay (ms)", hint: "Wait after the dashboard loads before the tour opens.", type: "number", min: 0, max: 60000, step: 250 },
    ],
  },
];

/**
 * Studio-managed SiteConfig keys — blog + email live in their dedicated
 * studios (`/admin/blog`, `/admin/email`), which ship visual builders,
 * previews, and send flows the generic Config page cannot offer. These keys
 * never render as editable cards or raw JSON rows on the Config page;
 * they render as link cards (ADMIN_STUDIO_LINKS) pointing at the studios.
 * The shipped defaults + central validator stay in this module so the API
 * gate and read-time fallbacks keep working — only the Config-page surface
 * is a link, never an editor.
 */
export const ADMIN_STUDIO_MANAGED_KEYS = [
  "blogPosts",
  "emailConfig",
  "emailTemplates",
  "emailTemplateToggles",
] as const;

export interface AdminStudioLinkMeta {
  /** Studio-managed SiteConfig key(s) this card stands in for. */
  keys: readonly string[];
  title: string;
  description: string;
  /** Admin route of the dedicated studio. */
  href: "/admin/email" | "/admin/blog";
  ctaLabel: string;
}

/**
 * Link cards replacing editable Config-page sections for blog + email.
 * Metadata-driven: the Config page maps over this (never hardcoded
 * hrefs/labels), so future studios join by appending one entry here.
 */
export const ADMIN_STUDIO_LINKS: AdminStudioLinkMeta[] = [
  {
    keys: ["emailConfig", "emailTemplates", "emailTemplateToggles"],
    title: "Email Studio",
    description:
      "Sender identity, templates, and sends — visual builder, live preview, and recipient search live here.",
    href: "/admin/email",
    ctaLabel: "Open Email Studio",
  },
  {
    keys: ["blogPosts"],
    title: "Blog Studio",
    description:
      "Draft, publish, archive, and edit blog posts — visual builder with preview lives here.",
    href: "/admin/blog",
    ctaLabel: "Open Blog Studio",
  },
];

/**
 * Deprecated config keys — once owned a dedicated admin editor, superseded
 * by newer config, and intentionally have NO UI anymore (stored values keep
 * working; validators stay registered). Hidden from every admin surface
 * (simple cards + raw JSON list).
 */
export const ADMIN_DEPRECATED_CONFIG_KEYS = [
  // Legacy single-string banner — superseded by the rich `announcements`
  // list editor. Never used by an admin in production; safe to hide fully.
  "announcementBanner",
] as const;

/** Card keys with dedicated (non-generic) editors — hidden from the raw list. */
export const ADMIN_DEDICATED_CONFIG_KEYS = [
  "earlyAdopterConfig",
  "feedDiversity",
  // Rich announcements: bespoke list editor on the Config page (no JSON).
  "announcements",
  ...ADMIN_DEPRECATED_CONFIG_KEYS,
  ...ADMIN_STUDIO_MANAGED_KEYS,
  ...ADMIN_SIMPLE_CONFIG_CARDS.map((c) => c.key),
] as const;
