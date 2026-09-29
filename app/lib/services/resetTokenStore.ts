import crypto from "crypto";
import { prisma } from "@/app/lib/db/prisma";

export const RESET_TOKEN_TTL_SECONDS = 3600;

export function normalizeResetEmail(email: unknown): string | null {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

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
      "[resetTokenStore] PasswordResetToken table unavailable (migration pending?) — using Redis/memory fallback",
      (e as Error).message
    );
    return true;
  }
  return false;
}

/**
 * Persist a reset token durably in Postgres. Allows multiple concurrent
 * tokens per email (each request creates its own row) so requesting twice
 * does not instantly invalidate the first link.
 */
export async function storeResetTokenDb(
  email: string,
  token: string,
  ttlSeconds = RESET_TOKEN_TTL_SECONDS
): Promise<{ tokenHash: string; expiresAt: Date }> {
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  // Opportunistic cleanup of expired rows — never let it block issuance.
  // Prior tokens for the same email are intentionally KEPT so requesting
  // twice does not instantly invalidate the first link.
  try {
    await prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // ignore cleanup failures; issuance below is what matters.
  }
  try {
    await prisma.passwordResetToken.create({
      data: { email, tokenHash, expiresAt },
    });
    // Cap rows per email to bound growth (keep newest 5).
    const rows = await prisma.passwordResetToken.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
      select: { tokenHash: true },
    });
    if (rows.length > 5) {
      const stale = rows.slice(5).map((r) => r.tokenHash);
      await prisma.passwordResetToken
        .deleteMany({ where: { tokenHash: { in: stale } } })
        .catch(() => {});
    }
  } catch (e) {
    if (swallowMissingTable(e)) throw e;
    throw e;
  }
  return { tokenHash, expiresAt };
}

/**
 * Verify a token against the DB store. Returns the matching row's email when
 * valid, otherwise null. Does not consume the token.
 */
export async function verifyResetTokenDb(
  email: string,
  token: string
): Promise<boolean> {
  const tokenHash = sha256Hex(token);
  try {
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!row) return false;
    if (row.email !== email) return false;
    if (row.expiresAt.getTime() <= Date.now()) {
      await prisma.passwordResetToken.delete({ where: { tokenHash } }).catch(() => {});
      return false;
    }
    return true;
  } catch (e) {
    if (swallowMissingTable(e)) return false;
    throw e;
  }
}

export async function consumeResetTokenDb(
  email: string,
  token: string
): Promise<void> {
  const tokenHash = sha256Hex(token);
  try {
    await prisma.passwordResetToken.deleteMany({
      where: { email, tokenHash },
    });
  } catch (e) {
    if (swallowMissingTable(e)) return;
    throw e;
  }
}

export async function deleteResetTokensForEmail(email: string): Promise<void> {
  try {
    await prisma.passwordResetToken.deleteMany({ where: { email } });
  } catch (e) {
    if (swallowMissingTable(e)) return;
    throw e;
  }
}
