import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { sendTemplatedEmail, resolveEmailRecipients } from "@/app/lib/services/emailService";

/**
 * Admin composer send — dynamic recipient selection + any template.
 * Body: { templateName, vars, selection: { mode, role, count, query, emails } }
 * Sends sequentially with per-recipient audit in EmailLog (via sendEmail).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await request.json();
    const { templateName, vars, selection } = body as {
      templateName?: string; vars?: Record<string, string>; selection?: { mode: string; role?: string; count?: number; query?: string; emails?: string[] };
    };
    if (!templateName) return NextResponse.json({ error: "templateName required" }, { status: 400 });
    const recipients = await resolveEmailRecipients(selection ?? { mode: "admins" });
    if (recipients.length === 0) return NextResponse.json({ error: "No recipients resolved" }, { status: 400 });
    let sent = 0;
    const failures: string[] = [];
    for (const to of recipients) {
      const r = await sendTemplatedEmail(templateName, to, vars ?? {}, `custom:${templateName}`);
      if (r.sent) sent += 1;
      else failures.push(to);
    }
    return NextResponse.json({ success: true, sent, failed: failures.length, total: recipients.length }, { status: 200 });
  } catch (e) {
    console.error("admin email send error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
