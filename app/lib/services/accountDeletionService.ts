/**
 * Safe account-deletion service — request → 7-day archived grace → finalize.
 * ACID: every transition runs in a single prisma.$transaction; anonymization
 * preserves post rows (policy: anonymised post data retained) while wiping
 * PII + personalized rows (likes/bookmarks). All side-effects (email,
 * notifications) are best-effort and never fail the transaction.
 */

import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/db/prisma";
import {
  ACCOUNT_DELETION_CONFIG,
  deletionScheduledFor,
  buildDeletedUserName,
  buildDeletedEmail,
} from "@/app/lib/config/accountDeletion";
import { getAppUrl } from "@/app/lib/config/env";

export interface DeletionRequestResult {
  ok: boolean;
  error?: string;
  scheduledFor?: Date;
  requestId?: string;
}

async function getAdminIds(): Promise<string[]> {
  // Legacy helper kept for callers that only need a presence check; new code
  // should use assignAdminForIssue() (single-assignee policy).
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isDeleted: false },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  } catch {
    return [];
  }
}

async function getAssignedAdmin(): Promise<{ id: string; email: string } | null> {
  try {
    const { assignAdminForIssue } = await import(
      "@/app/lib/services/adminAssignmentService"
    );
    return await assignAdminForIssue();
  } catch {
    return null;
  }
}

async function safeNotify(input: {
  type: "ACCOUNT_DELETION_REQUESTED" | "ACCOUNT_DELETION_CANCELLED" | "ACCOUNT_DELETION_COMPLETED";
  actorId: string;
  message: string;
  recipientIds: string[];
  allowSelf?: boolean;
}) {
  try {
    const { createNotification } = await import("@/app/lib/services/notificationService");
    await createNotification({ ...input });
  } catch (e) {
    console.error("[accountDeletion] notify failed:", e);
  }
}

export async function getDeletionStatus(userId: string) {
  try {
    const [user, pending] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isDeleted: true, deletionRequestedAt: true, deletionScheduledFor: true },
      }),
      prisma.accountDeletionRequest.findFirst({
        where: { userId, status: "PENDING" },
        orderBy: { requestedAt: "desc" },
      }),
    ]);
    return { user, pending };
  } catch {
    return { user: null, pending: null };
  }
}

/** User-initiated request: archive account + posts, schedule finalization. */
export async function requestAccountDeletion(userId: string, reason?: string): Promise<DeletionRequestResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, userName: true, firstName: true, lastName: true, isDeleted: true, role: true },
    });
    if (!user) return { ok: false, error: "User not found" };
    if (user.isDeleted) return { ok: false, error: "Account already deleted" };
    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN", isDeleted: false } });
      if (adminCount <= 1) return { ok: false, error: "Last admin cannot request deletion — promote another admin first" };
    }
    const existing = await prisma.accountDeletionRequest.findFirst({ where: { userId, status: "PENDING" } });
    if (existing) return { ok: true, scheduledFor: existing.scheduledFor, requestId: existing.id };

    const scheduledFor = deletionScheduledFor();
    const now = new Date();
    const sanitizedReason = (reason ?? "").slice(0, 500);

    const request = await prisma.$transaction(async (tx) => {
      const req = await tx.accountDeletionRequest.create({
        data: {
          userId,
          status: "PENDING",
          reason: sanitizedReason || null,
          originalEmail: user.email,
          originalUserName: user.userName,
          scheduledFor,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { deletionRequestedAt: now, deletionScheduledFor: scheduledFor, deletionReason: sanitizedReason || null },
      });
      // Archive all live posts so they vanish from feeds/explore/search.
      // Reviews stay visible-but-attributed during grace (reversal restores
      // everything); final anonymization happens in finalizeOne.
      await tx.post.updateMany({ where: { userId, isArchived: false }, data: { isArchived: true, archivedAt: now } });
      return req;
    });

    // Side-effects (best-effort, outside tx).
    const appUrl = getAppUrl();
    const scheduledLabel = scheduledFor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const displayName = `${user.firstName} ${user.lastName}`;
    try {
      const { sendAccountDeletionRequestedEmail, sendAdminDeletionAlertEmail } = await import("@/app/lib/services/emailService");
      const adminIds = await getAdminIds();
      // Single-assignee policy: exactly one admin owns the request and gets
      // the mail + in-app ping (not every admin).
      const assignee = await getAssignedAdmin();
      // Parallel sends — each has its own 5s provider timeout; sequential
      // awaits previously doubled the worst-case block on this request path.
      const userMail = sendAccountDeletionRequestedEmail(user.email, {
        firstName: user.firstName,
        scheduledDate: scheduledLabel,
        cancelLink: `${appUrl}/profile`,
      });
      const adminMail = assignee
        ? sendAdminDeletionAlertEmail(assignee.email, {
            displayName, userName: user.userName, email: user.email,
            scheduledDate: scheduledLabel,
            reasonLine: sanitizedReason ? `Reason: ${sanitizedReason}` : "",
          })
        : Promise.resolve({ sent: false, reason: "no assignee" });
      const [userRes, adminRes] = await Promise.all([userMail, adminMail]);
      if (!userRes.sent) console.warn(`[accountDeletion] user mail not sent: ${userRes.reason}`);
      if (assignee && !(adminRes as { sent: boolean }).sent) console.warn(`[accountDeletion] admin mail not sent: ${(adminRes as { reason?: string }).reason}`);
      await safeNotify({
        type: "ACCOUNT_DELETION_REQUESTED", actorId: userId,
        message: `Deletion requested — @${user.userName} archived until ${scheduledLabel}`,
        recipientIds: [userId], allowSelf: true,
      });
      if (assignee) {
        await safeNotify({
          type: "ACCOUNT_DELETION_REQUESTED", actorId: userId,
          message: `@${user.userName} requested account deletion (due ${scheduledLabel})`,
          recipientIds: [assignee.id],
        });
      } else if (adminIds.length > 0) {
        // No assignee resolved (e.g. load query failed with several admins):
        // fall back to the legacy fan-out rather than dropping the signal.
        await safeNotify({
          type: "ACCOUNT_DELETION_REQUESTED", actorId: userId,
          message: `@${user.userName} requested account deletion (due ${scheduledLabel})`,
          recipientIds: adminIds,
        });
      }
    } catch (e) {
      console.error("[accountDeletion] request side-effects failed:", e);
      Sentry.captureException(e);
    }

    return { ok: true, scheduledFor, requestId: request.id };
  } catch (e) {
    console.error("[accountDeletion] request failed:", e);
    Sentry.captureException(e);
    return { ok: false, error: "Failed to process deletion request" };
  }
}

/** Reverse a pending request: unarchive account + posts, notify admins in-app only. */
export async function cancelAccountDeletion(userId: string): Promise<DeletionRequestResult> {
  try {
    const pending = await prisma.accountDeletionRequest.findFirst({ where: { userId, status: "PENDING" } });
    if (!pending) return { ok: false, error: "No pending deletion request" };

    await prisma.$transaction(async (tx) => {
      await tx.accountDeletionRequest.update({ where: { id: pending.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: { deletionRequestedAt: null, deletionScheduledFor: null, deletionReason: null } });
      // Restore posts archived by the request (leave manually-archived ones intact
      // where possible: only unarchive posts archived after the request time).
      await tx.post.updateMany({
        where: { userId, isArchived: true, archivedAt: { gte: pending.requestedAt } },
        data: { isArchived: false, archivedAt: null },
      });
    });

    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { userName: true } });
      // Reversal pings the single assignee in-app only (no email, per
      // anti-abuse policy). Re-resolving by load usually lands on the same
      // admin that owned the request.
      const assignee = await getAssignedAdmin();
      const recipients = assignee ? [assignee.id] : await getAdminIds();
      await safeNotify({
        type: "ACCOUNT_DELETION_CANCELLED", actorId: userId,
        message: "You reversed your deletion request — welcome back!",
        recipientIds: [userId], allowSelf: true,
      });
      if (recipients.length > 0) {
        // In-app only for reversals (no email, per anti-abuse policy).
        await safeNotify({
          type: "ACCOUNT_DELETION_CANCELLED", actorId: userId,
          message: `@${user?.userName ?? "user"} reversed their deletion request`,
          recipientIds: recipients,
        });
      }
    } catch (e) {
      console.error("[accountDeletion] cancel side-effects failed:", e);
    }

    return { ok: true };
  } catch (e) {
    console.error("[accountDeletion] cancel failed:", e);
    Sentry.captureException(e);
    return { ok: false, error: "Failed to reverse deletion request" };
  }
}

export interface FinalizeResult { processed: number; ids: string[] }

/**
 * Finalize due requests: anonymize PII, clear personalized rows, send the
 * final email to the snapshotted address. Idempotent per request id.
 */
export async function finalizeDueDeletions(limit = ACCOUNT_DELETION_CONFIG.maxFinalizePerRun, completedBy = "cron"): Promise<FinalizeResult> {
  const due = await prisma.accountDeletionRequest.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: Math.min(limit, ACCOUNT_DELETION_CONFIG.maxFinalizePerRun),
  });
  const ids: string[] = [];
  for (const req of due) {
    try {
      await finalizeOne(req.id, completedBy);
      ids.push(req.id);
    } catch (e) {
      console.error(`[accountDeletion] finalize ${req.id} failed:`, e);
      Sentry.captureException(e);
    }
  }
  return { processed: ids.length, ids };
}

async function finalizeOne(requestId: string, completedBy: string) {
  const req = await prisma.accountDeletionRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") return;
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || user.isDeleted) {
    await prisma.accountDeletionRequest.update({ where: { id: requestId }, data: { status: "COMPLETED", completedAt: new Date(), completedBy } });
    return;
  }

  const now = new Date();
  const anonUserName = buildDeletedUserName(user.id);
  const anonEmail = buildDeletedEmail(user.id);
  const randomSecret = `deleted-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Capture interacted post ids BEFORE wiping rows so denormalized
  // counters can be recomputed (ACID for counts, best-effort post-tx).
  let interactedPostIds: string[] = [];
  try {
    const [liked, bookmarked] = await Promise.all([
      prisma.like.findMany({ where: { userId: user.id }, select: { postId: true } }),
      prisma.bookmark.findMany({ where: { userId: user.id }, select: { postId: true } }),
    ]);
    interactedPostIds = [...new Set([...liked.map((l) => l.postId), ...bookmarked.map((b) => b.postId)])];
  } catch { interactedPostIds = []; }

  await prisma.$transaction(async (tx) => {
    // Remove personalized rows (likes/bookmarks by the user) — these must
    // never survive for deleted profiles.
    await tx.like.deleteMany({ where: { userId: user.id } });
    await tx.bookmark.deleteMany({ where: { userId: user.id } });
    // Remove follow edges + push subscriptions (personal data).
    await tx.follow.deleteMany({ where: { OR: [{ followerId: user.id }, { followingId: user.id }] } });
    await tx.pushSubscription.deleteMany({ where: { userId: user.id } });
    // Recompute denormalized counters on posts the user had liked/bookmarked.
    // (Best-effort inside tx: recount via affected post ids first.)
    // Anonymize the user row; keep id stable so posts stay linked.
    await tx.user.update({
      where: { id: user.id },
      data: {
        userName: anonUserName,
        firstName: ACCOUNT_DELETION_CONFIG.deletedUserName,
        lastName: "User",
        email: anonEmail,
        password: randomSecret,
        avatar: null,
        // Prisma 7 Json? columns reject a bare `null` literal — DbNull
        // writes a true SQL NULL (clears any stored avatar config).
        avatarConfig: Prisma.DbNull,
        bio: ACCOUNT_DELETION_CONFIG.deletedBio,
        location: null,
        verified: false,
        role: "USER",
        inviteCode: null,
        invitedById: null,
        googleId: null,
        lastKnownLat: null,
        lastKnownLng: null,
        isDeleted: true,
        deletedAt: now,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionReason: null,
      },
    });
    // Ensure posts stay archived-but-attributed (anonymised post data
    // retained for platform integrity per policy). Keep them archived.
    await tx.post.updateMany({ where: { userId: user.id }, data: { isArchived: true, archivedAt: now } });
    // Reviews are intentionally NOT deleted: the user row above is anonymized
    // in place (id stable), so authored/received UserReview rows survive with
    // "Deleted User" attribution. Admin + public surfaces render them via
    // null-safe helpers (reviewAuthorName) and never crash on anonymized
    // authors. Hard-deletes never happen here, so onDelete:Cascade never fires.
    await tx.accountDeletionRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", completedAt: now, completedBy },
    });
  });

  // Counters: likes/bookmarks rows are gone so denormalized counts on
  // affected posts would be stale. Recompute for posts this user interacted
  // with — best-effort, capped, never fails finalization.
  if (interactedPostIds.length > 0) {
    try {
      const capped = interactedPostIds.slice(0, 200);
      for (const postId of capped) {
        const [likes, dislikes, bookmarks, comments] = await Promise.all([
          prisma.like.count({ where: { postId, type: "LIKE" } }),
          prisma.like.count({ where: { postId, type: "DISLIKE" } }),
          prisma.bookmark.count({ where: { postId } }),
          prisma.comment.count({ where: { postId } }),
        ]);
        await prisma.post.update({ where: { id: postId }, data: { likes, dislikes, bookmarks, comments } });
      }
    } catch { /* non-critical */ }
  }

  // Final email to the ORIGINAL address (snapshot survives anonymization).
  try {
    const { sendAccountDeletionCompletedEmail } = await import("@/app/lib/services/emailService");
    const firstName = user.firstName || "there";
    await sendAccountDeletionCompletedEmail(req.originalEmail, {
      firstName,
      completedDate: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      supportEmail: process.env.PLATFORM_USER_EMAIL ?? "alongtoanywhere@gmail.com",
    });
    const adminIds = await getAdminIds();
    const assignee = await getAssignedAdmin();
    const recipients = assignee ? [assignee.id] : adminIds;
    if (recipients.length > 0) {
      await safeNotify({
        type: "ACCOUNT_DELETION_COMPLETED", actorId: user.id,
        message: `@${req.originalUserName} deletion completed`,
        recipientIds: recipients,
      });
    }
  } catch (e) {
    console.error("[accountDeletion] completion side-effects failed:", e);
  }
}
