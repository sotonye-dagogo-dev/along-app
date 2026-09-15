"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { X, MapPin, GripVertical, Plus, Upload, Navigation, Save } from "lucide-react"
import { AppModal } from "@/app/components/ui"
import { VEHICLE_REGISTRY } from "@/app/lib/config"
import { draftingCoachService } from "@/app/lib/services/DraftingCoachService"
import { toastService } from "@/app/lib/services/toastService"
import type { VehicleType } from "@/app/lib/types"
import DraftingCoach from "./DraftingCoach"
import type { RoutePin } from "./RouteMap"

const DRAFT_KEY = "along_route_draft"


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

interface ShareRouteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: {
    title: string
    description: string
    routes: RouteStep[]
    images: string[]
    tags: string[]
    startLat?: number
    startLng?: number
    endLat?: number
    endLng?: number
    waypoints?: { lat: number; lng: number }[]
  }) => void
}

const VEHICLE_OPTIONS = Object.keys(VEHICLE_REGISTRY) as VehicleType[]

export default function ShareRouteModal({ isOpen, onClose, onSubmit }: ShareRouteModalProps) {
  const [title, setTitle] = useState("")
  const [description] = useState("")
  const [steps, setSteps] = useState<(RouteStep & { _geoResults?: GeoResult[]; _geoLoading?: boolean })[]>([
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
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=en`,
        { headers: { "User-Agent": "AlongApp/1.0" } }
      )
      const results: GeoResult[] = await res.json()
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
      }
      return next
    })
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

  const saveDraft = useCallback(() => {
    const draft = { title, steps, tags, images }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      toastService.success("Draft saved locally")
    } catch {
      toastService.error("Failed to save draft")
    }
  }, [title, steps, tags, images])

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    try {
      const stored = localStorage.getItem(DRAFT_KEY)
      if (!stored) return
      const draft = JSON.parse(stored) as { title?: string; steps?: (RouteStep & { _geoResults?: GeoResult[]; _geoLoading?: boolean })[]; tags?: string[]; images?: string[] }
      if (draft.title) setTitle(draft.title)
      if (draft.steps && draft.steps.length >= 2) setSteps(draft.steps)
      if (draft.tags) setTags(draft.tags)
      if (draft.images) setImages(draft.images)
    } catch { /* ignore */ }
  }, [isOpen])

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
    const trimmed = tagInput.trim().replace(/^#/, "")
    if (trimmed && !tags.includes(trimmed)) {
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
    // Fallback: geocode any step that has location string but no lat/lng
    const stepsToSubmit = [...validSteps]
    const missingGeo = stepsToSubmit.filter((s) => !s.lat || !s.lng)
    if (missingGeo.length > 0) {
      try {
        await Promise.all(missingGeo.map(async (s) => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(s.location)}&limit=1&accept-language=en`, { headers: { "User-Agent": "AlongApp/1.0" } })
            const results: GeoResult[] = await res.json()
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
    onSubmit?.({
      title: title.trim(),
      description,
      routes: stepsToSubmit.map(({ _geoResults, _geoLoading, ...rest }) => rest),
      images,
      tags,
      startLat: first?.lat,
      startLng: first?.lng,
      endLat: last?.lat && last !== first ? last.lat : undefined,
      endLng: last?.lng && last !== first ? last.lng : undefined,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
    })
    clearDraft()
    onClose()
  }

  return (
    <AppModal open={isOpen} onClose={onClose} size="xl">
      <div className="flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Share a Route</h2>
            <p className="text-sm text-text-secondary mt-0.5">Help the community with a new route</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row overflow-y-auto flex-1">
          <div className="flex-1 p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto">
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
                          placeholder="Search location..."
                          className="w-full h-10 pl-[34px] pr-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none transition-colors duration-fast bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"
                        />
                        {step._geoLoading && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"><Navigation size={14} className="animate-spin" /></span>
                        )}
                        {(step._geoResults ?? []).length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-card border border-border radius-md shadow-lg max-h-[200px] overflow-y-auto">
                            {(step._geoResults ?? []).map((r, ri) => (
                              <button
                                key={ri}
                                onClick={() => selectGeoResult(index, r)}
                                className="w-full text-left px-3 py-2 text-xs text-text-primary border-none bg-transparent cursor-pointer hover:bg-bg-elevated font-sans"
                              >
                                <span className="flex items-center gap-2">
                                  <MapPin size={12} className="shrink-0 text-text-muted" />
                                  {r.display_name}
                                </span>
                              </button>
                            ))}
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

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-text-muted">Drafts are saved locally</span>
              <div className="flex gap-2">
                <button onClick={saveDraft} className="inline-flex items-center gap-1.5 h-10 px-4 radius-md bg-transparent text-text-secondary border-none text-sm font-semibold cursor-pointer font-sans hover:bg-bg-elevated hover:text-text-primary transition-all duration-fast">
                  <Save size={14} />
                  Save Draft
                </button>
                <button
                  onClick={handleSubmit}
                  className="h-10 px-5 radius-md bg-primary text-text-inverse border-none text-sm font-semibold cursor-pointer font-sans hover:bg-primary-light transition-all duration-fast"
                >
                  Share Route
                </button>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[280px] shrink-0 p-4 sm:py-5 sm:pr-6 sm:pl-0 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-text-secondary">Route preview</label>
              <RouteMap
                pins={pins}
                height={180}
                editable={false}
                showOverlay={true}
                distance={pins.length >= 2 ? Math.round((pins.length - 1) * 3.2 * 10) / 10 : undefined}
                duration={pins.length >= 2 ? (pins.length - 1) * 25 : undefined}
                fare={`₦${steps.reduce((sum, s) => sum + (s.fare || 0), 0).toLocaleString()}`}
              />
            </div>

            <DraftingCoach
              score={evaluation.score}
              maxScore={evaluation.maxScore}
              checkpoints={evaluation.checkpoints}
              nextSuggestion={evaluation.nextSuggestion}
            />
          </div>
        </div>
      </div>
    </AppModal>
  )
}
