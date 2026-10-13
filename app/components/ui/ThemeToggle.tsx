"use client"

import { Sun, Moon } from "lucide-react"
import type { CSSProperties } from "react"
import { useTheme } from "@/app/providers/ThemeProvider"
import { FLOATING_UI_CONFIG, laneBottom } from "@/app/lib/config/floatingUi"

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"
  // Same dock as Back to top (FLOATING_UI_CONFIG.mobileDockSide = right,
  // stacked above it, clear of the tab bar).
  const { mobileDockSide, roundButtons } = FLOATING_UI_CONFIG
  const mobileSideClass = mobileDockSide === "left" ? "left-3 right-auto" : "right-3 left-auto"

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ "--float-lane": laneBottom(roundButtons.secondBottomPx) } as CSSProperties}
      className={`${mobileSideClass} fixed bottom-[var(--float-lane)] lg:left-auto lg:right-6 lg:bottom-6 z-50 w-12 h-12 rounded-full bg-bg-card border border-border shadow-lg flex items-center justify-center hover:shadow-xl transition-all duration-base focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer`}
    >
      {isDark ? (
        <Sun size={20} className="text-text-primary" />
      ) : (
        <Moon size={20} className="text-text-primary" />
      )}
    </button>
  )
}
