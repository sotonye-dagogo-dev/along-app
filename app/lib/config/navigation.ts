import {
  Home, Compass, Bookmark, Bell, User, BarChart3,
  UserPlus, Shield, ShieldCheck, Trophy,
} from "lucide-react";
import type { NavItem } from "@/app/lib/types";

export const NAV_REGISTRY: NavItem[] = [
  { label: "Home", href: "/home", icon: Home, section: "main" },
  { label: "Explore", href: "/explore", icon: Compass, section: "main" },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark, section: "main" },
  { label: "Notifications", href: "/notifications", icon: Bell, section: "main" },
  { label: "Profile", href: "/profile", icon: User, section: "main" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, section: "main" },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy, section: "main" },
  { label: "Invite", href: "/invite", icon: UserPlus, section: "main" },
  { label: "Admin", href: "/admin", icon: Shield, section: "admin", roles: ["ADMIN"] },
  { label: "Moderation", href: "/admin/posts", icon: ShieldCheck, section: "admin", roles: ["ADMIN"] },
];

/**
 * Canonical admin check. The DB enum is uppercase (`USER` | `ADMIN`), but
 * older client code compared against lowercase `"admin"` — which silently
 * hid every admin entry point. Compare case-insensitively so one helper
 * owns the rule everywhere (sidebar, profile quick links, admin shell).
 */
export function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && role.toUpperCase() === "ADMIN";
}

function hasAccess(item: NavItem, role: string): boolean {
  if (!item.roles) return true;
  return item.roles.some((r) => r.toUpperCase() === role.toUpperCase());
}

export function filterNavItems(role: string, section?: "main" | "admin"): NavItem[] {
  return NAV_REGISTRY.filter(
    (item) => hasAccess(item, role) && (!section || item.section === section)
  );
}

/**
 * Notification badge policy (config-driven, zero app deps).
 * - `pollMs`: how often the nav re-reads the unread count (60s mirrors the
 *   server notifications cache TTL so polls stay cheap).
 * - `maxDisplay`: counts above this render as "99+".
 * - `endpoint`: unread source — limit=1 keeps the payload tiny; the
 *   `unreadCount` field is what the badge reads.
 */
export const NOTIFICATION_BADGE_CONFIG = {
  pollMs: 60_000,
  maxDisplay: 99,
  endpoint: "/api/notifications?limit=1",
} as const;

/** Hrefs whose nav entries render the unread badge. */
export const BADGED_NAV_HREFS: readonly string[] = ["/notifications"] as const;

/**
 * Live-navigation overlay policy (config-driven, zero app deps).
 * When the user starts navigation, the map + step guide open together in
 * a floating modal that takes up most of the screen over a dimmed page —
 * so the moving user dot and the turn-by-turn instructions stay in view
 * hand-in-hand on any screen size.
 */
export const LIVE_NAVIGATION_CONFIG = {
  title: "Live Navigation",
  subtitle: "Follow the map and the step guide together",
  closeLabel: "Close navigation",
  dialogLabel: "Live navigation",
  /** Guide panel width on desktop (map takes the rest). */
  sidePanelWidthPx: 360,
} as const;
