import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import { DEFAULT_EMAIL_CONFIG, DEFAULT_EMAIL_TEMPLATES } from "@/app/lib/config/email";
import type { EmailConfig, EmailTemplate } from "@/app/lib/config/email";
import { escapeHtmlValue, sanitizeEmailHtml, stripTags } from "@/app/lib/utils/emailSanitize";
import { getAppUrl, isProduction } from "@/app/lib/config/env";
import { LOGO_CONFIG } from "@/app/lib/config/logo";

export async function getEmailConfig(): Promise<EmailConfig> {
  return getSiteConfig<EmailConfig>("emailConfig", DEFAULT_EMAIL_CONFIG);
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const stored = await getSiteConfig<EmailTemplate[]>("emailTemplates", DEFAULT_EMAIL_TEMPLATES);
  // Merge defaults with stored customs: stored wins per-name, new system
  // templates backfill automatically (non-breaking forward-compat).
  const byName = new Map(stored.map((t) => [t.name, t]));
  for (const d of DEFAULT_EMAIL_TEMPLATES) {
    if (!byName.has(d.name)) byName.set(d.name, d);
  }
  return [...byName.values()];
}

export async function getTemplateToggles(): Promise<Record<string, boolean>> {
  return getSiteConfig<Record<string, boolean>>("emailTemplateToggles", {});
}

export async function isTemplateEnabled(name: string): Promise<boolean> {
  const [templates, toggles] = await Promise.all([getEmailTemplates(), getTemplateToggles()]);
  if (toggles[name] === false) return false;
  const t = templates.find((x) => x.name === name);
  if (t && t.enabled === false) return false;
  return true;
}

/** Default vars injected into every render (logo URL is absolute). */
export function defaultEmailVars(): Record<string, string> {
  const appUrl = getAppUrl();
  const logoPath = LOGO_CONFIG.logoUrl.startsWith("http") ? LOGO_CONFIG.logoUrl : `${appUrl}${LOGO_CONFIG.logoUrl}`;
  return {
    appUrl,
    appName: LOGO_CONFIG.wordmark,
    logoUrl: logoPath,
    supportEmail: DEFAULT_EMAIL_CONFIG.replyTo,
    year: String(new Date().getFullYear()),
  };
}

/**
 * Interpolate {{vars}} with HTML-escaping for html/subject and raw for
 * text. CRITICAL FIX: missing variables render as "" (never the literal
 * `{{identifier}}`), so mails never leak placeholder syntax.
 */
function renderTemplate(template: string, variables: Record<string, string>, escape: boolean): string {
  const merged: Record<string, string> = { ...defaultEmailVars(), ...variables };
  let result = template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = merged[key];
    if (v == null) return "";
    const s = String(v);
    return escape ? escapeHtmlValue(s) : s;
  });
  return result;
}

export async function findTemplate(name: string): Promise<EmailTemplate | undefined> {
  const templates = await getEmailTemplates();
  return templates.find((t) => t.name === name);
}

export function renderEmailHtml(template: EmailTemplate, vars: Record<string, string>): string {
  return renderTemplate(template.bodyHtml, vars, true);
}

export function renderEmailText(template: EmailTemplate, vars: Record<string, string>): string {
  return renderTemplate(template.bodyText, vars, false);
}

export function renderEmailSubject(subject: string, vars: Record<string, string>): string {
  return renderTemplate(subject, vars, false);
}

/** Sanitize a stored body before persist (keeps {{vars}} intact). */
export function sanitizeStoredBody(dirty: string): string {
  // Protect placeholders from the sanitizer, restore after.
  const token = (i: number) => `__VAR${i}__`;
  const vars: string[] = [];
  const protectedHtml = dirty.replace(/\{\{\w+\}\}/g, (m) => {
    vars.push(m);
    return token(vars.length - 1);
  });
  const clean = sanitizeEmailHtml(protectedHtml);
  return clean.replace(/__VAR(\d+)__/g, (_m, i: string) => vars[Number(i)] ?? "");
}

export function deriveBodyText(bodyText: string, bodyHtml: string): string {
  const t = (bodyText ?? "").trim();
  if (t) return t.slice(0, 50000);
  return stripTags(bodyHtml).slice(0, 50000);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function buildOtpVars(otp: string): Record<string, string> {
  return { otp };
}

export function buildWelcomeVars(firstName: string): Record<string, string> {
  return { firstName, appUrl: APP_URL };
}

export function buildPasswordResetVars(resetLink: string): Record<string, string> {
  return { resetLink };
}

export function buildContactNotificationVars(senderName: string, senderEmail: string, message: string): Record<string, string> {
  return { senderName, senderEmail, message };
}

export function buildBugReportNotificationVars(title: string, category: string, description: string): Record<string, string> {
  return { title, category, description };
}

export function buildVerifyEmailVars(firstName: string, otp: string, verifyLink: string): Record<string, string> {
  return { firstName, otp, verifyLink };
}

export function buildChangeEmailVars(firstName: string, newEmail: string, otp: string, confirmLink: string): Record<string, string> {
  return { firstName, newEmail, otp, confirmLink };
}

export function buildChangePasswordVars(firstName: string, changedAt: string): Record<string, string> {
  return { firstName, changedAt };
}

export { isProduction };
