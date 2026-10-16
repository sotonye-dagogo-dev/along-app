'use client'

import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Navigation, Clock, DollarSign, Crosshair, Maximize2, Minimize2, X } from 'lucide-react'
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import polyline from '@mapbox/polyline'
import { getMapStyleStack, rasterFallbackDepth, MAP_STACK_CONFIG, MAP_EXPAND_CONFIG } from '@/app/lib/config/mapStack'
import { TRAFFIC_CONFIG, remapTrafficSegments } from '@/app/lib/config/traffic'
import type { TrafficResult } from '@/app/lib/services/trafficService'
import { useRouteTraffic } from '@/app/lib/hooks/useRouteTraffic'
import {
  MAP_TOOLTIPS_CONFIG,
  resolveTooltipMode,
  legBounds,
  legCounterLabel,
  legDistanceKm,
  legEstMins,
  legIndexForCoord,
  legLengthShare,
  legRangeLabel,
  nearestCoordIndex,
  pinBordersOnRoute,
  segmentForIndex,
  parseTrafficLayerId,
  worstLevelInRange,
  type MapTooltipModePreference,
} from '@/app/lib/config/mapTooltips'
import {
  MAP_SUMMARY_CONFIG,
  formatDurationRange,
  isValidDistanceKm,
  isValidDurationMins,
  shouldShowTrafficAdjusted,
  splitMinsByWeights,
} from '@/app/lib/config/mapSummary'
import { legTrafficFactor } from '@/app/lib/config/journeyTime'
import { MAP_PINS_CONFIG } from '@/app/lib/config/mapPins'
import { MapRoutePin, MapUserDot } from './MapPins'
import { TrafficLegend } from './TrafficLegend'

interface RoutePin {
  lat: number
  lng: number
  label?: string
  type: 'origin' | 'waypoint' | 'destination'
}

interface RouteMapProps {
  pins: RoutePin[]
  encodedPolyline?: string
  /** Fixed px height, or a CSS height (e.g. "100%") to fill a flex parent. */
  height?: number | string
  editable?: boolean
  showOverlay?: boolean
  distance?: number
  duration?: number
  fare?: string
  onPinsChange?: (pins: RoutePin[]) => void
  onAutoTrace?: () => void
  isSuggestion?: boolean
  className?: string
  userLocation?: { lat: number; lng: number; accuracy?: number; heading?: number | null } | null
  followUser?: boolean
  /**
   * Traffic overlay (non-breaking additive):
   * - `showTraffic` (default true): fetch per-chunk traffic and paint
   *   moderate (yellow) / heavy (red) segments over the base line.
   * - `trafficOverride`: pass a caller-owned result (e.g. shared with the
   *   navigation guide so both read one lookup); `null` disables rendering.
   * - `trafficAdjustedMins`: adjusted duration shown in the overlay chip.
   */
  showTraffic?: boolean
  trafficOverride?: TrafficResult | null
  trafficAdjustedMins?: number | null
  /**
   * Dominant vehicle for this route (non-breaking additive): scales the
   * traffic delay (trekking/boat/train stay near base) and is forwarded to
   * the traffic lookup so estimates stay mode-aware. Omit for legacy
   * full-traffic behaviour.
   */
  vehicle?: string | null
  /**
   * Expanded-map toggle (non-breaking additive). The live-navigation modal
   * already fills the screen, so callers there may pass `false` — defaults
   * to true everywhere else.
   */
  expandable?: boolean
  /**
   * Tracing tooltip depth (non-breaking additive, `auto` by default):
   * - `auto` → `detailed` when traffic renders, else `mini`
   * - `detailed` → tap the tracing for per-stretch traffic level +
   *   estimated time/distance (post detail + navigation guide)
   * - `mini` → tap shows a light prompt linking to the post detail /
   *   navigation guide (feed cards stay rate-limit friendly: no per-card
   *   traffic lookup, just the quick link)
   */
  tooltipMode?: MapTooltipModePreference
  /** Mini-tooltip quick links (only read in `mini` mode). */
  detailHref?: string | null
  navigateHref?: string | null
  postTitle?: string | null
}

function MapSkeleton() {
  return (
    <div className="w-full h-full bg-bg-elevated rounded-md animate-pulse flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-text-muted">
        <Navigation size={24} />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
}

function decodeEncodedPolyline(encoded: string): { lat: number; lng: number }[] {
  try {
    return polyline.decode(encoded).map(([lat, lng]) => ({ lat, lng }))
  } catch {
    return []
  }
}

function RouteMap({
  pins,
  encodedPolyline,
  height = 280,
  editable = false,
  showOverlay = false,
  distance,
  duration,
  fare,
  onPinsChange,
  onAutoTrace,
  isSuggestion = false,
  className = '',
  userLocation = null,
  followUser = false,
  showTraffic = true,
  trafficOverride,
  trafficAdjustedMins = null,
  vehicle = null,
  expandable = true,
  tooltipMode = "auto",
  detailHref = null,
  navigateHref = null,
  postTitle = null,
}: RouteMapProps) {
  const [isDark, setIsDark] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const mapRef = useRef<MapRef>(null)
  // Stable mapLib promise: `import()` inline creates a fresh promise every
  // render, which react-map-gl can treat as a new library and re-init the
  // map mid-interaction (camera jumps, markers lose place). One promise for
  // the component lifetime keeps the canvas and its markers glued together.
  const mapLibRef = useRef<Promise<unknown> | null>(null)
  if (mapLibRef.current === null && typeof window !== "undefined") {
    mapLibRef.current = import("maplibre-gl")
  }

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'))
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  // Keyless map stack (Sprint 19): OpenFreeMap vector primary, keyless
  // raster fallbacks on error step-down. No API keys consulted — keyed
  // providers (Mapbox/Carto-keyed/MapTiler) are server-side overrides only.
  const [styleIdx, setStyleIdx] = useState(0)
  useEffect(() => {
    // Reset to the keyless vector style when the theme flips.
    setStyleIdx(0)
  }, [isDark])
  const mapStyle = getMapStyleStack(isDark)[Math.min(styleIdx, rasterFallbackDepth())] as unknown as never
  const handleStyleError = useCallback(() => {
    setStyleIdx((i) => {
      // Walk the keyless fallback stack; only give up (skeleton) when the
      // last raster fallback also fails (e.g. WebGL unavailable/offline).
      if (i < rasterFallbackDepth()) return i + 1
      setMapError(true)
      return i
    })
  }, [])

  // Filter out invalid pins (0,0 placeholders that were previously rendered incorrectly).
  // Content-keyed memo: `pins` is a fresh array most renders, and a new
  // identity here would cascade (snapped pins → bounds → fit effect) and
  // re-fit the camera every render, fighting the user's pan/zoom.
  const pinsKey = pins.map((p) => `${p.lat},${p.lng},${p.label ?? ""},${p.type}`).join(">")
  const effectivePins = useMemo(() => {
    const valid = pins.filter(
      (p) => typeof p.lat === "number" && typeof p.lng === "number" && !(p.lat === 0 && p.lng === 0) && !isNaN(p.lat) && !isNaN(p.lng)
    )
    // Fallback: if all pins filtered but original has data, keep original (avoid empty map)
    const filtered = valid.length > 0 ? valid : pins.filter((p) => p.lat !== 0 || p.lng !== 0)
    return filtered.length > 0 ? filtered : pins
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey])

  const routeCoords = useMemo(() => {
    if (encodedPolyline) return decodeEncodedPolyline(encodedPolyline)
    return effectivePins.length >= 2
      ? effectivePins.map((p) => ({ lat: p.lat, lng: p.lng }))
      : []
  }, [encodedPolyline, effectivePins])

  // Traffic overlay: self-fetches per-chunk levels unless the caller
  // supplies `trafficOverride` (shared with the navigation guide). Silent
  // null fallback keeps the base line when offline/rate-limited/failed.
  // The last good result is KEPT across geometry swaps (straight pins line
  // → road-snapped trace) and remapped proportionally below, so the
  // traffic colors persist instead of vanishing on every re-trace.
  const { traffic: fetchedTraffic } = useRouteTraffic(
    showTraffic && trafficOverride === undefined ? routeCoords : null,
    duration ?? undefined,
    vehicle ?? undefined
  )
  const traffic = trafficOverride !== undefined ? trafficOverride : fetchedTraffic
  const trafficSegments = useMemo(() => {
    if (!traffic || !Array.isArray(traffic.segments)) return []
    const moderate = traffic.segments.filter(
      (s) => (s.level === "moderate" || s.level === "heavy") && routeCoords.length >= 2
    )
    // Geometry-generation guard: chunk indices belong to the geometry the
    // lookup ran on. When the tracer swaps geometries (2-pin line →
    // 200-point road trace) the old indices would collapse onto a tiny head
    // slice and the colors would "disappear" — fractional remapping keeps
    // each chunk's share of the route until the refetch lands.
    return remapTrafficSegments(moderate, routeCoords.length)
  }, [traffic, routeCoords.length])
  const overlayDuration = trafficAdjustedMins ?? traffic?.adjustedDurationMins ?? null

  // Tracing tooltips (config-driven, zero extra fetches): `allSegments`
  // covers every chunk incl. free-flow so a tap anywhere on the tracing
  // resolves to a stretch; `trafficSegments` stays the moderate/heavy-only
  // paint subset. Mini mode (feed cards) skips traffic entirely and shows
  // a quick-link prompt instead — rate-limit friendly by design.
  const effectiveTooltipMode = resolveTooltipMode(tooltipMode, showTraffic)
  const allSegments = useMemo(() => {
    if (!traffic || !Array.isArray(traffic.segments)) return []
    if (routeCoords.length < 2) return []
    return remapTrafficSegments(traffic.segments, routeCoords.length)
  }, [traffic, routeCoords.length])
  interface SelectedStretch {
    from: number
    to: number
    level: "low" | "moderate" | "heavy"
    /** Tap anchor — the tooltip renders where the user tapped, not at a
     * distant segment midpoint, so it is always in view on mobile. */
    lat: number
    lng: number
    estMins: number
    /** Free-flow minutes for this stretch (range lower bound). */
    baseMins: number
    distKm: number
    /** Route-leg context (0-based leg among pins-1 legs, -1 when unknown). */
    legIndex: number
    totalLegs: number
    legLabel: string
    legCounter: string
  }
  const [selectedStretch, setSelectedStretch] = useState<SelectedStretch | null>(null)
  const [miniAnchor, setMiniAnchor] = useState<{ lat: number; lng: number } | null>(null)
  // Stale-tip guard: geometry/traffic swaps invalidate the anchored stretch.
  const routeSig = routeCoords.length >= 2
    ? `${routeCoords.length}:${routeCoords[0].lat.toFixed(4)},${routeCoords[0].lng.toFixed(4)}>${routeCoords[routeCoords.length - 1].lat.toFixed(4)},${routeCoords[routeCoords.length - 1].lng.toFixed(4)}`
    : ""
  useEffect(() => {
    setSelectedStretch(null)
    setMiniAnchor(null)
  }, [routeSig, traffic, encodedPolyline])
  useEffect(() => {
    if (!selectedStretch) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedStretch(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedStretch])
  useEffect(() => {
    if (!miniAnchor) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMiniAnchor(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [miniAnchor])

  const baseMinsForStretch = duration ?? traffic?.baseDurationMins ?? 0
  // Leg borders: each pin's nearest snapped-trace index, monotonic, so a tap
  // resolves to the route leg (origin→stop→destination) it actually sits on
  // rather than an arbitrary traffic chunk. Recomputed only when the pin or
  // geometry identity changes.
  const pinsForLegsKey = effectivePins.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(">")
  const legBorders = useMemo(() => {
    try {
      return pinBordersOnRoute(routeCoords, effectivePins)
    } catch {
      return []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoords.length, routeSig, pinsForLegsKey])
  const totalLegs = legBorders.length >= 2 ? legBorders.length - 1 : 0
  // Consistent leg totals (config-driven): per-stretch minutes are split from
  // the SAME totals the header shows, so the stretches always sum to the
  // header instead of drifting via independent rounding. Shares come from
  // polyline length; the adjusted split is weighted by each leg's traffic
  // factor (vehicle-aware) and largest-remainder apportioned.
  const legShares = useMemo(() => {
    try {
      if (legBorders.length >= 2 && routeCoords.length >= 2) {
        const out: number[] = []
        for (let leg = 0; leg < legBorders.length - 1; leg++) {
          const b = legBorders[leg]
          const n = legBorders[leg + 1]
          if (b === undefined || n === undefined) {
            out.push(0)
            continue
          }
          try {
            out.push(legLengthShare(routeCoords, b, n))
          } catch {
            out.push(0)
          }
        }
        return out
      }
      return []
    } catch {
      return []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legBorders, routeCoords.length, routeSig])
  const legLevels = useMemo(() => {
    try {
      if (legBorders.length < 2) return [] as ("low" | "moderate" | "heavy")[]
      return legBorders.slice(0, -1).map((_, leg) => {
        const bounds = legBounds(legBorders, leg)
        if (!bounds) return "low" as const
        try {
          return worstLevelInRange(allSegments, bounds.from, bounds.to)
        } catch {
          return "low" as const
        }
      })
    } catch {
      return [] as ("low" | "moderate" | "heavy")[]
    }
  }, [legBorders, allSegments])
  const consistentLegTimes = useMemo(() => {
    try {
      const n = Math.max(legShares.length, 1)
      const shares = legShares.length === n ? legShares : Array(n).fill(1 / Math.max(n, 1))
      const baseTotal = Number.isFinite(baseMinsForStretch) && baseMinsForStretch > 0 ? Math.round(baseMinsForStretch) : 0
      const adjustedTotal = Number.isFinite(overlayDuration) && (overlayDuration as number) > 0 ? Math.round(overlayDuration as number) : baseTotal
      const baseLegs = splitMinsByWeights(baseTotal, shares)
      const factors = shares.map((_, i) => {
        try {
          return legTrafficFactor(legLevels[i] ?? "low", vehicle ?? null)
        } catch {
          return 1
        }
      })
      const weights = baseLegs.map((b, i) => {
        const f = Number.isFinite(factors[i]) && (factors[i] as number) > 0 ? (factors[i] as number) : 1
        return (b > 0 ? b : shares[i] ?? 0) * f
      })
      const adjustedLegs = splitMinsByWeights(adjustedTotal, weights)
      return { baseLegs, adjustedLegs, baseTotal, adjustedTotal }
    } catch {
      return { baseLegs: [] as number[], adjustedLegs: [] as number[], baseTotal: 0, adjustedTotal: 0 }
    }
  }, [legShares, legLevels, baseMinsForStretch, overlayDuration, vehicle])
  const interactiveLayerIds = useMemo(() => {
    if (routeCoords.length < 2) return undefined as unknown as string[]
    const ids = ["route-line", "route-hit-line"]
    for (const s of trafficSegments) ids.push(`traffic-line-${s.from}-${s.to}`)
    return ids
  }, [routeCoords.length, trafficSegments])

  const handleMapClick = useCallback((e: unknown) => {
    try {
      const ev = e as {
        lngLat?: { lng: number; lat: number }
        features?: { layer?: { id?: string } }[]
      }
      const lngLat = ev?.lngLat
      if (!lngLat || !Number.isFinite(lngLat.lat) || !Number.isFinite(lngLat.lng)) {
        setSelectedStretch(null)
        setMiniAnchor(null)
        return
      }
      if (routeCoords.length < 2) return
      if (effectiveTooltipMode === "mini") {
        setSelectedStretch(null)
        setMiniAnchor({ lat: lngLat.lat, lng: lngLat.lng })
        return
      }
      // Detailed, leg-aware: the tap resolves to the route leg
      // (origin→stop→destination) it sits on, so a 4-stretch post shows four
      // distinct tooltips. Traffic level for the leg is the worst overlapping
      // traffic chunk; time/distance are that leg's polyline-length share of
      // the route totals. The card anchors AT the tap so it is always where
      // the user tapped (no hunting across the map).
      const tapIdx = nearestCoordIndex(routeCoords, lngLat.lat, lngLat.lng)
      if (tapIdx < 0) {
        setSelectedStretch(null)
        return
      }
      let legFrom = 0
      let legTo = routeCoords.length - 1
      let legIndex = -1
      let legCount = totalLegs
      if (legBorders.length >= 2) {
        const found = legIndexForCoord(legBorders, tapIdx)
        if (found >= 0) {
          const bounds = legBounds(legBorders, found)
          if (bounds) {
            legFrom = bounds.from
            legTo = bounds.to
            legIndex = found
          }
        } else {
          const lo = Math.max(0, tapIdx - 2)
          const hi = Math.min(routeCoords.length - 1, tapIdx + 2)
          legFrom = lo
          legTo = hi
        }
      } else {
        // Single-leg fallback: honour a directly-clicked traffic layer when
        // leg borders cannot be built (e.g. a lone trace without pins).
        const feats = Array.isArray(ev?.features) ? ev.features : []
        let chunkHit: { from: number; to: number } | null = null
        for (const f of feats) {
          const parsed = parseTrafficLayerId(f?.layer?.id)
          if (parsed) {
            chunkHit = parsed
            break
          }
        }
        if (chunkHit) {
          legFrom = Math.max(0, chunkHit.from)
          legTo = Math.min(routeCoords.length - 1, chunkHit.to)
        } else {
          const seg = segmentForIndex(allSegments, tapIdx)
          if (seg) {
            legFrom = seg.from
            legTo = seg.to
          } else {
            legFrom = Math.max(0, tapIdx - 2)
            legTo = Math.min(routeCoords.length - 1, tapIdx + 2)
          }
        }
        legCount = 1
        legIndex = 0
      }
      const level = worstLevelInRange(allSegments, legFrom, legTo)
      const totalKmForLeg = typeof distance === "number" && Number.isFinite(distance) ? distance : 0
      // Consistent stretch time: the leg's share of the SAME adjusted total
      // the header shows (largest-remainder split), so all stretches sum to
      // the header instead of exceeding it via independent rounding.
      let consistentMins = 0
      try {
        if (legIndex >= 0 && consistentLegTimes.adjustedLegs[legIndex] !== undefined) {
          consistentMins = consistentLegTimes.adjustedLegs[legIndex] as number
        } else {
          const delayFactor = TRAFFIC_CONFIG.levels[level]?.delayFactor ?? 1
          consistentMins = legEstMins(baseMinsForStretch, routeCoords, legFrom, legTo, delayFactor)
        }
      } catch {
        const delayFactor = TRAFFIC_CONFIG.levels[level]?.delayFactor ?? 1
        consistentMins = legEstMins(baseMinsForStretch, routeCoords, legFrom, legTo, delayFactor)
      }
      let consistentBase = 0
      try {
        if (legIndex >= 0 && consistentLegTimes.baseLegs[legIndex] !== undefined) {
          consistentBase = consistentLegTimes.baseLegs[legIndex] as number
        }
      } catch {
        consistentBase = 0
      }
      setMiniAnchor(null)
      setSelectedStretch({
        from: legFrom,
        to: legTo,
        level,
        lat: lngLat.lat,
        lng: lngLat.lng,
        estMins: consistentMins,
        baseMins: consistentBase,
        distKm: legDistanceKm(totalKmForLeg, routeCoords, legFrom, legTo),
        legIndex,
        totalLegs: Math.max(1, legCount),
        legLabel: legRangeLabel(legIndex, effectivePins),
        legCounter: legCounterLabel(legIndex, Math.max(1, legCount)),
      })
    } catch {
      // Soft-fail: a tooltip must never break the map.
      setSelectedStretch(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoords, allSegments, effectiveTooltipMode, baseMinsForStretch, distance, legBorders, totalLegs])

  // Pin-to-polyline snapping (same library, same data): the road-snapped
  // trace is authoritative for where the line runs, so origin/destination
  // dots render at the trace endpoints — the snapped versions of their own
  // coords, metres apart — and the line visibly meets the dots through
  // pan/zoom. Intermediate stops stay at exact geocoded coords. Raw coords
  // are the fallback when no trace is on screen.
  const displayPins = useMemo(() => {
    if (!MAP_PINS_CONFIG.snapEndpointsToPolyline) return effectivePins
    if (routeCoords.length < 2 || effectivePins.length === 0) return effectivePins
    if (effectivePins.length === 1) return effectivePins
    const first = routeCoords[0]
    const last = routeCoords[routeCoords.length - 1]
    return effectivePins.map((p, i) => {
      if (i === 0) return { ...p, lat: first.lat, lng: first.lng }
      if (i === effectivePins.length - 1) return { ...p, lat: last.lat, lng: last.lng }
      return p
    })
  }, [effectivePins, routeCoords])

  // Bounds should include BOTH polyline and pins for accurate fit (polyline can extend beyond pins).
  // Memoized: a fresh bounds object every render would re-fire the fit
  // effect and yank the camera on each render, fighting the user's pan/zoom.
  const boundsSource = routeCoords.length >= 2 ? routeCoords : displayPins
  const boundsKey = boundsSource.length >= 2
    ? boundsSource.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(">")
    : ""
  const bounds = useMemo(() => {
    if (boundsSource.length < 2) return null
    return boundsSource.reduce(
      (acc, p) => ({
        minLat: Math.min(acc.minLat, p.lat),
        maxLat: Math.max(acc.maxLat, p.lat),
        minLng: Math.min(acc.minLng, p.lng),
        maxLng: Math.max(acc.maxLng, p.lng),
      }),
      { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey])

  const centerLat = bounds ? (bounds.minLat + bounds.maxLat) / 2 : displayPins[0]?.lat ?? 6.5244
  const centerLng = bounds ? (bounds.minLng + bounds.maxLng) / 2 : displayPins[0]?.lng ?? 3.3792

  const fitMapToBounds = useCallback(() => {
    if (!mapRef.current || !bounds) return
    // Add extra padding when polyline exists to show full route
    const padding = routeCoords.length > 10 ? 50 : 40
    mapRef.current.fitBounds(
      [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]] as [[number, number], [number, number]],
      { padding, duration: 400 }
    )
  }, [bounds, routeCoords.length])

  useEffect(() => {
    if (mapLoaded && bounds) {
      // Don't auto-fit when following user in live nav — keep user centered
      if (followUser && userLocation) return
      fitMapToBounds()
    } else if (mapLoaded && !bounds && displayPins.length === 1) {
      mapRef.current?.flyTo({ center: [displayPins[0].lng, displayPins[0].lat], zoom: 14, duration: 400 })
    }
  }, [mapLoaded, displayPins, encodedPolyline, bounds, fitMapToBounds, followUser, userLocation])

  // Follow user location when in live mode
  useEffect(() => {
    if (followUser && userLocation && mapLoaded && mapRef.current) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 600 })
    }
  }, [userLocation, followUser, mapLoaded])

  const renderMarker = useCallback(
    (pin: RoutePin, index: number) => {
      // Numbered dot in stop order (1-based) — matches the step list so the
      // user can visually map dot N to route step N on the polyline.
      return <MapRoutePin index={index} total={displayPins.length} label={pin.label} />
    },
    [displayPins.length]
  )

  const movePin = (index: number, lat: number, lng: number) => {
    if (!editable || !onPinsChange) return
    const next = [...pins]
    next[index] = { ...next[index], lat, lng }
    onPinsChange(next)
  }

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true)
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [expanded])

  const toggleExpanded = () => setExpanded((e) => !e)
  const closeExpanded = useCallback(() => setExpanded(false), [])
  const minimizeRef = useRef<HTMLButtonElement>(null)

  // Escape closes the contained dialog (config-gated, non-breaking).
  useEffect(() => {
    if (!expanded || !MAP_EXPAND_CONFIG.closeOnEscape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [expanded])

  // Resizing after the panel mounts keeps the trace fitted instead of
  // half-rendered; focusing Minimize keeps keyboard users oriented.
  useEffect(() => {
    if (!expanded || !mapLoaded) return
    const raf = requestAnimationFrame(() => {
      try {
        (mapRef.current as unknown as { resize?: () => void } | null)?.resize?.()
      } catch {
        // Soft-fail: the map still paints, just without a refit.
      }
      fitMapToBounds()
    })
    minimizeRef.current?.focus()
    return () => cancelAnimationFrame(raf)
  }, [expanded, mapLoaded, fitMapToBounds])

  if (mapError) {
    return (
      <div className={`relative overflow-hidden rounded-md ${className}`} style={{ height }}>
        <MapSkeleton />
      </div>
    )
  }

  // Shared map chrome: identical canvas/markers/controls inline and in the
  // contained expanded dialog, so behaviour never diverges between modes.
  const mapChrome = (
    <>
      <style>{isDark && MAP_STACK_CONFIG.darkCanvasFilter !== "none" ? `.dark-map .maplibregl-canvas { filter: ${MAP_STACK_CONFIG.darkCanvasFilter}; }` : ""}</style>
      <Map
        ref={mapRef}
        mapLib={(mapLibRef.current ?? import('maplibre-gl')) as never}
        initialViewState={{ latitude: centerLat, longitude: centerLng, zoom: 12 }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleMapLoad}
        onError={handleStyleError}
        onClick={handleMapClick}
        interactiveLayerIds={interactiveLayerIds}
        attributionControl={false}
        reuseMaps
      >
        {displayPins.map((pin, i) => {
          // displayPins[i] ↔ effectivePins[i] 1:1 (snapping only moves the
          // coords); map back to the original index for draggable edits.
          const origIdx = pins.indexOf(effectivePins[i] ?? pin)
          return (
            <Marker
              key={`pin-${i}`}
              latitude={pin.lat}
              longitude={pin.lng}
              draggable={editable}
              onDragEnd={(e) => movePin(origIdx >= 0 ? origIdx : i, e.lngLat.lat, e.lngLat.lng)}
              anchor={MAP_PINS_CONFIG.markerAnchor}
              offset={MAP_PINS_CONFIG.markerOffset as unknown as [number, number]}
            >
              {renderMarker(pin, i)}
            </Marker>
          )
        })}
        {userLocation && (
          <Marker
            key="user-location"
            latitude={userLocation.lat}
            longitude={userLocation.lng}
            anchor={MAP_PINS_CONFIG.markerAnchor}
            offset={MAP_PINS_CONFIG.markerOffset as unknown as [number, number]}
          >
            <MapUserDot accuracy={userLocation.accuracy} heading={userLocation.heading} />
          </Marker>
        )}
        {routeCoords.length >= 2 && (
          <>
            {/* Route casing (white outline) for better visibility */}
            <Source
              id="route-casing"
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords.map((c) => [c.lng, c.lat] as [number, number]),
                },
              }}
            >
              <Layer
                id="route-casing-line"
                type="line"
                paint={{
                  'line-color': '#ffffff',
                  'line-width': 6,
                  'line-opacity': 0.9,
                }}
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              />
            </Source>
            <Source
              id="route"
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords.map((c) => [c.lng, c.lat] as [number, number]),
                },
              }}
            >
              <Layer
                id="route-line"
                type="line"
                paint={{
                  'line-color': isSuggestion ? '#00A862' : '#00623B',
                  'line-width': 3.5,
                  'line-opacity': 0.95,
                  ...(isSuggestion ? { 'line-dasharray': [2, 4] } : {}),
                }}
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              />
            </Source>
            {/* Traffic overlay: moderate (yellow) / heavy (red) chunks over
                the base line. Low chunks keep the base color underneath. */}
            {trafficSegments.map((seg) => {
              const pts = routeCoords.slice(seg.from, seg.to + 1)
              if (pts.length < 2) return null
              return (
                <Source
                  key={`traffic-${seg.from}-${seg.to}`}
                  id={`traffic-${seg.from}-${seg.to}`}
                  type="geojson"
                  data={{
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'LineString',
                      coordinates: pts.map((c) => [c.lng, c.lat] as [number, number]),
                    },
                  }}
                >
                  <Layer
                    id={`traffic-line-${seg.from}-${seg.to}`}
                    type="line"
                    paint={{
                      'line-color': TRAFFIC_CONFIG.levels[seg.level].color,
                      'line-width': 4.5,
                      'line-opacity': 0.95,
                    }}
                    layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  />
                </Source>
              )
            })}
            {/* Invisible tap target over the tracing (config width): the
                visible line is too thin to tap on mobile. Clicks resolve to
                the nearest stretch (detailed) or the mini quick-link card. */}
            <Source
              id="route-hit"
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords.map((c) => [c.lng, c.lat] as [number, number]),
                },
              }}
            >
              <Layer
                id="route-hit-line"
                type="line"
                paint={{
                  'line-color': '#000000',
                  'line-width': MAP_TOOLTIPS_CONFIG.hitLineWidth,
                  'line-opacity': 0,
                }}
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              />
            </Source>
          </>
        )}
        {/* Detailed stretch tooltip (post detail + navigation guide). */}
        {selectedStretch && effectiveTooltipMode === "detailed" && (
          <Marker
            key={`stretch-tip-${selectedStretch.from}-${selectedStretch.to}-${selectedStretch.legIndex}`}
            latitude={selectedStretch.lat}
            longitude={selectedStretch.lng}
            anchor="bottom"
          >
            <div
              role="tooltip"
              className={MAP_TOOLTIPS_CONFIG.detailed.cardClass}
              style={{ maxWidth: MAP_TOOLTIPS_CONFIG.cardMaxWidth }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-text-primary">
                  {selectedStretch.legCounter || MAP_TOOLTIPS_CONFIG.detailed.title}
                </span>
                <button
                  type="button"
                  aria-label={MAP_TOOLTIPS_CONFIG.detailed.closeLabel}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedStretch(null)
                  }}
                  className="w-5 h-5 rounded-circle flex items-center justify-center border-none bg-transparent text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
              {selectedStretch.legLabel && (
                <div className="text-[11px] font-medium text-text-secondary truncate mb-1.5" title={selectedStretch.legLabel}>
                  {selectedStretch.legLabel}
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  aria-hidden
                  className="inline-block w-6 h-1.5 rounded-full shrink-0"
                  style={{ background: TRAFFIC_CONFIG.levels[selectedStretch.level].color }}
                />
                <span className="text-xs font-medium text-text-primary">
                  {TRAFFIC_CONFIG.levels[selectedStretch.level].label}
                </span>
              </div>
              <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                {selectedStretch.estMins > 0 && (
                  <li className="flex items-center gap-1 text-xs text-text-secondary">
                    <Clock size={12} aria-hidden className="shrink-0" />
                    {MAP_TOOLTIPS_CONFIG.detailed.stretchTimeLabel}{" "}
                    {selectedStretch.baseMins > 0 && selectedStretch.baseMins !== selectedStretch.estMins
                      ? formatDurationRange(selectedStretch.baseMins, selectedStretch.estMins)
                      : `${selectedStretch.estMins} min`}
                  </li>
                )}
                {selectedStretch.distKm > 0 && (
                  <li className="flex items-center gap-1 text-xs text-text-secondary">
                    <Navigation size={12} aria-hidden className="shrink-0" />
                    {MAP_TOOLTIPS_CONFIG.detailed.stretchDistanceLabel} {selectedStretch.distKm} km
                  </li>
                )}
                {selectedStretch.level === "low" && (
                  <li className="text-[11px] text-text-muted leading-relaxed">
                    {MAP_TOOLTIPS_CONFIG.detailed.freeFlowNote}
                  </li>
                )}
              </ul>
              <p className="text-[11px] text-text-muted leading-relaxed mt-1.5 mb-0">
                {traffic?.estimated === false
                  ? MAP_TOOLTIPS_CONFIG.detailed.liveNote
                  : MAP_TOOLTIPS_CONFIG.detailed.estimatedNote}
              </p>
            </div>
          </Marker>
        )}
        {/* Mini quick-link tooltip (feed cards: no traffic fetch by design). */}
        {miniAnchor && effectiveTooltipMode === "mini" && (
          <Marker
            key="mini-tip"
            latitude={miniAnchor.lat}
            longitude={miniAnchor.lng}
            anchor="bottom"
          >
            <div
              role="tooltip"
              className={MAP_TOOLTIPS_CONFIG.mini.cardClass}
              style={{ maxWidth: MAP_TOOLTIPS_CONFIG.cardMaxWidth }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-text-primary">
                  {MAP_TOOLTIPS_CONFIG.mini.title}
                </span>
                <button
                  type="button"
                  aria-label={MAP_TOOLTIPS_CONFIG.mini.closeLabel}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMiniAnchor(null)
                  }}
                  className="w-5 h-5 rounded-circle flex items-center justify-center border-none bg-transparent text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed mt-0 mb-2">
                {postTitle && (
                  <span className="block text-xs font-medium text-text-primary truncate mb-0.5">
                    {postTitle}
                  </span>
                )}
                {MAP_TOOLTIPS_CONFIG.mini.body}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {detailHref && (
                  <Link
                    href={detailHref}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-1 radius-md text-[11px] font-semibold bg-primary text-white no-underline hover:bg-primary-light transition-colors"
                  >
                    {MAP_TOOLTIPS_CONFIG.mini.viewPostLabel}
                  </Link>
                )}
                {navigateHref && (
                  <Link
                    href={navigateHref}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-1 radius-md text-[11px] font-semibold bg-primary-muted text-primary no-underline hover:bg-bg-elevated transition-colors"
                  >
                    <Navigation size={11} aria-hidden />
                    {MAP_TOOLTIPS_CONFIG.mini.navigateLabel}
                  </Link>
                )}
              </div>
            </div>
          </Marker>
        )}
      </Map>

      {traffic && traffic.segments.length > 0 && (
        <TrafficLegend
          estimated={traffic.estimated}
          className={editable && onAutoTrace ? "absolute top-12 right-2 z-[4]" : "absolute top-2 right-2 z-[4]"}
        />
      )}

      {!mapLoaded && (
        <div className="absolute inset-0 z-[2]">
          <MapSkeleton />
        </div>
      )}

      {(() => {
        // Summary bar guards (config-driven, nullsafe): each chip hides
        // independently when invalid; traffic renders as a RANGE
        // ("62–75 min": base free-flow – with-traffic) so the header total
        // always matches the per-stretch times, which split from these same
        // bounds. A still-loading lookup (adjusted 0) falls back to the base.
        const showDistance = isValidDistanceKm(distance)
        const showDuration = isValidDurationMins(duration)
        const showTraffic = shouldShowTrafficAdjusted(overlayDuration, duration)
        const showFare = typeof fare === "string" && fare.trim().length > 0
        if (!showOverlay || (!showDistance && !showDuration && !showFare)) return null
        const rangeLabel = showTraffic
          ? formatDurationRange(duration, overlayDuration)
          : `${duration}min`
        const rangeTitle = showTraffic
          ? `${MAP_SUMMARY_CONFIG.rangeTitle} (${duration} min ${TRAFFIC_CONFIG.legend.durationSuffix} ${overlayDuration} min${traffic?.estimated === false ? "" : " (estimated)"})`
          : undefined
        return (
          <div className="glass absolute bottom-0 left-0 right-0 z-[3] p-3 flex items-center gap-4 text-sm">
            {showDistance && (
              <span className="flex items-center gap-1 text-text-secondary">
                <Navigation size={14} />
                {distance}km
              </span>
            )}
            {showDuration && (
              <span className="flex items-center gap-1 text-text-secondary" title={rangeTitle}>
                <Clock size={14} />
                {rangeLabel}
              </span>
            )}
            {showFare && (
              <span className="flex items-center gap-1 text-text-secondary font-semibold ml-auto">
                <DollarSign size={14} />
                {fare}
              </span>
            )}
          </div>
        )
      })()}

      {expandable && (
        <button
          type="button"
          ref={expanded ? minimizeRef : undefined}
          className="absolute top-2 left-2 z-[3] flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-card/80 backdrop-blur-sm border border-border text-text-secondary text-xs font-medium shadow-sm hover:bg-bg-card transition-colors"
          onClick={toggleExpanded}
          aria-label={expanded ? MAP_EXPAND_CONFIG.minimizeLabel : 'Expand map'}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {expanded ? 'Minimize' : 'Expand'}
        </button>
      )}

      {editable && onAutoTrace && (
        <button
          type="button"
          className="absolute top-2 right-2 z-[3] flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium shadow-sm hover:bg-primary-light transition-colors"
          onClick={onAutoTrace}
        >
          <Crosshair size={12} />
          Auto-Trace
        </button>
      )}
    </>
  )

  // Expanded mode is a contained centered dialog (backdrop + max-width
  // panel), never a full-bleed 100vw layer — so it cannot spill past its
  // column into the desktop suggestions rail or scroll the page sideways.
  // Portalled to document.body: `fixed` inside a transformed/filtered
  // ancestor (cards, backdrop-blur panels) positions against that ancestor
  // instead of the viewport, which is how the dialog used to drift right
  // over the suggestions rail on desktop post views. The portal keeps it
  // viewport-centered everywhere; SSR/edge fallback renders inline.
  if (expanded) {
    const dialog = (
      <div
        className={MAP_EXPAND_CONFIG.overlayClass}
        role="dialog"
        aria-modal="true"
        aria-label={MAP_EXPAND_CONFIG.dialogLabel}
      >
        <div
          className={MAP_EXPAND_CONFIG.backdropClass}
          aria-hidden="true"
          onClick={MAP_EXPAND_CONFIG.closeOnBackdropClick ? closeExpanded : undefined}
        />
        <div
          ref={containerRef}
          className={`${MAP_EXPAND_CONFIG.panelMaxWidthClass} ${MAP_EXPAND_CONFIG.panelClass} ${isDark ? "dark-map" : ""}`}
          style={{ height: MAP_EXPAND_CONFIG.panelHeight, maxWidth: "min(56rem, calc(100vw - 2rem))" }}
        >
          {mapChrome}
        </div>
      </div>
    )
    if (typeof document !== "undefined" && document.body) {
      return createPortal(dialog, document.body)
    }
    return dialog
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-md max-w-full w-full min-w-0 ${className} ${isDark ? "dark-map" : ""}`}
      style={{ height }}
    >
      {mapChrome}
    </div>
  )
}

export { RouteMap, MapSkeleton }
export type { RouteMapProps, RoutePin }
