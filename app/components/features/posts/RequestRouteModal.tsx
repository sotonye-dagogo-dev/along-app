"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { ClipboardList, MapPin, Loader2 } from "lucide-react"
import { AppModal } from "@/app/components/ui"

export interface RouteRequestBody {
  title: string
  description: string
  type: "ROUTE_REQUEST"
  routes: { location: string; description?: string }[]
  tags: string[]
  /** Idempotency key for this composer session — dedups double-clicks/retries server-side. */
  clientMutationId?: string
}

/** An existing ROUTE_REQUEST opened for editing — prefilled, PATCHed, never morphed. */
export interface EditRouteRequest {
  id: string
  title: string
  description?: string | null
  routes?: { location?: string; description?: string }[] | unknown
  tags?: string[]
}

interface RequestRouteModalProps {
  isOpen: boolean
  onClose: () => void
  /** Return false to keep the modal open (e.g. submission failed). */
  onSubmit?: (data: RouteRequestBody) => boolean | void | Promise<boolean | void>
  /** Edit mode: prefill from this request and PATCH on submit (nature preserved). */
  editRequest?: EditRouteRequest | null
  /** Handles the request edit; must resolve `true` on success. */
  onEditSubmit?: (
    postId: string,
    data: { title: string; description: string; routes: { location: string }[]; tags: string[] },
  ) => boolean | void | Promise<boolean | void>
}

const inputClass =
  "w-full h-10 px-3 py-2.5 border border-border radius-sm text-sm font-sans outline-none transition-colors duration-fast bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted"

function newRequestKey(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  } catch {
    /* fall through to Math.random fallback */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function RequestRouteModal({ isOpen, onClose, onSubmit, editRequest, onEditSubmit }: RequestRouteModalProps) {
  const isEditing = Boolean(editRequest)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  // One idempotency key per composer session (regenerated after each success).
  const [mutationKey, setMutationKey] = useState(() => newRequestKey())

  // Location autocomplete (same keyless `/api/maps/geocode` proxy as the
  // share composer: debounced, abortable, bias on a ~120ms budget, 429 and
  // offline leave prior hits untouched so the dropdown never flashes empty).
  interface LocHit { display_name: string; lat: string; lon: string }
  const [fromHits, setFromHits] = useState<LocHit[]>([]);
  const [toHits, setToHits] = useState<LocHit[]>([]);
  const [fromLoading, setFromLoading] = useState(false);
  const [toLoading, setToLoading] = useState(false);
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLocHits = useCallback(async (q: string, which: "from" | "to") => {
    if (!q || q.trim().length < 3) {
      if (which === "from") setFromHits([]);
      else setToHits([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (which === "from") setFromLoading(true);
    else setToLoading(true);
    try {
      const { peekBiasCoords, getBiasCoordsQuick, biasQuerySuffix } = await import("@/app/lib/utils/geoBias");
      const bias = peekBiasCoords() ?? (await getBiasCoordsQuick());
      const res = await fetch(
        `/api/maps/geocode?q=${encodeURIComponent(q.trim())}&limit=5${biasQuerySuffix(bias)}`,
        { signal: controller.signal },
      );
      if (res.status === 429) return; // keep prior hits; next keystroke retries
      if (!res.ok) throw new Error(`geocode ${res.status}`);
      const data = (await res.json()) as { results?: LocHit[] };
      const hits = Array.isArray(data.results) ? data.results : [];
      if (which === "from") setFromHits(hits);
      else setToHits(hits);
    } catch {
      // Offline/aborted/transient: leave prior hits untouched.
    } finally {
      if (!controller.signal.aborted) {
        if (which === "from") setFromLoading(false);
        else setToLoading(false);
      }
    }
  }, []);

  const queueLocFetch = useCallback((q: string, which: "from" | "to") => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 3) {
      if (which === "from") setFromHits([]);
      else setToHits([]);
      return;
    }
    if (which === "from") setFromLoading(true);
    else setToLoading(true);
    debounceRef.current = setTimeout(() => void fetchLocHits(q, which), 400);
  }, [fetchLocHits]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  // Edit mode prefill: a ROUTE_REQUEST stays a request — fields map back to
  // the same from/to shape so the edit form matches the create form.
  useEffect(() => {
    if (!isOpen) return
    if (editRequest) {
      const steps = Array.isArray(editRequest.routes)
        ? (editRequest.routes as { location?: string }[])
        : []
      setTitle(editRequest.title ?? "")
      setDescription(editRequest.description ?? "")
      setFrom(steps[0]?.location ?? "")
      setTo(steps[1]?.location ?? steps[0]?.location ?? "")
      setTags(Array.isArray(editRequest.tags) ? [...editRequest.tags] : [])
      setTagInput("")
      setShowErrors(false)
      setSubmitting(false)
    }
  }, [isOpen, editRequest])

  const errors = {
    title: title.trim().length < 5 ? "Title must be at least 5 characters" : null,
    description: description.trim().length < 10 ? "Describe what you need (at least 10 characters)" : null,
    from: from.trim().length < 2 ? "Where are you starting from?" : null,
    to: to.trim().length < 2 ? "Where are you going?" : null,
  }
  const isValid = !errors.title && !errors.description && !errors.from && !errors.to

  // Stable identities: AppModal keys its Escape listener off onClose, so
  // inline closures here churned the listener on every keystroke (and the
  // old focus effect stole input focus — mobile keyboard dismissal).
  const reset = useCallback(() => {
    setTitle("")
    setDescription("")
    setFrom("")
    setTo("")
    setTags([])
    setTagInput("")
    setShowErrors(false)
    setSubmitting(false)
    setFromHits([])
    setToHits([])
    setFromFocused(false)
    setToFocused(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase()
    if (t && !tags.includes(t) && tags.length < 5) setTags([...tags, t])
    setTagInput("")
  }

  const handleSubmit = async () => {
    setShowErrors(true)
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      // Edit path: PATCH without `type` so the request nature is immutable
      // server-side (MODERATION_CONFIG.immutablePostFields backstop).
      if (isEditing && editRequest) {
        const result = await onEditSubmit?.(editRequest.id, {
          title: title.trim(),
          description: description.trim(),
          routes: [{ location: from.trim() }, { location: to.trim() }],
          tags,
        })
        if (result !== true) {
          setSubmitting(false)
          return // failed — keep input, allow retry
        }
        reset()
        onClose()
        return
      }
      const result = await onSubmit?.({
        title: title.trim(),
        description: description.trim(),
        type: "ROUTE_REQUEST",
        routes: [{ location: from.trim() }, { location: to.trim() }],
        tags,
        clientMutationId: mutationKey,
      })
      // Only explicit `true` counts as success — a void/no-op handler must
      // never clear the composer (same vanish-class guard as ShareRouteModal).
      if (result !== true) {
        setSubmitting(false)
        return // failed — keep input, allow retry
      }
      reset()
      setMutationKey(newRequestKey())
      onClose()
    } catch {
      // Parent threw; allow retry
      setSubmitting(false)
    }
  }

  const fieldError = (key: keyof typeof errors) =>
    showErrors && errors[key] ? (
      <p className="text-xs text-error-text mt-1">{errors[key]}</p>
    ) : null

  return (
    <AppModal open={isOpen} onClose={handleClose} size="lg">
      <div className="flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-6 py-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-circle bg-warning text-warning-text flex items-center justify-center shrink-0">
              <ClipboardList size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{isEditing ? "Edit Route Request" : "Request a Route"}</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {isEditing
                  ? "Update your request — it stays a request, never a route."
                  : "Ask the community for a route you need"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-primary">
              What do you need? <span className="text-error-text">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Route from Ikeja to Lekki on a budget"'
              maxLength={100}
              className={inputClass}
            />
            {fieldError("title")}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-text-primary">
              Details <span className="text-error-text">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Time of day, budget, vehicle preference, luggage…"
              rows={3}
              maxLength={500}
              className={`${inputClass} h-auto py-2.5 resize-y min-h-[72px]`}
            />
            {fieldError("description")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-primary">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} className="text-primary" /> From <span className="text-error-text">*</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); queueLocFetch(e.target.value, "from"); }}
                  onFocus={() => setFromFocused(true)}
                  onBlur={() => setTimeout(() => setFromFocused(false), 160)}
                  placeholder="Starting point"
                  maxLength={120}
                  autoComplete="off"
                  aria-label="Starting point (location suggestions appear as you type)"
                  className={inputClass}
                />
                {fromLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                    <Loader2 size={14} className="animate-spin" />
                  </span>
                )}
                {fromFocused && fromHits.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-card border border-border radius-md shadow-lg max-h-[200px] overflow-y-auto">
                    {fromHits.map((h, i) => (
                      <button
                        key={`${h.lat},${h.lon},${i}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setFrom(h.display_name); setFromHits([]); setFromFocused(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-text-primary border-none bg-transparent cursor-pointer hover:bg-bg-elevated font-sans"
                      >
                        <span className="flex items-center gap-2">
                          <MapPin size={12} className="shrink-0 text-text-muted" />
                          <span className="truncate">{h.display_name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fieldError("from")}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-text-primary">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} className="text-error" /> To <span className="text-error-text">*</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); queueLocFetch(e.target.value, "to"); }}
                  onFocus={() => setToFocused(true)}
                  onBlur={() => setTimeout(() => setToFocused(false), 160)}
                  placeholder="Destination"
                  maxLength={120}
                  autoComplete="off"
                  aria-label="Destination (location suggestions appear as you type)"
                  className={inputClass}
                />
                {toLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                    <Loader2 size={14} className="animate-spin" />
                  </span>
                )}
                {toFocused && toHits.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-card border border-border radius-md shadow-lg max-h-[200px] overflow-y-auto">
                    {toHits.map((h, i) => (
                      <button
                        key={`${h.lat},${h.lon},${i}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setTo(h.display_name); setToHits([]); setToFocused(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-text-primary border-none bg-transparent cursor-pointer hover:bg-bg-elevated font-sans"
                      >
                        <span className="flex items-center gap-2">
                          <MapPin size={12} className="shrink-0 text-text-muted" />
                          <span className="truncate">{h.display_name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fieldError("to")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-text-primary">Tags</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag()
                  }
                }}
                onBlur={addTag}
                placeholder="Add a tag and press Enter"
                maxLength={30}
                className={inputClass}
              />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 radius-pill text-xs font-medium bg-primary-muted text-primary border-none cursor-pointer font-sans hover:opacity-80"
                    aria-label={`Remove tag ${t}`}
                  >
                    #{t} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={handleClose}
            className="h-10 px-4 radius-md border border-border bg-bg-card text-sm font-medium text-text-secondary cursor-pointer font-sans hover:bg-bg-elevated transition-colors duration-fast"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 radius-md bg-primary text-white border-none text-sm font-semibold cursor-pointer font-sans hover:bg-primary-light transition-colors duration-fast disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {submitting ? (isEditing ? "Saving…" : "Posting…") : isEditing ? "Save Changes" : "Post Request"}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
