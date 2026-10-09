export interface EmailConfig {
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
  enabled?: boolean;
  description?: string;
  isSystem?: boolean;
}

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  fromName: "Along",
  fromEmail: "mail@alongng.com",
  replyTo: "support@alongng.com",
};

export const EMAIL_TEMPLATE_NAMES = {
  OTP: "otp",
  WELCOME: "welcome",
  PASSWORD_RESET: "passwordReset",
  VERIFY_EMAIL: "verifyEmail",
  CHANGE_EMAIL: "changeEmail",
  CHANGE_PASSWORD: "changePassword",
  CONTACT_NOTIFICATION: "contactNotification",
  BUG_REPORT_NOTIFICATION: "bugReportNotification",
  ACCOUNT_DELETION_REQUESTED: "accountDeletionRequested",
  ACCOUNT_DELETION_COMPLETED: "accountDeletionCompleted",
  ADMIN_DELETION_ALERT: "adminDeletionAlert",
} as const;

/**
 * Shared wrapper config — every template renders inside this layout by
 * default (logo up top, header, body, CTA slot, footer). Config-driven so
 * admins can restyle without code changes; renderers fall back to these
 * defaults when SiteConfig has no override.
 */
export interface EmailWrapperConfig {
  logoUrl: string;
  logoAlt: string;
  logoSize: number;
  headerAlign: "center" | "left";
  bodyMaxWidth: number;
  footerNote: string;
}

/** Default variables available in every template (logo URL included). */
export const EMAIL_DEFAULT_VARIABLES = [
  { name: "appUrl", label: "App URL", description: "Base URL of the platform", example: "https://www.alongng.com" },
  { name: "appName", label: "App name", description: "Platform display name", example: "Along" },
  { name: "logoUrl", label: "Logo URL", description: "Absolute URL of the app logo (header image)", example: "https://www.alongng.com/logo.svg" },
  { name: "firstName", label: "First name", description: "Recipient first name", example: "Adaobi" },
  { name: "supportEmail", label: "Support email", description: "Support inbox", example: "support@alongng.com" },
  { name: "year", label: "Year", description: "Current year for footer", example: "2026" },
] as const;

/**
 * Icon set for emails — Lucide-style inline SVGs first, geometric SVG
 * shapes second, emoji text last resort. Templates must use
 * EMAIL_ICONS svg strings (no raw emoji in default templates).
 */
export const EMAIL_ICONS: Record<string, string> = {
  pin: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00A862" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00A862" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00A862" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00A862" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#00A862" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
};

export const EMAIL_ICON_FALLBACK_EMOJI: Record<string, string> = {
  pin: "📍",
  star: "⭐",
  trophy: "🏆",
  shield: "🛡️",
  mail: "✉️",
};

/**
 * Compose the shared document wrapper. `bodyHtml` is the template-specific
 * content (blocks renderer output or legacy body); header/CTA/footer come
 * from the wrapper so every mail shares logo + structure.
 */
export function composeEmailDocument(opts: {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
  appUrl?: string;
  logoUrl?: string;
}): string {
  const appUrl = (opts.appUrl ?? "").trim() || "{{appUrl}}";
  const logo = (opts.logoUrl ?? "").trim() || "{{logoUrl}}";
  const cta = opts.cta
    ? `<div style="text-align:center;margin:20px 0 4px"><a href="${opts.cta.url}" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">${opts.cta.label}</a></div>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="${appUrl}/home"><img src="${logo}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">${opts.title}</h1>
${opts.subtitle ? `<p style="font-size:14px;color:#666;margin:0 0 20px">${opts.subtitle}</p>` : ""}
</td></tr>
<tr><td style="padding:0 32px 8px">${opts.bodyHtml}${cta}</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">${opts.footerNote ?? "Questions? Reply to this email or visit our <a href=\"{{appUrl}}/faq\" style=\"color:#00A862;text-decoration:none\">FAQ</a>."}</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

/** Plain-text twin of the shared wrapper (logo URL on first line). */
export function composeEmailText(opts: { title: string; bodyText: string; cta?: { label: string; url: string } }): string {
  const cta = opts.cta ? `\n\n${opts.cta.label}: ${opts.cta.url}` : "";
  return `${opts.title}\n\n${opts.bodyText}${cta}\n\n— {{appName}} ({{appUrl}})`;
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    name: "otp",
    subject: "Your Along verification code",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Verify your email</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Use the code below to complete your registration</p>
</td></tr>
<tr><td style="padding:0 32px;text-align:center">
<div style="background:#f0fdf6;border:1px solid #b8f0d8;border-radius:8px;padding:20px;font-size:32px;font-weight:700;letter-spacing:8px;color:#004A2C;font-family:monospace">{{otp}}</div>
<p style="font-size:12px;color:#999;margin:16px 0 0">This code expires in 15 minutes</p>
</td></tr>
<tr><td style="padding:24px 32px 32px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">If you didn't request this, you can safely ignore this email.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Your Along verification code is: {{otp}}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.",
    variables: ["otp", "appUrl", "logoUrl", "appName", "year"],
  },
  {
    name: "welcome",
    subject: "Welcome to Along!",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Welcome, {{firstName||traveller}}!</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">You're all set to start exploring</p>
</td></tr>
<tr><td style="padding:0 32px 32px">
<p style="font-size:14px;color:#444;margin:0 0 16px;line-height:1.6">Thanks for joining Along. Here's what you can do:</p>
<table cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 12px;font-size:14px;color:#444"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#00A862" stroke-width="2" style="vertical-align:-2px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> Share your favorite routes</td></tr>
<tr><td style="padding:0 0 12px;font-size:14px;color:#444"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#00A862" stroke-width="2" style="vertical-align:-2px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Discover trusted recommendations</td></tr>
<tr><td style="padding:0 0 12px;font-size:14px;color:#444"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#00A862" stroke-width="2" style="vertical-align:-2px"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> Earn trust badges and rewards</td></tr>
</table>
<a href="{{appUrl}}/home" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;margin-top:8px">Start exploring</a>
</td></tr>
<tr><td style="padding:16px 32px 32px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">If you have questions, reply to this email or visit our <a href="{{appUrl}}/faq" style="color:#00A862;text-decoration:none">FAQ</a>.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Welcome, {{firstName||traveller}}!\n\nThanks for joining Along. Here's what you can do:\n- Share your favorite routes\n- Discover trusted recommendations\n- Earn trust badges and rewards\n\nStart exploring: {{appUrl}}/home",
    variables: ["firstName", "appUrl", "logoUrl", "appName", "year"],
  },
  {
    name: "passwordReset",
    subject: "Reset your Along password",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Reset your password</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Click the button below to reset your password</p>
</td></tr>
<tr><td style="padding:0 32px 8px;text-align:center">
<div style="text-align:center;margin:8px 0 4px"><a href="{{resetLink}}" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Reset password</a></div>
<p style="font-size:12px;color:#999;margin:16px 0 0">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">Questions? Reply to this email or visit our <a href="{{appUrl}}/faq" style="color:#00A862;text-decoration:none">FAQ</a>.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Reset your Along password\n\nClick the link below to reset your password:\n{{resetLink}}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.",
    variables: ["resetLink", "appUrl", "logoUrl", "appName", "year"],
  },
  {
    name: "verifyEmail",
    subject: "Verify your Along email",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Verify your email</h1>
<p style="font-size:14px;color:#666;margin:0 0 20px">Hi {{firstName}}, confirm this address to finish setup</p>
</td></tr>
<tr><td style="padding:0 32px 8px;text-align:center">
<div style="background:#f0fdf6;border:1px solid #b8f0d8;border-radius:8px;padding:20px;font-size:32px;font-weight:700;letter-spacing:8px;color:#004A2C;font-family:monospace">{{otp}}</div>
<p style="font-size:12px;color:#999;margin:16px 0 0">This code expires in 15 minutes. Or verify in one tap:</p>
<div style="text-align:center;margin:16px 0 4px"><a href="{{verifyLink}}" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Verify email</a></div>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">If you didn't request this, you can safely ignore this email.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Verify your email\n\nHi {{firstName}}, your code is: {{otp}}\nThis code expires in 15 minutes.\nOr verify here: {{verifyLink}}\n\nIf you didn't request this, ignore this email.",
    variables: ["firstName", "otp", "verifyLink", "appUrl", "logoUrl", "appName", "year"],
    description: "Email verification (OTP + link) for email+password signups, profile re-verify, and email changes.",
    isSystem: true,
  },
  {
    name: "changeEmail",
    subject: "Confirm your new Along email",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Confirm your new email</h1>
<p style="font-size:14px;color:#666;margin:0 0 20px">Hi {{firstName}}, use the code below to confirm {{newEmail}}</p>
</td></tr>
<tr><td style="padding:0 32px 8px;text-align:center">
<div style="background:#f0fdf6;border:1px solid #b8f0d8;border-radius:8px;padding:20px;font-size:32px;font-weight:700;letter-spacing:8px;color:#004A2C;font-family:monospace">{{otp}}</div>
<div style="text-align:center;margin:16px 0 4px"><a href="{{confirmLink}}" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Confirm new email</a></div>
<p style="font-size:12px;color:#999;margin:12px 0 0">This code expires in 15 minutes.</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">If you didn't request this change, secure your account and contact support.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Confirm your new email\n\nHi {{firstName}}, your code for {{newEmail}} is: {{otp}}\nOr confirm here: {{confirmLink}}\nThis code expires in 15 minutes.",
    variables: ["firstName", "newEmail", "otp", "confirmLink", "appUrl", "logoUrl", "appName", "year"],
    description: "Sent to the NEW address when a user changes their email.",
    isSystem: true,
  },
  {
    name: "changePassword",
    subject: "Your Along password was changed",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Password updated</h1>
<p style="font-size:14px;color:#666;margin:0 0 20px">Hi {{firstName}}, your password was changed {{changedAt}}</p>
</td></tr>
<tr><td style="padding:0 32px 8px">
<p style="font-size:14px;color:#444;margin:0;line-height:1.6">If this was you, no action is needed. If you didn't make this change, reset your password immediately and contact support.</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Password updated\n\nHi {{firstName}}, your password was changed on {{changedAt}}.\nIf this wasn't you, reset immediately and contact {{supportEmail}}.",
    variables: ["firstName", "changedAt", "appUrl", "logoUrl", "appName", "supportEmail", "year"],
    description: "Confirmation sent after a password change (security notice).",
    isSystem: true,
  },
  {
    name: "contactNotification",
    subject: "New contact form submission",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:18px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">New contact message</h1>
<p style="font-size:13px;color:#666;margin:0 0 20px">From {{senderName}} ({{senderEmail}})</p>
</td></tr>
<tr><td style="padding:0 32px 8px">
<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;font-size:13px;color:#444;line-height:1.6;white-space:pre-wrap">{{message}}</div>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">Questions? Reply to this email or visit our <a href="{{appUrl}}/faq" style="color:#00A862;text-decoration:none">FAQ</a>.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "New contact message\nFrom: {{senderName}} ({{senderEmail}})\n\n{{message}}",
    variables: ["senderName", "senderEmail", "message", "appUrl", "logoUrl", "appName", "year"],
  },
  {
    name: "bugReportNotification",
    subject: "New bug report",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:18px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">New bug report</h1>
<p style="font-size:13px;color:#666;margin:0 0 4px"><strong>Title:</strong> {{title}}</p>
<p style="font-size:13px;color:#666;margin:0 0 20px"><strong>Category:</strong> {{category}}</p>
</td></tr>
<tr><td style="padding:0 32px 8px">
<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;font-size:13px;color:#444;line-height:1.6;white-space:pre-wrap">{{description}}</div>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">Manage in Admin → Bug reports.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "New bug report\nTitle: {{title}}\nCategory: {{category}}\n\n{{description}}",
    variables: ["title", "category", "description", "appUrl", "logoUrl", "appName", "year"],
  },
  {
    name: "accountDeletionRequested",
    subject: "Your Along account deletion request",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Deletion request received</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Hi {{firstName||traveller}}, we've archived your account</p>
</td></tr>
<tr><td style="padding:0 32px 8px">
<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6">Your account and posts are now archived and hidden from the platform. They will be permanently deleted on <strong>{{scheduledDate}}</strong> (7 days from now).</p>
<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6">Changed your mind? You can reverse this any time before that date from your profile or via <a href="{{cancelLink}}" style="color:#00A862">this link</a>.</p>
<p style="font-size:12px;color:#999;margin:16px 0 0;line-height:1.6">After deletion, personal information is removed within 30 days. Anonymised post data may be retained for platform integrity. Backups are kept for up to 30 days for recovery requests.</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">Questions? Reply to this email or visit our <a href="{{appUrl}}/faq" style="color:#00A862;text-decoration:none">FAQ</a>.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Deletion request received\n\nHi {{firstName}}, your account and posts are now archived and hidden. They will be permanently deleted on {{scheduledDate}} (7 days from now).\n\nChanged your mind? Reverse it any time before then: {{cancelLink}}\n\nAfter deletion, personal info is removed within 30 days; anonymised posts may be retained.",
    variables: ["firstName", "scheduledDate", "cancelLink", "appUrl", "logoUrl", "appName", "year"],
    enabled: true,
    description: "Sent to the user when they request account deletion (grace-period notice).",
    isSystem: true,
  },
  {
    name: "accountDeletionCompleted",
    subject: "Your Along account has been deleted",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Account deleted</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Hi {{firstName||traveller}}, this is your final confirmation</p>
</td></tr>
<tr><td style="padding:0 32px 8px">
<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6">Your Along account was permanently deleted on {{completedDate}}. Your profile now appears as "Deleted User" and your likes/bookmarks were removed. Anonymised post data may be retained for platform integrity.</p>
<p style="font-size:14px;color:#444;margin:0;line-height:1.6">If you requested recovery within 30 days, contact <a href="mailto:{{supportEmail}}" style="color:#00A862">{{supportEmail}}</a> — recovery is handled off-platform from backups where possible.</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Account deleted\n\nHi {{firstName}}, your Along account was permanently deleted on {{completedDate}}. Your profile now appears as Deleted User; likes/bookmarks removed; anonymised posts may be retained.\n\nRecovery within 30 days: contact {{supportEmail}} (handled off-platform from backups).",
    variables: ["firstName", "completedDate", "supportEmail", "appUrl", "logoUrl", "appName", "year"],
    enabled: true,
    description: "Final confirmation sent to the original address when deletion completes.",
    isSystem: true,
  },
  {
    name: "adminDeletionAlert",
    subject: "Account deletion requested: @{{userName}}",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="padding:28px 32px 0;text-align:center">
<a href="{{appUrl}}/home"><img src="{{logoUrl}}" alt="{{appName}}" width="96" style="display:inline-block;border:0;outline:none;height:auto;max-width:120px" /></a>
<h1 style="font-size:18px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Deletion request</h1>
<p style="font-size:13px;color:#666;margin:0 0 16px">{{displayName}} (@{{userName}}, {{email}}) requested account deletion.</p>
</td></tr>
<tr><td style="padding:0 32px 8px">
<p style="font-size:13px;color:#666;margin:0 0 4px"><strong>Scheduled for:</strong> {{scheduledDate}}</p>
{{reasonLine}}
<p style="font-size:12px;color:#999;margin:16px 0 0">Manage in Admin → Users. Reversal notices arrive in-app only (no email).</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">&copy; {{year}} {{appName}}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Deletion request\n{{displayName}} (@{{userName}}, {{email}}) requested account deletion.\nScheduled for: {{scheduledDate}}\n{{reasonLine}}\nManage in Admin → Users.",
    variables: ["displayName", "userName", "email", "scheduledDate", "reasonLine", "appUrl", "logoUrl", "appName", "year"],
    enabled: true,
    description: "Sent to all admins when a user requests deletion.",
    isSystem: true,
  },
];

export const PLATFORM_NOTIFICATION_EMAIL = "alongtoanywhere@gmail.com";
