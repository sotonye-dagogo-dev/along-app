"use client"

import { useRequireAuth } from "@/app/hooks/useRequireAuth"
import { AppPageLoader, AppFooter } from "@/app/components/ui"
import GuestBanner from "@/app/components/ui/GuestBanner"
import DashboardNav from "@/app/components/ui/DashboardNav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isGuest } = useRequireAuth("")

  if (isLoading) {
    return <AppPageLoader />
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base lg:pb-0 pb-16">
      {isGuest && <GuestBanner />}
      <div className="flex-1 flex">
        <DashboardNav />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
      <AppFooter />
    </div>
  )
}
