"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { X, MapPin, GripVertical, Plus, Upload, Navigation, Save, ChevronDown, Crosshair, History, Loader2 } from "lucide-react"
import { AppModal } from "@/app/components/ui"
import { VEHICLE_REGISTRY } from "@/app/lib/config"
import { SHARE_ROUTE_MODAL_CONFIG } from "@/app/lib/config"
import { POST_SUBMIT_CONFIG } from "@/app/lib/config/postSubmit"
import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts"
import { draftingCoachService } from "@/app/lib/services/DraftingCoachService"
import { routeDraftsService, type RouteDraft } from "@/app/lib/services/routeDraftsService"
import { toastService } from "@/app/lib/services/toastService"
import { estimateRoute, traceSignature, getCurrentPosition, reverseGeocode } from "@/app/lib/utils/geo"
import { memoryCache } from "@/app/lib/cache/memoryCache"
import type { VehicleType } from "@/app/lib/types"
import DraftingCoach from "./DraftingCoach"
import { RouteDraftsPanel } from "./RouteDraftsPanel"
import { RequestRouteTrigger } from "./RequestRouteTrigger"
import type { RoutePin } from "./RouteMap"


const RouteMap = dynamic(() => import("./RouteMap").then((m) => ({ default: m.RouteMap })), { ssr: false })

interface RouteStep {
  location: string
  description: string
  vehicle: string
  fare: number
  lat?: number
  lng?: number
}

interface GeoResult {
  display_name: string
  lat: string
  lon: string
}

/** The route request being responded to — switches the modal into response mode. */
export interface RespondToRequest {
  id: string
  title: string
  user?: { userName: string; firstName: string; lastName: string }
  /** Tags from the original request — inherited by the response composer. */
  tags?: string[]
}

/** An existing post opened for editing — the modal prefills and PATCHes it. */
export interface EditPost {
  id: string
  title: string
  description?: string | null
  routes: { location?: string; description?: string; vehicle?: string; fare?: number }[]
  tags?: string[]
  images?: string[]
}

interface ShareRouteModalProps {
  isOpen: boolean
  onClose: () => void
  responseTo?: RespondToRequest | null
  /** Opens the request-route flow (e.g. user meant to request, not share). Optional — trigger hidden when absent. */
  onRequestRoute?: () => void
  /** Open with the saved-drafts panel expanded (used by the home drafts resume chip). */
  startWithDraftsOpen?: boolean
  /** Edit mode: prefill from this post and PATCH on submit (drafts/response UI hidden). */
  editPost?: EditPost | null
  /** Handles the edit submit; return false to keep the modal open. */
  onEditSubmit?: (postId: string, data: {
    title: string
    description?: string
    routes: RouteStep[]
    images: string[]
    tags: string[]
    startLat?: number
    startLng?: number
    endLat?: number
    endLng?: number
    waypoints?: { lat: number; lng: number }[]
  }) => boolean | void | Promise<boolean | void>
  onSubmit?: (data: {
    title: string
    description?: string
    type?: "ROUTE" | "ROUTE_RESPONSE"
    quotedPostId?: string
    routes: RouteStep[]
    images: string[]
    tags: string[]
    startLat?: number
    startLng?: number
    endLat?: number
    endLng?: number
    waypoints?: { lat: number; lng: number }[]
    /** Idempotency key for this composer session — dedups double-clicks/retries server-side. */
    clientMutationId?: string
    /** Return false to keep the modal open (e.g. submission failed). */
  }) => boolean | void | Promise<boolean | void>
}

const VEHICLE_OPTIONS = Object.keys(VEHICLE_REGISTRY) as VehicleType[]

function newMutationKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  } catch {
    /* fall through to Math.random fallback */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const TRACE_CACHE_TTL = 600 // 10 min — same route re-edits don't re-trace
const TRACE_DEBOUNCE_MS = 1000

export default function ShareRouteModal({ isOpen, onClose, responseTo, onRequestRoute, startWithDraftsOpen, onSubmit, editPost, onEditSubmit }: ShareRouteModalProps) {
  const [restoredResponseTo, setRestoredResponseTo] = useState<RespondToRequest | null>(null)
  /** Prop wins; a restored draft keeps its response linkage when opened without one. */
  const effectiveResponseTo = responseTo ?? restoredResponseTo
  const isResponse = Boolean(effectiveResponseTo)
  /** Edit mode: owner correcting their own post (or admin) — no drafts, no response UI. */
  const isEditing = Boolean(editPost)
  const [drafts, setDrafts] = useState<RouteDraft[]>([])
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [showDrafts, setShowDrafts] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState<(RouteStep & { _geoResults?: GeoResult[]; _geoLoading?: boolean; _focused?: boolean; _locating?: boolean })[]>([
    { location: "", description: "", vehicle: "bus", fare: 0, _geoResults: [], _geoLoading: false },
    { location: "", description: "", vehicle: "", fare: 0, _geoResults: [], _geoLoading: false },
  ])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(SHARE_ROUTE_MODAL_CONFIG.previewDefaultOpen)
  const [formOpen, setFormOpen] = useState(SHARE_ROUTE_MODAL_CONFIG.formDefaultOpen)
  // Double-submit guard: while a post is in flight the Share/Save buttons are
  // disabled with spinner feedback, and re-entry is ignored. `mutationKey`
  // identifies this composer session for server-side idempotency replay.
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mutationKey, setMutationKey] = useState(() => newMutationKey())
  const [trace, setTrace] = useState<{ polyline: string; distance: number; duration: number; sig: string } | null>(null)
  const [tracing, setTracing] = useState(false)
  const traceDisabledRef = useRef(false)
  const traceSeqRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doGeocode = useCallback(async (query: string, stepIndex: number) => {
    if (!query || query.length < 3) {
      setSteps((prev) => {
        const next = [...prev]
        next[stepIndex] = { ...next[stepIndex], _geoResults: [], _geoLoading: false }
        return next
      })
      return
    }
    setSteps((prev) => {
      const next = [...prev]
      next[stepIndex] = { ...next[stepIndex], _geoLoading: true }
      return next
    })
    try {
      // Keyless stack: geocode via the internal server proxy (cached,
      // policy-compliant). Never call Nominatim browser-direct.
      const res = await fetch(
        `/api/maps/geocode?q=${encodeURIComponent(query)}&limit=5`,
      )
      if (!res.ok) throw new Error(`geocode ${res.status}`)
      const data = (await res.json()) as { results?: GeoResult[] }
      const results = Array.isArray(data.results) ? data.results : []
      setSteps((prev) => {
        const next = [...prev]
        next[stepIndex] = { ...next[stepIndex], _geoResults: results, _geoLoading: false }
        return next
      })
    } catch {
      setSteps((prev) => {
        const next = [...prev]
        next[stepIndex] = { ...next[stepIndex], _geoLoading: false }
        return next
      })
    }
  }, [])

  const handleGeoInput = (index: number, value: string) => {
    updateStep(index, "location", value)
    if (geoDebounceRef.current) clearTimeout(geoDebounceRef.current)
    geoDebounceRef.current = setTimeout(() => doGeocode(value, index), 400)
  }

  const selectGeoResult = (index: number, result: GeoResult) => {
    setSteps((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        location: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        _geoResults: [],
        _geoLoading: false,
        _focused: false,
      }
      return next
    })
  }

  const setStepExtra = (
    index: number,
    patch: Partial<{ _geoResults: GeoResult[]; _geoLoading: boolean; _focused: boolean; _locating: boolean }>
  ) => {
    setSteps((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  // Autofill: fill the focused location input with the user's current position
  const locateMe = async (index: number) => {
    setStepExtra(index, { _locating: true })
    try {
      const pos = await getCurrentPosition()
      const label = (await reverseGeocode(pos.lat, pos.lng)) ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
      setSteps((prev) => {
        const next = [...prev]
        next[index] = {
          ...next[index],
          location: label,
          lat: pos.lat,
          lng: pos.lng,
          _locating: false,
          _focused: false,
          _geoResults: [],
          _geoLoading: false,
        }
        return next
      })
    } catch (error) {
      setStepExtra(index, { _locating: false })
      toastService.error(error instanceof Error ? error.message : "Couldn't get your location")
    }
  }

  const pins: RoutePin[] = useMemo(() => {
    const validSteps = steps.filter((s) => s.location && s.lat && s.lng)
    if (validSteps.length === 0) {
      return steps.filter((s) => s.location).map((s, i) => ({
        lat: 6.5244 + (i * 0.003),
        lng: 3.3792 + (i * 0.005),
        label: s.location,
        type: (i === 0 ? "origin" : i === steps.filter(x => x.location).length - 1 ? "destination" : "waypoint") as "origin" | "destination" | "waypoint",
      }))
    }
    return validSteps.map((s, i) => ({
      lat: s.lat!,
      lng: s.lng!,
      label: s.location,
      type: i === 0 ? "origin" as const : i === validSteps.length - 1 ? "destination" as const : "waypoint" as const,
    }))
  }, [steps])

  const draftInput = {
    title,
    steps: steps.filter((s) => s.location),
    images,
    tags,
    description,
  }

  // ---- Live preview: instant client estimate + debounced server trace ----
  const realPins = useMemo(
    () => steps.filter((s) => s.location && s.lat && s.lng).map((s) => ({ lat: s.lat!, lng: s.lng! })),
    [steps]
  )
  const estimate = useMemo(() => estimateRoute(realPins.length >= 2 ? realPins : []), [realPins])
  const traceSig = realPins.length >= 2 ? traceSignature(realPins) : ""
  // Only trust a trace that matches the pins currently on screen
  const liveTrace = trace && trace.sig === traceSig ? trace : null
  const displayDistance = liveTrace ? liveTrace.distance : estimate.distanceKm
  const displayDuration = liveTrace ? liveTrace.duration : estimate.durationMins
  const totalFare = steps.reduce((sum, s) => sum + (s.fare || 0), 0)

  useEffect(() => {
    if (!isOpen || !traceSig) {
      setTrace(null)
      setTracing(false)
      return
    }
    const cached = memoryCache.get<{ polyline: string; distance: number; duration: number }>(`route-trace:${traceSig}`)
    if (cached) {
      setTrace({ ...cached, sig: traceSig })
      setTracing(false)
      return
    }
    if (traceDisabledRef.current) return // rate-limited earlier — estimates only

    const seq = ++traceSeqRef.current
    setTracing(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/routes/trace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pins: realPins }),
        })
        if (res.status === 429) {
          traceDisabledRef.current = true // stop tracing for this session
          return
        }
        if (!res.ok) throw new Error("trace failed")
        const data = (await res.json()) as { polyline?: string; distance?: number; duration?: number }
        if (seq !== traceSeqRef.current || !data.polyline) return
        const entry = {
          polyline: data.polyline,
          distance: typeof data.distance === "number" ? data.distance : estimate.distanceKm,
          duration: typeof data.duration === "number" ? data.duration : estimate.durationMins,
        }
        memoryCache.set(`route-trace:${traceSig}`, entry, TRACE_CACHE_TTL)
        setTrace({ ...entry, sig: traceSig })
      } catch {
        // silent — straight-line estimate stays on screen
      } finally {
        if (seq === traceSeqRef.current) setTracing(false)
      }
    }, TRACE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traceSig, isOpen])

  const evaluation = draftingCoachService.evaluate(draftInput)

  const addStep = () => {
    setSteps([...steps, { location: "", description: "", vehicle: "", fare: 0, _geoResults: [], _geoLoading: false }])
  }

  const removeStep = (index: number) => {
    if (steps.length <= 2) return
    setSteps(steps.filter((_, i) => i !== index))
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const reordered = [...steps]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(index, 0, moved)
    setSteps(reordered)
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    if (images.length + arr.length > 10) {
      setUploadError("You can upload up to 10 images")
      return
    }
    const oversized = arr.find((f) => f.size > 5 * 1024 * 1024)
    if (oversized) {
      setUploadError(`${oversized.name} exceeds 5MB`)
      return
    }
    const invalid = arr.find((f) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type))
    if (invalid) {
      setUploadError(`${invalid.name}: unsupported format. Use JPEG, PNG, WebP or GIF.`)
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      arr.forEach((f) => formData.append("file", f))
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error ?? "Upload failed")
      }
      const urls = (data as { urls: string[] }).urls ?? []
      setImages((prev) => [...prev, ...urls].slice(0, 10))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed. Check your connection."
      setUploadError(msg)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [images.length])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files)
  }

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const applyDraft = useCallback((draft: RouteDraft) => {
    if (draft.title) setTitle(draft.title)
    setDescription(draft.description ?? "")
    if (draft.steps.length >= 2) {
      setSteps(
        draft.steps.map((s) => ({ ...s, _geoResults: [], _geoLoading: false }))
      )
    }
    setTags(draft.tags)
    setImages(draft.images)
    setActiveDraftId(draft.id)
    // Maintain response linkage: a draft saved as a response restores it.
    setRestoredResponseTo(draft.responseTo ? {
      id: draft.responseTo.id,
      title: draft.responseTo.title,
      ...(draft.responseTo.user ? { user: draft.responseTo.user } : {}),
      ...(draft.responseTo.tags ? { tags: draft.responseTo.tags } : {}),
    } : null)
  }, [])

  const saveDraft = useCallback(() => {
    const stored = routeDraftsService.saveDraft({
      title,
      description,
      steps: steps.map(({ location, description, vehicle, fare, lat, lng }) => ({
        location,
        description,
        vehicle,
        fare,
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {}),
      })),
      tags,
      images,
      responseTo: effectiveResponseTo ? {
        id: effectiveResponseTo.id,
        title: effectiveResponseTo.title,
        ...(effectiveResponseTo.user ? { user: effectiveResponseTo.user } : {}),
        ...(effectiveResponseTo.tags ? { tags: effectiveResponseTo.tags } : {}),
      } : null,
    })
    if (!stored) {
      toastService.error(ROUTE_DRAFTS_CONFIG.saveEmptyError)
      return
    }
    setDrafts(routeDraftsService.listDrafts())
    setActiveDraftId(stored.id)
    toastService.success(ROUTE_DRAFTS_CONFIG.savedToast)
  }, [title, description, steps, tags, images, effectiveResponseTo])

  const restoreDraft = useCallback((draft: RouteDraft) => {
    applyDraft(draft)
    setShowDrafts(false)
    toastService.success(ROUTE_DRAFTS_CONFIG.restoredToast)
  }, [applyDraft])

  const deleteDraft = useCallback((id: string) => {
    setDrafts(routeDraftsService.deleteDraft(id))
    setActiveDraftId((prev) => (prev === id ? null : prev))
    toastService.success(ROUTE_DRAFTS_CONFIG.deletedToast)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    // Edit mode: prefill from the post, never absorb drafts or response state.
    if (editPost) {
      setTitle(editPost.title ?? "")
      setDescription(editPost.description ?? "")
      const prefill = (editPost.routes ?? []).map((s) => ({
        location: s.location ?? "",
        description: s.description ?? "",
        vehicle: s.vehicle ?? "",
        fare: typeof s.fare === "number" ? s.fare : 0,
        _geoResults: [] as GeoResult[],
        _geoLoading: false,
      }))
      setSteps(prefill.length >= 2 ? prefill : [
        { location: "", description: "", vehicle: "bus", fare: 0, _geoResults: [], _geoLoading: false },
        { location: "", description: "", vehicle: "", fare: 0, _geoResults: [], _geoLoading: false },
      ])
      setTags(editPost.tags ?? [])
      setImages(editPost.images ?? [])
      setActiveDraftId(null)
      setShowDrafts(false)
      setRestoredResponseTo(null)
      return
    }
    // Response mode: prefill from the quoted request, never absorb a normal-route draft.
    // Tags are inherited from the request when the composer has none yet.
    if (effectiveResponseTo) {
      const responseTitle = effectiveResponseTo.title
      const responseTags = effectiveResponseTo.tags ?? []
      setTitle((prev) => prev || `Re: ${responseTitle}`.slice(0, 100))
      if (responseTags.length > 0) {
        setTags((prev) => (prev.length === 0 ? [...responseTags] : prev))
      }
      setDrafts(routeDraftsService.listDrafts())
      setShowDrafts(false)
      return
    }
    const stored = routeDraftsService.listDrafts()
    setDrafts(stored)
    setShowDrafts(Boolean(startWithDraftsOpen && stored.length > 0))
    // Preserve the previous auto-restore UX: when the composer opens empty and
    // drafts exist, load the most recent one so no saved progress is stranded.
    if (stored.length > 0) {
      const composerEmpty =
        title.trim().length === 0 &&
        description.trim().length === 0 &&
        steps.every((s) => s.location.trim().length === 0) &&
        tags.length === 0 &&
        images.length === 0
      if (composerEmpty) applyDraft(stored[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, effectiveResponseTo, startWithDraftsOpen, editPost])

  const updateStep = (index: number, field: keyof RouteStep, value: string | number) => {
    setSteps((prev) => {
      const next = [...prev]
      const s = { ...next[index] }
      ;(s as unknown as Record<string, unknown>)[field] = value
      next[index] = s
      return next
    })
  }

  const addTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, "").slice(0, 30)
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed])
    }
    setTagInput("")
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag()
    }
  }

  const handleSubmit = async () => {
    // Ignore re-entry while a submission is in flight (double-click guard).
    if (isSubmitting) return
    if (!title.trim() || title.trim().length < 5) {
      toastService.error("Title must be at least 5 characters")
      return
    }
    const validSteps = steps.filter((s) => s.location.trim().length > 0)
    if (validSteps.length < 2) {
      toastService.error("Add at least 2 route steps")
      return
    }
    if (uploading) {
      toastService.error("Please wait for images to finish uploading")
      return
    }
    setIsSubmitting(true)
    // Fallback: geocode any step that has location string but no lat/lng
    const stepsToSubmit = [...validSteps]
    const missingGeo = stepsToSubmit.filter((s) => !s.lat || !s.lng)
    if (missingGeo.length > 0) {
      try {
        await Promise.all(missingGeo.map(async (s) => {
          try {
            const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(s.location)}&limit=1`)
            if (!res.ok) return
            const data = (await res.json()) as { results?: GeoResult[] }
            const results = Array.isArray(data.results) ? data.results : []
            if (results[0]) {
              s.lat = parseFloat(results[0].lat)
              s.lng = parseFloat(results[0].lon)
            }
          } catch { /* ignore per-step */ }
        }))
      } catch { /* ignore */ }
    }
    const first = stepsToSubmit.find((s) => s.lat && s.lng)
    const last = [...stepsToSubmit].reverse().find((s) => s.lat && s.lng)
    const waypoints = stepsToSubmit
      .filter((s) => s.lat && s.lng && s !== first && s !== last)
      .map((s) => ({ lat: s.lat!, lng: s.lng! }))
    // Edit mode: PATCH the existing post (single atomic update server-side).
    if (isEditing && editPost) {
      try {
        const { POST_ACTIONS_CONFIG } = await import("@/app/lib/config/postActions")
        const ok = await onEditSubmit?.(editPost.id, {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          routes: stepsToSubmit.map(({ _geoResults, _geoLoading, _focused, _locating, ...rest }) => rest),
          images,
          tags: tags.slice(0, 10),
          startLat: first?.lat,
          startLng: first?.lng,
          endLat: last?.lat && last !== first ? last.lat : undefined,
          endLng: last?.lng && last !== first ? last.lng : undefined,
          waypoints: waypoints.length > 0 ? waypoints : undefined,
        })
        if (ok === false) {
          setIsSubmitting(false)
          return
        }
        toastService.success(POST_ACTIONS_CONFIG.editSuccess)
      } catch {
        const { POST_ACTIONS_CONFIG } = await import("@/app/lib/config/postActions")
        toastService.error(POST_ACTIONS_CONFIG.editError)
        setIsSubmitting(false)
        return
      }
      setIsSubmitting(false)
      onClose()
      return
    }
    let result: boolean | void
    try {
      result = await onSubmit?.({
        title: title.trim(),
        // Omit empty descriptions: the API treats "" as a min-length failure,
        // and the quality-score checkpoint needs >=10 chars to pass.
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(isResponse && effectiveResponseTo ? { type: "ROUTE_RESPONSE" as const, quotedPostId: effectiveResponseTo.id } : {}),
        routes: stepsToSubmit.map(({ _geoResults, _geoLoading, _focused, _locating, ...rest }) => rest),
        images,
        tags: tags.slice(0, 10),
        startLat: first?.lat,
        startLng: first?.lng,
        endLat: last?.lat && last !== first ? last.lat : undefined,
        endLng: last?.lng && last !== first ? last.lng : undefined,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        clientMutationId: mutationKey,
      })
    } catch {
      setIsSubmitting(false)
      return // parent threw — keep input, allow retry
    }
    if (result === false) {
      setIsSubmitting(false)
      return // failed — keep the modal open so input isn't lost
    }
    // Upload complete: drop the restored draft (or legacy keys when none was active)
    if (activeDraftId) {
      setDrafts(routeDraftsService.deleteDraft(activeDraftId))
      setActiveDraftId(null)
    } else {
      routeDraftsService.clearLegacyKeys()
    }
    setRestoredResponseTo(null)
    // Fresh idempotency key for the next composer session.
    setMutationKey(newMutationKey())
    setIsSubmitting(false)
    onClose()
  }

  return (
    <AppModal open={isOpen} onClose={onClose} size="xl">
      <div className="flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between gap-3 px-6 py-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {isEditing ? "Edit Route" : isResponse ? "Respond to Route Request" : "Share a Route"}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {isEditing
                ? "Update your route details"
                : isResponse
                  ? "Post the route that answers this request"
                  : "Help the community with a new route"}
            </p>
          </div>
          {onRequestRoute && SHARE_ROUTE_MODAL_CONFIG.showRequestTrigger && !isResponse && !isEditing && (
            <div className="pr-8 shrink-0">
              <RequestRouteTrigger onClick={onRequestRoute} />
            </div>
          )}
        </div>

        {isResponse && effectiveResponseTo && !isEditing && (
          <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-warning border border-warning-border radius-lg">
            <span className="mt-0.5 text-warning-text shrink-0" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-text-muted">
                Replying to{effectiveResponseTo.user ? ` ${effectiveResponseTo.user.firstName} ${effectiveResponseTo.user.lastName}` : ""}&apos;s request
              </div>
              <div className="text-sm font-medium text-text-primary truncate">{effectiveResponseTo.title}</div>
            </div>
          </div>
        )}

        {!isEditing && (
        <div className="mx-6 mt-4 border border-border radius-lg bg-bg-elevated">
          <button
            type="button"
            onClick={() => setShowDrafts((open) => !open)}
            aria-expanded={showDrafts}
            aria-controls="route-drafts-panel"
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-none bg-transparent cursor-pointer font-sans text-left"
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <History size={15} className="text-text-secondary" />
              {ROUTE_DRAFTS_CONFIG.panelToggleLabel}
              <span className="text-xs font-medium text-text-muted">
                ({ROUTE_DRAFTS_CONFIG.draftsCountLabel(drafts.length)})
              </span>
            </span>
            <ChevronDown
              size={16}
              className={`text-text-secondary transition-transform duration-fast ${showDrafts ? "rotate-180" : ""}`}
            />
          </button>
          {showDrafts && (
            <div id="route-drafts-panel" className="px-3 pb-3">
              <RouteDraftsPanel drafts={drafts} activeDraftId={activeDraftId} onRestore={restoreDraft} onDelete={deleteDraft} />
            </div>
          )}
        </div>
        )}

        <div className="flex flex-col lg:flex-row overflow-y-auto flex-1">
          <div className="flex-1 p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto">
            <button
              type="button"
              onClick={() => setFormOpen((open) => !open)}
              aria-expanded={formOpen}
              aria-controls="route-form-panel"
              className="w-full flex items-center justify-between gap-2 py-1 border-none bg-transparent cursor-pointer font-sans text-left group"
            >
              <span className="text-sm font-semibold text-text-primary">
                {SHARE_ROUTE_MODAL_CONFIG.formTitle}
              </span>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform duration-fast ${formOpen ? "rotate-180" : ""}`}
              />
            </button>
            {formOpen && (
              <div id="route-form-panel" className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-primary">
                Route title <span className="text-error-text">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. "Marina to Yaba via Obalende"'
                className="w-full h-10 px-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none transition-colors duration-fast bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
              />
            </div>

            <div>
              <label htmlFor="route-description" className="block text-sm font-medium mb-1 text-text-primary">
                {SHARE_ROUTE_MODAL_CONFIG.descriptionTitle} <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <textarea
                id="route-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={SHARE_ROUTE_MODAL_CONFIG.descriptionPlaceholder}
                rows={3}
                maxLength={500}
                className="w-full min-h-[72px] px-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none transition-colors duration-fast resize-y bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
              />
              <p className="text-[11px] text-text-muted mt-1">{SHARE_ROUTE_MODAL_CONFIG.descriptionHint}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Route steps <span className="text-error-text">*</span>
              </label>
              <div className="flex flex-col gap-3">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-bg-elevated border radius-lg p-4 relative transition-all duration-fast ${
                      dragIndex === index ? "border-primary opacity-60 shadow-md" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <span
                        className="flex text-text-muted cursor-grab active:cursor-grabbing touch-none"
                        onDragStart={() => handleDragStart(index)}
                      >
                        <GripVertical size={16} />
                      </span>
                      <span className="w-6 h-6 rounded-circle bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium">
                        {index === 0 ? "Origin" : index === steps.length - 1 ? "Destination" : "Stop"}
                      </span>
                      {steps.length > 2 && (
                        <button onClick={() => removeStep(index)} className="ml-auto flex items-center justify-center p-1 rounded-xs border-none bg-transparent text-error-text cursor-pointer hover:bg-error" aria-label="Remove step">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none flex">
                          <MapPin size={16} />
                        </span>
                        <input
                          type="text"
                          value={step.location}
                          onChange={(e) => handleGeoInput(index, e.target.value)}
                          onFocus={() => setStepExtra(index, { _focused: true })}
                          onBlur={() => setTimeout(() => setStepExtra(index, { _focused: false }), 160)}
                          placeholder="Search location..."
                          aria-label={index === 0 ? "Origin location" : index === steps.length - 1 ? "Destination location" : `Stop ${index} location`}
                          className="w-full h-10 pl-[34px] pr-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none transition-colors duration-fast bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
                        />
                        {(step._geoLoading || step._locating) && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"><Navigation size={14} className="animate-spin" /></span>
                        )}
                        {step._focused && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-card border border-border radius-md shadow-lg max-h-[220px] overflow-y-auto">
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => locateMe(index)}
                              disabled={step._locating}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-primary border-none bg-transparent cursor-pointer hover:bg-primary-muted font-sans inline-flex items-center gap-2"
                            >
                              <Crosshair size={12} className="shrink-0" />
                              {step._locating ? "Getting your location..." : "Use my current location"}
                            </button>
                            {(step._geoResults ?? []).map((r, ri) => (
                              <button
                                key={ri}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectGeoResult(index, r)}
                                className="w-full text-left px-3 py-2 text-xs text-text-primary border-none bg-transparent cursor-pointer hover:bg-bg-elevated font-sans"
                              >
                                <span className="flex items-center gap-2">
                                  <MapPin size={12} className="shrink-0 text-text-muted" />
                                  {r.display_name}
                                </span>
                              </button>
                            ))}
                            {(step._geoResults ?? []).length === 0 && !step._geoLoading && !step._locating && (
                              <div className="px-3 py-2 text-xs text-text-muted">
                                Type to search places, or use your current location
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <textarea
                        value={step.description}
                        onChange={(e) => updateStep(index, "description", e.target.value)}
                        placeholder="Describe this stop, landmarks, and boarding instructions..."
                        className="w-full min-h-[60px] px-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none transition-colors duration-fast resize-y bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {VEHICLE_OPTIONS.map((vType) => {
                          const vConfig = VEHICLE_REGISTRY[vType]
                          const VIcon = vConfig.icon
                          const selected = step.vehicle === vType
                          return (
                            <button
                              key={vType}
                              onClick={() => updateStep(index, "vehicle", selected ? "" : vType)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 radius-pill border text-xs font-medium cursor-pointer font-sans transition-all duration-fast ${
                                selected
                                  ? "bg-primary-muted border-primary text-primary"
                                  : "bg-transparent border-border text-text-secondary hover:border-primary-light"
                              }`}
                            >
                              <VIcon size={14} />
                              {vConfig.label}
                            </button>
                          )
                        })}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-primary font-semibold text-sm pointer-events-none">₦</span>
                        <input
                          type="number"
                          value={step.fare || ""}
                          onChange={(e) => updateStep(index, "fare", parseFloat(e.target.value) || 0)}
                          placeholder="Fare amount"
                          className="w-full h-10 pl-7 pr-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none transition-colors duration-fast bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={addStep}
                className="inline-flex items-center gap-1.5 mt-2.5 px-3.5 py-2 radius-md border-2 border-dashed border-border bg-transparent text-sm font-medium text-text-secondary cursor-pointer font-sans transition-all duration-fast hover:border-primary hover:text-primary hover:bg-primary-muted"
              >
                <Plus size={16} />
                Add step
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-text-primary">Images <span className="text-text-muted font-normal">(optional)</span></label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileInputChange} />
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed radius-lg py-8 px-4 text-center cursor-pointer transition-colors duration-fast ${isDraggingOver ? "border-primary bg-primary-muted" : "border-border hover:border-primary hover:bg-primary-muted"} ${uploading ? "opacity-60 pointer-events-none" : ""}`}
                role="button"
                aria-label="Upload images"
              >
                <div className="text-text-muted mb-2">
                  <Upload size={28} className={`mx-auto ${uploading ? "animate-pulse" : ""}`} />
                </div>
                <p className="text-sm text-text-secondary">
                  {uploading ? "Uploading..." : <>Drag & drop or <strong className="text-text-primary">browse</strong> — Up to 10 images</>}
                </p>
                <p className="text-xs text-text-muted mt-1">JPEG, PNG, WebP · Max 5MB each</p>
              </div>
              {uploadError && <p className="text-xs text-error-text mt-2">{uploadError}</p>}
              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                  {images.map((url, idx) => (
                    <div key={url + idx} className="relative group radius-md overflow-hidden border border-border bg-bg-elevated">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-20 object-cover" />
                      <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-6 h-6 rounded-circle bg-black/60 text-white flex items-center justify-center border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-text-primary">Tags</label>
              <div className="flex flex-wrap gap-1.5 px-3 py-2 border border-border radius-sm bg-bg-base min-h-[40px] items-center">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-xs font-medium bg-primary-muted text-primary">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="w-3.5 h-3.5 rounded-circle flex items-center justify-center border-none bg-transparent text-primary cursor-pointer p-0">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={addTag}
                  placeholder="Type to add tags..."
                  className="border-none outline-none text-sm flex-1 min-w-[80px] bg-transparent font-sans text-text-primary placeholder:text-text-muted"
                />
              </div>
            </div>

            {/* Actions live in the modal footer below preview + score. */}
              </div>
            )}
          </div>

          <div className="w-full lg:w-[280px] shrink-0 p-4 sm:py-5 sm:pr-6 sm:pl-0 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border">
            <div>
              <button
                type="button"
                onClick={() => setPreviewOpen((open) => !open)}
                aria-expanded={previewOpen}
                aria-controls="route-preview-panel"
                className="w-full flex items-center justify-between gap-2 px-0 py-1.5 border-none bg-transparent cursor-pointer font-sans text-left group"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                  <MapPin size={14} />
                  {SHARE_ROUTE_MODAL_CONFIG.previewTitle}
                  {tracing && (
                    <span className="text-[10px] font-normal text-text-muted animate-pulse">updating...</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-text-muted">
                  {displayDistance > 0 ? `${displayDistance} km` : ""}
                  {displayDuration > 0 ? ` · ${displayDuration} min` : ""}
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-fast ${previewOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              {previewOpen && (
                <div id="route-preview-panel">
                  <RouteMap
                    pins={pins}
                    encodedPolyline={liveTrace?.polyline}
                    height={180}
                    editable={false}
                    showOverlay={true}
                    distance={displayDistance > 0 ? displayDistance : undefined}
                    duration={displayDuration > 0 ? displayDuration : undefined}
                    fare={`₦${totalFare.toLocaleString()}`}
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px] text-text-muted">
                    <span>{liveTrace ? "Live route" : "Estimated route — updates as you edit"}</span>
                    <span>{steps.filter((s) => s.location).length} steps</span>
                  </div>
                </div>
              )}
            </div>

            <DraftingCoach
              score={evaluation.score}
              maxScore={evaluation.maxScore}
              checkpoints={evaluation.checkpoints}
              nextSuggestion={evaluation.nextSuggestion}
              defaultOpen={SHARE_ROUTE_MODAL_CONFIG.scoreDefaultOpen}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-t border-border bg-bg-card shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {!isEditing && (
            <button
              type="button"
              onClick={() => setShowDrafts((open) => !open)}
              aria-expanded={showDrafts}
              aria-controls="route-drafts-panel"
              className="inline-flex items-center gap-1.5 h-9 px-3 radius-md border border-border bg-transparent text-xs font-semibold text-text-secondary cursor-pointer font-sans hover:bg-bg-elevated hover:text-text-primary transition-all duration-fast shrink-0"
            >
              <History size={14} />
              {ROUTE_DRAFTS_CONFIG.panelToggleLabel} ({drafts.length})
            </button>
            )}
            <span className="text-xs text-text-muted hidden md:inline truncate">{SHARE_ROUTE_MODAL_CONFIG.actionsNote}</span>
          </div>
          <div className="flex gap-2 ml-auto shrink-0">
            {!isEditing && (
            <button
              onClick={saveDraft}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 h-10 px-4 radius-md bg-transparent text-text-secondary border-none text-sm font-semibold cursor-pointer font-sans hover:bg-bg-elevated hover:text-text-primary transition-all duration-fast disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={14} />
              {ROUTE_DRAFTS_CONFIG.saveLabel}
            </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || uploading}
              aria-busy={isSubmitting}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 radius-md bg-primary text-text-inverse border-none text-sm font-semibold cursor-pointer font-sans hover:bg-primary-light transition-all duration-fast disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {isSubmitting
                ? (isEditing ? "Saving…" : isResponse ? POST_SUBMIT_CONFIG.responseSharingLabel : POST_SUBMIT_CONFIG.sharingLabel)
                : (isEditing ? "Save changes" : isResponse ? POST_SUBMIT_CONFIG.responseShareLabel : POST_SUBMIT_CONFIG.shareLabel)}
            </button>
          </div>
        </div>
      </div>
    </AppModal>
  )
}
