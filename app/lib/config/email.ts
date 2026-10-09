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
  CONTACT_NOTIFICATION: "contactNotification",
  BUG_REPORT_NOTIFICATION: "bugReportNotification",
  ACCOUNT_DELETION_REQUESTED: "accountDeletionRequested",
  ACCOUNT_DELETION_COMPLETED: "accountDeletionCompleted",
  ADMIN_DELETION_ALERT: "adminDeletionAlert",
} as const;

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
<tr><td style="padding:32px 32px 0;text-align:center">
<svg viewBox="0 0 28 28" width="40" height="40" fill="none"><circle cx="14" cy="14" r="12" fill="#00A862"/><circle cx="10" cy="10" r="2.5" fill="#b8f0d8"/><circle cx="18" cy="18" r="2.5" fill="#b8f0d8"/><path d="M10 10L18 18" stroke="#fff" stroke-width="2"/></svg>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Verify your email</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Use the code below to complete your registration</p>
</td></tr>
<tr><td style="padding:0 32px;text-align:center">
<div style="background:#f0fdf6;border:1px solid #b8f0d8;border-radius:8px;padding:20px;font-size:32px;font-weight:700;letter-spacing:8px;color:#004A2C;font-family:monospace">{{otp}}</div>
<p style="font-size:12px;color:#999;margin:16px 0 0">This code expires in 15 minutes</p>
</td></tr>
<tr><td style="padding:24px 32px 32px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">If you didn't request this, you can safely ignore this email.</p>
<p style="font-size:11px;color:#999;margin:8px 0 0">&copy; 2026 Along. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Your Along verification code is: {{otp}}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.",
    variables: ["otp"],
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
<tr><td style="padding:32px 32px 0;text-align:center">
<svg viewBox="0 0 28 28" width="40" height="40" fill="none"><circle cx="14" cy="14" r="12" fill="#00A862"/><circle cx="10" cy="10" r="2.5" fill="#b8f0d8"/><circle cx="18" cy="18" r="2.5" fill="#b8f0d8"/><path d="M10 10L18 18" stroke="#fff" stroke-width="2"/></svg>
<h1 style="font-size:20px;font-weight:700;margin:16px 0 4px;color:#1a1a1a">Welcome, {{firstName}}!</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">You're all set to start exploring</p>
</td></tr>
<tr><td style="padding:0 32px 32px">
<p style="font-size:14px;color:#444;margin:0 0 16px;line-height:1.6">Thanks for joining Along. Here's what you can do:</p>
<table cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 12px;font-size:14px;color:#444">🌍 Share your favorite routes</td></tr>
<tr><td style="padding:0 0 12px;font-size:14px;color:#444">⭐ Discover trusted recommendations</td></tr>
<tr><td style="padding:0 0 12px;font-size:14px;color:#444">🏆 Earn trust badges and rewards</td></tr>
</table>
<a href="{{appUrl}}/home" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;margin-top:8px">Start exploring</a>
</td></tr>
<tr><td style="padding:16px 32px 32px;text-align:center;border-top:1px solid #eee">
<p style="font-size:11px;color:#999;margin:0">If you have questions, reply to this email or visit our <a href="{{appUrl}}/faq" style="color:#00A862;text-decoration:none">FAQ</a>.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Welcome, {{firstName}}!\n\nThanks for joining Along. Here's what you can do:\n- Share your favorite routes\n- Discover trusted recommendations\n- Earn trust badges and rewards\n\nStart exploring: {{appUrl}}/home",
    variables: ["firstName", "appUrl"],
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
<tr><td style="padding:32px 32px 0;text-align:center">
<h1 style="font-size:20px;font-weight:700;margin:0 0 4px;color:#1a1a1a">Reset your password</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Click the button below to reset your password</p>
</td></tr>
<tr><td style="padding:0 32px 32px;text-align:center">
<a href="{{resetLink}}" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">Reset password</a>
<p style="font-size:12px;color:#999;margin:16px 0 0">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Reset your Along password\n\nClick the link below to reset your password:\n{{resetLink}}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.",
    variables: ["resetLink"],
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
<tr><td style="padding:32px 32px 0">
<h1 style="font-size:18px;font-weight:700;margin:0 0 4px;color:#1a1a1a">New contact message</h1>
<p style="font-size:13px;color:#666;margin:0 0 20px">From {{senderName}} ({{senderEmail}})</p>
</td></tr>
<tr><td style="padding:0 32px 32px">
<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;font-size:13px;color:#444;line-height:1.6;white-space:pre-wrap">{{message}}</div>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "New contact message\nFrom: {{senderName}} ({{senderEmail}})\n\n{{message}}",
    variables: ["senderName", "senderEmail", "message"],
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
<tr><td style="padding:32px 32px 0">
<h1 style="font-size:18px;font-weight:700;margin:0 0 4px;color:#1a1a1a">New bug report</h1>
<p style="font-size:13px;color:#666;margin:0 0 4px"><strong>Title:</strong> {{title}}</p>
<p style="font-size:13px;color:#666;margin:0 0 20px"><strong>Category:</strong> {{category}}</p>
</td></tr>
<tr><td style="padding:0 32px 32px">
<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;font-size:13px;color:#444;line-height:1.6;white-space:pre-wrap">{{description}}</div>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "New bug report\nTitle: {{title}}\nCategory: {{category}}\n\n{{description}}",
    variables: ["title", "category", "description"],
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
<tr><td style="padding:32px 32px 0;text-align:center">
<h1 style="font-size:20px;font-weight:700;margin:0 0 4px;color:#1a1a1a">Deletion request received</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Hi {{firstName}}, we've archived your account</p>
</td></tr>
<tr><td style="padding:0 32px 32px">
<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6">Your account and posts are now archived and hidden from the platform. They will be permanently deleted on <strong>{{scheduledDate}}</strong> (7 days from now).</p>
<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6">Changed your mind? You can reverse this any time before that date from your profile or via <a href="{{cancelLink}}" style="color:#00A862">this link</a>.</p>
<p style="font-size:12px;color:#999;margin:16px 0 0;line-height:1.6">After deletion, personal information is removed within 30 days. Anonymised post data may be retained for platform integrity. Backups are kept for up to 30 days for recovery requests.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Deletion request received\n\nHi {{firstName}}, your account and posts are now archived and hidden. They will be permanently deleted on {{scheduledDate}} (7 days from now).\n\nChanged your mind? Reverse it any time before then: {{cancelLink}}\n\nAfter deletion, personal info is removed within 30 days; anonymised posts may be retained.",
    variables: ["firstName", "scheduledDate", "cancelLink", "appUrl"],
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
<tr><td style="padding:32px 32px 0;text-align:center">
<h1 style="font-size:20px;font-weight:700;margin:0 0 4px;color:#1a1a1a">Account deleted</h1>
<p style="font-size:14px;color:#666;margin:0 0 24px">Hi {{firstName}}, this is your final confirmation</p>
</td></tr>
<tr><td style="padding:0 32px 32px">
<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6">Your Along account was permanently deleted on {{completedDate}}. Your profile now appears as "Deleted User" and your likes/bookmarks were removed. Anonymised post data may be retained for platform integrity.</p>
<p style="font-size:14px;color:#444;margin:0;line-height:1.6">If you requested recovery within 30 days, contact <a href="mailto:{{supportEmail}}" style="color:#00A862">{{supportEmail}}</a> — recovery is handled off-platform from backups where possible.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Account deleted\n\nHi {{firstName}}, your Along account was permanently deleted on {{completedDate}}. Your profile now appears as Deleted User; likes/bookmarks removed; anonymised posts may be retained.\n\nRecovery within 30 days: contact {{supportEmail}} (handled off-platform from backups).",
    variables: ["firstName", "completedDate", "supportEmail", "appUrl"],
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
<tr><td style="padding:32px 32px">
<h1 style="font-size:18px;font-weight:700;margin:0 0 4px;color:#1a1a1a">Deletion request</h1>
<p style="font-size:13px;color:#666;margin:0 0 16px">{{displayName}} (@{{userName}}, {{email}}) requested account deletion.</p>
<p style="font-size:13px;color:#666;margin:0 0 4px"><strong>Scheduled for:</strong> {{scheduledDate}}</p>
{{reasonLine}}
<p style="font-size:12px;color:#999;margin:16px 0 0">Manage in Admin → Users. Reversal notices arrive in-app only (no email).</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`,
    bodyText: "Deletion request\n{{displayName}} (@{{userName}}, {{email}}) requested account deletion.\nScheduled for: {{scheduledDate}}\n{{reasonLine}}\nManage in Admin → Users.",
    variables: ["displayName", "userName", "email", "scheduledDate", "reasonLine", "appUrl"],
    enabled: true,
    description: "Sent to all admins when a user requests deletion.",
    isSystem: true,
  },
];

export const PLATFORM_NOTIFICATION_EMAIL = "alongtoanywhere@gmail.com";
