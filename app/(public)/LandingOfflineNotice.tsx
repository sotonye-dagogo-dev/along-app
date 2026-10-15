"use client";

import { CachedDataNotice } from "@/app/components/pwa/OfflineBanner";

/**
 * Landing offline notice — client island inside the server-rendered landing
 * page. Renders nothing while online; while offline it labels the precached
 * landing shell as cached data (PWA cached-notice copy, config-driven).
 */
export default function LandingOfflineNotice() {
  return (
    <div className="px-5 pt-3 bg-bg-base">
      <div className="max-w-[640px] mx-auto">
        <CachedDataNotice compact />
      </div>
    </div>
  );
}
