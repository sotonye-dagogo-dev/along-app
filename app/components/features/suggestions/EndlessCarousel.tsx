"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ENDLESS_CAROUSEL_CONFIG } from "@/app/lib/config"

interface EndlessCarouselProps {
  /** Cards to loop. Each item should be a fixed-width (responsive) element. */
  items: ReactNode[]
  /** Seconds for one full loop. Defaults from carousel config. */
  durationSec?: number
  /** Accessible name for the region. */
  label?: string
  className?: string
}

const CARD_GAP_CLASS = "mr-3"

/**
 * Endless tape carousel with its own overflow container.
 *
 * Structure: outer wrapper (`overflow-hidden`, owns the overflow so the
 * parent feed column never grows) > native `overflow-x-auto` viewport >
 * duplicated `w-max` track. Autoplay advances `viewport.scrollLeft` via
 * rAF and wraps by half the track width, so a user can freely scroll or
 * drag to any point forward/backward and the animation simply continues
 * from the landed position instead of snapping back. Pauses on
 * hover/focus/drag/hidden-tab and honours prefers-reduced-motion with a
 * plain horizontal scroller.
 */
export function EndlessCarousel({
  items,
  durationSec = ENDLESS_CAROUSEL_CONFIG.defaultDurationSec,
  label = ENDLESS_CAROUSEL_CONFIG.defaultLabel,
  className = "",
}: EndlessCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragState = useRef<{ active: boolean; startX: number; startScroll: number }>({
    active: false,
    startX: 0,
    startScroll: 0,
  })
  const [reducedMotion, setReducedMotion] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (reducedMotion || items.length === 0) return
    const viewport = viewportRef.current
    if (!viewport) return

    const pause = (resumeAfterMs?: number) => {
      pausedRef.current = true
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
      if (typeof resumeAfterMs === "number") {
        resumeTimer.current = setTimeout(() => {
          pausedRef.current = false
        }, resumeAfterMs)
      }
    }
    const resumeSoon = () => pause(ENDLESS_CAROUSEL_CONFIG.resumeDelayMs)

    const onPointerEnter = () => {
      if (ENDLESS_CAROUSEL_CONFIG.pauseOnHover && !dragState.current.active) pause()
    }
    const onPointerLeave = () => {
      if (!dragState.current.active) resumeSoon()
    }
    const onFocusIn = () => pause()
    const onFocusOut = () => resumeSoon()
    const onWheelTouch = () => resumeSoon()
    const onVisibility = () => {
      if (!ENDLESS_CAROUSEL_CONFIG.pauseWhenHidden) return
      if (document.hidden) pause()
      else resumeSoon()
    }

    viewport.addEventListener("pointerenter", onPointerEnter)
    viewport.addEventListener("pointerleave", onPointerLeave)
    viewport.addEventListener("focusin", onFocusIn)
    viewport.addEventListener("focusout", onFocusOut)
    viewport.addEventListener("wheel", onWheelTouch, { passive: true })
    viewport.addEventListener("touchmove", onWheelTouch, { passive: true })
    document.addEventListener("visibilitychange", onVisibility)

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!pausedRef.current && !dragState.current.active && !document.hidden) {
        const half = viewport.scrollWidth / 2
        if (half > 0) {
          const speed =
            half > 0 ? half / Math.max(1, durationSec) : ENDLESS_CAROUSEL_CONFIG.fallbackSpeedPxPerSec
          let next = viewport.scrollLeft + speed * dt
          // Wrap inside the first half; content is duplicated so the seam is invisible.
          if (next >= half) next -= half
          // Guard against external jumps past the seam (user fast-scroll).
          if (next >= half) next = next % half
          viewport.scrollLeft = next
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
      viewport.removeEventListener("pointerenter", onPointerEnter)
      viewport.removeEventListener("pointerleave", onPointerLeave)
      viewport.removeEventListener("focusin", onFocusIn)
      viewport.removeEventListener("focusout", onFocusOut)
      viewport.removeEventListener("wheel", onWheelTouch)
      viewport.removeEventListener("touchmove", onWheelTouch)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [reducedMotion, items.length, durationSec])

  // Mouse drag-to-scroll: moves the native scroll offset, autoplay resumes from there.
  useEffect(() => {
    if (reducedMotion) return
    const viewport = viewportRef.current
    if (!viewport) return

    const onMove = (e: PointerEvent) => {
      if (!dragState.current.active) return
      viewport.scrollLeft = dragState.current.startScroll - (e.clientX - dragState.current.startX)
    }
    const onUp = () => {
      if (!dragState.current.active) return
      dragState.current.active = false
      setDragging(false)
      pausedRef.current = false
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
      resumeTimer.current = setTimeout(() => {
        pausedRef.current = false
      }, ENDLESS_CAROUSEL_CONFIG.resumeDelayMs)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [reducedMotion])

  if (items.length === 0) return null

  if (reducedMotion) {
    return (
      <div className={`${ENDLESS_CAROUSEL_CONFIG.wrapperClass} ${className}`} role="region" aria-label={label}>
        <div className={`${ENDLESS_CAROUSEL_CONFIG.viewportClass}`}>
          <div className={`${ENDLESS_CAROUSEL_CONFIG.trackClass} gap-3 pb-1`}>{items}</div>
        </div>
      </div>
    )
  }

  const beginDrag = (e: React.PointerEvent) => {
    // Touch uses native scrolling; only hijack mouse drags.
    if (e.pointerType !== "mouse" || (e.button !== undefined && e.button !== 0)) return
    const viewport = viewportRef.current
    if (!viewport) return
    dragState.current = { active: true, startX: e.clientX, startScroll: viewport.scrollLeft }
    setDragging(true)
    pausedRef.current = true
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
  }

  return (
    <div className={`${ENDLESS_CAROUSEL_CONFIG.wrapperClass} ${className}`} role="region" aria-label={label}>
      <div
        ref={viewportRef}
        className={ENDLESS_CAROUSEL_CONFIG.viewportClass}
        style={{ touchAction: "pan-x pan-y", cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={beginDrag}
        tabIndex={0}
      >
        <div className={ENDLESS_CAROUSEL_CONFIG.trackClass}>
          {items.map((item, i) => (
            <div key={`a-${i}`} className={`shrink-0 ${CARD_GAP_CLASS}`}>
              {item}
            </div>
          ))}
          {items.map((item, i) => (
            <div key={`b-${i}`} className={`shrink-0 ${CARD_GAP_CLASS}`} aria-hidden="true">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
