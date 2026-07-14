import { prisma } from "@/app/lib/db/prisma";
import { getEmailConfig, findTemplate, renderEmailHtml, renderEmailText } from "@/app/lib/utils/emailTemplates";

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    const { Resend } = await import("resend");
    return new Resend(apiKey);
  } catch {
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
    await logEmail({ to, subject, type, status: "skipped", metadata });
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const config = await getEmailConfig();
    const { data, error } = await resend.emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [to],
      reply_to: config.replyTo,
      subject,
      html,
      text,
    });

    if (error) {
      console.error(`[EMAIL FAILED] ${type} to ${to}:`, error);
      await logEmail({ to, subject, type, status: "failed", error: String(error), metadata });
      return { sent: false, reason: String(error) };
    }

    await logEmail({ to, subject, type, status: "sent", metadata: { ...metadata, resendId: data?.id } });
    return { sent: true, id: data?.id };
  } catch (error) {
    console.error(`[EMAIL FAILED] ${type} to ${to}:`, error);
    await logEmail({ to, subject, type, status: "failed", error: String(error), metadata });
    return { sent: false, reason: String(error) };
  }
}

export async function sendOtpEmail(to: string, otp: string) {
  const template = await findTemplate("otp");
  if (!template) {
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] otp to ${to}: template not found`);
    return { sent: false, reason: "Template not found" };
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
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] welcome to ${to}: template not found`);
    return { sent: false, reason: "Template not found" };
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
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] passwordReset to ${to}: template not found`);
    return { sent: false, reason: "Template not found" };
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
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] contactNotification: template not found`);
    return { sent: false, reason: "Template not found" };
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
    if (process.env.NODE_ENV !== "production") console.log(`[EMAIL SKIPPED] bugReportNotification: template not found`);
    return { sent: false, reason: "Template not found" };
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
