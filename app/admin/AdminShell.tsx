"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/app/hooks/useAuth"
import { isAdminRole } from "@/app/lib/config/navigation"
import { AppPageLoader } from "@/app/components/ui"
import { useEffect } from "react"
import AppLogo from "@/app/components/ui/AppLogo"
import {
  LayoutDashboard, Users, FileText, Settings, Bug, Shield,
  Home, Compass, Bell, Bookmark, BarChart3, Mail
} from "lucide-react"

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/config", label: "Config", icon: Settings },
  { href: "/admin/bugs", label: "Bugs", icon: Bug },
  { href: "/admin/reviews", label: "Reviews", icon: Shield },
  { href: "/admin/email-preview", label: "Email Preview", icon: Mail },
]

const topNavItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    } else if (!isLoading && user && !isAdminRole(user.role)) {
      router.push("/home")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <AppPageLoader />
  }

  if (!user || !isAdminRole(user.role)) {
    return null
  }

  return (
    <div className="flex min-h-screen max-w-[1280px] mx-auto bg-bg-base">
      <aside className="w-[240px] shrink-0 bg-bg-card border-r border-border flex flex-col sticky top-0 h-screen">
        <Link href="/home" className="px-5 py-6 pb-4 no-underline">
          <AppLogo size="md" showText={true} variant="icon" />
        </Link>

        {topNavItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-4 py-2.5 mx-3 mb-0.5 radius-md text-sm font-medium text-text-secondary no-underline hover:bg-bg-elevated hover:text-text-primary transition-colors duration-fast"
            >
              <Icon size={20} />
              {item.label}
            </Link>
          )
        })}

        <div className="h-px bg-border mx-4 my-3" />
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted px-5 mb-1">Admin</div>

        {adminNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-4 py-2.5 mx-3 mb-0.5 radius-md text-sm font-medium no-underline transition-colors duration-fast ${
                isActive
                  ? "bg-primary-muted text-primary"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          )
        })}

        <div className="mt-auto border-t border-border px-5 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">{user.firstName} {user.lastName}</div>
            <span className="inline-block px-1.5 py-0.5 radius-pill text-[10px] font-semibold bg-error text-error-text uppercase tracking-wider">
              {user.role === "ADMIN" ? "Admin" : "Mod"}
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 max-w-[calc(1280px-240px)] flex flex-col gap-6">
        {children}
      </main>
    </div>
  )
}
