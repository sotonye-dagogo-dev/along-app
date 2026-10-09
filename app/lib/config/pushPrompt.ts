/**
 * Push-prompt registry — single source of truth for the enable-push notice:
 * persistence keys, copy per environment outcome, and platform guidance.
 * Zero app deps (config layer only).
 *
 * The notice must (a) actually subscribe on click, (b) explain itself when
 * the device/browser cannot comply, and (c) stay hidden once resolved —
 * via local flags, not just server state (which is unreachable offline).
 */

export interface PushPromptConfig {
  storage: {
    /** Set when a subscription succeeds on this device. */
    enabledKey: string;
    /** Timestamp of the last user dismissal (respected for dismissTtlMs). */
    dismissedAtKey: string;
    /** How long a dismissal hides the prompt. */
    dismissTtlMs: number;
  };
  copy: {
    prompt: string;
    enable: string;
    enabling: string;
    enabledToast: string;
    dismissed: string;
    offline: string;
    denied: string;
    deniedHelp: string;
    unsupported: string;
    noVapid: string;
    failed: string;
    iosHelp: string;
    howTo: string;
  };
}

export const PUSH_PROMPT_CONFIG: PushPromptConfig = {
  storage: {
    enabledKey: "along-push-enabled",
    dismissedAtKey: "along-push-dismissed-at",
    dismissTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  copy: {
    prompt: "Enable push notifications to never miss replies, mentions, and rewards.",
    enable: "Enable",
    enabling: "Enabling…",
    enabledToast: "Push notifications on — you're all set.",
    dismissed: "Dismiss push prompt",
    offline: "Connect to the internet to enable notifications.",
    denied: "Notifications are blocked for this site.",
    deniedHelp: "Open your browser site settings → Notifications → Allow, then try Enable again.",
    unsupported: "This device or browser doesn't support push notifications.",
    noVapid: "Push service isn't configured right now. In-app notifications still work.",
    failed: "Couldn't enable push. Check permission and connection, then retry.",
    iosHelp: "On iPhone: Share → Add to Home Screen, open the installed app, then enable.",
    howTo: "How to enable",
  },
};

/** Outcome reasons surfaced by subscribeToPushDetailed (stable identifiers). */
export type PushSubscribeReason =
  | "ok"
  | "unsupported"
  | "insecure-context"
  | "no-vapid"
  | "no-service-worker"
  | "denied"
  | "dismissed-permission"
  | "subscribe-failed"
  | "server-rejected"
  | "offline";

/** True for iOS Safari/WebKit where push needs an installed PWA. */
export function isLikelyIos(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}
