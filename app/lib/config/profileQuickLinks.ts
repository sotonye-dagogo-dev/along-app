import { Link2, Trophy, Bell, BarChart3, UserPlus, Shield, LayoutList } from "lucide-react";
import { LEADERBOARD_LINKS_CONFIG } from "@/app/lib/config/leaderboardLinks";

export type ProfileQuickLinkKind =
  | { kind: "accountTab"; tab: "connected" | "points" | "security" | "danger" }
  | { kind: "scroll"; targetId: string }
  | { kind: "route"; href: string };

export type ProfileQuickLink = ProfileQuickLinkKind & {
  id: string;
  label: string;
  i18nKey?: string;
  icon: typeof Trophy;
  adminOnly?: boolean;
};

/**
 * Profile quick-links (config-driven).
 * Rendered between the account tabs and content tabs on the own-profile page.
 * `accountTab` entries switch the account tab + scroll; `scroll` entries just
 * scroll; `route` entries are plain Next Links. Admin entries are filtered
 * at render time via `isAdminRole`.
 */
export const PROFILE_QUICK_LINKS_CONFIG: ProfileQuickLink[] = [
  { id: "connected", label: "Connected accounts", icon: Link2, kind: "accountTab", tab: "connected" },
  { id: "points", label: "Profile points", icon: Trophy, kind: "accountTab", tab: "points" },
  { id: "posts", label: "Jump to posts", icon: LayoutList, kind: "scroll", targetId: "content" },
  { id: "notifications", label: "Notifications", icon: Bell, kind: "route", href: "/notifications" },
  { id: "analytics", label: "Analytics", icon: BarChart3, kind: "route", href: "/analytics" },
  {
    id: LEADERBOARD_LINKS_CONFIG.profileQuickLink.id,
    label: LEADERBOARD_LINKS_CONFIG.profileQuickLink.label,
    i18nKey: LEADERBOARD_LINKS_CONFIG.profileQuickLink.i18nKey,
    icon: Trophy,
    kind: "route",
    href: LEADERBOARD_LINKS_CONFIG.profileQuickLink.href,
  },
  { id: "invite", label: "Invite Friends", icon: UserPlus, kind: "route", href: "/invite" },
  { id: "admin", label: "Admin Dashboard", icon: Shield, kind: "route", href: "/admin", adminOnly: true },
];
