import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { getEmailConfig, findTemplate, renderEmailHtml, renderEmailText, renderEmailSubject, isTemplateEnabled, defaultEmailVars } from "@/app/lib/utils/emailTemplates";
import { sanitizeVarText } from "@/app/lib/utils/emailSanitize";
import { isProduction, getAppUrl } from "@/app/lib/config/env";

const EMAIL_SEND_TIMEOUT_MS = 5000;

function withEmailTimeout<T>(promise: Promise<T>, ms = EMAIL_SEND_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Email send timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]) as Promise<T>;
}

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const msg = "RESEND_API_KEY not configured";
    if (isProduction()) {
      console.error(`[EMAIL CONFIG] ${msg} — email delivery will fail`);
      Sentry.captureMessage(msg, "error");
    }
    return null;
  }
  if (apiKey.length < 10 || apiKey.includes("replace_me")) {
    const msg = "RESEND_API_KEY looks placeholder/invalid";
    console.error(`[EMAIL CONFIG] ${msg}`);
    Sentry.captureMessage(msg, "warning");
    return null;
  }
  try {
    const { Resend } = await import("resend");
    return new Resend(apiKey);
  } catch (e) {
    console.error("[EMAIL CONFIG] Failed to init Resend", e);
    Sentry.captureException(e);
    return null;
  }
}

async function logEmail(params: {
  to: string;
  subject: string;
  type: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject,
        type: params.type,
        status: params.status,
        error: params.error ?? null,
        metadata: (params.metadata ?? {}) as never,
      },
    });
  } catch {
    console.error("Failed to log email:", params.type, params.to);
  }
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: string;
  metadata?: Record<string, unknown>;
}) {
  const { to, subject, html, text, type, metadata } = options;
  const resend = await getResend();

  if (!resend) {
    if (!isProduction()) console.log(`[EMAIL SKIPPED] ${type} to ${to}: ${subject}`);
    if (!isProduction()) console.log(`[EMAIL BODY]\n${text}`);
    await logEmail({ to, subject, type, status: "failed", error: "RESEND_API_KEY not configured", metadata });
    return { sent: false, reason: "Email service not configured — RESEND_API_KEY missing" };
  }

  // Recipient guard — never attempt clearly-invalid addresses.
  const cleanTo = to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo) || cleanTo.length > 254) {
    await logEmail({ to, subject, type, status: "failed", error: "invalid recipient", metadata });
    return { sent: false, reason: "invalid recipient" };
  }

  try {
    const config = await getEmailConfig();
    // Validate from address — Resend rejects unverified domains silently in dashboard
    if (!config.fromEmail || !config.fromEmail.includes("@") || config.fromEmail === "mail@alongng.com") {
      console.warn(`[EMAIL WARN] fromEmail looks unverified/default: ${config.fromEmail}`);
    }
    const { data, error } = await withEmailTimeout(
      resend.emails.send({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [to],
        reply_to: config.replyTo,
        subject,
        html,
        text,
      })
    );

    if (error) {
      const errStr = typeof error === "object" ? JSON.stringify(error) : String(error);
      console.error(`[EMAIL FAILED] ${type} to ${to}:`, errStr);
      Sentry.captureMessage(`Email send failed (${type} to ${to}): ${errStr}`, "error");
      await logEmail({ to, subject, type, status: "failed", error: errStr, metadata });
      return { sent: false, reason: errStr };
    }

    await logEmail({ to, subject, type, status: "sent", metadata: { ...metadata, resendId: data?.id } });
    return { sent: true, id: data?.id };
  } catch (error) {
    const errStr = String(error);
    console.error(`[EMAIL FAILED] ${type} to ${to}:`, errStr);
    Sentry.captureException(error);
    await logEmail({ to, subject, type, status: "failed", error: errStr, metadata });
    return { sent: false, reason: errStr };
  }
}

export async function sendOtpEmail(to: string, otp: string) {
  if (!(await isTemplateEnabled("otp"))) {
    await logEmail({ to, subject: "[disabled] otp", type: "otp", status: "skipped", error: "template disabled" });
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate("otp");
  if (!template) {
    const reason = "Email template not found: otp";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (!isProduction()) console.log(`[EMAIL SKIPPED] otp to ${to}: template not found`);
    return { sent: false, reason };
  }

  const vars = { otp: sanitizeVarText(otp, 12) };
  return sendEmail({
    to,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "otp",
    metadata: {},
  });
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  if (!(await isTemplateEnabled("welcome"))) {
    await logEmail({ to, subject: "[disabled] welcome", type: "welcome", status: "skipped", error: "template disabled" });
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate("welcome");
  if (!template) {
    const reason = "Email template not found: welcome";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (!isProduction()) console.log(`[EMAIL SKIPPED] welcome to ${to}: template not found`);
    return { sent: false, reason };
  }

  const appUrl = getAppUrl();
  const vars = { firstName: sanitizeVarText(firstName, 80) || "traveller", appUrl };
  return sendEmail({
    to,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "welcome",
    metadata: { firstName: vars.firstName },
  });
}

export async function sendVerifyEmail(to: string, firstName: string, otp: string, verifyLink: string) {
  if (!(await isTemplateEnabled("verifyEmail"))) {
    await logEmail({ to, subject: "[disabled] verifyEmail", type: "verifyEmail", status: "skipped", error: "template disabled" });
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate("verifyEmail");
  if (!template) return sendOtpEmail(to, otp);
  const vars = {
    firstName: sanitizeVarText(firstName, 80) || "traveller",
    otp: sanitizeVarText(otp, 12),
    verifyLink: String(verifyLink ?? "").slice(0, 2000),
    ...defaultEmailVars(),
  };
  return sendEmail({
    to,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "verifyEmail",
  });
}

export async function sendChangeEmailConfirmation(to: string, firstName: string, newEmail: string, otp: string, confirmLink: string) {
  if (!(await isTemplateEnabled("changeEmail"))) {
    await logEmail({ to, subject: "[disabled] changeEmail", type: "changeEmail", status: "skipped", error: "template disabled" });
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate("changeEmail");
  if (!template) return sendOtpEmail(to, otp);
  const vars = {
    firstName: sanitizeVarText(firstName, 80) || "traveller",
    newEmail: sanitizeVarText(newEmail, 254),
    otp: sanitizeVarText(otp, 12),
    confirmLink: String(confirmLink ?? "").slice(0, 2000),
    ...defaultEmailVars(),
  };
  return sendEmail({
    to,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "changeEmail",
  });
}

export async function sendChangePasswordNotice(to: string, firstName: string) {
  if (!(await isTemplateEnabled("changePassword"))) {
    await logEmail({ to, subject: "[disabled] changePassword", type: "changePassword", status: "skipped", error: "template disabled" });
    return { sent: true, reason: "template disabled (notice suppressed)" };
  }
  const template = await findTemplate("changePassword");
  if (!template) return { sent: true };
  const vars = {
    firstName: sanitizeVarText(firstName, 80) || "traveller",
    changedAt: new Date().toUTCString(),
    ...defaultEmailVars(),
  };
  return sendEmail({
    to,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "changePassword",
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  if (!(await isTemplateEnabled("passwordReset"))) {
    await logEmail({ to, subject: "[disabled] passwordReset", type: "passwordReset", status: "skipped", error: "template disabled" });
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate("passwordReset");
  if (!template) {
    const reason = "Email template not found: passwordReset";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (!isProduction()) console.log(`[EMAIL SKIPPED] passwordReset to ${to}: template not found`);
    return { sent: false, reason };
  }

  const vars = { resetLink: String(resetLink ?? "").slice(0, 2000) };
  return sendEmail({
    to,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "passwordReset",
    metadata: {},
  });
}

export async function sendContactNotification(senderName: string, senderEmail: string, message: string) {
  const recipient = process.env.PLATFORM_USER_EMAIL ?? "alongtoanywhere@gmail.com";
  if (!(await isTemplateEnabled("contactNotification"))) {
    await logEmail({ to: recipient, subject: "[disabled] contact", type: "contactNotification", status: "skipped", error: "template disabled" });
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate("contactNotification");
  if (!template) {
    const reason = "Email template not found: contactNotification";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (!isProduction()) console.log(`[EMAIL SKIPPED] contactNotification: template not found`);
    return { sent: false, reason };
  }

  const vars = { senderName: sanitizeVarText(senderName, 120), senderEmail: sanitizeVarText(senderEmail, 254), message: sanitizeVarText(message, 5000) };
  return sendEmail({
    to: recipient,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "contactNotification",
    metadata: { senderName: vars.senderName },
  });
}

export async function sendBugReportNotification(title: string, category: string, description: string, recipientOverride?: string) {
  // Single-assignee policy: callers pass the assigned admin's email so only
  // one admin gets the mail. Falls back to the platform inbox when no
  // assignee resolved (e.g. zero admins seeded).
  const recipient = (recipientOverride ?? "").trim() || process.env.PLATFORM_USER_EMAIL || "alongtoanywhere@gmail.com";
  if (!(await isTemplateEnabled("bugReportNotification"))) {
    await logEmail({ to: recipient, subject: "[disabled] bug", type: "bugReportNotification", status: "skipped", error: "template disabled" });
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate("bugReportNotification");
  if (!template) {
    const reason = "Email template not found: bugReportNotification";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (!isProduction()) console.log(`[EMAIL SKIPPED] bugReportNotification: template not found`);
    return { sent: false, reason };
  }

  const vars = { title: sanitizeVarText(title, 200), category: sanitizeVarText(category, 80), description: sanitizeVarText(description, 5000) };
  return sendEmail({
    to: recipient,
    subject: renderEmailSubject(template.subject, vars),
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "bugReportNotification",
    metadata: { title: vars.title },
  });
}

/**
 * Generic config-driven send for any template (system or admin-created
 * custom). Respects the enabled toggle: disabled templates skip with an
 * EmailLog entry recording the toggle transition (posting from one state
 * to another) without throwing — wired-in callers treat skip as non-fatal.
 */
export async function sendTemplatedEmail(templateName: string, to: string, vars: Record<string, string>, type?: string) {
  const enabled = await isTemplateEnabled(templateName);
  if (!enabled) {
    await logEmail({ to, subject: `[disabled] ${templateName}`, type: type ?? templateName, status: "skipped", error: "template disabled by admin toggle", metadata: { templateName } });
    if (!isProduction()) console.log(`[EMAIL SKIPPED] ${templateName} to ${to}: disabled by toggle`);
    return { sent: false, reason: "template disabled" };
  }
  const template = await findTemplate(templateName);
  if (!template) {
    const reason = `Email template not found: ${templateName}`;
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    return { sent: false, reason };
  }
  // Sanitize every inbound var (admin composer JSON is untrusted) so stored
  // HTML structure survives and values can't inject markup/scripts.
  const cleanVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars ?? {})) {
    if (!/^\w+$/.test(k)) continue;
    cleanVars[k] = sanitizeVarText(v, 5000);
  }
  return sendEmail({
    to,
    subject: renderEmailSubject(template.subject, cleanVars),
    html: renderEmailHtml(template, cleanVars),
    text: renderEmailText(template, cleanVars),
    type: type ?? templateName,
    metadata: { templateName },
  });
}

function renderTemplateSubject(subject: string, vars: Record<string, string>): string {
  return renderEmailSubject(subject, vars);
}

const APP_URL_FALLBACK = getAppUrl();

export async function sendAccountDeletionRequestedEmail(to: string, vars: { firstName: string; scheduledDate: string; cancelLink: string }) {
  return sendTemplatedEmail("accountDeletionRequested", to, { ...vars, appUrl: APP_URL_FALLBACK });
}

export async function sendAccountDeletionCompletedEmail(to: string, vars: { firstName: string; completedDate: string; supportEmail: string }) {
  return sendTemplatedEmail("accountDeletionCompleted", to, { ...vars, appUrl: APP_URL_FALLBACK });
}

export async function sendAdminDeletionAlertEmail(to: string, vars: { displayName: string; userName: string; email: string; scheduledDate: string; reasonLine: string }) {
  return sendTemplatedEmail("adminDeletionAlert", to, { ...vars, appUrl: APP_URL_FALLBACK }, "adminDeletionAlert");
}

/**
 * Variable source classification for the composer (config-driven).
 * - platform: always auto (appUrl/appName/logoUrl/supportEmail/year).
 * - user: auto from the recipient's user row (firstName/lastName/userName/email/displayName).
 * - generated: platform-generated per send (otp/verifyLink/resetLink/confirmLink/cancelLink/changedAt/scheduledDate/completedDate) — auto where derivable, else manual.
 * - manual: everything else (custom template vars, message/title/category/...) — manual entry only when sending to addresses with no user row.
 */
export const EMAIL_VAR_SOURCES: Record<string, "platform" | "user" | "generated" | "manual"> = {
  appUrl: "platform", appName: "platform", logoUrl: "platform", supportEmail: "platform", year: "platform",
  firstName: "user", lastName: "user", userName: "user", email: "user", displayName: "user", newEmail: "user",
  otp: "generated", verifyLink: "generated", resetLink: "generated", confirmLink: "generated",
  cancelLink: "generated", changedAt: "generated", scheduledDate: "generated", completedDate: "generated",
  reasonLine: "generated",
};

export function emailVarSource(name: string): "platform" | "user" | "generated" | "manual" {
  return EMAIL_VAR_SOURCES[name] ?? "manual";
}

/**
 * Per-recipient var resolution: merges platform defaults + user-derived
 * values + admin-supplied base vars. Admin input wins when non-empty; user
 * row fills gaps (firstName/userName/email/...); platform-generated tokens
 * (otp/verifyLink/...) are derived per recipient when feasible, otherwise
 * fall back to admin input or template fallbacks. Manual entry is only
 * REQUIRED for vars with no derivable value (e.g. firstName when mailing a
 * manually-entered address with no user row).
 */
export async function resolveVarsForRecipient(
  baseVars: Record<string, string>,
  recipientEmail: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...(baseVars ?? {}) };
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: recipientEmail.trim().toLowerCase(), mode: "insensitive" } },
      select: { firstName: true, lastName: true, userName: true, email: true },
    });
    if (user) {
      if (!out.firstName?.trim()) out.firstName = user.firstName || user.userName;
      if (!out.lastName?.trim()) out.lastName = user.lastName || "";
      if (!out.userName?.trim()) out.userName = user.userName;
      if (!out.email?.trim()) out.email = user.email;
      if (!out.displayName?.trim()) out.displayName = `${user.firstName} ${user.lastName}`.trim() || user.userName;
    }
    // Platform-generated vars: derive per recipient where feasible.
    if (!out.verifyLink?.trim() && user) {
      out.verifyLink = `${getAppUrl()}/verify-email?email=${encodeURIComponent(user.email)}`;
    }
    if (!out.cancelLink?.trim()) out.cancelLink = `${getAppUrl()}/profile`;
    if (!out.changedAt?.trim()) out.changedAt = new Date().toUTCString();
  } catch { /* non-critical — fall back to base vars */ }
  return out;
}

/**
 * Dynamic recipient resolution for the admin composer (config-driven caps).
 * Never includes deleted users; admins mode pulls ADMIN role only.
 * Unverified emails are filtered OUT by default (resource-wastage guard —
 * unverified addresses often bounce); pass includeUnverified:true to opt in.
 */
export async function resolveEmailRecipients(sel: {
  mode: string; role?: string; count?: number; query?: string; emails?: string[]; includeUnverified?: boolean;
}): Promise<string[]> {
  const { EMAIL_MANAGEMENT_CONFIG } = await import("@/app/lib/config/emailManagement");
  const cap = EMAIL_MANAGEMENT_CONFIG.maxRecipientsPerSend;
  const verifiedFilter = sel.includeUnverified ? {} : { verified: true };
  try {
    if (sel.mode === "manual") {
      return [...new Set((sel.emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))].slice(0, cap);
    }
    if (sel.mode === "admins") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isDeleted: false, ...verifiedFilter }, select: { email: true }, take: cap });
      return admins.map((a) => a.email);
    }
    if (sel.mode === "role") {
      const role = sel.role === "ADMIN" ? "ADMIN" : "USER";
      const users = await prisma.user.findMany({ where: { role: role as never, isDeleted: false, ...verifiedFilter }, select: { email: true }, take: cap });
      return users.map((u) => u.email);
    }
    if (sel.mode === "firstN") {
      const n = Math.min(Math.max(1, Math.floor(sel.count ?? 100)), EMAIL_MANAGEMENT_CONFIG.maxFirstN, cap);
      const users = await prisma.user.findMany({ where: { isDeleted: false, ...verifiedFilter }, select: { email: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: n });
      return users.map((u) => u.email);
    }
    if (sel.mode === "search") {
      const q = (sel.query ?? "").trim();
      if (!q) return [];
      const users = await prisma.user.findMany({
        where: { isDeleted: false, ...verifiedFilter, OR: [{ userName: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } as never,
        select: { email: true }, take: cap,
      });
      return users.map((u) => u.email);
    }
    const users = await prisma.user.findMany({ where: { isDeleted: false, ...verifiedFilter }, select: { email: true }, take: cap });
    return users.map((u) => u.email);
  } catch (e) {
    console.error("[emailService] resolveEmailRecipients failed:", e);
    return [];
  }
}
