import { NextRequest, NextResponse } from "next/server";
import {
  getEarlyAdopterConfig,
  listEarlyAdopters,
} from "@/app/lib/services/earlyAdopterService";

/**
 * GET /api/users/early-adopters?limit=100
 * Public, config-driven: returns the badge config plus the earliest-joined
 * users (ranked by User.createdAt asc). When the badge is disabled the list
 * is empty but the config (enabled:false) is still returned so clients can
 * hide the badge. Enables future filtering / rewards tooling.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get("limit");
    const parsed = rawLimit ? Number(rawLimit) : undefined;
    const limit =
      typeof parsed === "number" && Number.isFinite(parsed)
        ? Math.max(1, Math.min(500, Math.floor(parsed)))
        : undefined;

    const [config, adopters] = await Promise.all([
      getEarlyAdopterConfig(),
      (async () => {
        const c = await getEarlyAdopterConfig();
        if (!c.enabled) return [];
        return listEarlyAdopters(limit ?? c.limit);
      })(),
    ]);

    return NextResponse.json(
      { config, earlyAdopters: adopters },
      { status: 200 }
    );
  } catch (error) {
    console.error("Early adopters list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
