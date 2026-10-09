/**
 * Audit service — unified who/what/when trail. Every admin mutation should
 * `void logAudit(...)` (fire-and-forget, never throws) so the admin Audit
 * page can show a complete trail. Reads tolerate a missing table (P2022
 * during migration rollout) by returning empty results.
 */
import { prisma } from "@/app/lib/db/prisma";

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: String(input.action ?? "unknown").slice(0, 120),
        entity: String(input.entity ?? "general").slice(0, 80),
        entityId: input.entityId ? String(input.entityId).slice(0, 120) : null,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  } catch {
    /* audit writes are non-critical */
  }
}

export interface AuditQuery {
  action?: string;
  entity?: string;
  actorId?: string;
  cursor?: string;
  limit?: number;
}

export async function queryAudit(q: AuditQuery): Promise<{
  entries: Array<{
    id: string;
    actorId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    metadata: unknown;
    createdAt: Date;
    actor?: { id: string; userName: string; email: string } | null;
  }>;
  nextCursor: string | null;
}> {
  const limit = Math.min(100, Math.max(1, q.limit ?? 20));
  try {
    const where: Record<string, unknown> = {};
    if (q.action) where.action = { contains: q.action, mode: "insensitive" };
    if (q.entity) where.entity = q.entity;
    if (q.actorId) where.actorId = q.actorId;
    const rows = await prisma.auditLog.findMany({
      take: limit + 1,
      ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
      where: where as never,
      orderBy: { createdAt: "desc" },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    // Resolve actor display names in one query (best-effort).
    let actorMap = new Map<string, { id: string; userName: string; email: string }>();
    try {
      const ids = [...new Set(page.map((r) => r.actorId).filter(Boolean))] as string[];
      if (ids.length) {
        const users = await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, userName: true, email: true },
        });
        actorMap = new Map(users.map((u) => [u.id, u]));
      }
    } catch { /* ignore */ }
    return {
      entries: page.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        metadata: r.metadata,
        createdAt: r.createdAt,
        actor: r.actorId ? actorMap.get(r.actorId) ?? null : null,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  } catch {
    return { entries: [], nextCursor: null };
  }
}
