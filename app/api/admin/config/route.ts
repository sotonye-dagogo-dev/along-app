import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { redis } from "@/app/lib/db/redis";
import { CACHE_KEYS, CACHE_TTL } from "@/app/lib/config/cache";
import {
  ADMIN_CONFIG_DEFAULTS,
  getAdminConfigDefault,
  mergeAdminConfigsWithDefaults,
  validateAdminConfigValue,
} from "@/app/lib/config/admin";
import {
  SITE_NOTICE_CONFIG,
  normalizeMaintenanceFlag,
} from "@/app/lib/config/siteNotice";

const MAINTENANCE_KEY = SITE_NOTICE_CONFIG.siteConfigKeys.maintenance;

/**
 * Maintenance writes prime the cache (same JSON-string shape getSiteConfig
 * stores) instead of merely invalidating it, so the middleware enforcement
 * memo sees the fresh flag within its TTL window even before any banner
 * poll re-reads the DB.
 */
async function syncMaintenanceCache(value: boolean): Promise<void> {
  try {
    await redis.set(
      CACHE_KEYS.siteConfig(MAINTENANCE_KEY),
      JSON.stringify(value),
      { ex: CACHE_TTL.siteConfig },
    );
  } catch {
    /* best-effort — the middleware memo TTL still bounds staleness */
  }
}

export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const stored = await prisma.siteConfig.findMany({
      orderBy: { key: "asc" },
    });

    // DB-aware merge (Email/Blog Studio parity): stored rows win per key,
    // shipped defaults backfill for every known key with no row, so a fresh
    // database still renders a fully configurable board. Hardcoded updates
    // never overwrite DB rows — `configs` keeps the legacy shape (plus an
    // additive `source` flag), `defaults` ships the fallback catalog.
    const merged = mergeAdminConfigsWithDefaults(
      stored.map((c) => ({ key: c.key, value: c.value }))
    );
    const byKey = new Map(stored.map((c) => [c.key, c]));
    const configs = merged.map((m) => {
      const row = byKey.get(m.key);
      if (row) return { ...row, source: m.source };
      // Virtual row for a shipped default with no DB entry yet — the page
      // keys on `key` (never `id`), and saving it creates the real row.
      const now = new Date().toISOString();
      return {
        id: `default:${m.key}`,
        key: m.key,
        value: m.value,
        createdAt: now,
        updatedAt: now,
        source: m.source,
      };
    });

    return NextResponse.json(
      { configs, defaults: ADMIN_CONFIG_DEFAULTS },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin config list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { key, value } = body;

    // Restore-to-default: removes the DB-saved override for one key so the
    // hardcoded fallback shines through again (Email/Blog Studio parity).
    // Hardcoded updates NEVER overwrite DB-saved versions automatically —
    // restore is the explicit opt-in path back. Unknown keys without a
    // shipped default fall back to plain delete semantics.
    const restoreKey = typeof body?.restore === "string" ? body.restore.trim() : "";
    if (restoreKey) {
      const def = getAdminConfigDefault(restoreKey);
      if (!def) {
        return NextResponse.json({ error: "No default for that key" }, { status: 404 });
      }
      try {
        await prisma.siteConfig.delete({ where: { key: restoreKey } });
      } catch {
        /* already at default — nothing to remove */
      }
      if (restoreKey === MAINTENANCE_KEY) {
        await syncMaintenanceCache(
          normalizeMaintenanceFlag(getAdminConfigDefault(restoreKey)?.defaultValue),
        );
      } else {
        try {
          await redis.del(CACHE_KEYS.siteConfig(restoreKey));
        } catch {
          /* best-effort */
        }
      }
      try {
        const { logAudit } = await import("@/app/lib/services/auditService");
        await logAudit({
          actorId: (user as { id: string }).id,
          action: "config.restore-default",
          entity: "config",
          entityId: restoreKey,
        });
      } catch {
        /* audit never blocks the restore */
      }
      return NextResponse.json(
        { success: true, restored: restoreKey, value: def.defaultValue },
        { status: 200 }
      );
    }

    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }

    // Central gate: every known key validates here (earlyAdopter +
    // feedDiversity delegate to their existing validators, same messages).
    // Wrong shapes would silently degrade to defaults at read time, so
    // reject them with a clear 400.
    const validationError = validateAdminConfigValue(key, value);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const config = await prisma.siteConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    // Apply the edit now: maintenance is primed (see syncMaintenanceCache),
    // every other key is invalidated so the read-through cache re-fetches.
    if (key === MAINTENANCE_KEY) {
      await syncMaintenanceCache(normalizeMaintenanceFlag(value));
    } else {
      try {
        await redis.del(CACHE_KEYS.siteConfig(key));
      } catch {
        /* best-effort */
      }
    }

    try {
      const { logAudit } = await import("@/app/lib/services/auditService");
      await logAudit({
        actorId: (user as { id: string }).id,
        action: "config.upsert",
        entity: "config",
        entityId: key,
      });
    } catch {
      /* audit never blocks the save */
    }

    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    console.error("Admin config update error:", error);
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
    const { key } = body;

    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }

    // Idempotent: deleting a key with no row (already at default, or a
    // concurrent restore) succeeds instead of 500ing on the missing row.
    try {
      await prisma.siteConfig.delete({ where: { key } });
    } catch {
      /* already absent — still a successful delete */
    }

    if (key === MAINTENANCE_KEY) {
      await syncMaintenanceCache(false);
    } else {
      try {
        await redis.del(CACHE_KEYS.siteConfig(key));
      } catch {
        /* best-effort */
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Admin config delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
