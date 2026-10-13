"use client"

import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { ArrowUp } from "lucide-react"
import { FLOATING_UI_CONFIG, laneBottom } from "@/app/lib/config/floatingUi"

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!visible) return null

  // Mobile + desktop dock RIGHT (FLOATING_UI_CONFIG.mobileDockSide); other
  // floating surfaces keep their own lanes, so only these round buttons move.
  // The lane rides a CSS var so the lg: override still applies (inline bottom
  // would win over responsive classes at every breakpoint).
  const { mobileDockSide, roundButtons } = FLOATING_UI_CONFIG
  const mobileSideClass = mobileDockSide === "left" ? "left-3 right-auto" : "right-3 left-auto"
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      style={{ "--float-lane": laneBottom(roundButtons.firstBottomPx) } as CSSProperties}
      className={`${mobileSideClass} fixed bottom-[var(--float-lane)] lg:left-auto lg:right-6 lg:bottom-20 z-50 w-12 h-12 rounded-full bg-primary text-white border-none shadow-primary shadow-lg flex items-center justify-center hover:scale-105 transition-all duration-base cursor-pointer`}
    >
      <ArrowUp size={20} />
    </button>
  )
}
