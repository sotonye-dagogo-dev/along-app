import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { hashPassword, verifyPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { z } from "zod";

/**
 * POST /api/auth/change-password — authed password change.
 * Availability: only when the account HAS a password (hasPassword).
 * Password-less (Google-only) accounts use /api/auth/link/password to ADD
 * one first; this route never creates the first credential.
 * Sends a changePassword security notice (toggle-respecting, non-blocking).
 */
const Schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit(request, "auth");
    if (!rate.allowed) return rate.response;
    const user = await getUserFromRequest() as { id: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Check your input and try again.";
      return NextResponse.json({ error: first }, { status: 400 });
    }
    const db = await prisma.user.findUnique({ where: { id: user.id } });
    if (!db) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!db.password) {
      return NextResponse.json({ error: "No password set — add one first, then you can change it." }, { status: 400 });
    }
    const valid = await verifyPassword(parsed.data.currentPassword, db.password);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(parsed.data.newPassword) } });
    try {
      const { sendChangePasswordNotice } = await import("@/app/lib/services/emailService");
      void sendChangePasswordNotice(db.email, db.firstName || "traveller");
    } catch { /* non-critical */ }
    return NextResponse.json({ message: "Password changed" }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
