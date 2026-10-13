'use client'

import React, { useCallback, useRef, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { getBiasCoordsQuick, peekBiasCoords, biasQuerySuffix } from '@/app/lib/utils/geoBias'
import { LOCATION_SUGGESTIONS_CONFIG, buildGeocodeUrl } from '@/app/lib/config/locationSuggestions'

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
    if (q.length < LOCATION_SUGGESTIONS_CONFIG.minQueryLength) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      // Keyless stack: geocode via the internal server proxy (fast providers
      // in parallel + Overpass/token-reorder fallback, merged, cached).
      // Viewer bias (granted-only, never prompts) re-ranks nearby hits first
      // server-side. Bias resolves on a
      // ~120ms budget so a cold GPS fix never stalls keystroke suggestions.
      // Browser-direct upstream calls violate usage policy and are banned —
      // never call upstream from the client.
      // A quick cached peek fires the request immediately; the raced lookup
      // only upgrades the bias when it resolves within budget.
      const bias = peekBiasCoords() ?? (await getBiasCoordsQuick());
      const res = await fetch(
        `${buildGeocodeUrl(q)}${biasQuerySuffix(bias)}`,
        { signal: controller.signal }
      )
      if (res.status === 429) {
        // Rate-limited: keep prior suggestions visible (if any) rather than
        // wiping the dropdown — the user can keep typing; next keystroke
        // retries. Never throws, never clears good results.
        return;
      }
      if (!res.ok) throw new Error(`geocode ${res.status}`)
      const data = (await res.json()) as { results?: GeoResult[] }
      const results = Array.isArray(data.results) ? data.results : []
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    } catch {
      // Offline/aborted/upstream failure: leave prior suggestions untouched
      // so the dropdown doesn't flash empty on transient errors.
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setQuery(val)

      if (timerRef.current) clearTimeout(timerRef.current)

      if (val.length < LOCATION_SUGGESTIONS_CONFIG.minQueryLength) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setLoading(true)
      timerRef.current = setTimeout(() => doGeocode(val), LOCATION_SUGGESTIONS_CONFIG.debounceMs)
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
