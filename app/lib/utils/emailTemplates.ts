import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import { DEFAULT_EMAIL_CONFIG, DEFAULT_EMAIL_TEMPLATES, composeEmailDocument } from "@/app/lib/config/email";
import type { EmailConfig, EmailTemplate } from "@/app/lib/config/email";
import { escapeHtmlValue, sanitizeEmailHtml, stripTags, parseVarToken } from "@/app/lib/utils/emailSanitize";
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
 * text. Supports fallback syntax `{{name||fallback}}` / `{{name|fallback}}`
 * (quotes optional): the fallback is used when the var is missing/empty.
 * Missing variables with no fallback render as "" (never the literal
 * `{{identifier}}`), so mails never leak placeholder syntax.
 */
function renderTemplate(template: string, variables: Record<string, string>, escape: boolean): string {
  const merged: Record<string, string> = { ...defaultEmailVars(), ...variables };
  const result = template.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (m, inner: string) => {
    const parsed = parseVarToken(inner);
    if (!parsed) return "";
    const v = merged[parsed.name];
    let s = v == null ? "" : String(v);
    if (!s.trim() && parsed.fallback) s = parsed.fallback;
    if (!s) return "";
    return escape ? escapeHtmlValue(s) : s;
  });
  return result;
}

/**
 * Wrap a builder fragment (no <table>/<html> document shell) in the shared
 * branded document so builder-saved templates keep their card styling
 * (logo/header/body/CTA/footer) in preview AND in sent mail. Full-document
 * bodies pass through untouched — non-breaking for legacy templates.
 */
export function ensureEmailDocument(bodyHtml: string, subject: string): string {
  const raw = String(bodyHtml ?? "");
  if (/<table[\s>]/i.test(raw) || /<html[\s>]/i.test(raw)) return raw;
  const title = stripTags(subject || "Along update").slice(0, 120) || "Along update";
  return composeEmailDocument({ title, bodyHtml: raw });
}

export async function findTemplate(name: string): Promise<EmailTemplate | undefined> {
  const templates = await getEmailTemplates();
  return templates.find((t) => t.name === name);
}

export function renderEmailHtml(template: EmailTemplate, vars: Record<string, string>): string {
  return renderTemplate(ensureEmailDocument(template.bodyHtml, template.subject), vars, true);
}

export function renderEmailText(template: EmailTemplate, vars: Record<string, string>): string {
  return renderTemplate(template.bodyText, vars, false);
}

export function renderEmailSubject(subject: string, vars: Record<string, string>): string {
  return renderTemplate(subject, vars, false);
}

/** Sanitize a stored body before persist (keeps {{vars}} incl. fallbacks intact). */
export function sanitizeStoredBody(dirty: string): string {
  // Protect placeholders from the sanitizer, restore after. The token is a
  // `#`-fragment so href/src values carrying a {{var}} still pass the
  // sanitizer's isSafeUrl allowlist (a bare `__VARn__` token was dropped as
  // an unsafe URL, silently deleting e.g. `<a href="{{appUrl}}/home">`).
  // Fallback syntax (`{{name||fallback}}`) is protected as one unit.
  const token = (i: number) => `#__ALONG_VAR${i}__`;
  const vars: string[] = [];
  const protectedHtml = dirty.replace(/\{\{\s*\w+(?:\s*\|\|?\s*[^}]*)?\s*\}\}/g, (m) => {
    vars.push(m);
    return token(vars.length - 1);
  });
  const clean = sanitizeEmailHtml(protectedHtml);
  return clean.replace(/#__ALONG_VAR(\d+)__/g, (_m, i: string) => vars[Number(i)] ?? "");
}

export function deriveBodyText(bodyText: string, bodyHtml: string): string {
  const t = (bodyText ?? "").trim();
  if (t) return t.slice(0, 50000);
  return stripTags(bodyHtml).slice(0, 50000);
}

export function buildOtpVars(otp: string): Record<string, string> {
  return { otp };
}

export function buildWelcomeVars(firstName: string): Record<string, string> {
  return { firstName, appUrl: getAppUrl() };
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
