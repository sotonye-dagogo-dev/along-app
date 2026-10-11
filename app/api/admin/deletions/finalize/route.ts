import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import {
  finalizeDueDeletions,
  requestAccountDeletion,
  finalizeSingleRequest,
  cancelDeletionRequestById,
  deleteUserNow,
} from "@/app/lib/services/accountDeletionService";
import { ADMIN_USER_DELETION_META } from "@/app/lib/config/admin";

/**
 * Admin-triggered deletion pipeline (safe, same grace-period flow).
 * POST { action: "finalizeDue" } runs the cron finalizer on demand.
 * POST { action: "request", userId, reason } starts the 7-day flow for a user.
 * POST { action: "cancel", requestId } reverses one pending request.
 * POST { action: "finalizeOne", requestId, force? } finalizes one request
 *   (due-only unless force:true — the destructive "delete now" path).
 * POST { action: "deleteNow", userId, reason? } request-if-needed then
 *   force-finalize through the same anonymize pipeline (destructive safe
 *   deletion with warning + audit; irreversible in-app, 30-day off-platform
 *   backup recovery only).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const actorId = user.id as string;
    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action ?? "finalizeDue";

    if (action === "request") {
      const { userId, reason } = body as { userId?: string; reason?: string };
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      if (userId === actorId)
        return NextResponse.json({ error: ADMIN_USER_DELETION_META.selfDeleteGuard }, { status: 400 });
      const result = await requestAccountDeletion(userId, reason);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      try {
        const { logAudit } = await import("@/app/lib/services/auditService");
        await logAudit({ actorId, action: "user.deletion.request", entity: "user", metadata: { userId, requestId: result.requestId } });
      } catch { /* ignore */ }
      return NextResponse.json({ success: true, scheduledFor: result.scheduledFor, requestId: result.requestId }, { status: 200 });
    }

    if (action === "cancel") {
      const { requestId, userId } = body as { requestId?: string; userId?: string };
      if (requestId) {
        const result = await cancelDeletionRequestById(requestId);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        try {
          const { logAudit } = await import("@/app/lib/services/auditService");
          await logAudit({ actorId, action: "user.deletion.cancel", entity: "user", metadata: { requestId } });
        } catch { /* ignore */ }
        return NextResponse.json({ success: true, requestId }, { status: 200 });
      }
      // User-scoped reversal (users table has no request id handy): resolve
      // the pending request for the user, then cancel through the same path.
      if (userId) {
        const { cancelAccountDeletion } = await import(
          "@/app/lib/services/accountDeletionService"
        );
        const result = await cancelAccountDeletion(userId);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        try {
          const { logAudit } = await import("@/app/lib/services/auditService");
          await logAudit({ actorId, action: "user.deletion.cancel", entity: "user", metadata: { userId } });
        } catch { /* ignore */ }
        return NextResponse.json({ success: true, userId }, { status: 200 });
      }
      return NextResponse.json({ error: "requestId or userId required" }, { status: 400 });
    }

    if (action === "finalizeOne") {
      const { requestId, force } = body as { requestId?: string; force?: boolean };
      if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });
      const result = await finalizeSingleRequest(requestId, actorId, { force: force === true });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      try {
        const { logAudit } = await import("@/app/lib/services/auditService");
        await logAudit({ actorId, action: force === true ? "user.deletion.finalizeNow" : "user.deletion.finalizeOne", entity: "user", metadata: { requestId, forced: result.forced ?? false } });
      } catch { /* ignore */ }
      return NextResponse.json({ success: true, requestId: result.requestId, forced: result.forced ?? false }, { status: 200 });
    }

    if (action === "deleteNow") {
      const { userId, reason } = body as { userId?: string; reason?: string };
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      if (userId === actorId)
        return NextResponse.json({ error: ADMIN_USER_DELETION_META.selfDeleteGuard }, { status: 400 });
      const result = await deleteUserNow(userId, reason, actorId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      try {
        const { logAudit } = await import("@/app/lib/services/auditService");
        await logAudit({ actorId, action: "user.deletion.deleteNow", entity: "user", metadata: { userId, requestId: result.requestId } });
      } catch { /* ignore */ }
      return NextResponse.json({ success: true, requestId: result.requestId, finalized: true }, { status: 200 });
    }

    const result = await finalizeDueDeletions(50, actorId);
    try {
      const { logAudit } = await import("@/app/lib/services/auditService");
      await logAudit({ actorId, action: "user.deletion.finalizeDue", entity: "user", metadata: { processed: result.processed } });
    } catch { /* ignore */ }
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (e) {
    console.error("admin deletions finalize error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
