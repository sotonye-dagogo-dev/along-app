import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import {
  normalizeNotificationPreferences,
  validateNotificationPreferencesValue,
} from "@/app/lib/config/notificationPreferences";

/**
 * GET /api/notifications/preferences — the caller's effective preferences.
 * Missing row / NULL / partial JSON resolves per-key to `true` (current
 * platform behaviour), so existing users see "everything on" — backward
 * compatible, no backfill. Never 404s for lack of a row.
 */
export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = user.id as string;
    try {
      const row = await prisma.notificationPreference.findUnique({
        where: { userId },
        select: { prefs: true, updatedAt: true },
      });
      const prefs = normalizeNotificationPreferences(
        (row as { prefs?: unknown } | null)?.prefs ?? null
      );
      return NextResponse.json(
        {
          preferences: prefs,
          customized: Boolean(row),
          updatedAt: (row as { updatedAt?: unknown } | null)?.updatedAt ?? null,
        },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        { preferences: normalizeNotificationPreferences(null), customized: false, updatedAt: null },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Get notification preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/notifications/preferences — upserts the caller's prefs.
 * Body: `{ preferences: { <knownKey>: boolean, ... } }` (partial allowed;
 * unknown keys / non-booleans are rejected with 400). Stored JSON is the
 * merged full map so reads stay single-row. Never touches anyone else's row.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = user.id as string;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const patch =
      (body as { preferences?: unknown; prefs?: unknown })?.preferences ??
      (body as { prefs?: unknown })?.prefs;
    const err = validateNotificationPreferencesValue(patch);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
    try {
      const existing = await prisma.notificationPreference.findUnique({
        where: { userId },
        select: { prefs: true },
      });
      const merged = {
        ...normalizeNotificationPreferences(
          (existing as { prefs?: unknown } | null)?.prefs ?? null
        ),
        ...(patch as Record<string, boolean>),
      };
      const saved = await prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId, prefs: merged as never },
        update: { prefs: merged as never },
        select: { prefs: true, updatedAt: true },
      });
      const preferences = normalizeNotificationPreferences(
        (saved as { prefs?: unknown })?.prefs ?? null
      );
      return NextResponse.json(
        {
          preferences,
          customized: true,
          updatedAt: (saved as { updatedAt?: unknown })?.updatedAt ?? null,
        },
        { status: 200 }
      );
    } catch (e) {
      // P2022 (column missing pre-migration) or init failure: fail honestly
      // but keep the caller's intent visible — return merged defaults.
      console.error("Save notification preferences error:", e);
      return NextResponse.json(
        {
          error: "Preferences could not be saved yet. Please try again in a moment.",
          preferences: normalizeNotificationPreferences(patch),
          customized: false,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Save notification preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
