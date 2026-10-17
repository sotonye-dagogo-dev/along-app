/**
 * Site notice registry — maintenance mode + announcement banner.
 *
 * Single source of truth for the two platform-wide notice configs
 * (`maintenanceMode`, `announcementBanner`) that live in SiteConfig and are
 * edited via the admin Site-config board. Everything downstream reads from
 * here: the public `/api/site-config` endpoint, the `<SiteNotices />`
 * banner island, and the middleware enforcement branch.
 *
 * Edge-safe by design: pure data + pure helpers only (no prisma, no node
 * builtins) so `middleware.ts` can import it on the Edge runtime.
 */

export const SITE_NOTICE_CONFIG = {
  /** SiteConfig keys (must match the admin-site-config editor registrations). */
  siteConfigKeys: {
    maintenance: "maintenanceMode",
    announcement: "announcementBanner",
  },
  /** Public endpoint the banner island polls. Already PWA-cacheable. */
  endpoint: "/api/site-config",
  /** Client refresh policy: mount + interval + online + focus. */
  refresh: {
    intervalMs: 60_000,
    onFocus: true,
    onOnline: true,
  },
  announcement: {
    maxChars: 500,
    /** sessionStorage (per-tab) — dismissed notices stay gone for the session. */
    dismissStorageKey: "along-announcement-dismissed",
  },
  copy: {
    maintenance: {
      title: "Under maintenance",
      body: "Along is undergoing maintenance right now. Reading still works — posting and saving are paused until we're back.",
      adminNote: "Admin tools stay available to you during maintenance.",
    },
    announcementLabel: "Announcement",
    dismiss: "Dismiss notice",
  },
  i18nKeys: {
    maintenanceTitle: "siteNotice.maintenanceTitle",
    maintenanceBody: "siteNotice.maintenanceBody",
    maintenanceAdminNote: "siteNotice.maintenanceAdminNote",
    announcementLabel: "siteNotice.announcementLabel",
    dismiss: "siteNotice.dismiss",
  },
  /** Token-driven strip styles — theme-aware, no hardcoded hex. */
  tokens: {
    maintenance: {
      background: "var(--color-warning, #FEF3C7)",
      border: "1px solid var(--color-warning-border, #FCD34D)",
      color: "var(--color-warning-text, #92400E)",
    },
    announcement: {
      background: "var(--color-bg-card, #FFFFFF)",
      border: "1px solid var(--color-border, #E5E7EB)",
      color: "var(--color-text-primary, #1A1A1A)",
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
