"use client";

/**
 * Global PWA notices hub — mounts the install + push prompts once for the
 * whole app. Both children are self-hiding (installed / enabled / dismissed
 * flags), collapsible to corner pills, and fixed-position with capped width,
 * so they inform without interfering with core flows or performance:
 * no polling, no network until the user acts, SSR-safe.
 */
import { InstallPrompt } from "@/app/components/pwa/InstallPrompt";
import { PushManager } from "@/app/components/pwa/PushManager";
import { ServiceWorkerUpdatePrompt } from "@/app/components/pwa/ServiceWorkerUpdatePrompt";

export function PwaNotices() {
  return (
    <>
      <InstallPrompt />
      <ServiceWorkerUpdatePrompt />
      <PushManager variant="floating" />
    </>
  );
}
