import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const search = searchParams.get("q");
    // Future-proof filter: ?earlyAdopter=true lists the earliest-joined users
    // first (badge qualification order) for rewards/audience tooling.
    const earlyAdopterOnly = searchParams.get("earlyAdopter") === "true";
    // Deletion lifecycle filters: ?deletion=pending|deleted, ?order=oldest for
    // first-N-by-signup quick selection (earliest createdAt first).
    const deletionFilter = searchParams.get("deletion");
    const oldestFirst = searchParams.get("order") === "oldest";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { userName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (deletionFilter === "pending") {
      where.deletionScheduledFor = { not: null };
      (where as Record<string, unknown>).isDeleted = false;
    } else if (deletionFilter === "deleted") {
      (where as Record<string, unknown>).isDeleted = true;
    }

    if (earlyAdopterOnly && !cursor) {
      const { buildEarlyAdopterLabel } = await import(
        "@/app/lib/config/earlyAdopter"
      );
      let badgeLimit = 100;
      let template = "First {N} Users #{rank}";
      try {
        const stored = await prisma.siteConfig.findUnique({
          where: { key: "earlyAdopterConfig" },
        });
        if (stored?.value && typeof stored.value === "object") {
          const cfg = stored.value as { limit?: unknown; badgeLabelTemplate?: unknown };
          if (typeof cfg.limit === "number" && Number.isFinite(cfg.limit)) {
            badgeLimit = Math.max(1, Math.floor(cfg.limit));
          }
          if (typeof cfg.badgeLabelTemplate === "string" && cfg.badgeLabelTemplate.trim()) {
            template = cfg.badgeLabelTemplate;
          }
        }
      } catch {
        /* defaults */
      }
      const take = Math.min(limit, badgeLimit);
      const earliest = await prisma.user.findMany({
        take,
        where: where as never,
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          role: true,
          rewardTier: true,
          rewardPoints: true,
          verified: true,
          _count: { select: { posts: true } },
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const ranked = earliest.map((u, i) => ({
        ...u,
        earlyAdopterRank: i + 1,
        earlyAdopterLabel: buildEarlyAdopterLabel(
          { limit: badgeLimit, badgeLabelTemplate: template },
          i + 1
        ),
      }));
      return NextResponse.json({ users: ranked, nextCursor: null }, { status: 200 });
    }

    const users = await prisma.user.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: where as never,
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        role: true,
        rewardTier: true,
        rewardPoints: true,
        verified: true,
        isDeleted: true,
        deletionScheduledFor: true,
        _count: { select: { posts: true } },
        createdAt: true,
      },
      orderBy: oldestFirst ? [{ createdAt: "asc" }, { id: "asc" }] : { createdAt: "desc" },
    });

    const hasMore = users.length > limit;
    const result = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? result[result.length - 1].id : null;

    return NextResponse.json({ users: result, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("Admin users list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, userIds, role, verified, action } = body as {
      userId?: string; userIds?: string[]; role?: string; verified?: boolean;
      action?: "verify" | "unverify" | "resend-verification";
    };
    const targets: string[] = userIds?.length ? userIds : userId ? [userId] : [];

    if (targets.length === 0) {
      return NextResponse.json({ error: "userId(s) required" }, { status: 400 });
    }

    // Capture previous verification state for client-side undo (all paths).
    const previous = await prisma.user.findMany({
      where: { id: { in: targets } },
      select: { id: true, role: true, verified: true },
    });

    // --- Email-verification actions (additive; role flow below unchanged) ---
    if (action === "verify" || action === "unverify") {
      const next = action === "verify";
      await prisma.user.updateMany({
        where: { id: { in: targets } },
        data: { verified: next },
      });
      // Notify each affected user (self-addressed VERIFIED on verify so the
      // push mirror fires too; silent best-effort on unverify is still
      // recorded so the user knows their status changed).
      try {
        const { createNotification } = await import("@/app/lib/services/notificationService");
        for (const t of targets) {
          void createNotification({
            type: "VERIFIED",
            actorId: user.id as string,
            message: next
              ? "An admin verified your email. You're all set!"
              : "An admin marked your email as unverified. Check your inbox for a fresh code.",
            recipientIds: [t],
          });
        }
      } catch { /* non-critical */ }
      try {
        const { logAudit } = await import("@/app/lib/services/auditService");
        await logAudit({ actorId: user.id as string, action: `user.${action}`, entity: "user", metadata: { targets, next } });
      } catch { /* ignore */ }
      return NextResponse.json({ success: true, updated: targets.length, previous, action }, { status: 200 });
    }

    if (action === "resend-verification") {
      const { hashPassword } = await import("@/app/lib/utils/security");
      const { setOtp } = await import("@/app/lib/services/otpStore");
      const { AUTH_VERIFICATION_CONFIG } = await import("@/app/lib/config/authVerification");
      const { getAppUrl } = await import("@/app/lib/config/env");
      const appUrl = getAppUrl();
      let emailed = 0;
      const errors: string[] = [];
      for (const id of targets) {
        try {
          const target = await prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, firstName: true, verified: true },
          });
          if (!target) {
            errors.push(`${id}: not found`);
            continue;
          }
          if (target.verified) continue; // already verified — nothing to send
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          await setOtp(`otp:${target.email.trim().toLowerCase()}`, await hashPassword(otp), AUTH_VERIFICATION_CONFIG.otpTtlSeconds);
          try {
            const { sendVerifyEmail } = await import("@/app/lib/services/emailService");
            const r = await sendVerifyEmail(
              target.email,
              target.firstName || "traveller",
              otp,
              `${appUrl}/verify-email?email=${encodeURIComponent(target.email)}`
            );
            if (r.sent) {
              emailed += 1;
              try {
                const { createNotification } = await import("@/app/lib/services/notificationService");
                void createNotification({
                  type: "VERIFIED",
                  actorId: user.id as string,
                  message: "An admin re-sent your verification code. Use the newest email.",
                  recipientIds: [target.id],
                });
              } catch { /* non-critical */ }
            } else {
              errors.push(`${target.email}: ${r.reason ?? "send failed"}`);
            }
          } catch {
            errors.push(`${target.email}: send error`);
          }
        } catch {
          errors.push(`${id}: failed`);
        }
      }
      return NextResponse.json(
        { success: true, updated: targets.length, emailed, previous, action, ...(errors.length ? { errors } : {}) },
        { status: 200 }
      );
    }

    if (!role) {
      return NextResponse.json({ error: "userId(s) and role required" }, { status: 400 });
    }

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    await prisma.user.updateMany({
      where: { id: { in: targets } },
      data:
        typeof verified === "boolean"
          ? { role: role as "USER" | "ADMIN", verified }
          : { role: role as "USER" | "ADMIN" },
    });

    try {
      const { logAudit } = await import("@/app/lib/services/auditService");
      await logAudit({ actorId: user.id as string, action: "user.role", entity: "user", metadata: { targets, role, verified: verified ?? null } });
    } catch { /* ignore */ }
    return NextResponse.json({ success: true, updated: targets.length, previous }, { status: 200 });
  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, userIds } = body as { userId?: string; userIds?: string[] };
    const targets: string[] = userIds?.length ? userIds : userId ? [userId] : [];

    if (targets.length === 0) {
      return NextResponse.json({ error: "userId(s) required" }, { status: 400 });
    }

    const previous = await prisma.user.findMany({
      where: { id: { in: targets } },
      select: { id: true, role: true, verified: true },
    });

    await prisma.user.updateMany({
      where: { id: { in: targets } },
      data: { role: "USER", verified: false },
    });

    return NextResponse.json({ success: true, updated: targets.length, previous }, { status: 200 });
  } catch (error) {
    console.error("Admin user action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
