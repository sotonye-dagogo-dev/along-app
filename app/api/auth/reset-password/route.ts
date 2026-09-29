import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/app/lib/utils/security";
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import crypto from "crypto";
import { getResetToken, delResetToken } from "@/app/lib/services/otpStore";
import {
  normalizeResetEmail,
  verifyResetTokenDb,
  consumeResetTokenDb,
} from "@/app/lib/services/resetTokenStore";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

function isBcryptHash(value: string): boolean {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

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
    const { token, email, password } = body as {
      token?: unknown;
      email?: unknown;
      password?: unknown;
    };
    if (!token || typeof token !== "string" || !email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Token, email, and password are required" }, { status: 400 });
    }

    // Normalize email exactly like issuance does (trim + lowercase).
    // Previously issuance lowercased but verification used the raw query-param
    // value, so any case/whitespace difference produced a key mismatch and an
    // immediate "expired or invalid" even seconds after issuance.
    const normalizedEmail = normalizeResetEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // 1) Durable DB store (primary). Survives serverless instance hops and
    //    Redis outages — the root cause of "link expired seconds after mail".
    let valid = false;
    try {
      valid = await verifyResetTokenDb(normalizedEmail, token);
    } catch (e) {
      console.warn("[reset-password] DB verify failed, trying legacy store", (e as Error)?.message);
    }

    // 2) Legacy Redis/memory fallback (tokens issued before DB migration,
    //    or while the migration is still rolling out).
    let legacyKey: string | null = null;
    if (!valid) {
      // The legacy key was written with the canonical (stored, lowercased)
      // email. Try the normalized email first, then fall back to the raw
      // stored-email lookup via case-insensitive user match below.
      legacyKey = `reset:${normalizedEmail}`;
      const storedHash = await getResetToken(legacyKey);
      if (storedHash) {
        if (isBcryptHash(storedHash)) {
          valid = await verifyPassword(token, storedHash);
        } else {
          // Forward-compatible: sha256 hex stored directly — timing-safe compare.
          const { sha256Hex } = await import("@/app/lib/services/resetTokenStore");
          const candidate = sha256Hex(token);
          valid =
            candidate.length === storedHash.length &&
            crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
        }
      }
    }

    // 3) If the account's stored email differs in case from the link email,
    //    the legacy single-key lookup above may have missed. Resolve the
    //    canonical address and retry the legacy store once.
    let canonicalEmail = normalizedEmail;
    if (!valid) {
      const owner = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { email: true },
      });
      if (owner) {
        const stored = owner.email.trim().toLowerCase();
        if (stored !== normalizedEmail) {
          canonicalEmail = stored;
          const retryHash = await getResetToken(`reset:${stored}`);
          if (retryHash && isBcryptHash(retryHash)) {
            valid = await verifyPassword(token, retryHash);
            legacyKey = `reset:${stored}`;
          } else if (retryHash) {
            try {
              valid = await verifyResetTokenDb(stored, token);
              if (valid) canonicalEmail = stored;
            } catch {
              valid = false;
            }
          }
        }
      }
    } else {
      // DB hit — adopt canonical email for the password update below.
      const owner = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { email: true },
      });
      if (owner) canonicalEmail = owner.email.trim().toLowerCase();
    }

    if (!valid) {
      return NextResponse.json({ error: "Reset link expired or invalid" }, { status: 400 });
    }

    const account = await prisma.user.findFirst({
      where: { email: { equals: canonicalEmail, mode: "insensitive" } },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Reset link expired or invalid" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    // Update by id (not by raw email) so case differences can't miss.
    await prisma.user.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });

    // Consume the token from every store so the link is single-use.
    await consumeResetTokenDb(canonicalEmail, token).catch(() => {});
    if (canonicalEmail !== normalizedEmail) {
      await consumeResetTokenDb(normalizedEmail, token).catch(() => {});
    }
    await delResetToken(`reset:${canonicalEmail}`).catch(() => {});
    if (legacyKey && legacyKey !== `reset:${canonicalEmail}`) {
      await delResetToken(legacyKey).catch(() => {});
    }

    return NextResponse.json({ message: "Password reset successful" }, { status: 200 });
  } catch (error) {
    console.error("Reset password error:", error);
    Sentry.captureException(error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request format. Please check your input." }, { status: 400 });
    }
    if (error instanceof Error && (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError")) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
