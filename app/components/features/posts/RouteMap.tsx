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

  const mapStyle = {
    version: 8 as const,
    sources: {
      basemap: {
        type: 'raster' as const,
        tiles: [
          isDark
            ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            : 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ] as string[],
        tileSize: 256,
        attribution: '&copy; CARTO',
      },
    },
    layers: [
      { id: 'basemap-layer', type: 'raster' as const, source: 'basemap', minzoom: 0, maxzoom: 20 },
    ],
  }

  const routeCoords = encodedPolyline
    ? decodeEncodedPolyline(encodedPolyline)
    : pins.length >= 2
      ? pins.map((p) => ({ lat: p.lat, lng: p.lng }))
      : []

  const bounds = pins.length >= 2
    ? pins.reduce(
        (acc, p) => ({
          minLat: Math.min(acc.minLat, p.lat),
          maxLat: Math.max(acc.maxLat, p.lat),
          minLng: Math.min(acc.minLng, p.lng),
          maxLng: Math.max(acc.maxLng, p.lng),
        }),
        { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }
      )
    : null

  const centerLat = bounds ? (bounds.minLat + bounds.maxLat) / 2 : pins[0]?.lat ?? 6.5244
  const centerLng = bounds ? (bounds.minLng + bounds.maxLng) / 2 : pins[0]?.lng ?? 3.3792

  const fitMapToBounds = useCallback(() => {
    if (!mapRef.current || !bounds) return
    mapRef.current.fitBounds(
      [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]] as [[number, number], [number, number]],
      { padding: 40, duration: 400 }
    )
  }, [bounds])

  useEffect(() => {
    if (mapLoaded && bounds) {
      fitMapToBounds()
    } else if (mapLoaded && !bounds && pins.length === 1) {
      mapRef.current?.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: 14, duration: 400 })
    }
  }, [mapLoaded, pins, encodedPolyline, bounds, fitMapToBounds])

  const renderMarker = useCallback(
    (pin: RoutePin, index: number) => {
      const size = 24
      const isOrigin = pin.type === 'origin'
      const isDest = pin.type === 'destination'
      const bgColor = isOrigin ? '#00623B' : isDest ? '#004A2C' : '#FFFFFF'
      const textColor = (isOrigin || isDest) ? '#FFFFFF' : '#00623B'
      const borderColor = isOrigin || isDest ? 'transparent' : '#00623B'

      return (
        <div
          key={`pin-${index}`}
          className="relative flex items-center justify-center cursor-pointer"
          style={{ width: size, height: size }}
        >
          <div
            className="flex items-center justify-center rounded-circle font-bold text-xs shadow-sm"
            style={{
              width: size,
              height: size,
              backgroundColor: bgColor,
              color: textColor,
              border: `2.5px solid ${borderColor}`,
              boxShadow: '0 2px 4px rgba(0,98,59,0.25)',
            }}
          >
            {index + 1}
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
        {pins.map((pin, i) => (
          <Marker
            key={`pin-${i}`}
            latitude={pin.lat}
            longitude={pin.lng}
            draggable={editable}
            onDragEnd={(e) => movePin(i, e.lngLat.lat, e.lngLat.lng)}
          >
            {renderMarker(pin, i)}
          </Marker>
        ))}
        {routeCoords.length >= 2 && (
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
                'line-width': 3,
                'line-opacity': 0.8,
                ...(isSuggestion ? { 'line-dasharray': [2, 4] } : {}),
              }}
            />
          </Source>
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
