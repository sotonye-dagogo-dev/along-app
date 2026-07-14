import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";

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

    const { token, email, password } = await request.json();
    if (!token || !email || !password) {
      return NextResponse.json({ error: "Token, email, and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const key = `reset:${email}`;
    let storedHash: string | null = null;

    const redis = await getRedis();
    if (redis) {
      storedHash = await redis.get(key);
    } else {
      const entry = resetTokenStore.get(key);
      if (entry && entry.expiry > Date.now()) {
        storedHash = entry.hash;
      }
    }

    if (!storedHash) {
      return NextResponse.json({ error: "Reset link expired or invalid" }, { status: 400 });
    }

    const valid = await verifyPassword(token, storedHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    if (redis) {
      await redis.del(key);
    } else {
      resetTokenStore.delete(key);
    }

    return NextResponse.json({ message: "Password reset successful" }, { status: 200 });
  } catch (error) {
    console.error("Reset password error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
