import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getOtp, setOtp, delOtp } from "@/app/lib/services/otpStore";
import { getAppUrl } from "@/app/lib/config/env";
import { z } from "zod";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Change-email flow (authed only):
 * POST — { newEmail } → validates uniqueness, stores OTP under
 *   `change-email:{userId}`, mails the NEW address (changeEmail template).
 * PUT — { otp } → confirms, flips User.email, resets verified=false→ then
 *   marks verified=true for the confirmed address (single-step confirm),
 *   notifies in-app. Old address keeps no lingering verification.
 */
const RequestSchema = z.object({ newEmail: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    const rate = checkRateLimit(request, "auth");
    if (!rate.allowed) return rate.response;
    const user = await getUserFromRequest() as { id: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
    const parsed = RequestSchema.safeParse({ newEmail });
    if (!parsed.success) return NextResponse.json({ error: "A valid new email is required." }, { status: 400 });

    const db = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, firstName: true, googleId: true } });
    if (!db) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (db.email.trim().toLowerCase() === parsed.data.newEmail) {
      return NextResponse.json({ error: "This is already your email address." }, { status: 400 });
    }
    const taken = await prisma.user.findFirst({ where: { email: { equals: parsed.data.newEmail, mode: "insensitive" } }, select: { id: true } });
    if (taken && taken.id !== db.id) return NextResponse.json({ error: "This email is already in use." }, { status: 409 });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setOtp(`change-email:${db.id}`, await hashPassword(`${parsed.data.newEmail}::${otp}`), 900);
    const appUrl = getAppUrl();
    try {
      const { sendChangeEmailConfirmation } = await import("@/app/lib/services/emailService");
      const r = await sendChangeEmailConfirmation(parsed.data.newEmail, db.firstName || "traveller", parsed.data.newEmail, otp, `${appUrl}/profile?emailConfirmed=1`);
      if (!r.sent) console.warn(`[change-email] send failed: ${r.reason}`);
    } catch (e) {
      console.error("[change-email] send error", e);
      Sentry.captureException(e);
    }
    return NextResponse.json({ message: "Confirmation code sent to your new address" }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

const ConfirmSchema = z.object({ otp: z.string().min(4).max(12), newEmail: z.string().email() });

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest() as { id: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse({
      otp: body.otp,
      newEmail: typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : body.newEmail,
    });
    if (!parsed.success) return NextResponse.json({ error: "New email and code are required." }, { status: 400 });
    const storedHash = await getOtp(`change-email:${user.id}`);
    if (!storedHash) return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
    const ok = await verifyPassword(`${parsed.data.newEmail}::${parsed.data.otp}`, storedHash);
    if (!ok) return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
    const taken = await prisma.user.findFirst({ where: { email: { equals: parsed.data.newEmail, mode: "insensitive" } }, select: { id: true } });
    if (taken && taken.id !== user.id) return NextResponse.json({ error: "This email was just taken. Try another." }, { status: 409 });
    await prisma.user.update({ where: { id: user.id }, data: { email: parsed.data.newEmail, verified: true } });
    await delOtp(`change-email:${user.id}`);
    try {
      const { createNotification } = await import("@/app/lib/services/notificationService");
      void createNotification({ type: "VERIFIED", actorId: user.id, message: `Your email is now ${parsed.data.newEmail}.`, recipientIds: [user.id], allowSelf: true });
    } catch { /* non-critical */ }
    return NextResponse.json({ message: "Email updated", email: parsed.data.newEmail }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
