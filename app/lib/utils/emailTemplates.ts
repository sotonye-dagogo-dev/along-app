import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import { DEFAULT_EMAIL_CONFIG, DEFAULT_EMAIL_TEMPLATES } from "@/app/lib/config/email";
import type { EmailConfig, EmailTemplate } from "@/app/lib/config/email";

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

function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export async function findTemplate(name: string): Promise<EmailTemplate | undefined> {
  const templates = await getEmailTemplates();
  return templates.find((t) => t.name === name);
}

export function renderEmailHtml(template: EmailTemplate, vars: Record<string, string>): string {
  return renderTemplate(template.bodyHtml, vars);
}

export function renderEmailText(template: EmailTemplate, vars: Record<string, string>): string {
  return renderTemplate(template.bodyText, vars);
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
