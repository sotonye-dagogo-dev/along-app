import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { DEFAULT_EMAIL_TEMPLATES } from "@/app/lib/config/email";
import type { EmailTemplate } from "@/app/lib/config/email";
import { isSystemTemplate } from "@/app/lib/config/emailManagement";
import { sanitizeStoredBody, deriveBodyText, mergeEmailTemplatesWithDefaults } from "@/app/lib/utils/emailTemplates";
import { extractVariables, stripTags } from "@/app/lib/utils/emailSanitize";

async function readRawStored(): Promise<EmailTemplate[] | null> {
  try {
    const row = await prisma.siteConfig.findUnique({ where: { key: "emailTemplates" } });
    if (row?.value && Array.isArray(row.value)) return row.value as unknown as EmailTemplate[];
  } catch { /* fall through */ }
  return null;
}

async function readStored(): Promise<EmailTemplate[]> {
  const raw = await readRawStored();
  if (raw) {
    // Merge hardcoded defaults under stored customs: stored wins per-name,
    // new system templates backfill automatically. Without this merge a DB
    // seeded when fewer templates existed would hide every template added
    // since (the reported "only one bug-report template in Studio" case).
    return mergeEmailTemplatesWithDefaults(raw);
  }
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
  // Plain-text twin always regenerates from the NEW html unless the caller
  // explicitly supplied bodyText (Studio sends html-only edits) — otherwise
  // the text preview/send would show stale pre-edit content after saving.
  const rawText = typeof t.bodyText === "string" && t.bodyText.trim() ? String(t.bodyText) : "";
  const bodyText = rawText ? stripTags(rawText).slice(0, 50000) : deriveBodyText("", bodyHtml);
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
    // Restore-to-default: removes the DB-saved override for one template so
    // the hardcoded config fallback shines through again. Hardcoded updates
    // NEVER overwrite DB-saved versions automatically (stored wins per-name
    // in getEmailTemplates); restore is the explicit opt-in path back.
    // Persistence uses the RAW stored row (not the merged view) so
    // backfilled defaults are never snapshotted into the DB.
    const restoreName = typeof body?.restore === "string" ? body.restore.trim() : "";
    if (restoreName) {
      const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.name === restoreName);
      if (!def) return NextResponse.json({ error: "No default for that template" }, { status: 404 });
      const raw = (await readRawStored()) ?? [];
      await writeStored(raw.filter((t) => t.name !== restoreName));
      try {
        await prisma.emailLog.create({ data: { to: "-", subject: `restore:${restoreName}`, type: "template_restore", status: "sent", metadata: { templateName: restoreName } as never } });
      } catch { /* ignore */ }
      return NextResponse.json({ success: true, restored: restoreName, template: def }, { status: 200 });
    }
    const incoming = body?.template as Partial<EmailTemplate> | undefined;
    if (!incoming) return NextResponse.json({ error: "template required" }, { status: 400 });
    const templates = await readStored();
    const idx = templates.findIndex((t) => t.name === incoming.name);
    const clean = sanitize(incoming, idx >= 0 ? templates[idx] : undefined);
    if (!clean) return NextResponse.json({ error: "Invalid template (name/subject/bodyHtml required)" }, { status: 400 });
    // Persist against the RAW row so unedited backfilled defaults stay
    // un-stored (future hardcoded updates still flow through for them).
    const raw = (await readRawStored()) ?? [];
    const rawIdx = raw.findIndex((t) => t.name === clean.name);
    if (rawIdx >= 0) raw[rawIdx] = clean;
    else raw.push(clean);
    await writeStored(raw);
    try {
      const { logAudit } = await import("@/app/lib/services/auditService");
      await logAudit({ actorId: (user as { id: string }).id, action: "email.template.save", entity: "email-template", entityId: clean.name, metadata: { subject: clean.subject } });
    } catch { /* ignore */ }
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
    const raw = (await readRawStored()) ?? [];
    await writeStored(raw.filter((t) => t.name !== name));
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("admin email templates DELETE error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
