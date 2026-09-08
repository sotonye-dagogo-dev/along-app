"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { Navigation, ChevronLeft, ChevronRight, MapPin, BadgeDollarSign, X, LocateFixed, AlertTriangle, Compass } from "lucide-react"
import { VEHICLE_REGISTRY } from "@/app/lib/config"
import type { VehicleType } from "@/app/lib/types"

interface RouteStep {
  location?: string
  description?: string
  vehicle?: string
  fare?: number
}

interface RoutePinCoord {
  lat: number
  lng: number
}

interface NavigationGuideProps {
  steps: RouteStep[]
  totalDistanceKm?: number | null
  estimatedMins?: number | null
  onClose?: () => void
  pins?: RoutePinCoord[]
  onUserLocationChange?: (loc: { lat: number; lng: number; accuracy: number; heading: number | null } | null) => void
}

function formatDistance(km: number): string {
  if (km >= 1) return `${km.toFixed(1)} km`
  return `${Math.round(km * 1000)} m`
}

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${min} min`
}

function haversineKm(a: RoutePinCoord, b: RoutePinCoord): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export default function NavigationGuide({ steps, totalDistanceKm, estimatedMins, onClose, pins, onUserLocationChange }: NavigationGuideProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isNavigating, setIsNavigating] = useState(false)
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number; accuracy: number; heading: number | null } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const watchIdRef = useRef<number | null>(null)
  const hasCenteredRef = useRef(false)

  const validSteps = useMemo(() => steps.filter((s) => s.location), [steps])
  const validPins = useMemo(() => (pins ?? []).filter((p) => p.lat !== 0 || p.lng !== 0), [pins])

  const currentStep = validSteps[currentStepIndex]
  const isFirst = currentStepIndex === 0
  const isLast = currentStepIndex === validSteps.length - 1
  const progress = validSteps.length > 1 ? (currentStepIndex / (validSteps.length - 1)) * 100 : 100

  const currentPin = validPins[currentStepIndex] ?? null
  const distanceToNext = useMemo(() => {
    if (!userLoc || !currentPin) return null
    return haversineKm(userLoc, currentPin)
  }, [userLoc, currentPin])

  const handlePrev = () => {
    if (!isFirst) setCurrentStepIndex((i) => i - 1)
  }

  const handleNext = () => {
    if (!isLast) setCurrentStepIndex((i) => i + 1)
  }

  const handleStart = useCallback(() => {
    setIsNavigating(true)
    setGeoError(null)
    hasCenteredRef.current = false
  }, [])
  const handleStop = useCallback(() => {
    setIsNavigating(false)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setUserLoc(null)
    onUserLocationChange?.(null)
  }, [onUserLocationChange])

  // Live geolocation tracking when navigating
  useEffect(() => {
    if (!isNavigating) return
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation is not supported on this device.")
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        }
        setUserLoc(loc)
        onUserLocationChange?.(loc)
        setGeoError(null)
        // Auto-advance if within 80m of current pin and not last
        if (autoAdvance && validPins.length > 0) {
          const target = validPins[currentStepIndex]
          if (target) {
            const d = haversineKm(loc, target)
            if (d < 0.08 && currentStepIndex < validSteps.length - 1) {
              setCurrentStepIndex((i) => Math.min(i + 1, validSteps.length - 1))
            }
          }
        }
      },
      (err) => {
        if (err.code === 1) setGeoError("Location permission denied. Enable it to use live tracking.")
        else if (err.code === 2) setGeoError("Unable to determine your location.")
        else setGeoError(err.message ?? "Location error")
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    )
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [isNavigating, autoAdvance, currentStepIndex, validPins, validSteps.length, onUserLocationChange])

  // Stop tracking on unmount / close
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  const stepDistance = totalDistanceKm
    ? totalDistanceKm / Math.max(validSteps.length - 1, 1)
    : null

  const stepDuration = estimatedMins
    ? Math.round(estimatedMins / Math.max(validSteps.length - 1, 1))
    : null

  return (
    <div className="flex flex-col bg-bg-card border border-border radius-xl overflow-hidden shadow-lg">
      {isNavigating ? (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
            <div className="flex items-center gap-2">
              <Navigation size={18} className="animate-pulse" />
              <span className="text-sm font-semibold">Live Navigation</span>
              {userLoc && (
                <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 radius-pill bg-white/20 text-[11px] font-medium">
                  <LocateFixed size={10} />
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none">
                <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} className="w-3 h-3 accent-white" />
                Auto
              </label>
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-3 py-1 radius-pill bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition-colors border-none cursor-pointer"
              >
                <X size={14} />
                Stop
              </button>
            </div>
          </div>

          {geoError && (
            <div className="mx-3 mt-3 flex items-start gap-2 px-3 py-2 radius-md bg-error-muted border border-error-border text-error-text text-xs leading-relaxed">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{geoError}</span>
            </div>
          )}

          {userLoc && distanceToNext !== null && (
            <div className="mx-3 mt-3 flex items-center justify-between px-3 py-2 radius-md bg-bg-elevated border border-border">
              <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <Compass size={14} className={userLoc.heading !== null ? "text-primary" : "text-text-muted"} style={userLoc.heading !== null ? { transform: `rotate(${userLoc.heading}deg)` } : undefined} />
                {distanceToNext < 1 ? `${Math.round(distanceToNext * 1000)} m to next` : `${distanceToNext.toFixed(1)} km to next`}
              </span>
              <span className="text-[11px] text-text-muted">±{Math.round(userLoc.accuracy)}m</span>
            </div>
          )}

          <div className="px-4 py-3 bg-bg-elevated">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">
                Step {currentStepIndex + 1} of {validSteps.length}
              </span>
              <span className="text-xs font-medium text-text-primary">
                {progress.toFixed(0)}% complete
              </span>
            </div>
            <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-circle bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                {currentStepIndex + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary">
                  {isFirst ? "Origin" : isLast ? "Destination" : "Stop"}
                </div>
                <div className="text-sm text-text-primary mt-0.5 truncate">{currentStep?.location}</div>
                {currentStep?.description && (
                  <div className="text-xs text-text-secondary mt-1">{currentStep.description}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {currentStep?.vehicle && VEHICLE_REGISTRY[currentStep.vehicle as VehicleType] && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 radius-pill text-xs font-medium bg-primary-muted text-primary">
                  {(() => {
                    const VIcon = VEHICLE_REGISTRY[currentStep.vehicle as VehicleType].icon
                    return <VIcon size={14} />
                  })()}
                  {VEHICLE_REGISTRY[currentStep.vehicle as VehicleType].label}
                </span>
              )}
              {currentStep?.fare !== undefined && currentStep.fare !== null && currentStep.fare > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 radius-pill text-xs font-medium bg-bg-elevated text-text-secondary">
                  <BadgeDollarSign size={14} />
                  ₦{currentStep.fare}
                </span>
              )}
              {stepDistance && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 radius-pill text-xs font-medium bg-bg-elevated text-text-secondary">
                  <MapPin size={14} />
                  {formatDistance(stepDistance)}
                </span>
              )}
            </div>
          </div>

          {currentStep?.description && (
            <div className="px-4 pb-2">
              <div className="bg-bg-elevated rounded-lg p-3 text-xs text-text-secondary leading-relaxed">
                <span className="font-semibold text-text-primary">Instruction: </span>
                {currentStep.description}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-border mt-auto">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className="flex items-center gap-1 px-3 py-2 radius-md text-sm font-medium border border-border bg-bg-card text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
              Prev
            </button>

            {!isLast && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>{stepDuration ? `${stepDuration} min` : "—"}</span>
                <span className="w-1 h-1 rounded-circle bg-text-muted" />
                <span>{stepDistance ? formatDistance(stepDistance) : "—"}</span>
              </div>
            )}

            <button
              onClick={handleNext}
              disabled={isLast}
              className="flex items-center gap-1 px-3 py-2 radius-md text-sm font-medium bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-light transition-colors cursor-pointer"
            >
              {isLast ? "Arrived" : "Next"}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Navigation size={18} className="text-primary" />
              <span className="text-sm font-semibold text-text-primary">Route Guide</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              {totalDistanceKm && <span>{formatDistance(totalDistanceKm)}</span>}
              {estimatedMins && <span>{formatDuration(estimatedMins)}</span>}
              <span>{validSteps.length} stops</span>
            </div>
          </div>

          <div className="flex flex-col gap-0 p-4 max-h-[300px] overflow-y-auto">
            {validSteps.map((step, i) => {
              const isCurrent = i === currentStepIndex
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 py-2.5 px-3 rounded-lg cursor-pointer transition-colors ${
                    isCurrent ? "bg-primary-muted" : "hover:bg-bg-elevated"
                  }`}
                  onClick={() => setCurrentStepIndex(i)}
                >
                  <div
                    className={`w-7 h-7 rounded-circle flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCurrent
                        ? "bg-primary text-white"
                        : i < currentStepIndex
                          ? "bg-success text-white"
                          : "bg-bg-elevated text-text-secondary border border-border"
                    }`}
                  >
                    {i < currentStepIndex ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {step.location || `Stop ${i + 1}`}
                    </div>
                    {step.description && (
                      <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{step.description}</div>
                    )}
                    {(step.vehicle || step.fare) && (
                      <div className="flex items-center gap-2 mt-1">
                        {step.vehicle && VEHICLE_REGISTRY[step.vehicle as VehicleType] && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 radius-pill text-[10px] font-medium bg-bg-elevated text-text-secondary">
                            {(() => {
                              const VIcon = VEHICLE_REGISTRY[step.vehicle as VehicleType].icon
                              return <VIcon size={10} />
                            })()}
                            {VEHICLE_REGISTRY[step.vehicle as VehicleType].label}
                          </span>
                        )}
                        {step.fare !== undefined && step.fare !== null && step.fare > 0 && (
                          <span className="text-[10px] text-text-muted">₦{step.fare}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-2 h-10 radius-md bg-primary text-white text-sm font-semibold border-none cursor-pointer hover:bg-primary-light transition-colors"
            >
              <Navigation size={16} />
              Start Navigation
            </button>
          </div>
        </>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-circle flex items-center justify-center border-none bg-bg-card/80 text-text-muted cursor-pointer hover:bg-bg-elevated hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
