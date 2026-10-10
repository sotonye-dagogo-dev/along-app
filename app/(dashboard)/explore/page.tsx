"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { MapRef } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { Search, LocateFixed, SlidersHorizontal, Link2, X, ChevronLeft } from "lucide-react"
import { ExplorePinCard, FilterChipsBar } from "@/app/components/features/explore"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"
import { useUserLocation } from "@/app/lib/hooks/useUserLocation"
import { getMapStyleStack, rasterFallbackDepth } from "@/app/lib/config/mapStack"
import { MAP_PINS_CONFIG } from "@/app/lib/config/mapPins"
import { MapRoutePin, MapUserDot } from "@/app/components/features/posts/MapPins"
import { toastService } from "@/app/lib/services/toastService"
import { LOCATION_FEEDBACK_CONFIG, locationErrorCopy } from "@/app/lib/config/locationFeedback"

const MapView = dynamic(() => import("react-map-gl/maplibre"), { ssr: false })
const Marker = dynamic(() => import("react-map-gl/maplibre").then((m) => ({ default: m.Marker })), { ssr: false })

interface PostPin {
  id: string
  title: string
  lat: number
  lng: number
  likes: number
  comments: number
  tags: string[]
  vehicles: string[]
  validityScore: number
  validityTier: string | null
  region: string | null
  createdAt: string
  user: { userName: string; firstName: string; lastName: string }
}

function getTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

interface ExploreApiPost {
  id: string
  title: string
  startLat?: number | null
  startLng?: number | null
  likes: number
  comments: number
  tags: string[]
  validityScore: number
  validityTier: string | null
  region: string | null
  routes?: unknown
  createdAt: string
  user: { userName: string; firstName: string; lastName: string }
}

export default function ExplorePage() {
  const searchParams = useSearchParams()
  const [selectedPin, setSelectedPin] = useState<PostPin | null>(null)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [bottomSheetHeight, setBottomSheetHeight] = useState("40vh")
  const [dragging, setDragging] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [sortBy, setSortBy] = useState("validity")
  // User location pin: always visible once granted. The shared hook requests
  // on mount (no view jump) and watches so the dot tracks movement; the
  // manual override lets "Near me" plant an explicit fix for feedback.
  const trackedLocation = useUserLocation()
  const [manualLocation, setManualLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null)
  const userLocation = manualLocation ?? trackedLocation
  const [locating, setLocating] = useState(false)
  const [sharing, setSharing] = useState(false)
  // Stable mapLib promise (see RouteMap): a fresh `import()` per render can
  // re-init the map mid-interaction and unseat markers.
  const mapLibRef = useRef<Promise<unknown> | null>(null)
  if (mapLibRef.current === null && typeof window !== "undefined") {
    mapLibRef.current = import("maplibre-gl")
  }
  // Keyless map stack (Sprint 19): vector primary, raster step-down on error.
  const [styleIdx, setStyleIdx] = useState(0)
  useEffect(() => {
    setStyleIdx(0)
  }, [isDark])
  const [filters, setFilters] = useState([
    { label: "Bus", active: false },
    { label: "Keke", active: false },
    { label: "Trekking", active: false },
    { label: "Taxi", active: false },
    { label: "Verified", active: false },
    { label: "Trusted", active: false },
  ])
  const [viewState, setViewState] = useState({
    latitude: Number(searchParams.get("lat")) || 6.5244,
    longitude: Number(searchParams.get("lng")) || 3.3792,
    zoom: Number(searchParams.get("zoom")) || 11,
  })
  const mapRef = useRef<MapRef>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const sheetStartHeight = useRef("40vh")

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          setIsDark(document.documentElement.classList.contains("dark"))
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  // Public route list — shared cache across viewers, SWR so the map pins paint instantly
  const { data: exploreData } = useCachedFetch<{ posts: ExploreApiPost[] }>(
    "posts:explore",
    "/api/posts?limit=100",
    { ttlSec: 120 }
  )

  const pins = useMemo<PostPin[]>(() => {
    const posts = exploreData?.posts ?? []
    // Only pins with coordinates are map-placeable; keep all for list but filter for map
    return posts
      .filter((p) => p.startLat != null && p.startLng != null && Number.isFinite(p.startLat) && Number.isFinite(p.startLng))
      .map((p) => {
        const routes = Array.isArray(p.routes) ? (p.routes as { vehicle?: string }[]) : []
        const vehicles = [...new Set(routes.map((r) => r.vehicle).filter(Boolean))] as string[]
        return {
          id: p.id,
          title: p.title,
          lat: p.startLat as number,
          lng: p.startLng as number,
          likes: p.likes,
          comments: p.comments,
          tags: p.tags,
          vehicles,
          validityScore: p.validityScore,
          validityTier: p.validityTier,
          region: p.region,
          createdAt: p.createdAt,
          user: p.user,
        }
      })
  }, [exploreData])

  const updateUrl = useCallback(
    (lat: number, lng: number, zoom: number) => {
      const params = new URLSearchParams()
      params.set("lat", lat.toFixed(4))
      params.set("lng", lng.toFixed(4))
      params.set("zoom", String(Math.round(zoom)))
      if (searchQuery) params.set("q", searchQuery)
      window.history.replaceState(null, "", `/explore?${params.toString()}`)
    },
    [searchQuery]
  )

  const handleViewportChange = useCallback(
    (v: { latitude: number; longitude: number; zoom: number }) => {
      setViewState({ latitude: v.latitude, longitude: v.longitude, zoom: v.zoom })
      updateUrl(v.latitude, v.longitude, v.zoom)
    },
    [updateUrl]
  )

  const activeVehicleFilters = filters.filter((f) =>
    ["Bus", "Keke", "Trekking", "Taxi"].includes(f.label) && f.active
  ).map((f) => f.label)
  const showVerified = filters.find((f) => f.label === "Verified")?.active ?? false
  const showTrusted = filters.find((f) => f.label === "Trusted")?.active ?? false

  const filteredPins = useMemo(() => {
    let result = pins
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.region?.toLowerCase().includes(q)
      )
    }
    if (activeVehicleFilters.length > 0) {
      result = result.filter((p) =>
        p.vehicles.some((v) => activeVehicleFilters.includes(v))
      )
    }
    // Trust tiers are hierarchical: "trusted" (≥80) outranks "verified"
    // (≥60), so the Verified filter includes both — otherwise verified
    // users lose their best posts from the filtered view.
    if (showVerified) {
      result = result.filter((p) => p.validityTier === "verified" || p.validityTier === "trusted")
    }
    if (showTrusted) {
      result = result.filter((p) => p.validityTier === "trusted")
    }
    if (sortBy === "validity") {
      // Score first, then engagement depth, then recency — mirrors the feed
      // tie-break order so Explore and Home agree on what "best" means.
      result = [...result].sort((a, b) => {
        if (b.validityScore !== a.validityScore) return b.validityScore - a.validityScore
        if (b.likes !== a.likes) return b.likes - a.likes
        if (b.comments !== a.comments) return b.comments - a.comments
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    } else if (sortBy === "recency") {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (sortBy === "nearest") {
      // Behind-the-scenes location factor: distance-decayed ordering when a
      // fix is available; falls back to validity order when it isn't.
      if (userLocation) {
        const toRad = (d: number) => (d * Math.PI) / 180
        const distKm = (lat: number, lng: number) => {
          const dLat = toRad(lat - userLocation.lat)
          const dLng = toRad(lng - userLocation.lng)
          const s =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(userLocation.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
          return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
        }
        result = [...result].sort((a, b) => distKm(a.lat, a.lng) - distKm(b.lat, b.lng))
      } else {
        result = [...result].sort((a, b) => b.validityScore - a.validityScore)
      }
    }
    return result
  }, [pins, searchQuery, activeVehicleFilters, showVerified, showTrusted, sortBy, userLocation])

  const handleSheetPointerDown = (e: React.PointerEvent) => {
    setDragging(true)
    dragStartY.current = e.clientY
    sheetStartHeight.current = bottomSheetHeight
    const handlePointerMove = (ev: PointerEvent) => {
      const delta = dragStartY.current - ev.clientY
      const parentHeight = window.innerHeight
      const currentVh = parseFloat(bottomSheetHeight) || 40
      const newVh = Math.min(80, Math.max(25, currentVh + (delta / parentHeight) * 100))
      setBottomSheetHeight(`${newVh}vh`)
    }
    const handlePointerUp = () => {
      setDragging(false)
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerup", handlePointerUp)
    }
    document.addEventListener("pointermove", handlePointerMove)
    document.addEventListener("pointerup", handlePointerUp)
  }

  // User location pin: always visible once granted. Requests on mount
  // (passive — no view jump), keeps a watchPosition subscription so the dot
  // tracks movement, and cleans up on unmount. Denials fail softly; the
  // Near-me button re-centres on demand with feedback.
  // (Now owned by the shared useUserLocation hook above — no local watch.)

  const handleNearMe = () => {
    if (!("geolocation" in navigator)) {
      toastService.error(LOCATION_FEEDBACK_CONFIG.unsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setManualLocation({ lat, lng, accuracy: pos.coords.accuracy });
        setViewState({ latitude: lat, longitude: lng, zoom: 14 });
        updateUrl(lat, lng, 14);
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1500 });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toastService.error(locationErrorCopy(err.code));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const handleShareView = async () => {
    const url = window.location.href;
    const title = "Along — explore routes";
    if (sharing) return;
    setSharing(true);
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await (navigator as Navigator & { share: (d: { title: string; url: string }) => Promise<void> }).share({ title, url });
          toastService.success("Shared!");
          return;
        } catch (e) {
          if (e instanceof Error && /abort|cancel/i.test(e.name + e.message)) return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toastService.success("Link copied — share it anywhere");
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toastService.success("Link copied — share it anywhere");
      }
    } catch {
      toastService.error("Couldn't share right now — copy the address bar URL");
    } finally {
      setSharing(false);
    }
  };

  // Shared keyless style stack (OpenFreeMap vector → keyless raster
  // fallbacks; no apiKey params, no mapbox:// branch).
  const mapStyle = getMapStyleStack(isDark)[Math.min(styleIdx, rasterFallbackDepth())]

  return (
    <div className="relative w-full h-screen overflow-hidden bg-bg-elevated">
      {/* Single Map View for all screen sizes */}
      <div className={`w-full h-full ${isDark ? "dark-map" : ""}`}>
        <MapView
          ref={mapRef}
          mapLib={(mapLibRef.current ?? import("maplibre-gl")) as never}
          {...viewState}
          mapStyle={mapStyle}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
          onMove={(e: { viewState: { latitude: number; longitude: number; zoom: number } }) =>
            setViewState({ latitude: e.viewState.latitude, longitude: e.viewState.longitude, zoom: e.viewState.zoom })
          }
          onMoveEnd={(e: { viewState: { latitude: number; longitude: number; zoom: number } }) =>
            handleViewportChange(e.viewState)
          }
          onError={() => setStyleIdx((i) => (i < rasterFallbackDepth() ? i + 1 : i))}
          reuseMaps
        >
          {userLocation && (
            <Marker
              key="user-location"
              latitude={userLocation.lat}
              longitude={userLocation.lng}
              anchor={MAP_PINS_CONFIG.markerAnchor}
              offset={MAP_PINS_CONFIG.markerOffset as unknown as [number, number]}
            >
              <MapUserDot accuracy={userLocation.accuracy} />
            </Marker>
          )}
          {filteredPins.map((pin, idx) => (
            <Marker
              key={pin.id}
              latitude={pin.lat}
              longitude={pin.lng}
              anchor={MAP_PINS_CONFIG.markerAnchor}
              offset={MAP_PINS_CONFIG.markerOffset as unknown as [number, number]}
              onClick={() => setSelectedPin(pin)}
            >
              <button
                type="button"
                onClick={() => setSelectedPin(pin)}
                aria-label={`${pin.title} - ${pin.validityTier ?? "developing"} (${pin.validityScore})`}
                title={`${pin.title} - ${pin.validityTier ?? "developing"} (${pin.validityScore})`}
                className="bg-transparent border-none p-0 cursor-pointer"
              >
                <MapRoutePin index={idx} total={filteredPins.length} label={pin.title} />
              </button>
            </Marker>
          ))}
        </MapView>
      </div>

      {/* Glass Top Bar - Desktop */}
      <div className="absolute top-0 left-0 right-0 z-15 hidden lg:flex items-center gap-3 px-5 py-3 bg-bg-base/70 backdrop-blur-[16px] saturate-[180%] border-b border-border/40">
        <div className="relative w-[360px] shrink-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routes, places..."
            aria-label="Search routes"
            className="w-full h-10 pl-9 pr-3 border border-border radius-sm text-sm font-sans outline-none bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterChipsBar filters={filters} onToggle={(label) => setFilters((prev) => prev.map((x) => (x.label === label ? { ...x, active: !x.active } : x)))} />
        </div>
        <button
          onClick={handleNearMe}
          disabled={locating}
          className="w-10 h-10 rounded-md border border-border bg-bg-card text-text-secondary flex items-center justify-center shrink-0 hover:bg-bg-elevated hover:text-primary transition-colors duration-fast cursor-pointer disabled:opacity-60"
          aria-label={locating ? "Locating…" : "Near me"}
          title={userLocation ? "Centred on your location" : "Show my location"}
        >
          <LocateFixed size={18} className={locating ? "animate-pulse" : ""} />
        </button>
      </div>

      {/* Glass Top Bar - Mobile */}
      <div className="absolute top-0 left-0 right-0 z-15 flex lg:hidden items-center gap-2 px-3 py-2 bg-bg-base/70 backdrop-blur-[16px] saturate-[180%]">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routes, places..."
            aria-label="Search routes"
            className="w-full h-10 pl-9 pr-3 border border-border radius-sm text-sm font-sans outline-none bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
          />
        </div>
        <button onClick={() => setMobileFilterOpen(!mobileFilterOpen)} className="w-10 h-10 rounded-md border border-border bg-bg-card text-text-secondary flex items-center justify-center shrink-0 cursor-pointer" aria-label="Filters">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Desktop Left Panel (320px, glass) */}
      <div
        className={`absolute top-[68px] left-0 bottom-0 w-[320px] z-12 hidden md:flex flex-col bg-bg-card/85 backdrop-blur-[16px] saturate-[180%] border-r border-border/40 overflow-hidden transition-transform duration-moderate ${
          panelCollapsed ? "-translate-x-full" : ""
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-sm font-semibold">Nearby routes</div>
            <div className="text-xs text-text-muted">{filteredPins.length} routes found</div>
          </div>
          <button
            onClick={() => setPanelCollapsed(true)}
            className="w-8 h-8 rounded-circle bg-bg-elevated text-text-secondary flex items-center justify-center hover:bg-primary-muted hover:text-primary transition-colors duration-fast cursor-pointer border-none"
            aria-label="Collapse panel"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <label className="text-xs text-text-secondary">Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-8 px-2 border border-border radius-sm text-xs font-sans text-text-primary bg-bg-base outline-none">
              <option value="validity">Validity score</option>
              <option value="recency">Recency</option>
              <option value="nearest">Nearest to me</option>
            </select>
          </div>
          {filteredPins.map((pin) => (
            <ExplorePinCard
              key={pin.id}
              id={pin.id}
              title={pin.title}
              user={pin.user}
              validityScore={pin.validityScore}
              validityTier={pin.validityTier}
              tags={pin.tags}
              likes={pin.likes}
              createdAt={pin.createdAt}
            />
          ))}
        </div>
      </div>

      {/* Collapsed panel toggle */}
      {panelCollapsed && (
        <button
          onClick={() => setPanelCollapsed(false)}
          className="absolute top-[76px] left-0 z-13 w-8 h-8 rounded-r-md bg-bg-card/85 backdrop-blur border border-border/40 border-l-0 text-text-secondary flex items-center justify-center cursor-pointer hover:text-primary shadow-sm"
          aria-label="Show panel"
        >
          <ChevronLeft size={16} className="rotate-180" />
        </button>
      )}

      {/* Pin Popup Card (280px, glass) */}
      {selectedPin && (
        <div className="hidden lg:block absolute z-20 w-[280px] bg-bg-card/90 backdrop-blur-[16px] saturate-[180%] border border-border/40 radius-xl p-4 shadow-lg animate-[scaleIn_200ms_ease-out]"
          style={{ top: "200px", left: "420px" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/profile/${selectedPin.user.userName}`} className="no-underline">
              <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {selectedPin.user.firstName[0]}{selectedPin.user.lastName[0]}
              </div>
            </Link>
            <div>
              <Link href={`/profile/${selectedPin.user.userName}`} className="text-xs font-semibold no-underline hover:underline text-text-primary">{selectedPin.user.firstName} {selectedPin.user.lastName}</Link>
              <Link href={`/profile/${selectedPin.user.userName}`} className="text-[11px] text-text-secondary no-underline hover:underline block">@{selectedPin.user.userName} · {getTimeAgo(selectedPin.createdAt)}</Link>
            </div>
            <button
              onClick={() => setSelectedPin(null)}
              className="ml-auto w-6 h-6 rounded-circle flex items-center justify-center border-none bg-transparent text-text-muted cursor-pointer hover:bg-bg-elevated"
              aria-label="Close popup"
            >
              <X size={14} />
            </button>
          </div>
          <Link href={`/posts/${selectedPin.id}`} className="text-sm font-semibold mb-2 no-underline hover:underline text-text-primary block">{selectedPin.title}</Link>
          <div className="flex gap-1 mb-2">
            {selectedPin.tags.slice(0, 3).map((t) => (
              <Link key={t} href={`/explore?tag=${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 radius-pill text-[10px] font-medium bg-bg-elevated text-text-secondary no-underline hover:bg-primary-muted hover:text-primary">#{t}</Link>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 radius-pill text-[10px] font-semibold ${
              (selectedPin.validityTier ?? "developing") === "verified" ? "bg-success text-success-text" :
              (selectedPin.validityTier ?? "developing") === "trusted" ? "bg-info text-info-text" :
              (selectedPin.validityTier ?? "developing") === "low" ? "bg-error text-error-text" :
              "bg-warning text-warning-text"
            }`}>
              {(selectedPin.validityTier ?? "developing").charAt(0).toUpperCase() + (selectedPin.validityTier ?? "developing").slice(1)} {selectedPin.validityScore}
            </span>
          </div>
          <Link
            href={`/posts/${selectedPin.id}`}
            className="inline-flex items-center justify-center w-full h-[34px] px-3.5 radius-md bg-primary text-white text-xs font-semibold no-underline hover:bg-primary-light transition-colors duration-fast"
          >
            View Route
          </Link>
        </div>
      )}

      {/* Share this view - Desktop */}
      <button
        onClick={handleShareView}
        disabled={sharing}
        className="absolute bottom-6 right-6 z-15 hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 radius-md border border-border bg-bg-card/85 backdrop-blur-[12px] saturate-[180%] text-text-secondary text-xs font-medium cursor-pointer font-sans transition-colors duration-fast hover:bg-bg-card hover:text-primary shadow-sm disabled:opacity-60"
        aria-label="Share this view"
      >
        <Link2 size={16} />
        {sharing ? "Sharing…" : "Share this view"}
      </button>

      {/* Mobile Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`md:hidden absolute left-0 right-0 bottom-0 z-15 bg-bg-card/90 backdrop-blur-[16px] saturate-[180%] border-t border-border/40 rounded-[24px_24px_0_0] overflow-y-auto transition-[height] duration-moderate ${dragging ? "" : "ease-[cubic-bezier(0.34,1.56,0.64,1)]"}`}
        style={{ height: bottomSheetHeight, maxHeight: "75vh" }}
      >
        <div
          className="flex justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handleSheetPointerDown}
        >
          <div className="w-10 h-1 bg-border rounded-pill" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2.5">
          <span className="text-xs font-semibold">Nearby routes</span>
          <span className="text-xs text-text-muted">{filteredPins.length} found</span>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-3">
          {filteredPins.map((pin) => (
            <ExplorePinCard
              key={pin.id}
              id={pin.id}
              title={pin.title}
              user={pin.user}
              validityScore={pin.validityScore}
              validityTier={pin.validityTier}
              tags={pin.tags}
              likes={pin.likes}
              createdAt={pin.createdAt}
            />
          ))}
        </div>
      </div>

      {/* Share this view - Mobile (tracks the bottom-sheet height) */}
      <button
        onClick={handleShareView}
        disabled={sharing}
        style={{ bottom: `calc(${bottomSheetHeight} + 16px)` }}
        className="lg:hidden absolute right-4 z-15 inline-flex items-center gap-1.5 px-3 py-1.5 radius-md border border-border bg-bg-card/85 backdrop-blur-[12px] text-text-secondary text-xs font-medium cursor-pointer font-sans hover:bg-bg-card hover:text-primary shadow-sm disabled:opacity-60"
        aria-label="Share this view"
      >
        <Link2 size={14} />
        {sharing ? "…" : "Share"}
      </button>

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFilterOpen(false)} />
          <div className="relative z-31 bg-bg-card rounded-[16px_16px_0_0] px-4 py-4 shadow-lg animate-[slideUp_200ms_ease-out]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Filter options</span>
              <button onClick={() => setMobileFilterOpen(false)} className="w-7 h-7 rounded-circle flex items-center justify-center border-none bg-bg-elevated text-text-secondary cursor-pointer"><X size={14} /></button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <FilterChipsBar filters={filters} onToggle={(label) => setFilters((prev) => prev.map((x) => (x.label === label ? { ...x, active: !x.active } : x)))} />
            </div>
            <button onClick={handleNearMe} disabled={locating} className="w-full h-9 flex items-center justify-center gap-2 radius-md border border-border bg-bg-card text-text-secondary text-xs font-medium cursor-pointer hover:bg-bg-elevated mt-1 disabled:opacity-60" aria-label="Near me">
              <LocateFixed size={14} />
              {locating ? "Locating…" : "Use my location"}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
