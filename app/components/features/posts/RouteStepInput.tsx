'use client'

import React, { useCallback, useRef, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'

interface RoutePin {
  lat: number
  lng: number
  label: string
  type: 'origin' | 'waypoint' | 'destination'
}

interface GeoResult {
  display_name: string
  lat: string
  lon: string
}

interface RouteStepInputProps {
  value?: RoutePin
  onChange: (pin: RoutePin) => void
  placeholder?: string
  type?: 'origin' | 'waypoint' | 'destination'
  disabled?: boolean
}

function RouteStepInput({
  value,
  onChange,
  placeholder = 'Search location...',
  type = 'waypoint',
  disabled = false,
}: RouteStepInputProps) {
  const [query, setQuery] = useState(value?.label ?? '')
  const [suggestions, setSuggestions] = useState<GeoResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const doGeocode = useCallback(async (q: string) => {
    if (q.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=en`,
        { headers: { "User-Agent": "AlongApp/1.0" }, signal: controller.signal }
      )
      const results: GeoResult[] = await res.json()
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    } catch {
      if (!controller.signal.aborted) {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setQuery(val)

      if (timerRef.current) clearTimeout(timerRef.current)

      if (val.length < 3) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setLoading(true)
      timerRef.current = setTimeout(() => doGeocode(val), 400)
    },
    [doGeocode]
  )

  const selectSuggestion = useCallback(
    (suggestion: GeoResult) => {
      setQuery(suggestion.display_name)
      setShowSuggestions(false)
      onChange({
        label: suggestion.display_name,
        lat: parseFloat(suggestion.lat),
        lng: parseFloat(suggestion.lon),
        type,
      })
    },
    [onChange, type]
  )

  return (
    <div className="relative">
      <div className="relative">
        <MapPin
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-10 pl-9 pr-3 text-sm border border-border rounded-sm bg-bg-base text-text-primary outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted disabled:opacity-50"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Navigation size={14} className="animate-spin text-primary" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-bg-card border border-border rounded-lg shadow-md max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-elevated transition-colors flex items-center gap-2"
              onMouseDown={() => selectSuggestion(s)}
            >
              <MapPin size={14} className="text-text-muted shrink-0" />
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { RouteStepInput }
export type { RouteStepInputProps, RoutePin }
