import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { DEFAULT_EMAIL_TEMPLATES } from "@/app/lib/config/email";
import type { EmailTemplate } from "@/app/lib/config/email";
import { isSystemTemplate } from "@/app/lib/config/emailManagement";
import { sanitizeStoredBody, deriveBodyText } from "@/app/lib/utils/emailTemplates";
import { extractVariables, stripTags } from "@/app/lib/utils/emailSanitize";

async function readStored(): Promise<EmailTemplate[]> {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: "emailTemplates" } });
    if (row?.value && Array.isArray(row.value)) return row.value as unknown as EmailTemplate[];
  } catch { /* fall through */ }
  return DEFAULT_EMAIL_TEMPLATES;
}

async function writeStored(templates: EmailTemplate[]) {
  await prisma.siteConfig.upsert({
    where: { key: "emailTemplates" },
    create: { key: "emailTemplates", value: templates as never },
    update: { value: templates as never },
  });
  try {
    const { redis } = await import("@/app/lib/db/redis");
    const { CACHE_KEYS } = await import("@/app/lib/config/cache");
    await redis.del(CACHE_KEYS.siteConfig("emailTemplates"));
  } catch { /* non-critical */ }
}

function sanitize(t: Partial<EmailTemplate>, existing?: EmailTemplate): EmailTemplate | null {
  const name = String(t.name ?? existing?.name ?? "").trim().slice(0, 64);
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) return null;
  const subject = stripTags(String(t.subject ?? existing?.subject ?? "")).slice(0, 200);
  const rawHtml = String(t.bodyHtml ?? existing?.bodyHtml ?? "").slice(0, 100000);
  const bodyHtml = sanitizeStoredBody(rawHtml);
  const rawText = String(t.bodyText ?? existing?.bodyText ?? "");
  const bodyText = stripTags(rawText).slice(0, 50000) || deriveBodyText("", bodyHtml);
  if (!subject || !bodyHtml) return null;
  const vars = Array.isArray(t.variables) ? t.variables.map(String).filter((v) => /^\w+$/.test(v)).slice(0, 50)
    : extractVariables(bodyHtml, subject, bodyText);
  return {
    name, subject, bodyHtml, bodyText,
    variables: vars,
    enabled: typeof t.enabled === "boolean" ? t.enabled : (existing?.enabled ?? true),
    description: typeof t.description === "string" ? stripTags(t.description).slice(0, 300) : existing?.description,
    isSystem: existing?.isSystem ?? isSystemTemplate(name),
  };
}

export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const templates = await readStored();
    let toggles: Record<string, boolean> = {};
    try {
      const row = await prisma.siteConfig.findUnique({ where: { key: "emailTemplateToggles" } });
      if (row?.value && typeof row.value === "object") toggles = row.value as Record<string, boolean>;
    } catch { /* ignore */ }
    return NextResponse.json({ templates, toggles }, { status: 200 });
  } catch (e) {
    console.error("admin email templates GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await request.json();
    const templates = await readStored();
    if (body?.toggles && typeof body.toggles === "object") {
      // Toggle posting: record transition per template in EmailLog metadata.
      const next = body.toggles as Record<string, boolean>;
      await prisma.siteConfig.upsert({
        where: { key: "emailTemplateToggles" },
        create: { key: "emailTemplateToggles", value: next as never },
        update: { value: next as never },
      });
      try {
        const { redis } = await import("@/app/lib/db/redis");
        const { CACHE_KEYS } = await import("@/app/lib/config/cache");
        await redis.del(CACHE_KEYS.siteConfig("emailTemplateToggles"));
      } catch { /* ignore */ }
      for (const [name, enabled] of Object.entries(next)) {
        try {
          await prisma.emailLog.create({ data: { to: "-", subject: `toggle:${name}`, type: "template_toggle", status: enabled ? "sent" : "skipped", metadata: { templateName: name, enabled } as never } });
        } catch { /* ignore */ }
      }
      return NextResponse.json({ success: true, toggles: next }, { status: 200 });
    }
    const incoming = body?.template as Partial<EmailTemplate> | undefined;
    if (!incoming) return NextResponse.json({ error: "template required" }, { status: 400 });
    const idx = templates.findIndex((t) => t.name === incoming.name);
    const clean = sanitize(incoming, idx >= 0 ? templates[idx] : undefined);
    if (!clean) return NextResponse.json({ error: "Invalid template (name/subject/bodyHtml required)" }, { status: 400 });
    if (idx >= 0) templates[idx] = clean;
    else templates.push(clean);
    await writeStored(templates);
    return NextResponse.json({ success: true, template: clean }, { status: 200 });
  } catch (e) {
    console.error("admin email templates PUT error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name") ?? "";
    if (!name || isSystemTemplate(name)) return NextResponse.json({ error: "Only custom templates can be deleted (system templates: toggle instead)" }, { status: 400 });
    const templates = (await readStored()).filter((t) => t.name !== name);
    await writeStored(templates);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("admin email templates DELETE error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
