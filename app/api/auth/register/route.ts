import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { REGISTER_SCHEMA } from "@/app/lib/schemas/auth";
import { hashPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { setOtp } from "@/app/lib/services/otpStore";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateCheck = checkRateLimit(request, "auth");
    if (!rateCheck.allowed) return rateCheck.response;
    let body: unknown;
    try {
      body = await request.json();
    } catch (e) {
      if (e instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
      }
      throw e;
    }
    // Normalize before validation: referral/invite links are often opened on
    // mobile where keyboards add trailing spaces or autocapitalise the email.
    // Without trimming, a perfectly good signup fails Zod with a bare
    // "Validation failed" and the user has no idea why.
    const raw = (body ?? {}) as Record<string, unknown>;
    const normalized = {
      firstName: typeof raw.firstName === "string" ? raw.firstName.trim() : raw.firstName,
      lastName: typeof raw.lastName === "string" ? raw.lastName.trim() : raw.lastName,
      userName: typeof raw.userName === "string" ? raw.userName.trim() : raw.userName,
      email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
      password: raw.password,
    };
    const parsed = REGISTER_SCHEMA.safeParse(normalized);

    if (!parsed.success) {
      // Return the first field-specific message (not a bare
      // "Validation failed") plus a per-field map so clients can highlight
      // the exact input — whether the signup came from a referral link or
      // the normal form.
      const flat = parsed.error.flatten();
      const fieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(flat.fieldErrors)) {
        if (messages && messages.length > 0) fieldErrors[field] = messages[0];
      }
      const firstMessage =
        Object.values(fieldErrors)[0] ??
        flat.formErrors[0] ??
        "Please check your details and try again.";
      return NextResponse.json(
        { error: firstMessage, details: flat, fieldErrors },
        { status: 400 }
      );
    }

    const { userName, firstName, lastName, email, password } = parsed.data;

    // Case-insensitive email check: accounts created before normalization may
    // hold mixed-case addresses, and login/OTP/reset all compare lowercase.
    const [existingEmail, existingUserName] = await Promise.all([
      prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
      prisma.user.findUnique({ where: { userName }, select: { id: true } }),
    ]);

    if (existingEmail) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    if (existingUserName) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const { searchParams } = new URL(request.url);
    // Referral linking is unlimited on every auth method — resolveReferral
    // only validates the code; the cap applies to send-credit points, never
    // to the ability to invite (see INVITE_CONFIG). Resolution is isolated
    // so a bad/expired ?ref= value can never fail account creation.
    // The code is read from the query string first, then from the POST body
    // (ref / referralCode / inviteCode / referral) so invite links keep
    // working even when a client, proxy, or share-sheet strips the query.
    const { resolveReferral, linkReferralRewards } = await import(
      "@/app/lib/services/referralService"
    );
    let invitedById: string | undefined;
    let inviterInviteeCount = 0;
    try {
      const bodyRef =
        typeof raw.ref === "string" ? raw.ref
        : typeof raw.referralCode === "string" ? raw.referralCode
        : typeof raw.inviteCode === "string" ? raw.inviteCode
        : typeof raw.referral === "string" ? raw.referral
        : null;
      const refParam = searchParams.get("ref") ?? bodyRef;
      const referral = await resolveReferral(refParam);
      invitedById = referral.invitedById;
      inviterInviteeCount = referral.inviterInviteeCount ?? 0;
    } catch {
      invitedById = undefined;
    }

    const newInviteCode =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

    let createdUser;
    try {
      createdUser = await prisma.user.create({
        data: {
          userName,
          firstName,
          lastName,
          email,
          password: hashedPassword,
          inviteCode: newInviteCode,
          invitedById,
        },
      });
    } catch (createError) {
      // Retry once without the referral link — a stale/just-deleted inviter
      // row (FK race) must not block signup. Unique collisions on email /
      // userName are already handled above, so only the referral edge is
      // retried here.
      if (
        invitedById &&
        createError instanceof Error &&
        (createError as Error & { code?: string }).code === "P2003"
      ) {
        invitedById = undefined;
        createdUser = await prisma.user.create({
          data: {
            userName,
            firstName,
            lastName,
            email,
            password: hashedPassword,
            inviteCode: newInviteCode,
          },
        });
      } else {
        throw createError;
      }
    }

    // Welcome notification for the new signup (non-blocking, never fails the request).
    // allowSelf: a welcome is addressed to the new user themselves.
    const { createNotification, notifyReferralConversion } = await import("@/app/lib/services/notificationService");
    void createNotification({
      type: "WELCOME",
      actorId: createdUser.id,
      message: `Welcome to Along, ${firstName}! Share your first route to get started.`,
      recipientIds: [createdUser.id],
      allowSelf: true,
    });

    if (invitedById) {
      // Conversion always pays INVITE_ACCEPTED; send credit only inside cap.
      // Isolated so reward fan-out can never fail signup.
      try {
        linkReferralRewards(invitedById, createdUser.id, inviterInviteeCount);
      } catch {
        // non-critical — account already created
      }
      // Tell the inviter who converted (non-blocking, never fails signup).
      try {
        void notifyReferralConversion(invitedById, createdUser.id, userName);
      } catch {
        // non-critical
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await hashPassword(otp);

    const otpKey = `otp:${email}`;
    await setOtp(otpKey, otpHash, 900);

    // Non-blocking email send — never hold request waiting for Resend, but now tightly observed (no false-positive).
    // Welcome fires regardless of OTP outcome (plan-register and referral
    // links share this path; referral isolation above keeps them non-interfering).
    const sendInBackground = async () => {
      try {
        const { sendOtpEmail, sendWelcomeEmail } = await import("@/app/lib/services/emailService");
        const otpResult = await sendOtpEmail(email, otp);
        if (!otpResult.sent) {
          console.error(`[REGISTER] OTP email failed for ${email}: ${otpResult.reason}`);
          Sentry.captureMessage(`OTP email failed for ${email}: ${otpResult.reason}`, "warning");
        }
        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] OTP for ${email}: ${otp}`);
        }
        const welcomeResult = await sendWelcomeEmail(email, firstName);
        if (!welcomeResult.sent) {
          console.warn(`[REGISTER] welcome email failed for ${email}: ${welcomeResult.reason}`);
        }
      } catch (e) {
        console.error("[REGISTER] background email failed", e);
        Sentry.captureException(e);
        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] OTP for ${email}: ${otp}`);
        }
      }
    };

    // Use waitUntil if available (Vercel), otherwise fire-and-forget
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeWaitUntil = (globalThis as any)?.waitUntil as ((p: Promise<void>) => void) | undefined;
    if (maybeWaitUntil) {
      maybeWaitUntil(sendInBackground());
    } else {
      // Don't await — respond immediately
      void sendInBackground();
    }

    return NextResponse.json({ message: "OTP sent to email" }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    // Don't leak internal details to client — sanitize all messages
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError") {
        return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
      }
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
