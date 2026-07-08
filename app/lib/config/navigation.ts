import {
  Home, Compass, MapPin, Bookmark, Bell, User, BarChart3,
  UserPlus, ShoppingBag, Settings, Shield, ShieldCheck, Trophy,
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
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag, section: "main" },
  { label: "Admin", href: "/admin", icon: Shield, section: "admin", roles: ["admin"] },
  { label: "Moderation", href: "/admin/posts", icon: ShieldCheck, section: "admin", roles: ["admin"] },
];

function hasAccess(item: NavItem, role: string): boolean {
  if (!item.roles) return true;
  return item.roles.includes(role as "user" | "admin");
}

export function filterNavItems(role: string, section?: "main" | "admin"): NavItem[] {
  return NAV_REGISTRY.filter(
    (item) => hasAccess(item, role) && (!section || item.section === section)
  );
}
