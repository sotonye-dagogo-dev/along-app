/**
 * Location permission feedback copy (config-driven, zero app deps).
 *
 * Single source of truth for user-facing geolocation messages so Explore,
 * Share-Route, and Navigation Guide stay consistent. Passive tracking
 * (useUserLocation) stays silent by design; explicit locate-me actions
 * surface these strings via toastService or inline banners.
 */
export interface LocationFeedbackConfig {
  denied: string;
  deniedWithTypingHint: string;
  timeout: string;
  unavailable: string;
  unsupported: string;
  trackingDenied: string;
  trackingUnavailable: string;
}

export const LOCATION_FEEDBACK_CONFIG: LocationFeedbackConfig = {
  denied: "Location access denied — enable it to see your pin",
  deniedWithTypingHint: "Location permission denied — type the location instead",
  timeout: "Location timed out — try again",
  unavailable: "Couldn't get your location",
  unsupported: "Location isn't available on this device",
  trackingDenied: "Location permission denied. Enable it to use live tracking.",
  trackingUnavailable: "Unable to determine your location.",
};

export function locationErrorCopy(code: number | null | undefined): string {
  if (code === 1) return LOCATION_FEEDBACK_CONFIG.denied;
  if (code === 3) return LOCATION_FEEDBACK_CONFIG.timeout;
  return LOCATION_FEEDBACK_CONFIG.unavailable;
}
