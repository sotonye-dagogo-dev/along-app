import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { redis } from "@/app/lib/db/redis";
import { CACHE_KEYS } from "@/app/lib/config/cache";

export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const configs = await prisma.siteConfig.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json({ configs }, { status: 200 });
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

    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }

    // Guard the early-adopter badge config: wrong shapes would silently
    // disable or mislabel the badge, so reject them with a clear 400.
    if (key === "earlyAdopterConfig") {
      const { validateEarlyAdopterConfigValue } = await import(
        "@/app/lib/config/earlyAdopter"
      );
      const validationError = validateEarlyAdopterConfigValue(value);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const config = await prisma.siteConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    // Invalidate the siteConfig read-through cache so admin edits apply now.
    try {
      await redis.del(CACHE_KEYS.siteConfig(key));
    } catch {
      /* best-effort */
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

    await prisma.siteConfig.delete({ where: { key } });

    try {
      await redis.del(CACHE_KEYS.siteConfig(key));
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Admin config delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
