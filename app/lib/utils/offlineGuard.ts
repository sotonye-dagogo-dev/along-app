import { toastService } from "@/app/lib/services/toastService";
import { PWA_TOAST_COPY } from "@/app/lib/config/pwa";

/**
 * Guard for network-dependent operations. Returns true when online.
 * When offline it toasts (sanitized, contextual) and returns false so the
 * caller can bail out before hitting the network — no raw TypeErrors, no
 * "Unexpected token" feedback reaching the user.
 */
export function requireOnline(actionLabel = "complete this action"): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    toastService.info(
      actionLabel === "complete this action"
        ? PWA_TOAST_COPY.blockedOffline
        : `You are offline. ${actionLabel} needs a connection — please try again when back online.`,
    );
    return false;
  }
  return true;
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true; // fetch failed
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed") ||
    msg.includes("offline")
  );
}

/** Sanitized message for a network-dependent failure (never raw HTML/JSON errors). */
export function offlineFriendlyError(error: unknown, actionLabel = "complete this action"): string {
  if (isOfflineError(error)) {
    return `You are offline. Couldn't ${actionLabel} — please try again when back online.`;
  }
  return `Couldn't ${actionLabel}. Please try again.`;
}
