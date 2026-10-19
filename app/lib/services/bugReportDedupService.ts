/**
 * Bug-report dedup + single-writer serialisation core (Lane A).
 *
 * Why this exists: the original flow was a READ (find recent matches) then a
 * WRITE (create) OUTSIDE any transaction. Two concurrent submissions of the
 * same report (error-boundary double capture, multi-tab submit, flaky-network
 * retry) both passed the read and both inserted — duplicate rows, each then
 * handed to a DIFFERENT admin by the load-based assignee pick. The fix:
 *
 * 1. Serialize per reporter with `pg_advisory_xact_lock` held for the whole
 *    check+insert transaction. Two writers for one reporter can never
 *    interleave between "no duplicate found" and "insert".
 * 2. Keep the matchers payload-scoped (idempotency key, error identity,
 *    exact description) and NO LONGER require a title match — identity
 *    matches (key/path) must not miss just because wording drifted.
 * 3. Self-heal: a duplicate row found without an assignee (historical crash
 *    window) is assigned to exactly one admin inside the same transaction.
 *
 * Lock key scope = reporter (or the "anon" bucket), so unrelated reporters
 * never contend. All helpers are safe to call with the route's interactive
 * transaction client (`tx`) and never throw on lock failure (best-effort
 * serialisation — a lock problem degrades to today's behaviour, it does not
 * block reporting).
 */

import type { Prisma } from "@/app/generated/prisma/client";
import { BUG_REPORT_DEDUP_CONFIG } from "@/app/lib/config/reportAttachments";

/** One incoming submission, normalised for matching. */
export interface IncomingBugReport {
  reporterId: string | null;
  description: string;
  idempotencyKey?: string | null;
  /** metadata.path from the client capture (error identity). */
  clientPath?: string | null;
  /** metadata.digest from the client capture (error identity). */
  clientDigest?: string | null;
}

/** Row shape the matchers need (subset of BugReport). */
export interface StoredBugReportRow {
  id: string;
  description: string;
  metadata?: unknown;
  reviewerId?: string | null;
}

/** Json-tolerant metadata reader (legacy rows may hold any shape). */
export function extractMetadataRecord(raw: unknown): Record<string, unknown> {
  try {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  } catch {
    /* unparseable metadata — fall through to empty record */
  }
  return {};
}

export function dedupWindowStart(nowMs: number = Date.now()): Date {
  return new Date(nowMs - BUG_REPORT_DEDUP_CONFIG.dedupWindowSec * 1000);
}

/**
 * Match order (same reporter scope is guaranteed by the caller's query):
 *  1. idempotency key (clientToken / header) — strongest signal;
 *  2. same error identity (metadata.path + metadata.digest agree) — catches
 *     timestamp-diverged captures of one error. Title deliberately does NOT
 *     participate: identity matches must survive wording drift;
 *  3. exact description (legacy content match).
 */
export function matchesDuplicateBugReport(row: StoredBugReportRow, incoming: IncomingBugReport): boolean {
  const meta = extractMetadataRecord(row.metadata);
  if (incoming.idempotencyKey && meta.idempotencyKey === incoming.idempotencyKey) return true;
  if (
    incoming.clientPath !== null &&
    incoming.clientPath !== undefined &&
    typeof meta.path === "string" &&
    meta.path === incoming.clientPath &&
    (incoming.clientDigest === null || incoming.clientDigest === undefined
      ? meta.digest === null || meta.digest === undefined
      : meta.digest === incoming.clientDigest)
  ) {
    return true;
  }
  return row.description === incoming.description;
}

/** Advisory-lock key: per reporter (coarsest scope covering every matcher). */
export function buildDedupLockKey(reporterId: string | null): string {
  return `${BUG_REPORT_DEDUP_CONFIG.dedupLockPrefix}${reporterId ?? "anon"}`;
}

/**
 * Take the per-reporter write lock for the current transaction. xact-scoped:
 * released automatically at commit/rollback. Best-effort — a failure leaves
 * the transaction running (degrades to the unlocked behaviour).
 */
export async function acquireBugReportDedupLock(tx: Prisma.TransactionClient, reporterId: string | null): Promise<boolean> {
  try {
    const key = buildDedupLockKey(reporterId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Newest-first candidate scan inside the dedup window, scoped to the SAME
 * reporter (or both-anonymous). Returns the first matcher hit or null.
 * Call INSIDE the locked transaction so the subsequent insert cannot race.
 */
export async function findDuplicateBugReport(
  tx: Prisma.TransactionClient,
  incoming: IncomingBugReport,
  windowStart: Date
): Promise<StoredBugReportRow | null> {
  const recent = await tx.bugReport.findMany({
    where: {
      createdAt: { gte: windowStart },
      reporterId: incoming.reporterId,
    },
    select: { id: true, description: true, metadata: true, reviewerId: true },
    orderBy: { createdAt: "desc" },
    take: BUG_REPORT_DEDUP_CONFIG.dedupMaxCandidates,
  });
  return recent.find((row) => matchesDuplicateBugReport(row, incoming)) ?? null;
}
