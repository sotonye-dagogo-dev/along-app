import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { getEmailConfig, findTemplate, renderEmailHtml, renderEmailText } from "@/app/lib/utils/emailTemplates";

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
    if (process.env.NODE_ENV === "production") {
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
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] ${type} to ${to}: ${subject}`);
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL BODY]\n${text}`);
    await logEmail({ to, subject, type, status: "failed", error: "RESEND_API_KEY not configured", metadata });
    return { sent: false, reason: "Email service not configured — RESEND_API_KEY missing" };
  }

  try {
    const config = await getEmailConfig();
    // Validate from address — Resend rejects unverified domains silently in dashboard
    if (!config.fromEmail || !config.fromEmail.includes("@") || config.fromEmail === "mail@along.app") {
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
  const template = await findTemplate("otp");
  if (!template) {
    const reason = "Email template not found: otp";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] otp to ${to}: template not found`);
    return { sent: false, reason };
  }

  const vars = { otp };
  return sendEmail({
    to,
    subject: template.subject,
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "otp",
    metadata: { otp },
  });
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  const template = await findTemplate("welcome");
  if (!template) {
    const reason = "Email template not found: welcome";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] welcome to ${to}: template not found`);
    return { sent: false, reason };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const vars = { firstName, appUrl };
  return sendEmail({
    to,
    subject: template.subject,
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "welcome",
    metadata: { firstName },
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const template = await findTemplate("passwordReset");
  if (!template) {
    const reason = "Email template not found: passwordReset";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] passwordReset to ${to}: template not found`);
    return { sent: false, reason };
  }

  const vars = { resetLink };
  return sendEmail({
    to,
    subject: template.subject,
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "passwordReset",
    metadata: { resetLink },
  });
}

export async function sendContactNotification(senderName: string, senderEmail: string, message: string) {
  const recipient = process.env.PLATFORM_USER_EMAIL ?? "alongtoanywhere@gmail.com";
  const template = await findTemplate("contactNotification");
  if (!template) {
    const reason = "Email template not found: contactNotification";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] contactNotification: template not found`);
    return { sent: false, reason };
  }

  const vars = { senderName, senderEmail, message };
  return sendEmail({
    to: recipient,
    subject: template.subject,
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "contactNotification",
    metadata: { senderName, senderEmail },
  });
}

export async function sendBugReportNotification(title: string, category: string, description: string) {
  const recipient = process.env.PLATFORM_USER_EMAIL ?? "alongtoanywhere@gmail.com";
  const template = await findTemplate("bugReportNotification");
  if (!template) {
    const reason = "Email template not found: bugReportNotification";
    console.error(`[EMAIL FAILED] ${reason}`);
    Sentry.captureMessage(reason, "error");
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] bugReportNotification: template not found`);
    return { sent: false, reason };
  }

  const vars = { title, category, description };
  return sendEmail({
    to: recipient,
    subject: template.subject,
    html: renderEmailHtml(template, vars),
    text: renderEmailText(template, vars),
    type: "bugReportNotification",
    metadata: { title, category },
  });
}
