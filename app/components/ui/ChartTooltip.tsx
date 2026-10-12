'use client'

import React, { useCallback, useId, useRef, useState } from "react"
import {
  CHART_TOOLTIP_CONFIG,
  type ChartTooltipLine,
} from "@/app/lib/config/charts"

interface ChartHoverTooltipProps {
  title: string
  lines: ChartTooltipLine[]
  x: number
  y: number
  /** Clamp origin so the card never leaves the viewport. */
  flipped?: boolean
}

/**
 * Floating hover card shared by every SVG/HTML chart on the platform.
 * Presentational only — positioning is owned by the caller (mouse-follow
 * with viewport clamping); copy + colours come from `charts.ts` config.
 */
export function ChartHoverTooltip({ title, lines, x, y, flipped }: ChartHoverTooltipProps) {
  return (
    <div
      role="tooltip"
      className="fixed z-50 min-w-[140px] max-w-[240px] bg-bg-card border border-border radius-md shadow-lg px-3 py-2 pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: flipped ? "translate(-100%, calc(-100% - 12px))" : "translate(12px, -100%)",
      }}
    >
      <div className="text-[11px] font-semibold text-text-secondary mb-1 truncate">{title}</div>
      <div className="flex flex-col gap-0.5">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center gap-1.5 text-xs">
            {line.color && (
              <span
                className="w-2 h-2 rounded-circle shrink-0"
                style={{ background: line.color }}
                aria-hidden="true"
              />
            )}
            <span className="text-text-secondary truncate">{line.label}</span>
            <span className="ml-auto font-semibold text-text-primary tabular-nums pl-2">
              {line.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ChartTooltipWrapperProps {
  title: string
  lines: ChartTooltipLine[]
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Hover/focus wrapper for HTML chart rows (bar lists, KPI cards).
 * Shows `ChartHoverTooltip` at the cursor on hover and on keyboard focus
 * (centered fallback). Non-breaking: renders an inline-flex span with no
 * layout shift when idle.
 */
export function ChartTooltipWrapper({
  title,
  lines,
  children,
  disabled,
  className,
}: ChartTooltipWrapperProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0, flipped: false })
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((clientX: number, clientY: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    const flipped = clientX > window.innerWidth - 260
    setPos({ x: clientX, y: clientY, flipped })
    setVisible(true)
  }, [])

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(
      () => setVisible(false),
      CHART_TOOLTIP_CONFIG.hideDelayMs
    )
  }, [])

  if (disabled) return <>{children}</>

  return (
    <>
      <div
        className={className ?? "inline-flex min-w-0"}
        onMouseMove={(e) => show(e.clientX, e.clientY)}
        onMouseLeave={hide}
        onFocus={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          show(r.left + r.width / 2, r.top)
        }}
        onBlur={hide}
        tabIndex={0}
        aria-label={`${title}: ${lines.map((l) => `${l.label} ${l.value}`).join(", ")}`}
      >
        {children}
      </div>
      {visible && (
        <ChartHoverTooltip title={title} lines={lines} x={pos.x} y={pos.y} flipped={pos.flipped} />
      )}
    </>
  )
}

interface SvgChartContainerProps {
  title: string
  /** One entry per x-index; each holds the tooltip lines for that column. */
  columns: { title: string; lines: ChartTooltipLine[] }[]
  /** Number of x slots (points/bars) so hover index can be derived. */
  count: number
  /** Left plot padding in fractions of container width (0..1). */
  padLeftFrac?: number
  padRightFrac?: number
  children: React.ReactNode
  className?: string
}

/**
 * Mouse-follow tooltip host for SVG charts. Wraps the `<svg>` in a
 * relatively-positioned div; on hover it maps the pointer x-position to the
 * nearest data index and renders one shared `ChartHoverTooltip` (multi-series
 * friendly). Touch-safe: taps also resolve an index. Falls back gracefully
 * when `columns` is empty (no tooltip, children still render).
 */
export function SvgChartContainer({
  title,
  columns,
  count,
  padLeftFrac = 0.08,
  padRightFrac = 0.04,
  children,
  className,
}: SvgChartContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ index: number; x: number; y: number; flipped: boolean } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const labelledBy = useId()

  const resolveIndex = useCallback(
    (clientX: number): number | null => {
      const el = ref.current
      if (!el || count <= 0) return null
      const rect = el.getBoundingClientRect()
      const rel = (clientX - rect.left) / Math.max(rect.width, 1)
      const plotL = padLeftFrac
      const plotR = 1 - padRightFrac
      const t = (rel - plotL) / Math.max(plotR - plotL, 0.01)
      const clamped = Math.min(1, Math.max(0, t))
      if (count === 1) return 0
      return Math.round(clamped * (count - 1))
    },
    [count, padLeftFrac, padRightFrac]
  )

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (columns.length === 0 || count <= 0) return
      const index = resolveIndex(clientX)
      if (index === null || !columns[index]) {
        setHover(null)
        return
      }
      setHover({
        index,
        x: clientX,
        y: clientY,
        flipped: clientX > window.innerWidth - 260,
      })
    },
    [columns, count, resolveIndex]
  )

  const handleLeave = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setHover(null), CHART_TOOLTIP_CONFIG.hideDelayMs)
  }, [])

  const active = hover ? columns[hover.index] : null

  return (
    <div
      ref={ref}
      className={className ?? "relative"}
      role="img"
      aria-labelledby={labelledBy}
      aria-label={`${title}. ${CHART_TOOLTIP_CONFIG.a11yHint}`}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseLeave={handleLeave}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (t) handleMove(t.clientX, t.clientY)
      }}
      onTouchEnd={handleLeave}
    >
      <span id={labelledBy} className="sr-only">
        {title}
      </span>
      {children}
      {active && hover && (
        <ChartHoverTooltip
          title={active.title}
          lines={active.lines}
          x={hover.x}
          y={hover.y}
          flipped={hover.flipped}
        />
      )}
    </div>
  )
}
