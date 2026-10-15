/**
 * Notification preferences configuration (per-user, config-driven).
 *
 * Backward compatibility: there is no prefs row (or a null/partial `prefs`
 * JSON) for existing users — every missing key resolves to `true`, which is
 * exactly how the platform behaves today (everything notifies). Toggling a
 * key to `false` opts that user out of that family; toggling back (or
 * deleting the row) restores the current behaviour. No migration backfills.
 *
 * Privacy: preferences only gate DELIVERY to the owner. They never expose
 * one user's choices to another user and never change what is stored about
 * anyone else.
 */

export const NOTIFICATION_PREFERENCE_KEYS = [
  "routeRequest",
  "newRoute",
  "routeResponse",
  "like",
  "dislike",
  "comment",
  "mention",
  "follow",
  "reward",
  "badge",
  "report",
  "moderation",
  "push",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export type NotificationPreferenceMap = Record<NotificationPreferenceKey, boolean>;

/** Current platform behaviour, expressed as data: everything on. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceMap = {
  routeRequest: true,
  newRoute: true,
  routeResponse: true,
  like: true,
  dislike: true,
  comment: true,
  mention: true,
  follow: true,
  reward: true,
  badge: true,
  report: true,
  moderation: true,
  push: true,
};

/** Maps a NotificationType fan-out to the preference key that gates it. */
export const NOTIFICATION_TYPE_TO_PREFERENCE_KEY: Record<string, NotificationPreferenceKey> = {
  ROUTE_REQUEST: "routeRequest",
  NEW_ROUTE: "newRoute",
  ROUTE_RESPONSE: "routeResponse",
  LIKE: "like",
  DISLIKE: "dislike",
  COMMENT: "comment",
  MENTION: "mention",
  FOLLOW: "follow",
  REWARD: "reward",
  BADGE: "badge",
  VERIFIED: "reward",
  WELCOME: "reward",
  REPORT: "report",
  MODERATION: "moderation",
  ACCOUNT_DELETION_REQUESTED: "moderation",
  ACCOUNT_DELETION_CANCELLED: "moderation",
  ACCOUNT_DELETION_COMPLETED: "moderation",
};

/** UI metadata — drives the preferences modal (metadata-driven, no hardcoded rows). */
export const NOTIFICATION_PREFERENCES_META = {
  title: "Notification preferences",
  description:
    "Choose which notifications you receive. Everything is on by default — exactly how Along works today. Turning a switch off only stops delivery to you.",
  sections: [
    {
      id: "routes",
      label: "Routes & requests",
      keys: ["routeRequest", "newRoute", "routeResponse"] as NotificationPreferenceKey[],
    },
    {
      id: "engagement",
      label: "Engagement",
      keys: ["like", "dislike", "comment", "mention", "follow"] as NotificationPreferenceKey[],
    },
    {
      id: "rewards",
      label: "Rewards & account",
      keys: ["reward", "badge", "report", "moderation"] as NotificationPreferenceKey[],
    },
    {
      id: "channels",
      label: "Channels",
      keys: ["push"] as NotificationPreferenceKey[],
    },
  ],
  keyLabels: {
    routeRequest: "Route requests from the community",
    newRoute: "New routes from people you follow",
    routeResponse: "Responses to your route requests",
    like: "Likes on your posts",
    dislike: "Dislikes on your posts",
    comment: "Comments on your posts",
    mention: "Mentions of you in comments",
    follow: "New followers",
    reward: "Points, referrals & welcome notes",
    badge: "Tier-ups & badges",
    report: "Reports & receipts",
    moderation: "Moderation outcomes & account notices",
    push: "Push notifications (device)",
  } as Record<NotificationPreferenceKey, string>,
  keyHints: {
    routeRequest: "Off = you won't be notified of new requests (you can still browse them).",
    newRoute: "Off = no notifications when people you follow share routes.",
    routeResponse: "Off = no notification when someone answers your request.",
    like: "Off = no notifications for likes.",
    dislike: "Off = no notifications for dislikes.",
    comment: "Off = no notifications for comments.",
    mention: "Off = no notifications when someone mentions you.",
    follow: "Off = no notifications for new followers.",
    reward: "Off = no points/referral/welcome notifications.",
    badge: "Off = no tier-up notifications.",
    report: "Off = no report receipts.",
    moderation: "Off = no moderation/account notices (still shown where required).",
    push: "Off = in-app stays, device push stops.",
  } as Record<NotificationPreferenceKey, string>,
} as const;

/** Merge a stored prefs JSON over the defaults (never throws; null-safe). */
export function normalizeNotificationPreferences(raw: unknown): NotificationPreferenceMap {
  const base = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const r = raw as Partial<Record<NotificationPreferenceKey, unknown>>;
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    const v = r[key];
    if (typeof v === "boolean") base[key] = v;
  }
  return base;
}

/** Validate a client-supplied prefs patch; error string or null when valid. */
export function validateNotificationPreferencesValue(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "preferences must be an object";
  const v = value as Record<string, unknown>;
  for (const [k, val] of Object.entries(v)) {
    if (!(NOTIFICATION_PREFERENCE_KEYS as readonly string[]).includes(k))
      return `unknown preference key: ${k}`;
    if (typeof val !== "boolean") return `${k} must be a boolean`;
  }
  return null;
}
