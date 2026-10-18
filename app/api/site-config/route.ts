import { NextResponse } from "next/server";
import { getSiteConfig } from "@/app/lib/utils/siteConfig";
import {
  SITE_NOTICE_CONFIG,
  normalizeMaintenanceFlag,
  normalizeAnnouncementText,
  normalizeAnnouncements,
} from "@/app/lib/config/siteNotice";

export const dynamic = "force-dynamic";

/**
 * Public site-notice surface — `{ maintenanceMode, refreshNotice,
 * announcementBanner, announcements }`.
 *
 * Consumed by the `<SiteNotices />` banner island (mount + online/focus +
 * interval). Deliberately unauthenticated and shape-stable: guests, the
 * service worker (`/api/site-config` is on the PWA cacheable list), and any
 * future consumer can rely on it. `no-store` so an admin toggle lands on the
 * next poll instead of a stale cache window.
 */
export async function GET() {
  const fallback = {
    maintenanceMode: false,
    refreshNotice: false,
    announcementBanner: "",
    announcements: [] as ReturnType<typeof normalizeAnnouncements>,
  };
  try {
    const [maintenanceRaw, announcementRaw, refreshRaw, announcementsRaw] =
      await Promise.all([
        getSiteConfig<unknown>(
          SITE_NOTICE_CONFIG.siteConfigKeys.maintenance,
          false,
        ),
        getSiteConfig<unknown>(SITE_NOTICE_CONFIG.siteConfigKeys.announcement, ""),
        getSiteConfig<unknown>(SITE_NOTICE_CONFIG.siteConfigKeys.refresh, false),
        getSiteConfig<unknown>(SITE_NOTICE_CONFIG.siteConfigKeys.announcements, []),
      ]);
    return NextResponse.json(
      {
        maintenanceMode: normalizeMaintenanceFlag(maintenanceRaw),
        refreshNotice: normalizeMaintenanceFlag(refreshRaw),
        announcementBanner: normalizeAnnouncementText(announcementRaw),
        announcements: normalizeAnnouncements(announcementsRaw),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // getSiteConfig already never-throws; this is belt-and-braces so the
    // banner island always gets a valid shape (notice simply stays hidden).
    return NextResponse.json(fallback, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
