import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { REGISTER_SCHEMA } from "@/app/lib/schemas/auth";
import { hashPassword } from "@/app/lib/utils/security";
import { qstashService } from "@/app/lib/services/qstashService";
import { sendOtpEmail, sendWelcomeEmail } from "@/app/lib/services/emailService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

const otpStore = new Map<string, { hash: string; expiry: number }>();

async function getRedis() {
  try {
    const { Redis } = await import("@upstash/redis");
    return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
  } catch {
    return null;
  }
}

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
    const ref = searchParams.get("ref");
    let invitedById: string | undefined;

    if (ref) {
      const inviter = await prisma.user.findUnique({ where: { inviteCode: ref } });
      if (inviter) {
        invitedById = inviter.id;
      }
    }

    await prisma.user.create({
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

    if (invitedById) {
      qstashService.publishRewardsAward({ userId: invitedById, actionKey: "INVITE_ACCEPTED" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await hashPassword(otp);

    const otpKey = `otp:${email}`;

    const redis = await getRedis();

    if (redis) {
      await redis.set(otpKey, otpHash, { ex: 900 });
    } else {
      otpStore.set(otpKey, { hash: otpHash, expiry: Date.now() + 900000 });
    }

    const otpResult = await sendOtpEmail(email, otp);
    if (otpResult.sent) {
      await sendWelcomeEmail(email, firstName);
    } else if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    return NextResponse.json({ message: "OTP sent to email" }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof Error) {
      if (error.name === "PrismaClientKnownRequestError") {
        return NextResponse.json({ error: "Database error. Please try again." }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
