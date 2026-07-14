import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
import { sendPasswordResetEmail } from "@/app/lib/services/emailService";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import crypto from "crypto";

const resetTokenStore = new Map<string, { email: string; hash: string; expiry: number }>();

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

    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: "If an account exists, reset instructions will be sent." }, { status: 200 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = await hashPassword(token);
    const expiry = Date.now() + 3600000;
    const key = `reset:${email}`;

    const redis = await getRedis();
    if (redis) {
      await redis.set(key, tokenHash, { ex: 3600 });
    } else {
      resetTokenStore.set(key, { email, hash: tokenHash, expiry });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${appUrl}/reset-password/${token}?email=${encodeURIComponent(email)}`;

    await sendPasswordResetEmail(email, resetLink);

    return NextResponse.json({ message: "If an account exists, reset instructions will be sent." }, { status: 200 });
  } catch (error) {
    console.error("Forgot password error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
