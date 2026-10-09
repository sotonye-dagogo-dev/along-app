/**
 * Single-admin assignment for incoming issues (bug reports, account-deletion
 * requests, error captures).
 *
 * Policy: exactly ONE admin is assigned per issue and receives the email +
 * in-app notification — notifying every admin wastes email since only one
 * admin acts. The assignee is picked by current load with randomization
 * among equals:
 * - load(admin) = OPEN + TRIAGED + IN_PROGRESS BugReports with
 *   reviewerId = admin.id, plus PENDING AccountDeletionRequests spread
 *   evenly (pendingCount / adminCount, so deletion backlogs also steer).
 * - candidates = admins tied on the lowest load; one is drawn with
 *   crypto.randomInt (uniform). Equal loads degrade to pure rotation-by-luck;
 *   skew drains toward the least-loaded admin. Never throws — callers fall
 *   back to the platform inbox when no admin resolves.
 */

import { randomInt } from "crypto";
import { prisma } from "@/app/lib/db/prisma";

export interface AssignedAdmin {
  id: string;
  email: string;
}

const ACTIVE_BUG_STATUSES = ["OPEN", "TRIAGED", "IN_PROGRESS"] as const;

export async function getActiveAdmins(): Promise<AssignedAdmin[]> {
  try {
    return await prisma.user.findMany({
      where: { role: "ADMIN", isDeleted: false },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return [];
  }
}

/**
 * Pick the single admin an issue should be assigned to. Returns null when
 * there are no admins (caller falls back to the platform inbox / no-op).
 */
export async function assignAdminForIssue(): Promise<AssignedAdmin | null> {
  const admins = await getActiveAdmins();
  if (admins.length === 0) return null;
  if (admins.length === 1) return admins[0];

  try {
    const [bugLoads, pendingDeletions] = await Promise.all([
      prisma.bugReport.groupBy({
        by: ["reviewerId"],
        where: {
          status: { in: [...ACTIVE_BUG_STATUSES] as never },
          reviewerId: { in: admins.map((a) => a.id) },
        },
        _count: { _all: true },
      }),
      prisma.accountDeletionRequest.count({ where: { status: "PENDING" } }),
    ]);
    const bugCountByAdmin = new Map<string, number>();
    for (const row of bugLoads) {
      if (row.reviewerId) bugCountByAdmin.set(row.reviewerId, row._count._all);
    }
    // Pending deletions carry no assignee column, so each admin absorbs an
    // equal share when comparing loads — a deep deletion backlog still
    // spreads new issues randomly instead of piling onto one admin.
    const sharedDeletionLoad = pendingDeletions / admins.length;
    let minLoad = Infinity;
    const loads = new Map<string, number>();
    for (const admin of admins) {
      const load = (bugCountByAdmin.get(admin.id) ?? 0) + sharedDeletionLoad;
      loads.set(admin.id, load);
      if (load < minLoad) minLoad = load;
    }
    const candidates = admins.filter((a) => loads.get(a.id) === minLoad);
    return candidates[randomInt(candidates.length)] ?? admins[0];
  } catch {
    // Load query failed — pure random pick still satisfies single-assignee.
    return admins[randomInt(admins.length)] ?? admins[0];
  }
}
