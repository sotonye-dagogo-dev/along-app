'use client'

import React, { useCallback, useState, useEffect, useRef } from 'react'
import { Navigation, Clock, DollarSign, Crosshair, Maximize2, Minimize2 } from 'lucide-react'
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import polyline from '@mapbox/polyline'

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
  const pendingFitRef = useRef(false)

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

  // Build Carto tile URL with optional API key (Carto now requires ?apiKey=... for some accounts)
  const cartoKey =
    process.env.NEXT_PUBLIC_CARTO_API_KEY ??
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY ??
    process.env.NEXT_PUBLIC_CARTO_KEY ??
    ""
  const cartoParam = cartoKey ? `?apiKey=${encodeURIComponent(cartoKey)}` : ""
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ""
  const useMapboxStyle = !!mapboxToken

  const mapStyle = useMapboxStyle
    ? (`mapbox://styles/mapbox/${isDark ? "dark-v11" : "streets-v12"}` as unknown as never)
    : ({
        version: 8 as const,
        sources: {
          basemap: {
            type: 'raster' as const,
            tiles: [
              isDark
                ? `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${cartoParam}`
                : `https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png${cartoParam}`,
            ] as string[],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
          },
        },
        layers: [
          { id: 'basemap-layer', type: 'raster' as const, source: 'basemap', minzoom: 0, maxzoom: 20 },
        ],
      } as unknown as never)

  // Filter out invalid pins (0,0 placeholders that were previously rendered incorrectly)
  const validPins = pins.filter(
    (p) => typeof p.lat === "number" && typeof p.lng === "number" && !(p.lat === 0 && p.lng === 0) && !isNaN(p.lat) && !isNaN(p.lng)
  )
  // Fallback: if all pins filtered but original has data, keep original (avoid empty map)
  const displayPins = validPins.length > 0 ? validPins : pins.filter((p) => p.lat !== 0 || p.lng !== 0)
  const effectivePins = displayPins.length > 0 ? displayPins : pins

  const routeCoords = encodedPolyline
    ? decodeEncodedPolyline(encodedPolyline)
    : effectivePins.length >= 2
      ? effectivePins.map((p) => ({ lat: p.lat, lng: p.lng }))
      : []

  // Bounds should include BOTH polyline and pins for accurate fit (polyline can extend beyond pins)
  const boundsSource = routeCoords.length >= 2 ? routeCoords : effectivePins
  const bounds = boundsSource.length >= 2
    ? boundsSource.reduce(
        (acc, p) => ({
          minLat: Math.min(acc.minLat, p.lat),
          maxLat: Math.max(acc.maxLat, p.lat),
          minLng: Math.min(acc.minLng, p.lng),
          maxLng: Math.max(acc.maxLng, p.lng),
        }),
        { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }
      )
    : null

  const centerLat = bounds ? (bounds.minLat + bounds.maxLat) / 2 : effectivePins[0]?.lat ?? 6.5244
  const centerLng = bounds ? (bounds.minLng + bounds.maxLng) / 2 : effectivePins[0]?.lng ?? 3.3792

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
    } else if (mapLoaded && !bounds && effectivePins.length === 1) {
      mapRef.current?.flyTo({ center: [effectivePins[0].lng, effectivePins[0].lat], zoom: 14, duration: 400 })
    }
  }, [mapLoaded, effectivePins, encodedPolyline, bounds, fitMapToBounds, followUser, userLocation])

  // Follow user location when in live mode
  useEffect(() => {
    if (followUser && userLocation && mapLoaded && mapRef.current) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 600 })
    }
  }, [userLocation, followUser, mapLoaded])

  const renderMarker = useCallback(
    (pin: RoutePin, index: number) => {
      const isOrigin = pin.type === 'origin'
      const isDest = pin.type === 'destination'
      const total = effectivePins.length

      // Origin: A, Destination: B, Waypoints: numbered; single pin: 1
      let label: string
      let size = 26
      if (total === 1) {
        label = '1'
      } else if (isOrigin) {
        label = 'A'
        size = 28
      } else if (isDest) {
        label = 'B'
        size = 28
      } else {
        // For waypoints, offset by 1 (origin is A, so first waypoint is 2, etc.)
        // Find waypoint index among non-origin/dest
        const waypointIdx = effectivePins.slice(1, -1).indexOf(pin)
        label = waypointIdx >= 0 ? String(waypointIdx + 1) : String(index + 1)
        size = 22
      }

      const bgColor = isOrigin ? '#00623B' : isDest ? '#004A2C' : '#FFFFFF'
      const textColor = isOrigin || isDest ? '#FFFFFF' : '#00623B'
      const borderColor = isOrigin || isDest ? 'transparent' : '#00623B'

      return (
        <div
          key={`pin-${index}`}
          className="relative flex items-center justify-center cursor-pointer select-none"
          style={{ width: size, height: size }}
          title={pin.label ?? label}
        >
          <div
            className="flex items-center justify-center rounded-full font-bold text-xs shadow-md"
            style={{
              width: size,
              height: size,
              backgroundColor: bgColor,
              color: textColor,
              border: `2.5px solid ${borderColor}`,
              boxShadow: '0 2px 6px rgba(0,98,59,0.3)',
            }}
          >
            {label}
          </div>
        </div>
      )
    },
    []
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

  if (mapError) {
    return (
      <div className={`relative overflow-hidden rounded-md ${className}`} style={{ height }}>
        <MapSkeleton />
      </div>
    )
  }

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

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-md ${className} ${isDark ? "dark-map" : ""} ${
        expanded ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
      style={expanded ? { height: '100vh', width: '100vw' } : { height }}
    >
      <style>{isDark ? `.dark-map .maplibregl-canvas { filter: brightness(1.35) contrast(1.1); }` : ""}</style>
      <Map
        ref={mapRef}
        mapLib={import('maplibre-gl') as never}
        initialViewState={{ latitude: centerLat, longitude: centerLng, zoom: 12 }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleMapLoad}
        onError={() => setMapError(true)}
        attributionControl={false}
        reuseMaps
      >
        {effectivePins.map((pin, i) => {
          // Map back to original index for draggable edits
          const origIdx = pins.indexOf(pin)
          return (
            <Marker
              key={`pin-${i}-${pin.lat}-${pin.lng}`}
              latitude={pin.lat}
              longitude={pin.lng}
              draggable={editable}
              onDragEnd={(e) => movePin(origIdx >= 0 ? origIdx : i, e.lngLat.lat, e.lngLat.lng)}
              anchor="center"
            >
              {renderMarker(pin, i)}
            </Marker>
          )
        })}
        {userLocation && (
          <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
            <div className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
              {/* Accuracy circle */}
              {userLocation.accuracy && userLocation.accuracy < 1000 && (
                <div
                  className="absolute rounded-full bg-primary/15 border border-primary/30"
                  style={{
                    width: Math.min(64, Math.max(24, userLocation.accuracy / 3)),
                    height: Math.min(64, Math.max(24, userLocation.accuracy / 3)),
                  }}
                />
              )}
              {/* Heading arrow */}
              {userLocation.heading !== null && userLocation.heading !== undefined && (
                <div
                  className="absolute w-0 h-0"
                  style={{
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderBottom: "10px solid #00623B",
                    top: -2,
                    transform: `rotate(${userLocation.heading}deg)`,
                    transformOrigin: "50% 16px",
                  }}
                />
              )}
              <div className="relative w-[14px] h-[14px] rounded-full bg-primary border-2 border-white shadow-lg">
                <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40" />
              </div>
            </div>
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
