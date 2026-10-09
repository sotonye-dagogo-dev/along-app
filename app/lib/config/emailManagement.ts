/**
 * Email management config — mirrors the crellab email/template builder shape:
 * every template is config-driven (enabled toggle, subject, HTML/text bodies,
 * variables), custom templates can be added, and sends support dynamic
 * recipient selection. Wired-in transactional sends respect the toggle:
 * disabling a template pauses that send (with posting from one toggle state
 * to another recorded in EmailLog metadata) without code changes.
 */

export interface EmailTemplateRecord {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
  /** When false, wired-in sends for this template are skipped (paused). */
  enabled?: boolean;
  /** Human description shown in the admin builder. */
  description?: string;
  /** True for platform-shipped templates; false for admin-created customs. */
  isSystem?: boolean;
}

export interface EmailRecipientSelection {
  mode: "all" | "role" | "firstN" | "search" | "manual" | "admins";
  role?: "USER" | "ADMIN";
  count?: number;
  query?: string;
  emails?: string[];
}

export const EMAIL_MANAGEMENT_CONFIG = {
  /** SiteConfig keys backing the builder (never hardcoded in UI). */
  configKey: "emailConfig",
  templatesKey: "emailTemplates",
  togglesKey: "emailTemplateToggles",
  /** Wired-in transactional template names (cannot be deleted, only toggled). */
  systemTemplateNames: [
    "otp",
    "welcome",
    "passwordReset",
    "contactNotification",
    "bugReportNotification",
    "accountDeletionRequested",
    "accountDeletionCompleted",
    "adminDeletionAlert",
  ] as const,
  /** Recipient modes offered in the admin composer. */
  recipientModes: [
    { id: "admins", label: "All admins", description: "Every ADMIN user with an email." },
    { id: "all", label: "All users", description: "Every non-deleted user (capped)." },
    { id: "role", label: "By role", description: "Filter by USER / ADMIN." },
    { id: "firstN", label: "First N signups", description: "Earliest-joined N users." },
    { id: "search", label: "Search users", description: "Match name / username / email." },
    { id: "manual", label: "Manual list", description: "Paste addresses (comma / line separated)." },
  ] as const,
  /** Safety caps so the composer can never fan out unbounded. */
  maxRecipientsPerSend: 500,
  maxFirstN: 1000,
  /** Builder editor modes. */
  editorModes: ["visual", "html"] as const,
} as const;

export type EmailRecipientMode = (typeof EMAIL_MANAGEMENT_CONFIG.recipientModes)[number]["id"];

export function isSystemTemplate(name: string): boolean {
  return (EMAIL_MANAGEMENT_CONFIG.systemTemplateNames as readonly string[]).includes(name);
}

export function parseManualEmails(raw: string): string[] {
  return [...new Set(
    raw.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes("@"))
  )].slice(0, EMAIL_MANAGEMENT_CONFIG.maxRecipientsPerSend);
}
