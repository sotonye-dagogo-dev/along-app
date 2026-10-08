"use client"

import { useState, useCallback } from "react"
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

interface RequestRouteModalProps {
  isOpen: boolean
  onClose: () => void
  /** Return false to keep the modal open (e.g. submission failed). */
  onSubmit?: (data: RouteRequestBody) => boolean | void | Promise<boolean | void>
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

export default function RequestRouteModal({ isOpen, onClose, onSubmit }: RequestRouteModalProps) {
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
      const result = await onSubmit?.({
        title: title.trim(),
        description: description.trim(),
        type: "ROUTE_REQUEST",
        routes: [{ location: from.trim() }, { location: to.trim() }],
        tags,
        clientMutationId: mutationKey,
      })
      if (result === false) {
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
              <h2 className="text-lg font-semibold tracking-tight">Request a Route</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                Ask the community for a route you need
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
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="Starting point"
                maxLength={120}
                className={inputClass}
              />
              {fieldError("from")}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-text-primary">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} className="text-error" /> To <span className="text-error-text">*</span>
                </span>
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Destination"
                maxLength={120}
                className={inputClass}
              />
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
            {submitting ? "Posting…" : "Post Request"}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
