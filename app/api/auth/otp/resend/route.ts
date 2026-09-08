import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/utils/security";
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
    const email = body.email as string | undefined;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
    if (user.verified) return NextResponse.json({ error: "Account already verified" }, { status: 400 });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await hashPassword(otp);
    const otpKey = `otp:${email}`;
    const redis = await getRedis();
    if (redis) {
      await redis.set(otpKey, otpHash, { ex: 900 });
    } else {
      otpStore.set(otpKey, { hash: otpHash, expiry: Date.now() + 900000 });
    }

    // Non-blocking send
    void (async () => {
      try {
        const { sendOtpEmail } = await import("@/app/lib/services/emailService");
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("[OTP RESEND] failed", e);
        if (process.env.NODE_ENV !== "production") console.log(`[DEV] OTP for ${email}: ${otp}`);
      }
    })();

    return NextResponse.json({ message: "OTP resent" }, { status: 200 });
  } catch (error) {
    console.error("OTP resend error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
