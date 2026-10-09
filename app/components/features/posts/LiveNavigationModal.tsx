"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"
import { Navigation, X } from "lucide-react"
import { LIVE_NAVIGATION_CONFIG } from "@/app/lib/config"
import NavigationGuide from "./NavigationGuide"
import type { RoutePin } from "@/app/components/features/posts/RouteMap"

const RouteMap = dynamic(
  () => import("@/app/components/features/posts/RouteMap").then((m) => ({ default: m.RouteMap })),
  { ssr: false }
)

interface RouteStepLike {
  location?: string
  description?: string
  vehicle?: string
  fare?: number
}

interface LiveNavigationModalProps {
  open: boolean
  title: string
  steps: RouteStepLike[]
  pins: RoutePin[]
  encodedPolyline?: string
  totalDistanceKm?: number | null
  estimatedMins?: number | null
  userLocation: { lat: number; lng: number; accuracy: number; heading: number | null } | null
  onUserLocationChange: (loc: { lat: number; lng: number; accuracy: number; heading: number | null } | null) => void
  onClose: () => void
}

/**
 * Floating live-navigation overlay: a near-fullscreen modal over a dimmed
 * page where the map (with the moving user dot) and the step-by-step
 * guide stay in view together. Mobile stacks map-over-guide; desktop
 * places the guide beside the map (width from LIVE_NAVIGATION_CONFIG).
 * Escape + backdrop click close it; unmounting stops geolocation tracking
 * via NavigationGuide cleanup.
 */
export default function LiveNavigationModal({
  open,
  title,
  steps,
  pins,
  encodedPolyline,
  totalDistanceKm,
  estimatedMins,
  userLocation,
  onUserLocationChange,
  onClose,
}: LiveNavigationModalProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={LIVE_NAVIGATION_CONFIG.dialogLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`@media (min-width: 768px) { .live-nav-panel { width: ${LIVE_NAVIGATION_CONFIG.sidePanelWidthPx}px; } }`}</style>
      <div className="w-full max-w-4xl h-[92dvh] flex flex-col bg-bg-card radius-xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
          <span className="w-8 h-8 rounded-circle bg-primary flex items-center justify-center text-white shrink-0">
            <Navigation size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-primary">{LIVE_NAVIGATION_CONFIG.title}</div>
            <div className="text-xs text-text-muted truncate">
              {title} · {LIVE_NAVIGATION_CONFIG.subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={LIVE_NAVIGATION_CONFIG.closeLabel}
            className="w-9 h-9 rounded-circle flex items-center justify-center border-none bg-bg-elevated text-text-secondary cursor-pointer hover:bg-border hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <div className="flex-1 min-h-[38%] md:min-h-0 relative">
            <div className="absolute inset-0">
              <RouteMap
                pins={pins}
                encodedPolyline={encodedPolyline}
                height="100%"
                className="!rounded-none"
                showOverlay={true}
                distance={totalDistanceKm ?? undefined}
                duration={estimatedMins ?? undefined}
                userLocation={userLocation}
                followUser={!!userLocation}
              />
            </div>
          </div>
          <div className="live-nav-panel shrink-0 border-t md:border-t-0 md:border-l border-border overflow-y-auto max-h-[46%] md:max-h-none">
            <NavigationGuide
              steps={steps}
              totalDistanceKm={totalDistanceKm}
              estimatedMins={estimatedMins}
              pins={pins.map((p) => ({ lat: p.lat, lng: p.lng }))}
              onUserLocationChange={onUserLocationChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
