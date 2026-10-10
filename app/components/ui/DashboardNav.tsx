"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import {
  Home, Compass, MapPin, Bell, User,
  Shield, ShieldCheck,
  PanelLeftClose, PanelRight,
  Settings, Navigation,
} from "lucide-react"
import { useAuth } from "@/app/hooks/useAuth"
import { useTranslation } from "@/app/providers/I18nProvider"
import { filterNavItems, BADGED_NAV_HREFS, isAdminRole } from "@/app/lib/config/navigation"
import { useUnreadNotifications, formatBadgeCount } from "@/app/lib/hooks/useUnreadNotifications"
import AppLogo from "./AppLogo"

const ShareRouteModal = dynamic(
  () => import("@/app/components/features/posts/ShareRouteModal"),
  { ssr: false }
)

const MOBILE_TABS = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Share Route", href: "/home?share=true", icon: MapPin, isFab: true },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: User },
]

/** In-flight POST /api/posts dedup for the sidebar composer (mirrors home). */
const sidebarInflightKeys = new Set<string>()

export default function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isGuest } = useAuth()
  const { t } = useTranslation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  const mainNavItems = filterNavItems(user?.role ?? "user", "main")
  // Badge reads the live unread count (0 for guests — no badge, no traffic).
  const unreadCount = useUnreadNotifications(!isGuest && Boolean(user))
  const showBadge = (href: string) =>
    !isGuest && unreadCount > 0 && (BADGED_NAV_HREFS as readonly string[]).includes(href)

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home"
    if (href === "/profile") return pathname.startsWith("/profile")
    return pathname.startsWith(href)
  }

  const sidebarWidth = sidebarCollapsed ? "w-16" : "w-60"

  /**
   * Real POST handler for the sidebar composer. Previously a no-op that just
   * closed the modal (returning void), which the composer treated as success
   * — drafts cleared, modal closed, but nothing ever reached POST /api/posts
   * (the reported "valid post vanished" bug). Now mirrors home `submitPost`:
   * POSTs with the idempotency header and returns an explicit boolean so the
   * modal only clears/closes on `true`.
   */
  const handleShareSubmit = useCallback(async (data: {
    title: string
    description?: string
    type?: "ROUTE" | "ROUTE_RESPONSE"
    quotedPostId?: string
    routes: unknown[]
    images?: string[]
    tags?: string[]
    startLat?: number
    startLng?: number
    endLat?: number
    endLng?: number
    waypoints?: { lat: number; lng: number }[]
    clientMutationId?: string
  }): Promise<boolean> => {
    const { clientMutationId, ...body } = data
    if (clientMutationId && sidebarInflightKeys.has(clientMutationId)) return false
    if (clientMutationId) sidebarInflightKeys.add(clientMutationId)
    try {
      const { POST_SUBMIT_CONFIG } = await import("@/app/lib/config/postSubmit")
      const { firstRouteServerMessage } = await import("@/app/lib/config/routeValidation")
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientMutationId ? { [POST_SUBMIT_CONFIG.idempotencyHeader]: clientMutationId } : {}),
        },
        body: JSON.stringify(body),
      })
      let payload: { error?: string; message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } = {}
      try {
        const text = await res.text()
        payload = text ? (JSON.parse(text) as typeof payload) : {}
      } catch {
        payload = { error: "Unexpected server response. Please try again." }
      }
      if (res.ok) {
        // Best-effort feed refresh: the sidebar mounts on every dashboard
        // page, so refresh the router + the shared feed stream (no-op off-home).
        try {
          const { feedStream } = await import("@/app/lib/streams/feedStream")
          await feedStream.refresh()
        } catch { /* non-critical off-home */ }
        router.refresh()
        return true
      }
      const { toastService } = await import("@/app/lib/services/toastService")
      toastService.error(
        firstRouteServerMessage(
          payload.details,
          payload.message ?? payload.error ?? "Failed to post. Please try again."
        )
      )
      console.error("[DashboardNav submitPost] failed", { status: res.status, error: payload.error, details: payload.details })
      return false
    } catch {
      try {
        const { toastService } = await import("@/app/lib/services/toastService")
        const { sanitizeRouteErrorMessage } = await import("@/app/lib/config/routeValidation")
        toastService.error(sanitizeRouteErrorMessage("Network error. Please check your connection and try again."))
      } catch { /* toast is best-effort */ }
      return false
    } finally {
      if (clientMutationId) sidebarInflightKeys.delete(clientMutationId)
    }
  }, [router])

  return (
    <>
      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed lg:hidden bottom-0 left-0 right-0 z-20 bg-bg-card/88 backdrop-blur-xl border-t border-border flex items-center justify-around h-16 px-2">
        {MOBILE_TABS.map((tab) => {
          if (tab.isFab) {
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className="w-14 h-14 rounded-full bg-primary text-white grid place-items-center -mt-5 shadow-primary shadow-lg transition-transform hover:scale-105"
                aria-label={tab.label}
              >
                <MapPin className="w-6 h-6" />
              </Link>
            )
          }
          const active = isActive(tab.href)
          const badged = showBadge(tab.href)
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1 min-w-[48px] transition-colors ${
                active ? "text-primary" : "text-text-muted"
              }`}
            >
              <span className="relative">
                <tab.icon className={`w-5 h-5 ${active ? "stroke-primary" : ""}`} />
                {badged && (
                  <span
                    role="status"
                    aria-label={`${unreadCount} unread notifications`}
                    className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-bold grid place-items-center leading-none"
                  >
                    {formatBadgeCount(unreadCount)}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-bg-card border-r border-border transition-all duration-200 relative ${sidebarWidth}`}
      >
        {/* Sidebar Brand */}
        <div className={`flex items-center pt-6 pb-4 ${sidebarCollapsed ? "justify-center px-2" : "px-5"}`}>
          {sidebarCollapsed ? (
            <AppLogo size="sm" variant="icon" showText={false} linkTo="/home" />
          ) : (
            <Link href="/home">
              <AppLogo size="sm" variant="icon" linkTo="" />
            </Link>
          )}
        </div>

        {/* Collapse Toggle - floating on right border */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-[28px] z-10 w-6 h-6 rounded-circle bg-bg-card border border-border grid place-items-center text-text-muted hover:text-text-secondary hover:bg-bg-elevated transition-colors shadow-sm cursor-pointer"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelRight className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-2 overflow-y-auto">
          {/* Share Route - always first, opens modal */}
          {!isGuest && (
            <button
              onClick={() => setShowShareModal(true)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors w-full text-left cursor-pointer ${
                sidebarCollapsed ? "justify-center px-0" : ""
              }`}
              title={sidebarCollapsed ? "Share Route" : undefined}
            >
              <Navigation className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{t("nav.shareRoute")}</span>}
            </button>
          )}

          {!sidebarCollapsed && !isGuest && <div className="h-px bg-border my-1 mx-3" />}

          {mainNavItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            const badged = showBadge(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-muted text-primary"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="relative shrink-0">
                  <Icon className={`w-5 h-5 shrink-0 ${active ? "stroke-primary" : ""}`} />
                  {badged && (
                    <span
                      role="status"
                      aria-label={`${unreadCount} unread notifications`}
                      className={`absolute -top-1.5 ${sidebarCollapsed ? "-right-2" : "-right-2.5"} min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-bold grid place-items-center leading-none`}
                    >
                      {formatBadgeCount(unreadCount)}
                    </span>
                  )}
                </span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!sidebarCollapsed && badged && (
                  <span
                    aria-hidden="true"
                    className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[#E11D48] text-white text-[11px] font-bold grid place-items-center leading-none"
                  >
                    {formatBadgeCount(unreadCount)}
                  </span>
                )}
              </Link>
            )
          })}

          {isAdminRole(user?.role) && (
            <>
              <div className="h-px bg-border my-2 mx-3" />
              {!sidebarCollapsed && (
                <div className="text-[11px] font-medium tracking-wider uppercase text-text-muted px-3 mb-1">
                  {t("nav.admin")}
                </div>
              )}
              <Link
                href="/admin"
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-primary-muted text-primary"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title={sidebarCollapsed ? t("nav.dashboard") : undefined}
              >
                <Shield className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span>{t("nav.dashboard")}</span>}
              </Link>
              <Link
                href="/admin/posts"
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith("/admin/posts")
                    ? "bg-primary-muted text-primary"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title={sidebarCollapsed ? t("nav.moderation") : undefined}
              >
                <ShieldCheck className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span>{t("nav.moderation")}</span>}
              </Link>
            </>
          )}
        </nav>

        {/* Sidebar User Section */}
        <div className={`flex items-center py-4 border-t border-border ${sidebarCollapsed ? "justify-center px-2 gap-1" : "gap-2.5 px-5"}`}>
          {isGuest ? (
            <Link
              href="/login"
              className={`flex items-center gap-2 text-sm font-medium text-primary hover:underline ${sidebarCollapsed ? "flex-col gap-1" : ""}`}
              title={sidebarCollapsed ? t("nav.signIn") : undefined}
            >
              <User className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span>{t("nav.signIn")}</span>}
            </Link>
          ) : (
            <>
              <Link
                href={`/profile/${user?.userName}`}
                className={`flex items-center ${sidebarCollapsed ? "" : "gap-2.5 min-w-0 flex-1"}`}
                title={sidebarCollapsed ? `${user?.firstName} ${user?.lastName}` : undefined}
              >
                <div className="w-8 h-8 rounded-full bg-primary-muted text-primary grid place-items-center text-sm font-bold shrink-0">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {user?.firstName} {user?.lastName}
                    </div>
                    {user?.role && (
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-info text-info-text uppercase tracking-wide">
                        {user.role}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </>
          )}
        </div>
      </aside>

      {/* Share Route Modal */}
      {showShareModal && (
        <ShareRouteModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          onSubmit={handleShareSubmit}
        />
      )}
    </>
  )
}
