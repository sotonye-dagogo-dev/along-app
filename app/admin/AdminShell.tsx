"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/app/hooks/useAuth"
import { isAdminRole } from "@/app/lib/config/navigation"
import { ADMIN_LAYOUT_CONFIG } from "@/app/lib/config/admin"
import { AppPageLoader } from "@/app/components/ui"
import AppLogo from "@/app/components/ui/AppLogo"
import {
  LayoutDashboard, Users, FileText, Settings, Bug, Shield,
  Home, Compass, Bell, Bookmark, BarChart3, Mail,
  ChevronsLeft, ChevronsRight, Menu, X, UserX,
} from "lucide-react"

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deletions", label: "Deletions", icon: UserX },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/config", label: "Config", icon: Settings },
  { href: "/admin/bugs", label: "Bugs", icon: Bug },
  { href: "/admin/reviews", label: "Reviews", icon: Shield },
  { href: "/admin/email", label: "Email", icon: Mail },
]

const topNavItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
]

function NavLink({ href, label, Icon, active, collapsed }: {
  href: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean; collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 px-4 py-2.5 mx-3 mb-0.5 radius-md text-sm font-medium no-underline transition-colors duration-fast overflow-hidden whitespace-nowrap text-ellipsis ${
        active
          ? "bg-primary-muted text-primary"
          : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <Icon size={20} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_LAYOUT_CONFIG.storageKey)
      if (raw === "1") setCollapsed(true)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    } else if (!isLoading && user && !isAdminRole(user.role)) {
      router.push("/home")
    }
  }, [user, isLoading, router])

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(ADMIN_LAYOUT_CONFIG.storageKey, next ? "1" : "0") } catch { /* ignore */ }
      return next
    })
  }

  if (isLoading) {
    return <AppPageLoader />
  }

  if (!user || !isAdminRole(user.role)) {
    return null
  }

  const sidebarWidth = collapsed ? ADMIN_LAYOUT_CONFIG.collapsedWidth : ADMIN_LAYOUT_CONFIG.sidebarWidth

  const sidebarBody = (isMobile: boolean, isCollapsed: boolean) => (
    <>
      <Link
        href="/home"
        className={`px-5 py-6 pb-4 no-underline flex items-center ${isCollapsed && !isMobile ? "justify-center px-2" : ""}`}
      >
        <AppLogo size="md" showText={!isCollapsed || isMobile} variant="icon" />
      </Link>

      {topNavItems.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} Icon={item.icon}
          active={pathname === item.href} collapsed={isCollapsed && !isMobile} />
      ))}

      <div className="h-px bg-border mx-4 my-3" />
      {(!isCollapsed || isMobile) && (
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted px-5 mb-1 truncate">Admin</div>
      )}

      <nav aria-label="Admin sections" className="flex flex-col overflow-y-auto overflow-x-hidden">
        {adminNavItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} Icon={item.icon}
            active={pathname === item.href} collapsed={isCollapsed && !isMobile} />
        ))}
      </nav>

      <div className={`mt-auto border-t border-border px-5 py-4 flex items-center gap-2.5 overflow-hidden ${isCollapsed && !isMobile ? "justify-center px-2" : ""}`}>
        <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {user.firstName?.[0]}{user.lastName?.[0]}
        </div>
        {(!isCollapsed || isMobile) && (
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate max-w-[140px]">{user.firstName} {user.lastName}</div>
            <span className="inline-block px-1.5 py-0.5 radius-pill text-[10px] font-semibold bg-error text-error-text uppercase tracking-wider">
              {user.role === "ADMIN" ? "Admin" : "Mod"}
            </span>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen max-w-[1280px] mx-auto bg-bg-base">
      {/* Desktop sidebar — collapsible, sticky */}
      <aside
        className="hidden lg:flex shrink-0 bg-bg-card border-r border-border flex-col sticky top-0 h-screen transition-[width] duration-200 overflow-hidden"
        style={{ width: sidebarWidth }}
        aria-label="Admin sidebar"
      >
        {sidebarBody(false, collapsed)}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className="mx-3 mb-3 mt-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 radius-md border border-border bg-bg-base text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer text-xs font-medium"
        >
          {collapsed ? <ChevronsRight size={14} /> : <><ChevronsLeft size={14} /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-bg-card border-r border-border flex flex-col overflow-y-auto">
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close admin menu"
                className="w-8 h-8 grid place-items-center radius-md text-text-secondary hover:bg-bg-elevated hover:text-text-primary cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>
            {sidebarBody(true, false)}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar with hamburger */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-4 py-3 bg-bg-card border-b border-border">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
            className="w-9 h-9 grid place-items-center radius-md border border-border bg-bg-base text-text-primary cursor-pointer"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-semibold truncate">Admin</span>
          <span className="text-xs text-text-muted truncate ml-1">
            {adminNavItems.find((i) => i.href === pathname)?.label ?? ""}
          </span>
        </div>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 flex flex-col gap-4 sm:gap-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
