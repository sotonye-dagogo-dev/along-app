import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { OTP_SCHEMA } from "@/app/lib/schemas/auth";
import { verifyPassword } from "@/app/lib/utils/security";
import { signAccessToken, signRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies } from "@/app/lib/utils/cookies";
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
    const parsed = OTP_SCHEMA.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, otp, rememberMe } = parsed.data;

    const otpKey = `otp:${email}`;
    let storedHash: string | null = null;

    const redis = await getRedis();

    if (redis) {
      storedHash = await redis.get(otpKey);
    } else {
      const entry = otpStore.get(otpKey);
      if (entry && entry.expiry > Date.now()) {
        storedHash = entry.hash;
      }
    }

    if (!storedHash) {
      return NextResponse.json({ error: "OTP expired or invalid" }, { status: 400 });
    }

    const valid = await verifyPassword(otp, storedHash);

    if (!valid) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { email },
      data: { verified: true },
    });

    if (redis) {
      await redis.del(otpKey);
    } else {
      otpStore.delete(otpKey);
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role }, rememberMe);
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role }, rememberMe);

    await setAuthCookies(accessToken, refreshToken, rememberMe);

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword }, { status: 200 });
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
