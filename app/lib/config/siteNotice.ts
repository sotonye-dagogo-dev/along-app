/**
 * Site notice registry — maintenance mode, refresh notice, announcements.
 *
 * Single source of truth for the platform-wide notice configs
 * (`maintenanceMode`, `refreshNotice`, `announcements`, plus the deprecated
 * `announcementBanner` kept for stored-value/API back-compat only)
 * that live in SiteConfig and are edited via the admin Site-config board.
 * Everything downstream reads from here: the public `/api/site-config`
 * endpoint, the `<SiteNotices />` banner island, and the middleware
 * enforcement branch.
 *
 * Edge-safe by design: pure data + pure helpers only (no prisma, no node
 * builtins) so `middleware.ts` can import it on the Edge runtime.
 */

export const SITE_NOTICE_CONFIG = {
  /** SiteConfig keys (must match the admin-site-config editor registrations). */
  siteConfigKeys: {
    maintenance: "maintenanceMode",
    /** @deprecated Legacy single-string banner — superseded by `announcements`. Kept for API back-compat; no UI. */
    announcement: "announcementBanner",
    /** Post-maintenance/deploy "kindly refresh" toggle (default off). */
    refresh: "refreshNotice",
    /** Rich announcement list with optional CTA (default empty). */
    announcements: "announcements",
  },
  /** Public endpoint the banner island polls. Already PWA-cacheable. */
  endpoint: "/api/site-config",
  /** Client refresh policy: mount + interval + online + focus. */
  refresh: {
    intervalMs: 60_000,
    onFocus: true,
    onOnline: true,
    /**
     * localStorage key: timestamp of the last safe-refresh click. Written
     * by `safeClientRefresh` (preserved through its storage clear) so a
     * user who already refreshed never sees the strip again within the TTL.
     */
    completedAtKey: "along-safe-refresh-done-at",
    /**
     * How long a completed refresh suppresses the strip (7 days — mirrors
     * the push-prompt dismiss window). After the TTL the admin toggle can
     * re-prompt; the catch-all note covers every in-between case.
     */
    completedTtlMs: 7 * 24 * 60 * 60 * 1000,
  },
  announcement: {
    maxChars: 500,
    /** sessionStorage (per-tab) — dismissed notices stay gone for the session. */
    dismissStorageKey: "along-announcement-dismissed",
    /** Per-id prefix so multiple announcements dismiss independently. */
    dismissIdPrefix: "along-announcement-dismissed:",
    /** Cap on rich announcements stored/rendered at once. */
    maxItems: 5,
    maxCtaLabelChars: 40,
    maxIdChars: 80,
  },
  copy: {
    maintenance: {
      title: "Under maintenance",
      body: "Along is undergoing maintenance right now. Reading still works — posting and saving are paused until we're back.",
      adminNote: "Admin tools stay available to you during maintenance.",
    },
    refresh: {
      title: "Update ready",
      body: "We've made updates — kindly refresh to get the latest version. You stay signed in and keep your drafts.",
      /** Catch-all line — covers manual refreshes / lost-flag edge cases. */
      note: "Already refreshed or updated? You can ignore this notice.",
      action: "Refresh now",
      pending: "Refreshing…",
    },
    announcementLabel: "Announcement",
    dismiss: "Dismiss notice",
  },
  i18nKeys: {
    maintenanceTitle: "siteNotice.maintenanceTitle",
    maintenanceBody: "siteNotice.maintenanceBody",
    maintenanceAdminNote: "siteNotice.maintenanceAdminNote",
    refreshTitle: "siteNotice.refreshTitle",
    refreshBody: "siteNotice.refreshBody",
    refreshNote: "siteNotice.refreshNote",
    refreshAction: "siteNotice.refreshAction",
    refreshPending: "siteNotice.refreshPending",
    announcementLabel: "siteNotice.announcementLabel",
    dismiss: "siteNotice.dismiss",
  },
  /**
   * Token-driven strip styles — theme-aware, no hardcoded hex. Warning
   * surfaces use the opaque `--color-warning-surface` token so the strip
   * stays readable in dark theme (translucent amber wash-out fix).
   */
  tokens: {
    maintenance: {
      background: "var(--color-warning-surface, #FEF3C7)",
      border: "1px solid var(--color-warning-border, #FCD34D)",
      color: "var(--color-warning-text, #92400E)",
    },
    refresh: {
      background: "var(--color-bg-card, #FFFFFF)",
      border: "1px solid var(--color-primary, #00A862)",
      color: "var(--color-text-primary, #1A1A1A)",
      actionBackground: "var(--color-primary, #00A862)",
      actionColor: "#FFFFFF",
    },
    announcement: {
      background: "var(--color-bg-card, #FFFFFF)",
      border: "1px solid var(--color-border, #E5E7EB)",
      color: "var(--color-text-primary, #1A1A1A)",
      ctaBackground: "var(--color-primary, #00A862)",
      ctaColor: "#FFFFFF",
    },
  },
  /**
   * Middleware enforcement — soft maintenance: reads keep working, mutating
   * API traffic gets a 503. Fail-open on every error path (redis down, flag
   * unreadable) so a broken cache can never take the platform offline.
   */
  enforcement: {
    enabled: true,
    blockedMethods: ["POST", "PUT", "PATCH", "DELETE"] as const,
    /**
     * Always-allowed prefixes: admin management (incl. flipping the flag
     * back off), the cron worker, and the auth session surface so admins can
     * log in / refresh / log out while maintenance is on.
     */
    exemptPathPrefixes: [
      "/api/admin",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/otp",
      "/api/auth/verify-email",
      "/api/auth/google",
      "/api/auth/refresh",
      "/api/auth/me",
      "/api/auth/logout",
      "/api/cron",
    ],
    /** Module-scope memo TTL in middleware — bounds staleness after a toggle. */
    memoTtlMs: 15_000,
    status: 503,
    code: "MAINTENANCE",
    message: "Along is under maintenance. Reading still works — try again shortly.",
    /** Retry hint for clients that honour it. */
    retryAfterSeconds: "60",
  },
} as const;

/** Coerce any stored SiteConfig value into a strict maintenance flag. */
export function normalizeMaintenanceFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

/**
 * True when the safe-refresh once-flag is present and still within its
 * suppression TTL. The flag stores the epoch-ms timestamp of the last
 * safe-refresh click (`SITE_NOTICE_CONFIG.refresh.completedAtKey`); while
 * fresh, the "kindly refresh" strip stays hidden so a completed refresh
 * never nags. Never throws — garbage/missing values read as "not done".
 */
export function isSafeRefreshCompleted(
  storedValue: string | null | undefined,
  now: number,
): boolean {
  const at = Number(storedValue ?? "");
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < SITE_NOTICE_CONFIG.refresh.completedTtlMs;
}

/**
 * Coerce any stored SiteConfig value into display-safe announcement text:
 * non-strings collapse to "", C0/C1 control characters are stripped, and the
 * result is capped at the configured length. React escapes it on render —
 * this only guards shape/length.
 */
export function normalizeAnnouncementText(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, SITE_NOTICE_CONFIG.announcement.maxChars);
}

/** A display-safe rich announcement (CTA optional). */
export interface NormalizedAnnouncement {
  id: string;
  body: string;
  ctaLabel: string | null;
  /** Same-origin path (`/…`) or absolute https URL; null when absent/invalid. */
  ctaHref: string | null;
}

/**
 * Strip C0/C1 control characters + collapse whitespace for single-line
 * notice text (shared by body/label/id sanitation).
 */
function cleanNoticeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * True when an announcement CTA href is safe to render: same-origin path
 * (`/…`, never `//host` protocol-relative) or an absolute https URL.
 * Blocks javascript:, data:, vbscript:, http:, and protocol-relative URLs.
 */
export function isSafeAnnouncementHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  if (href.startsWith("https://") && href.length > "https://".length) return true;
  return false;
}

/**
 * Coerce any stored SiteConfig value into a bounded, display-safe list of
 * rich announcements. Never throws: non-arrays collapse to [], invalid
 * entries are dropped, per-entry text is capped, unsafe CTA hrefs null out.
 */
export function normalizeAnnouncements(value: unknown): NormalizedAnnouncement[] {
  if (!Array.isArray(value)) return [];
  const { maxItems, maxChars, maxCtaLabelChars, maxIdChars } =
    SITE_NOTICE_CONFIG.announcement;
  const out: NormalizedAnnouncement[] = [];
  const seenIds = new Set<string>();
  for (const raw of value) {
    if (out.length >= maxItems) break;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const body = cleanNoticeText(item.body).slice(0, maxChars);
    if (!body) continue;
    let id = cleanNoticeText(item.id).slice(0, maxIdChars);
    if (!id) id = `ann-${out.length + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const ctaLabel = cleanNoticeText(item.ctaLabel).slice(0, maxCtaLabelChars) || null;
    const rawHref = typeof item.ctaHref === "string" ? item.ctaHref.trim() : "";
    // A CTA link is only kept when it has BOTH a label and a safe href —
    // a bare link without a label never renders.
    const ctaHref =
      ctaLabel && rawHref && isSafeAnnouncementHref(rawHref)
        ? rawHref.slice(0, 500)
        : null;
    out.push({ id, body, ctaLabel, ctaHref });
  }
  return out;
}

/** True when the request method is one maintenance blocks. */
export function isBlockedMutationMethod(method: string): boolean {
  return (SITE_NOTICE_CONFIG.enforcement.blockedMethods as readonly string[]).includes(
    method.toUpperCase(),
  );
}

/** True when the API path is exempt from maintenance enforcement. */
export function isMaintenanceExemptPath(pathname: string): boolean {
  return SITE_NOTICE_CONFIG.enforcement.exemptPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** 503 JSON body returned for blocked mutating requests. */
export function maintenancePayload(): { error: string; code: string } {
  return {
    error: SITE_NOTICE_CONFIG.enforcement.message,
    code: SITE_NOTICE_CONFIG.enforcement.code,
  };
}
