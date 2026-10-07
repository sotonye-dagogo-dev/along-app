"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

interface EndlessCarouselProps {
  /** Cards to loop. Each item should be a fixed-width (responsive) element. */
  items: ReactNode[]
  /** Seconds for one full loop. */
  durationSec?: number
  /** Accessible name for the region. */
  label?: string
  className?: string
}

/**
 * Endless tape carousel: the track is duplicated once and animated 0 → -50%,
 * so the loop is seamless. Pauses on hover/pointer and during drag; respects
 * prefers-reduced-motion by falling back to a plain horizontal scroller.
 */
export function EndlessCarousel({ items, durationSec = 45, label = "Suggestions", className = "" }: EndlessCarouselProps) {
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const startX = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  // Global listeners while dragging so release outside the container still ends it.
  useEffect(() => {
    if (!isDragging) return
    const move = (e: PointerEvent) => setDragX(e.clientX - startX.current)
    const end = () => {
      setIsDragging(false)
      setDragX(0)
      setPaused(false)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", end)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", end)
    }
  }, [isDragging])

  if (items.length === 0) return null

  if (reducedMotion) {
    return (
      <div className={`overflow-x-auto ${className}`} role="region" aria-label={label}>
        <div className="flex gap-3 pb-1">{items}</div>
      </div>
    )
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    startX.current = e.clientX
    setDragX(0)
    setIsDragging(true)
    setPaused(true)
  }

  return (
    <div
      role="region"
      aria-label={label}
      className={`relative overflow-hidden ${className}`}
      style={{ touchAction: "pan-y" }}
      onPointerEnter={() => !isDragging && setPaused(true)}
      onPointerLeave={() => !isDragging && setPaused(false)}
      onPointerDown={handlePointerDown}
    >
      <style jsx>{`
        @keyframes endless-tape {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      {/* Drag layer sits above the animated track so both transforms compose. */}
      <div
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="flex w-max"
          style={{
            animation: `endless-tape ${durationSec}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {[...items, ...items].map((item, i) => (
            <div key={i} className="shrink-0 mr-3">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
