import { NextResponse } from "next/server";
import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import {
  DEFAULT_PLATFORM_TOUR_CONFIG,
  PLATFORM_TOUR_CONFIG_KEY,
  normalizePlatformTourConfig,
} from "@/app/lib/config/platformTour";

export const dynamic = "force-dynamic";

/**
 * Public platform-tour surface — `{ tour }` (full normalized config incl.
 * the default step metadata shipped with the bundle).
 *
 * Deliberately unauthenticated and shape-stable: guests, the service worker
 * (`/api/tour` is on the SWR cacheable list), and the resume-when-offline
 * path can all rely on it. Stored admin row merges field-wise over the
 * shipped defaults, so a partial/corrupt row can never break the tour —
 * the code fallback always keeps every required key.
 */
export async function GET() {
  try {
    const raw = await getSiteConfig<unknown>(PLATFORM_TOUR_CONFIG_KEY, null);
    const tour = normalizePlatformTourConfig(raw, DEFAULT_PLATFORM_TOUR_CONFIG);
    return NextResponse.json(
      { tour },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      },
    );
  } catch {
    // Belt-and-braces normalization — getSiteConfig already never-throw.
    return NextResponse.json(
      { tour: DEFAULT_PLATFORM_TOUR_CONFIG },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      },
    );
  }
}
