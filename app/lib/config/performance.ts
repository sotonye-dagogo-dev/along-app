/**
 * Runtime performance registry — single source of truth for the client-side
 * cadences and CDN cache windows that keep Vercel Fluid Active CPU
 * consumption bounded.
 *
 * Vercel Fluid bills "Active CPU" (actual compute time) separately from the
 * wall-clock memory window, so the two cost drivers are (1) how often a
 * function actually runs and (2) how much work each run does. This registry
 * governs driver (1):
 *
 * - Background timers must not burn compute in hidden tabs. `pauseWhenHidden`
 *   stops every client poller while `document.visibilityState !== "visible"`
 *   and `refreshOnVisible` catches up once on return, so UX is unchanged but
 *   idle tabs cost nothing.
 * - Public, unauthenticated read endpoints get a short CDN cache window
 *   (`s-maxage` + `stale-while-revalidate`) so repeated polling is served at
 *   the edge instead of invoking a function. Authenticated/personalised
 *   responses never opt in.
 *
 * Zero app deps (config layer only) so it can be imported by hooks, providers
 * and route handlers without cycles.
 */

export const CLIENT_POLLING_CONFIG = {
  /**
   * Stop interval timers while the tab/document is hidden. The browser
   * throttles hidden timers to ~1/min but does not stop them; a long-lived
   * installed PWA left open would otherwise poll forever in the background.
   */
  pauseWhenHidden: true,
  /** Run one catch-up tick when the tab becomes visible again. */
  refreshOnVisible: true,
  /** Small delay so the catch-up tick never competes with the paint. */
  resumeDelayMs: 1_500,
} as const;

export type ClientPollingConfig = typeof CLIENT_POLLING_CONFIG;

/**
 * CDN cache policy for public, non-personalised read endpoints.
 *
 * `sMaxAgeSec` is how long the Vercel edge may serve the response without
 * invoking the function; `staleWhileRevalidateSec` lets it keep serving
 * stale while a single request refreshes it. Keep these short for surfaces
 * that an admin can toggle (site notices) so changes still land promptly.
 */
export const PUBLIC_READ_CACHE_CONFIG = {
  /** Public site-notice payload polled by every client (~60s cadence). */
  siteConfig: {
    sMaxAgeSec: 30,
    staleWhileRevalidateSec: 60,
  },
} as const;

export type PublicReadCacheConfig = typeof PUBLIC_READ_CACHE_CONFIG;

/** Build a `Cache-Control` value from a public read cache entry. */
export function publicReadCacheControl(entry: {
  sMaxAgeSec: number;
  staleWhileRevalidateSec: number;
}): string {
  const sMax = Math.max(0, Math.floor(entry.sMaxAgeSec));
  const swr = Math.max(0, Math.floor(entry.staleWhileRevalidateSec));
  return `public, s-maxage=${sMax}, stale-while-revalidate=${swr}`;
}
