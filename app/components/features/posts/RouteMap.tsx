'use client'

import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { Navigation, Clock, DollarSign, Crosshair, Maximize2, Minimize2 } from 'lucide-react'
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import polyline from '@mapbox/polyline'
import { getMapStyleStack, rasterFallbackDepth, MAP_STACK_CONFIG } from '@/app/lib/config/mapStack'
import { MAP_PINS_CONFIG } from '@/app/lib/config/mapPins'
import { MapRoutePin, MapUserDot } from './MapPins'

interface RoutePin {
  lat: number
  lng: number
  label?: string
  type: 'origin' | 'waypoint' | 'destination'
}

interface RouteMapProps {
  pins: RoutePin[]
  encodedPolyline?: string
  height?: number
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

  if (mapError) {
    return (
      <div className={`relative overflow-hidden rounded-md ${className}`} style={{ height }}>
        <MapSkeleton />
      </div>
    )
  }

  const toggleExpanded = () => setExpanded((e) => !e)

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-md ${className} ${isDark ? "dark-map" : ""} ${
        expanded ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
      style={expanded ? { height: '100vh', width: '100vw' } : { height }}
    >
      <style>{isDark && MAP_STACK_CONFIG.darkCanvasFilter !== "none" ? `.dark-map .maplibregl-canvas { filter: ${MAP_STACK_CONFIG.darkCanvasFilter}; }` : ""}</style>
      <Map
        ref={mapRef}
        mapLib={(mapLibRef.current ?? import('maplibre-gl')) as never}
        initialViewState={{ latitude: centerLat, longitude: centerLng, zoom: 12 }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleMapLoad}
        onError={handleStyleError}
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
          </>
        )}
      </Map>

      {!mapLoaded && (
        <div className="absolute inset-0 z-[2]">
          <MapSkeleton />
        </div>
      )}

      {showOverlay && (distance || duration || fare) && (
        <div className="glass absolute bottom-0 left-0 right-0 z-[3] p-3 flex items-center gap-4 text-sm">
          {distance && (
            <span className="flex items-center gap-1 text-text-secondary">
              <Navigation size={14} />
              {distance}km
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1 text-text-secondary">
              <Clock size={14} />
              {duration}min
            </span>
          )}
          {fare && (
            <span className="flex items-center gap-1 text-text-secondary font-semibold ml-auto">
              <DollarSign size={14} />
              {fare}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        className="absolute top-2 left-2 z-[3] flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-card/80 backdrop-blur-sm border border-border text-text-secondary text-xs font-medium shadow-sm hover:bg-bg-card transition-colors"
        onClick={toggleExpanded}
        aria-label={expanded ? 'Minimize map' : 'Expand map'}
      >
        {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {expanded ? 'Minimize' : 'Expand'}
      </button>

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
    </div>
  )
}

export { RouteMap, MapSkeleton }
export type { RouteMapProps, RoutePin }
