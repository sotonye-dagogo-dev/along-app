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
    const body = await request.json();
    const parsed = REGISTER_SCHEMA.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userName, firstName, lastName, email, password } = parsed.data;

    const [existingEmail, existingUserName] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { userName } }),
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
    // to the ability to invite (see INVITE_CONFIG).
    const { resolveReferral, linkReferralRewards } = await import(
      "@/app/lib/services/referralService"
    );
    const referral = await resolveReferral(searchParams.get("ref"));
    const invitedById = referral.invitedById;

    const createdUser = await prisma.user.create({
      data: {
        userName,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        inviteCode: crypto.randomUUID(),
        invitedById,
      },
    });

    // Welcome notification for the new signup (non-blocking, never fails the request).
    // allowSelf: a welcome is addressed to the new user themselves.
    const { createNotification } = await import("@/app/lib/services/notificationService");
    void createNotification({
      type: "WELCOME",
      actorId: createdUser.id,
      message: `Welcome to Along, ${firstName}! Share your first route to get started.`,
      recipientIds: [createdUser.id],
      allowSelf: true,
    });

    if (invitedById) {
      // Conversion always pays INVITE_ACCEPTED; send credit only inside cap.
      linkReferralRewards(invitedById, createdUser.id, referral.inviterInviteeCount ?? 0);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await hashPassword(otp);

    const otpKey = `otp:${email}`;
    await setOtp(otpKey, otpHash, 900);

    // Non-blocking email send — never hold request waiting for Resend, but now tightly observed (no false-positive)
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
        if (otpResult.sent) {
          const welcomeResult = await sendWelcomeEmail(email, firstName);
          if (!welcomeResult.sent) {
            console.warn(`[REGISTER] welcome email failed for ${email}: ${welcomeResult.reason}`);
          }
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
