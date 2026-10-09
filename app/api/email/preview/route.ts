import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getEmailTemplates, getEmailConfig, defaultEmailVars } from "@/app/lib/utils/emailTemplates";
import { renderEmailHtml, renderEmailText, renderEmailSubject, sanitizeStoredBody, deriveBodyText } from "@/app/lib/utils/emailTemplates";
import { extractVariables } from "@/app/lib/utils/emailSanitize";
import { getAppUrl } from "@/app/lib/config/env";

/**
 * Sample vars for Studio preview — origins ALWAYS resolve via getAppUrl()
 * (never hardcoded localhost), so previews show the remote origin in
 * production and the local origin in development. Shared defaults
 * (logoUrl/appName/year/supportEmail/appUrl) are merged at render time;
 * these samples only cover template-specific vars.
 */
function sampleVarsFor(templateName: string): Record<string, string> {
  const appUrl = getAppUrl();
  const base: Record<string, Record<string, string>> = {
    otp: { otp: "482937" },
    welcome: { firstName: "Adaobi" },
    passwordReset: { resetLink: `${appUrl}/reset?token=sample-token-123` },
    verifyEmail: { firstName: "Adaobi", otp: "482937", verifyLink: `${appUrl}/verify-email?token=sample` },
    changeEmail: { firstName: "Adaobi", newEmail: "ada@newmail.com", otp: "482937", confirmLink: `${appUrl}/profile?emailConfirmed=1` },
    changePassword: { firstName: "Adaobi", changedAt: new Date().toUTCString() },
    contactNotification: { senderName: "Chidi Okonkwo", senderEmail: "chidi@example.com", message: "I love the app! Would love to see more routes in Lagos mainland." },
    bugReportNotification: { title: "Route map not loading", category: "UI", description: "When I open the route map on the post page, the map stays blank. Using Chrome 120 on Windows 11." },
    accountDeletionRequested: { firstName: "Adaobi", scheduledDate: "October 16, 2026", cancelLink: `${appUrl}/profile` },
    accountDeletionCompleted: { firstName: "Adaobi", completedDate: "October 16, 2026", supportEmail: "alongtoanywhere@gmail.com" },
    adminDeletionAlert: { displayName: "Adaobi Eze", userName: "adaobi", email: "adaobi@example.com", scheduledDate: "October 16, 2026", reasonLine: "Reason: leaving for now" },
  };
  return { ...(base[templateName] ?? {}) };
}

function fillMissingVars(templateVars: string[], vars: Record<string, string>): Record<string, string> {
  const appUrl = getAppUrl();
  const out = { ...vars };
  for (const v of templateVars.filter((x) => !(x in out))) {
    if (/link|url/i.test(v)) out[v] = appUrl;
    else if (/email/i.test(v)) out[v] = "sample@example.com";
    else if (/name/i.test(v)) out[v] = "Sample";
    else if (/date|at/i.test(v)) out[v] = new Date().toDateString();
    else out[v] = `sample-${v}`;
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const templateName = searchParams.get("template");
    const format = searchParams.get("format") ?? "html";

    const [templates, config] = await Promise.all([
      getEmailTemplates(),
      getEmailConfig(),
    ]);

    if (!templateName) {
      return NextResponse.json({
        templates: templates.map((t) => ({ name: t.name, subject: t.subject, variables: t.variables })),
        config,
      });
    }

    const template = templates.find((t) => t.name === templateName);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const vars = fillMissingVars(template.variables, sampleVarsFor(templateName));

    const html = renderEmailHtml(template, vars);
    const text = renderEmailText(template, vars);

    if (format === "text") {
      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({
      template: { name: template.name, subject: template.subject, variables: template.variables },
      rendered: { html, text },
      sampleVars: { ...defaultEmailVars(), ...vars },
      config,
    });
  } catch (error) {
    console.error("Email preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST — draft preview for unsaved Studio edits (live preview parity).
 * Body: { subject, bodyHtml, bodyText?, vars? }.
 * Sanitizes the draft exactly like the save path, fills missing vars with
 * readable samples (never literal {{identifiers}}), and renders through
 * the same `renderEmailHtml/Text` pipeline (incl. fragment auto-wrap) so
 * what the admin sees is what will be sent.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const subject = String((body as { subject?: unknown }).subject ?? "Draft").slice(0, 200);
    const rawHtml = String((body as { bodyHtml?: unknown }).bodyHtml ?? "").slice(0, 100000);
    const rawText = String((body as { bodyText?: unknown }).bodyText ?? "").slice(0, 50000);
    const inboundVars = ((body as { vars?: unknown }).vars ?? {}) as Record<string, unknown>;
    if (!rawHtml.trim() && !rawText.trim()) {
      return NextResponse.json({ error: "bodyHtml or bodyText required" }, { status: 400 });
    }
    const cleanVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(inboundVars)) {
      if (!/^\w+$/.test(k)) continue;
      cleanVars[k] = String(v ?? "").slice(0, 2000);
    }
    const bodyHtml = rawHtml.trim() ? sanitizeStoredBody(rawHtml) : "";
    const bodyText = rawText.trim() ? rawText.slice(0, 50000) : deriveBodyText("", bodyHtml);
    const variables = extractVariables(bodyHtml, subject, bodyText);
    const vars = fillMissingVars(variables, cleanVars);
    const draft = { name: "draft", subject, bodyHtml: bodyHtml || `<p>${bodyText}</p>`, bodyText, variables };
    return NextResponse.json({
      rendered: {
        html: renderEmailHtml(draft, vars),
        text: renderEmailText(draft, vars),
        subject: renderEmailSubject(subject, vars),
      },
      sampleVars: { ...defaultEmailVars(), ...vars },
      variables,
    }, { status: 200 });
  } catch (error) {
    console.error("Email draft preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
