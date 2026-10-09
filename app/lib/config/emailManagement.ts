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
    "verifyEmail",
    "changeEmail",
    "changePassword",
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
  /** Builder editor modes. `text` is in-place plain-text editing for non-programmers. */
  editorModes: ["visual", "html", "text"] as const,
} as const;

/**
 * Visual-builder catalog — block types + variable catalog (selects with
 * options + custom entries). The Studio renders these; nothing is hardcoded
 * in the page component.
 */
export const EMAIL_BUILDER_CONFIG = {
  blocks: [
    { id: "heading", label: "Heading", description: "Title or section header", icon: "heading" },
    { id: "paragraph", label: "Paragraph", description: "Body text (supports {{variables}})", icon: "text" },
    { id: "button", label: "Button / CTA", description: "Call-to-action link button", icon: "cta" },
    { id: "image", label: "Image", description: "Banner or inline image", icon: "image" },
    { id: "list", label: "List", description: "Bulleted list", icon: "list" },
    { id: "link", label: "Link", description: "Inline text link", icon: "link" },
    { id: "divider", label: "Divider", description: "Horizontal rule", icon: "divider" },
    { id: "spacer", label: "Spacer", description: "Vertical whitespace", icon: "spacer" },
  ],
  /** Common email element presets for one-click insertion. */
  presets: [
    { id: "greeting", label: "Greeting", snippet: "Hi {{firstName}}," },
    { id: "cta-explore", label: "CTA: Start exploring", snippet: "[Start exploring]({{appUrl}}/home)" },
    { id: "cta-verify", label: "CTA: Verify email", snippet: "[Verify email]({{verifyLink}})" },
    { id: "signoff", label: "Sign-off", snippet: "— The {{appName}} team" },
  ],
  /** Variable catalog: curated selects + free custom entries. */
  variableCatalog: [
    { name: "firstName", label: "First name", example: "Adaobi" },
    { name: "appUrl", label: "App URL", example: "https://www.alongng.com" },
    { name: "appName", label: "App name", example: "Along" },
    { name: "logoUrl", label: "Logo URL", example: "https://www.alongng.com/logo.svg" },
    { name: "supportEmail", label: "Support email", example: "support@alongng.com" },
    { name: "year", label: "Year", example: "2026" },
    { name: "otp", label: "OTP code", example: "482937" },
    { name: "verifyLink", label: "Verify link", example: "https://www.alongng.com/verify?token=…" },
    { name: "resetLink", label: "Reset link", example: "https://www.alongng.com/reset-password?token=…" },
    { name: "confirmLink", label: "Confirm link", example: "https://www.alongng.com/profile?emailConfirmed=1" },
    { name: "newEmail", label: "New email", example: "ada@newmail.com" },
    { name: "cancelLink", label: "Cancel link", example: "https://www.alongng.com/profile" },
  ],
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
