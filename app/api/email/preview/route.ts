import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getEmailTemplates, getEmailConfig } from "@/app/lib/utils/emailTemplates";
import { renderEmailHtml, renderEmailText } from "@/app/lib/utils/emailTemplates";

const SAMPLE_VARS: Record<string, Record<string, string>> = {
  otp: { otp: "482937" },
  welcome: { firstName: "Adaobi", appUrl: "http://localhost:3000" },
  passwordReset: { resetLink: "http://localhost:3000/reset?token=sample-token-123" },
  contactNotification: { senderName: "Chidi Okonkwo", senderEmail: "chidi@example.com", message: "I love the app! Would love to see more routes in Lagos mainland." },
  bugReportNotification: { title: "Route map not loading", category: "UI", description: "When I open the route map on the post page, the map stays blank. Using Chrome 120 on Windows 11." },
  accountDeletionRequested: { firstName: "Adaobi", scheduledDate: "October 16, 2026", cancelLink: "http://localhost:3000/profile", appUrl: "http://localhost:3000" },
  accountDeletionCompleted: { firstName: "Adaobi", completedDate: "October 16, 2026", supportEmail: "alongtoanywhere@gmail.com", appUrl: "http://localhost:3000" },
  adminDeletionAlert: { displayName: "Adaobi Eze", userName: "adaobi", email: "adaobi@example.com", scheduledDate: "October 16, 2026", reasonLine: "Reason: leaving for now", appUrl: "http://localhost:3000" },
};

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

    const vars = SAMPLE_VARS[templateName] ?? {};
    const missingVars = template.variables.filter((v) => !(v in vars));
    if (missingVars.length > 0) {
      for (const v of missingVars) {
        vars[v] = `{{${v}}}`;
      }
    }

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
      sampleVars: vars,
      config,
    });
  } catch (error) {
    console.error("Email preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
