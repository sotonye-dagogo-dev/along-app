import { prisma } from "@/app/lib/db/prisma";
import { verifyPassword } from "@/app/lib/utils/security";
import { normalizeResetEmail } from "@/app/lib/services/resetTokenStore";

/**
 * Durable Postgres store for email-verification OTPs — mirrors
 * `resetTokenStore.ts` (which fixed the identical "link expired seconds
 * after mail" class for forgot-password).
 *
 * Why this exists: `otp:{email}` lives in Redis with a per-instance memory
 * fallback. On serverless, a code issued on instance A is invisible to
 * instance B whenever Upstash is slow/misconfigured (the fallback Map is
 * not shared), so a just-received code reads as "expired or replaced".
 * Every issuance below also writes one DB row (single-active per
 * email+purpose); every verification consults the DB whenever Redis has no
 * hash for the key. All DB calls are best-effort and swallow
 * missing-table errors (P2021/P2022 — migration still rolling out), in
 * which case the legacy Redis/memory path behaves exactly as before.
 */

export const EMAIL_OTP_PURPOSES = {
  verify: "verify",
  change: "change",
} as const;

export type EmailOtpPurpose =
  (typeof EMAIL_OTP_PURPOSES)[keyof typeof EMAIL_OTP_PURPOSES];

function isMissingTableError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = (e as { name?: string }).name ?? "";
  const code = (e as { code?: string }).code ?? "";
  const msg = e.message ?? "";
  return (
    code === "P2021" ||
    code === "P2022" ||
    name === "PrismaClientKnownRequestError" ||
    /does not exist|relation .* does not exist|table .* does not exist|column .* does not exist|not available/i.test(
      msg
    )
  );
}

function swallowMissingTable(e: unknown): boolean {
  if (isMissingTableError(e)) {
    console.warn(
      "[emailOtpStore] EmailOtpToken table unavailable (migration pending?) — using Redis/memory fallback",
      (e as Error).message
    );
    return true;
  }
  return false;
}

export function normalizeOtpEmail(email: unknown): string | null {
  return normalizeResetEmail(email);
}

/**
 * Persist an OTP hash durably. Single-active: prior rows for the same
 * (email, purpose[, userId]) are replaced so the "use the newest email"
 * copy stays honest and only one code can ever be valid.
 * Never throws for missing-table (migration pending) — callers treat the
 * Redis/memory write as the primary in that window.
 */
export async function storeEmailOtpDb(
  email: string,
  otpHash: string,
  purpose: EmailOtpPurpose,
  ttlSeconds: number,
  userId?: string
): Promise<void> {
  const normalized = normalizeOtpEmail(email);
  if (!normalized || !otpHash) return;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  try {
    // Opportunistic expiry cleanup — never blocks issuance.
    await prisma.emailOtpToken
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});
    const scope =
      purpose === EMAIL_OTP_PURPOSES.change && userId
        ? { purpose, userId }
        : { email: normalized, purpose };
    await prisma.emailOtpToken.deleteMany({ where: scope });
    await prisma.emailOtpToken.create({
      data: {
        email: normalized,
        purpose,
        userId: purpose === EMAIL_OTP_PURPOSES.change ? (userId ?? null) : null,
        otpHash,
        expiresAt,
      },
    });
  } catch (e) {
    if (swallowMissingTable(e)) return;
    throw e;
  }
}

interface VerifyDbOptions {
  /** Binds the code to a requester (change-email flow). */
  userId?: string;
  /**
   * Bound candidate for bcrypt comparison. Defaults to the raw OTP;
   * change-email stores `newEmail::otp` so callers pass that form here.
   */
  candidate?: string;
}

/**
 * Verify an OTP against the DB store. Returns true on the first unexpired
 * row whose bcrypt hash matches. Does not consume the row (callers consume
 * on success). Returns false when the table is missing (fallback path).
 */
export async function verifyEmailOtpDb(
  email: string,
  otp: string,
  purpose: EmailOtpPurpose,
  options: VerifyDbOptions = {}
): Promise<boolean> {
  const normalized = normalizeOtpEmail(email);
  if (!normalized || !otp) return false;
  const candidate = options.candidate ?? otp;
  try {
    const where =
      purpose === EMAIL_OTP_PURPOSES.change && options.userId
        ? { purpose, userId: options.userId }
        : { email: normalized, purpose };
    const rows = await prisma.emailOtpToken.findMany({ where });
    if (rows.length === 0) return false;
    const now = Date.now();
    let sawExpired = false;
    for (const row of rows) {
      if (row.expiresAt.getTime() <= now) {
        sawExpired = true;
        continue;
      }
      // For change-email the row's email IS the new address — an OTP issued
      // for another address must never verify here.
      if (
        purpose === EMAIL_OTP_PURPOSES.change &&
        row.email !== normalized
      ) {
        continue;
      }
      try {
        if (await verifyPassword(candidate, row.otpHash)) return true;
      } catch {
        // Corrupt hash — treat as non-match, prune below.
        sawExpired = true;
      }
    }
    if (sawExpired) {
      await prisma.emailOtpToken
        .deleteMany({ where: { ...where, expiresAt: { lte: new Date() } } })
        .catch(() => {});
    }
    return false;
  } catch (e) {
    if (swallowMissingTable(e)) return false;
    throw e;
  }
}

/** Consume (delete) all rows for an email+purpose (+userId for change). */
export async function consumeEmailOtpsDb(
  email: string,
  purpose: EmailOtpPurpose,
  userId?: string
): Promise<void> {
  const normalized = normalizeOtpEmail(email) ?? email;
  try {
    if (purpose === EMAIL_OTP_PURPOSES.change && userId) {
      await prisma.emailOtpToken.deleteMany({ where: { purpose, userId } });
    } else {
      await prisma.emailOtpToken.deleteMany({
        where: { email: normalized, purpose },
      });
    }
  } catch (e) {
    if (swallowMissingTable(e)) return;
    throw e;
  }
}
