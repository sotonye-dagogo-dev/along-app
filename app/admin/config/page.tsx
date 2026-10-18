"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Plus, Trash2, Sparkles, Megaphone, GripVertical, ChevronUp, ChevronDown, Pencil, Check, X, RotateCcw, Settings2, Mail, Newspaper, ArrowRight } from "lucide-react"
import { AppInput, AppButton } from "@/app/components/ui"
import {
  inferConfigKind,
  ADMIN_SIMPLE_CONFIG_CARDS,
  ADMIN_DEDICATED_CONFIG_KEYS,
  ADMIN_STUDIO_LINKS,
  getAdminConfigDefault,
  type AdminSimpleCardMeta,
  type AdminConfigSource,
} from "@/app/lib/config/admin"
import {
  SITE_NOTICE_CONFIG,
  normalizeAnnouncements,
  isSafeAnnouncementHref,
  type NormalizedAnnouncement,
} from "@/app/lib/config/siteNotice"

/** Icon twin for each studio link — Lucide-only, metadata-keyed (never emoji). */
const STUDIO_LINK_ICONS = {
  "/admin/email": Mail,
  "/admin/blog": Newspaper,
} as const
import { toastService } from "@/app/lib/services/toastService"
import { modalService } from "@/app/lib/services/modalService"
import {
  EARLY_ADOPTER_CONFIG_KEY,
  EARLY_ADOPTER_CONFIG_META,
  normalizeEarlyAdopterConfig,
} from "@/app/lib/config/earlyAdopter"
import {
  FEED_DIVERSITY_CONFIG,
  FEED_DIVERSITY_CONFIG_KEY,
  FEED_DIVERSITY_CONFIG_META,
  normalizeFeedDiversityConfig,
} from "@/app/lib/config/feedAlgorithm"

interface SiteConfigItem {
  id: string
  key: string
  value: unknown
  createdAt: string
  updatedAt: string
  /**
   * DB-awareness flag from the merged API (Email/Blog Studio parity):
   * "default" = shipped fallback, no DB row yet; "customized" = DB row
   * over a shipped default; "custom" = ad-hoc key with no shipped default.
   * Older payloads omit it — treated as "custom".
   */
  source?: AdminConfigSource | string
}

interface ConfigDefaultEntry {
  key: string
  title: string
  description: string
  defaultValue: unknown
}

/** Token-paired source badge — visible in both themes. */
function SourceBadge({ source }: { source?: string }) {
  if (source === "customized") {
    return (
      <span title="Saved in the database over the shipped default" className="text-[10px] font-semibold px-1.5 py-0.5 radius-pill bg-info text-info-text border border-info-border uppercase shrink-0">
        Customized
      </span>
    )
  }
  if (source === "default") {
    return (
      <span title="Shipped default — no database row yet. Saving creates one." className="text-[10px] font-semibold px-1.5 py-0.5 radius-pill bg-bg-elevated text-text-secondary border border-border uppercase shrink-0">
        Default
      </span>
    )
  }
  return (
    <span title="Ad-hoc setting with no shipped default" className="text-[10px] font-semibold px-1.5 py-0.5 radius-pill bg-primary-muted text-primary border border-primary/20 uppercase shrink-0">
      Custom
    </span>
  )
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

/**
 * Generic no-code card for a simple config key — toggles / text / number
 * inputs driven entirely by ADMIN_SIMPLE_CONFIG_CARDS metadata (never raw
 * JSON), so non-programmer admins can configure the platform. Single-field
 * cards read/write a primitive; multi-field cards read/write an object
 * spread-merged over the shipped default (partial stored rows keep working).
 */
function SimpleConfigCard({
  meta,
  row,
  onSave,
  onRestore,
}: {
  meta: AdminSimpleCardMeta
  row: SiteConfigItem | undefined
  onSave: (key: string, value: unknown) => Promise<string | null>
  onRestore: (key: string) => void
}) {
  const shipped = useMemo(() => getAdminConfigDefault(meta.key)?.defaultValue, [meta.key])
  const effective: Record<string, unknown> | unknown = useMemo(() => {
    if (meta.fields.length === 1 && meta.fields[0].id === "value") return row?.value
    const base = isPlainRecord(shipped) ? { ...shipped } : {}
    if (isPlainRecord(row?.value)) return { ...base, ...row.value }
    return base
  }, [meta.fields, row?.value, shipped])
  const [drafts, setDrafts] = useState<Record<string, string | boolean> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = (id: string): string | boolean => {
    if (drafts && id in drafts) return drafts[id]
    if (meta.fields.length === 1 && meta.fields[0].id === "value") {
      const v = effective
      const f = meta.fields[0]
      if (f.type === "boolean") return v === true
      return String(v ?? "")
    }
    const obj = isPlainRecord(effective) ? effective : {}
    const f = meta.fields.find((x) => x.id === id)
    const v = obj[id]
    if (f?.type === "boolean") return v === true
    return String(v ?? "")
  }

  const dirty = useMemo(() => {
    if (!drafts) return false
    return meta.fields.some((f) => {
      const baseVal =
        meta.fields.length === 1 && f.id === "value"
          ? (f.type === "boolean" ? effective === true : String((effective as unknown) ?? ""))
          : (() => {
              const obj = isPlainRecord(effective) ? (effective as Record<string, unknown>) : {}
              const v = obj[f.id]
              return f.type === "boolean" ? v === true : String(v ?? "")
            })()
      return drafts[f.id] !== baseVal
    })
  }, [drafts, effective, meta.fields])

  const setDraft = (id: string, v: string | boolean) => {
    setError(null)
    setDrafts((p) => ({ ...(p ?? {}), [id]: v }))
  }

  const buildValue = (): { value: unknown; error?: string } => {
    if (meta.fields.length === 1 && meta.fields[0].id === "value") {
      const f = meta.fields[0]
      const raw = current("value")
      if (f.type === "boolean") return { value: raw === true }
      if (f.type === "number") {
        const n = Number(raw)
        if (!Number.isFinite(n)) return { value: undefined, error: "Enter a valid number" }
        return { value: Math.floor(n) === n ? n : n }
      }
      return { value: String(raw ?? "") }
    }
    const out: Record<string, unknown> = {}
    for (const f of meta.fields) {
      const raw = current(f.id)
      if (f.type === "boolean") {
        out[f.id] = raw === true
      } else if (f.type === "number") {
        const n = Number(raw)
        if (!Number.isFinite(n)) return { value: undefined, error: `Enter a valid number for ${f.label}` }
        out[f.id] = n
      } else {
        out[f.id] = String(raw ?? "")
      }
    }
    return { value: out }
  }

  const handleSave = async () => {
    const built = buildValue()
    if (built.error) {
      setError(built.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const err = await onSave(meta.key, built.value)
      if (err) {
        setError(err)
      } else {
        setDrafts(null)
      }
    } finally {
      setBusy(false)
    }
  }

  const customized = row?.source === "customized"
  const shippedPreview = (() => {
    try {
      const s = typeof shipped === "string" ? shipped : JSON.stringify(shipped)
      return s.length > 120 ? `${s.slice(0, 120)}…` : s
    } catch {
      return ""
    }
  })()

  return (
    <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs mb-6">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Settings2 size={16} className="text-primary shrink-0" />
        <h3 className="text-sm font-semibold">{meta.title}</h3>
        <SourceBadge source={row?.source ?? "default"} />
      </div>
      <p className="text-xs text-text-secondary mb-4">{meta.description}</p>
      <div className={`grid gap-3 ${meta.fields.length > 3 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} max-w-[640px]`}>
        {meta.fields.map((f) => (
          <label key={f.id} className={f.type === "boolean" ? "flex items-center gap-2 text-sm cursor-pointer" : "flex flex-col gap-1 text-sm"}>
            {f.type === "boolean" ? (
              <>
                <input
                  type="checkbox"
                  checked={current(f.id) === true}
                  onChange={(e) => setDraft(f.id, e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span>
                  {f.label}
                  <span className="block text-[11px] text-text-muted font-normal">{f.hint}</span>
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-text-secondary">{f.label}</span>
                <AppInput
                  type={f.type === "number" ? "number" : "text"}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={String(current(f.id) ?? "")}
                  onChange={(e) => setDraft(f.id, e.target.value)}
                  placeholder={f.placeholder}
                />
                <span className="text-[11px] text-text-muted leading-snug">{f.hint}</span>
              </>
            )}
          </label>
        ))}
      </div>
      {customized && (
        <p className="text-[11px] text-text-muted mt-3 max-w-[640px]" title={(() => { try { return typeof shipped === "string" ? shipped : JSON.stringify(shipped, null, 2) } catch { return "" } })()}>
          Customized — shipped default: <code className="font-mono">{shippedPreview || "—"}</code>
        </p>
      )}
      {error && <p className="text-xs text-error-text mt-3">{error}</p>}
      <div className="flex gap-2 mt-3 flex-wrap">
        <AppButton onClick={handleSave} disabled={!dirty || busy}>
          {busy ? "Saving..." : "Save"}
        </AppButton>
        {customized && (
          <AppButton variant="secondary" onClick={() => onRestore(meta.key)} disabled={busy}>
            <RotateCcw size={13} /> Restore to default
          </AppButton>
        )}
      </div>
    </div>
  )
}

const ANNOUNCEMENTS_KEY = SITE_NOTICE_CONFIG.siteConfigKeys.announcements

interface AnnouncementDraft {
  id: string
  body: string
  ctaLabel: string
  ctaHref: string
}

function toDraftRow(a?: Partial<NormalizedAnnouncement>, index = 0): AnnouncementDraft {
  return {
    id: a?.id ?? `ann-${Date.now().toString(36)}-${index}`,
    body: a?.body ?? "",
    ctaLabel: a?.ctaLabel ?? "",
    ctaHref: a?.ctaHref ?? "",
  }
}

/**
 * Bespoke Announcements list editor — no JSON. Multiple entries, each with
 * an optional CTA (label + internal/https link). Validates the same rules
 * the central validator enforces so bad rows never reach the API.
 */
function AnnouncementsCard({
  row,
  onSave,
  onRestore,
}: {
  row: SiteConfigItem | undefined
  onSave: (key: string, value: unknown) => Promise<string | null>
  onRestore: (key: string) => void
}) {
  const stored = useMemo(
    () => normalizeAnnouncements(row?.value).map((a) => toDraftRow(a)),
    [row?.value],
  )
  const [rows, setRows] = useState<AnnouncementDraft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const draft = rows ?? stored
  const maxItems = SITE_NOTICE_CONFIG.announcement.maxItems

  const dirty = useMemo(() => {
    if (!rows) return false
    return (
      rows.length !== stored.length ||
      rows.some((r, i) => {
        const s = stored[i]
        return !s || r.body !== s.body || r.ctaLabel !== s.ctaLabel || r.ctaHref !== s.ctaHref
      })
    )
  }, [rows, stored])

  const setRow = (index: number, patch: Partial<AnnouncementDraft>) => {
    setError(null)
    setRows((prev) => {
      const base = prev ?? draft
      return base.map((r, i) => (i === index ? { ...r, ...patch } : r))
    })
  }

  const addRow = () => {
    setError(null)
    if (draft.length >= maxItems) {
      setError(`At most ${maxItems} announcements at once`)
      return
    }
    setRows([...draft, toDraftRow(undefined, draft.length)])
  }

  const removeRow = (index: number) => {
    setError(null)
    setRows(draft.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    const bodies = draft.filter((r) => r.body.trim().length > 0)
    for (const [index, r] of bodies.entries()) {
      if (r.body.trim().length > SITE_NOTICE_CONFIG.announcement.maxChars) {
        setError(`Announcement #${index + 1}: body must be <= ${SITE_NOTICE_CONFIG.announcement.maxChars} characters`)
        return
      }
      if (r.ctaHref.trim() && !r.ctaLabel.trim()) {
        setError(`Announcement #${index + 1}: add a CTA label or remove the CTA link`)
        return
      }
      if (r.ctaLabel.trim() && !r.ctaHref.trim()) {
        setError(`Announcement #${index + 1}: add a CTA link or remove the CTA label`)
        return
      }
      if (r.ctaHref.trim() && !isSafeAnnouncementHref(r.ctaHref.trim())) {
        setError(`Announcement #${index + 1}: CTA link must be an internal path (/…) or https:// URL`)
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      const value = bodies.map((r, index) => ({
        id: r.id || `ann-${index + 1}`,
        body: r.body.trim(),
        ctaLabel: r.ctaLabel.trim() || null,
        ctaHref: r.ctaHref.trim() || null,
      }))
      const err = await onSave(ANNOUNCEMENTS_KEY, value)
      if (err) setError(err)
      else setRows(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs mb-6">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Megaphone size={16} className="text-primary shrink-0" />
        <h3 className="text-sm font-semibold">Announcements</h3>
        <SourceBadge source={row?.source ?? "default"} />
      </div>
      <p className="text-xs text-text-secondary mb-4">
        Show one or more notices across the platform — each can carry an optional
        call-to-action button. Empty list hides them.
      </p>
      <div className="flex flex-col gap-3 max-w-[640px]">
        {draft.length === 0 && (
          <p className="text-xs text-text-muted">No announcements — the strips stay hidden.</p>
        )}
        {draft.map((r, index) => (
          <div key={r.id} className="border border-border radius-md p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-text-secondary uppercase">
                Announcement {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Remove announcement ${index + 1}`}
                className="w-7 h-7 rounded-md flex items-center justify-center border border-border bg-transparent text-error-text cursor-pointer hover:bg-bg-elevated"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold text-text-secondary">Message</span>
              <AppInput
                value={r.body}
                onChange={(e) => setRow(index, { body: e.target.value })}
                placeholder="e.g. New routes in Lagos are live!"
              />
              <span className="text-[11px] text-text-muted">
                Max {SITE_NOTICE_CONFIG.announcement.maxChars} characters.
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold text-text-secondary">CTA label (optional)</span>
                <AppInput
                  value={r.ctaLabel}
                  onChange={(e) => setRow(index, { ctaLabel: e.target.value })}
                  placeholder="e.g. See routes"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold text-text-secondary">CTA link (optional)</span>
                <AppInput
                  value={r.ctaHref}
                  onChange={(e) => setRow(index, { ctaHref: e.target.value })}
                  placeholder="/explore or https://…"
                />
              </label>
            </div>
            {(r.ctaLabel.trim() || r.ctaHref.trim()) && (
              <p className="text-[11px] text-text-muted">
                CTA needs both a label and a link — internal path (/…) or https:// only.
              </p>
            )}
          </div>
        ))}
        {error && <p className="text-xs text-error-text">{error}</p>}
        <div className="flex gap-2 flex-wrap">
          <AppButton variant="secondary" onClick={addRow} disabled={draft.length >= maxItems}>
            <Plus size={13} /> Add announcement
          </AppButton>
          <AppButton onClick={handleSave} disabled={!dirty || busy}>
            {busy ? "Saving..." : "Save announcements"}
          </AppButton>
          {row?.source === "customized" && (
            <AppButton variant="secondary" onClick={() => onRestore(ANNOUNCEMENTS_KEY)} disabled={busy}>
              <RotateCcw size={13} /> Restore to default
            </AppButton>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<SiteConfigItem[]>([])
  const [defaults, setDefaults] = useState<ConfigDefaultEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [newKind, setNewKind] = useState<"text" | "number" | "boolean" | "json">("text")
  const [order, setOrder] = useState<string[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/config")
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      const list: SiteConfigItem[] = data.configs ?? []
      setConfigs(list)
      setDefaults(Array.isArray(data.defaults) ? data.defaults : [])
      setOrder((prev) => {
        const keys = list.map((c) => c.key)
        const kept = prev.filter((k) => keys.includes(k))
        const fresh = keys.filter((k) => !kept.includes(k))
        return [...kept, ...fresh]
      })
    } catch (err) {
      console.error("[AdminError]", err)
      toastService.error("Failed to load config")
    } finally { setLoading(false) }
  }

  // --- Early Adopters badge card (admin-manageable, metadata-driven) ---
  const storedEarlyAdopter = useMemo(() => {
    const found = configs.find((c) => c.key === EARLY_ADOPTER_CONFIG_KEY)
    return normalizeEarlyAdopterConfig(found?.value)
  }, [configs])
  const [eaEnabled, setEaEnabled] = useState<boolean | null>(null)
  const [eaLimit, setEaLimit] = useState<string>("")
  const [eaTemplate, setEaTemplate] = useState<string>("")
  const [eaSaving, setEaSaving] = useState(false)
  const [eaError, setEaError] = useState<string | null>(null)
  const eaDirty = useMemo(() => {
    if (eaEnabled === null) return false
    return (
      eaEnabled !== storedEarlyAdopter.enabled ||
      eaLimit !== String(storedEarlyAdopter.limit) ||
      eaTemplate !== storedEarlyAdopter.badgeLabelTemplate
    )
  }, [eaEnabled, eaLimit, eaTemplate, storedEarlyAdopter])

  useEffect(() => {
    // Sync local editors when the stored config loads/changes (not while dirty-editing).
    if (eaEnabled === null) {
      setEaEnabled(storedEarlyAdopter.enabled)
      setEaLimit(String(storedEarlyAdopter.limit))
      setEaTemplate(storedEarlyAdopter.badgeLabelTemplate)
    }
  }, [storedEarlyAdopter, eaEnabled])

  // --- Feed Diversity card (admin-manageable, metadata-driven) ---
  const storedDiversity = useMemo(() => {
    const found = configs.find((c) => c.key === FEED_DIVERSITY_CONFIG_KEY)
    return normalizeFeedDiversityConfig(found?.value)
  }, [configs])
  const [fdMaxConsecutive, setFdMaxConsecutive] = useState<string | null>(null)
  const [fdLookahead, setFdLookahead] = useState<string | null>(null)
  const [fdJitter, setFdJitter] = useState<string | null>(null)
  const [fdSaving, setFdSaving] = useState(false)
  const [fdError, setFdError] = useState<string | null>(null)
  const fdDirty = useMemo(() => {
    if (fdMaxConsecutive === null || fdLookahead === null || fdJitter === null) return false
    return (
      fdMaxConsecutive !== String(storedDiversity.maxConsecutiveFromSameAuthor) ||
      fdLookahead !== String(storedDiversity.lookaheadWindow) ||
      fdJitter !== String(storedDiversity.jitterWeight)
    )
  }, [fdMaxConsecutive, fdLookahead, fdJitter, storedDiversity])

  useEffect(() => {
    if (fdMaxConsecutive === null) {
      setFdMaxConsecutive(String(storedDiversity.maxConsecutiveFromSameAuthor))
      setFdLookahead(String(storedDiversity.lookaheadWindow))
      setFdJitter(String(storedDiversity.jitterWeight))
    }
  }, [storedDiversity, fdMaxConsecutive])

  const handleDiversitySave = async () => {
    setFdSaving(true)
    setFdError(null)
    try {
      const maxC = Number(fdMaxConsecutive)
      const look = Number(fdLookahead)
      const jit = Number(fdJitter)
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: FEED_DIVERSITY_CONFIG_KEY,
          value: {
            maxConsecutiveFromSameAuthor: Number.isFinite(maxC) ? Math.floor(maxC) : fdMaxConsecutive,
            lookaheadWindow: Number.isFinite(look) ? Math.floor(look) : fdLookahead,
            jitterWeight: Number.isFinite(jit) ? jit : fdJitter,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed")
      toastService.success("Feed diversity saved")
      setFdMaxConsecutive(null)
      await load()
    } catch (err) {
      setFdError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setFdSaving(false)
    }
  }

  const handleDiversityReset = async () => {
    setFdSaving(true)
    setFdError(null)
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: FEED_DIVERSITY_CONFIG_KEY, value: { ...FEED_DIVERSITY_CONFIG } }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed")
      toastService.success("Feed diversity reset to defaults")
      setFdMaxConsecutive(null)
      await load()
    } catch (err) {
      setFdError(err instanceof Error ? err.message : "Failed to reset")
    } finally {
      setFdSaving(false)
    }
  }

  const handleEarlyAdopterSave = async () => {
    if (eaEnabled === null) return
    setEaSaving(true)
    setEaError(null)
    try {
      const limitNum = Number(eaLimit)
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: EARLY_ADOPTER_CONFIG_KEY,
          value: {
            enabled: eaEnabled,
            limit: Number.isFinite(limitNum) ? Math.floor(limitNum) : eaLimit,
            badgeLabelTemplate: eaTemplate,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Request failed")
      setEaEnabled(null)
      await load()
    } catch (err) {
      setEaError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setEaSaving(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (key: string, value: unknown): Promise<string | null> => {
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = (data as { error?: string } | null)?.error ?? "Request failed"
        toastService.error(msg)
        return msg
      }
      toastService.success(`Saved ${key}`)
      load()
      return null
    } catch (err) {
      console.error("[AdminError]", err)
      toastService.error("Save failed")
      return "Save failed"
    }
  }

  /**
   * Restore-to-default (Email/Blog Studio parity): deletes the DB row so
   * the hardcoded fallback shines through again. Hardcoded updates never
   * overwrite DB rows automatically — this is the explicit opt-in path.
   */
  const handleRestore = async (key: string) => {
    const def = defaults.find((d) => d.key === key) ?? getAdminConfigDefault(key)
    modalService.confirm({
      title: `Restore "${key}" to default?`,
      description: def
        ? `The saved override is removed and the shipped default applies again. You can customize it again any time.`
        : "The saved setting is removed.",
      variant: "sensitive",
      confirmLabel: "Restore",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          try {
            const res = await fetch("/api/admin/config", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restore: key }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Request failed")
            toastService.success(`Restored ${key} to default`)
            load()
          } catch (err) {
            console.error("[AdminError]", err)
            toastService.error(err instanceof Error ? err.message : "Restore failed")
          }
        })()
      },
    })
  }

  const handleDelete = async (key: string) => {
    modalService.confirm({
      title: `Delete config "${key}"?`,
      description: "This removes the setting. The app will fall back to its default.",
      variant: "destructive",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          try {
            const res = await fetch("/api/admin/config", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key }),
            })
            if (!res.ok) throw new Error("Request failed")
            toastService.success(`Deleted ${key}`)
            load()
          } catch (err) {
            console.error("[AdminError]", err)
            toastService.error("Delete failed")
          }
        })()
      },
    })
  }

  const parseNewValue = (): { value: unknown; error?: string } => {
    if (newKind === "boolean") {
      const v = newValue.trim().toLowerCase()
      if (["true", "1", "on", "yes"].includes(v)) return { value: true }
      if (["false", "0", "off", "no", ""].includes(v)) return { value: v === "" ? false : false }
      return { value: undefined, error: "Enter true or false" }
    }
    if (newKind === "number") {
      const n = Number(newValue)
      if (!Number.isFinite(n)) return { value: undefined, error: "Enter a valid number" }
      return { value: n }
    }
    if (newKind === "json") {
      try { return { value: JSON.parse(newValue) } }
      catch { return { value: undefined, error: "Invalid JSON" } }
    }
    return { value: newValue }
  }

  const handleAdd = () => {
    if (!newKey.trim()) return
    const parsed = parseNewValue()
    if (parsed.error) {
      toastService.error(parsed.error)
      return
    }
    handleSave(newKey.trim(), parsed.value)
    setNewKey("")
    setNewValue("")
  }

  const orderedConfigs = useMemo(() => {
    if (order.length === 0) return configs
    const map = new Map(configs.map((c) => [c.key, c]))
    return order.filter((k) => map.has(k)).map((k) => map.get(k)!) as SiteConfigItem[]
  }, [configs, order])

  /**
   * Raw-list rows: only ad-hoc keys. Every shipped default has a dedicated
   * no-code card above (Early Adopters / Feed Diversity / simple cards) and
   * studio-managed keys (blog + email) render as studio link cards instead,
   * so the raw JSON list never duplicates them — one editor per key.
   */
  const dedicatedKeys = useMemo(
    () => new Set<string>(ADMIN_DEDICATED_CONFIG_KEYS as unknown as string[]),
    []
  )
  const rawConfigs = useMemo(
    () => orderedConfigs.filter((c) => !dedicatedKeys.has(c.key)),
    [orderedConfigs, dedicatedKeys]
  )
  const rowFor = (key: string) => configs.find((c) => c.key === key)

  const moveKey = (key: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const arr = prev.length ? [...prev] : configs.map((c) => c.key)
      const i = arr.indexOf(key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= arr.length) return arr
      const [item] = arr.splice(i, 1)
      arr.splice(j, 0, item)
      return arr
    })
  }

  const startEdit = (c: SiteConfigItem) => {
    setEditingKey(c.key)
    setEditError(null)
    const kind = inferConfigKind(c.key, c.value)
    if (kind === "json") setEditDraft(typeof c.value === "string" ? c.value : JSON.stringify(c.value, null, 2))
    else setEditDraft(String(c.value ?? ""))
  }

  const commitEdit = (c: SiteConfigItem) => {
    const kind = inferConfigKind(c.key, c.value)
    let value: unknown = editDraft
    if (kind === "boolean") {
      const v = editDraft.trim().toLowerCase()
      if (!["true", "false", "1", "0", "on", "off", "yes", "no"].includes(v)) {
        setEditError("Enter true or false")
        return
      }
      value = ["true", "1", "on", "yes"].includes(v)
    } else if (kind === "number") {
      const n = Number(editDraft)
      if (!Number.isFinite(n)) {
        setEditError("Enter a valid number")
        return
      }
      value = n
    } else if (kind === "json") {
      try { value = JSON.parse(editDraft) }
      catch { setEditError("Invalid JSON"); return }
    }
    setEditingKey(null)
    setEditError(null)
    handleSave(c.key, value)
  }

  const toggleBoolean = (c: SiteConfigItem) => {
    handleSave(c.key, !(c.value === true))
  }

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">Config</h1>
          <div className="text-sm text-text-secondary truncate">Site configuration settings</div>
        </div>
      </div>

      <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs mb-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{EARLY_ADOPTER_CONFIG_META.title}</h3>
          <SourceBadge source={rowFor(EARLY_ADOPTER_CONFIG_KEY)?.source ?? "default"} />
        </div>
        <p className="text-xs text-text-secondary mb-4">{EARLY_ADOPTER_CONFIG_META.description}</p>
        <div className="flex flex-col gap-3 max-w-[560px]">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={eaEnabled ?? storedEarlyAdopter.enabled}
              onChange={(e) => setEaEnabled(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            Show badge on profiles
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold text-text-secondary">First N users</span>
            <AppInput
              type="number"
              min={1}
              value={eaLimit || String(storedEarlyAdopter.limit)}
              onChange={(e) => setEaLimit(e.target.value)}
              placeholder="e.g. 100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold text-text-secondary">Badge label (use {"{N}"} and {"{rank}"})</span>
            <AppInput
              value={eaTemplate || storedEarlyAdopter.badgeLabelTemplate}
              onChange={(e) => setEaTemplate(e.target.value)}
              placeholder="First {N} Users #{rank}"
            />
          </label>
          {eaError && <p className="text-xs text-error-text">{eaError}</p>}
          <div className="flex gap-2 flex-wrap">
            <AppButton onClick={handleEarlyAdopterSave} disabled={!eaDirty || eaSaving}>
              {eaSaving ? "Saving..." : "Save badge settings"}
            </AppButton>
            {rowFor(EARLY_ADOPTER_CONFIG_KEY)?.source === "customized" && (
              <AppButton variant="secondary" onClick={() => handleRestore(EARLY_ADOPTER_CONFIG_KEY)} disabled={eaSaving}>
                <RotateCcw size={13} /> Restore to default
              </AppButton>
            )}
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs mb-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{FEED_DIVERSITY_CONFIG_META.title}</h3>
          <SourceBadge source={rowFor(FEED_DIVERSITY_CONFIG_KEY)?.source ?? "default"} />
        </div>
        <p className="text-xs text-text-secondary mb-4">{FEED_DIVERSITY_CONFIG_META.description}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[640px]">
          {FEED_DIVERSITY_CONFIG_META.fields.map((f) => {
            const val =
              f.id === "maxConsecutiveFromSameAuthor" ? (fdMaxConsecutive ?? String(storedDiversity.maxConsecutiveFromSameAuthor))
              : f.id === "lookaheadWindow" ? (fdLookahead ?? String(storedDiversity.lookaheadWindow))
              : (fdJitter ?? String(storedDiversity.jitterWeight));
            const setVal =
              f.id === "maxConsecutiveFromSameAuthor" ? setFdMaxConsecutive
              : f.id === "lookaheadWindow" ? setFdLookahead
              : setFdJitter;
            return (
              <label key={f.id} className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold text-text-secondary">{f.label}</span>
                <AppInput
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                />
                <span className="text-[11px] text-text-muted leading-snug">{f.hint}</span>
              </label>
            );
          })}
        </div>
        {fdError && <p className="text-xs text-error-text mt-3">{fdError}</p>}
        <div className="flex gap-2 mt-3">
          <AppButton onClick={handleDiversitySave} disabled={!fdDirty || fdSaving}>
            {fdSaving ? "Saving..." : "Save diversity settings"}
          </AppButton>
          <AppButton variant="secondary" onClick={handleDiversityReset} disabled={fdSaving}>
            Reset to defaults
          </AppButton>
        </div>
      </div>

      {/*
        Studio-managed sections (blog + email) render as link cards, never
        as editors: the Email/Blog Studios ship visual builders, previews,
        and send flows the generic page cannot offer. Metadata-driven via
        ADMIN_STUDIO_LINKS — future studios join by appending one entry.
      */}
      {ADMIN_STUDIO_LINKS.map((studio) => {
        const StudioIcon = STUDIO_LINK_ICONS[studio.href]
        const managed = studio.keys
          .map((k) => rowFor(k))
          .filter((r): r is SiteConfigItem => !!r)
        const customized = managed.filter((r) => r.source === "customized").length
        return (
          <div key={studio.href} className="bg-bg-card border border-border radius-lg p-5 shadow-xs mb-6">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StudioIcon size={16} className="text-primary shrink-0" />
              <h3 className="text-sm font-semibold">{studio.title}</h3>
              {customized > 0 && (
                <span title={`${customized} saved override${customized === 1 ? "" : "s"} live in the studio`} className="text-[10px] font-semibold px-1.5 py-0.5 radius-pill bg-info text-info-text border border-info-border uppercase shrink-0">
                  Customized
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mb-4">{studio.description}</p>
            <Link
              href={studio.href}
              className="inline-flex items-center gap-1.5 px-3 py-2 radius-md bg-primary text-white text-xs font-semibold no-underline hover:bg-primary-light transition-colors duration-fast"
            >
              {studio.ctaLabel} <ArrowRight size={13} />
            </Link>
          </div>
        )
      })}

      {/*
        Rich announcements (multiple + optional CTA) — bespoke list editor,
        metadata-registered under the same SiteConfig store. Sits just above
        the simple notice cards (maintenance / refresh / banner) so all
        notice controls stay together.
      */}
      <AnnouncementsCard
        row={rowFor(ANNOUNCEMENTS_KEY)}
        onSave={handleSave}
        onRestore={handleRestore}
      />

      {ADMIN_SIMPLE_CONFIG_CARDS.map((meta) => (
        <SimpleConfigCard
          key={meta.key}
          meta={meta}
          row={rowFor(meta.key)}
          onSave={handleSave}
          onRestore={handleRestore}
        />
      ))}

      <div className="bg-bg-card border border-border radius-lg p-4 sm:p-5 shadow-xs mb-6 min-w-0">
        <h3 className="text-sm font-semibold mb-1">Add new config</h3>
        <p className="text-xs text-text-secondary mb-3">Pick a type — no JSON needed for simple values.</p>
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[160px]">
            <AppInput
              placeholder="Config key..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as typeof newKind)}
            aria-label="Value type"
            className="px-3 py-2 radius-md border border-border text-xs font-medium bg-bg-card text-text-primary cursor-pointer"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">On/Off</option>
            <option value="json">Advanced (JSON)</option>
          </select>
          <div className="flex-[2] min-w-[200px]">
            {newKind === "boolean" ? (
              <select
                value={newValue === "" ? "true" : newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full px-3 py-2 radius-md border border-border text-xs bg-bg-card text-text-primary cursor-pointer"
                aria-label="Boolean value"
              >
                <option value="true">On (true)</option>
                <option value="false">Off (false)</option>
              </select>
            ) : (
              <AppInput
                placeholder={newKind === "number" ? "e.g. 100" : newKind === "json" ? '{"key":"value"}' : "Value..."}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            )}
          </div>
          <AppButton onClick={handleAdd}><Plus size={14} /> Add</AppButton>
        </div>
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="text-xs text-text-muted">Custom settings (ad-hoc keys) — shipped defaults live in the cards above. Drag cards or use arrows to reorder (display order only).</div>
        {loading ? (
          <div className="text-center py-8 text-text-muted bg-bg-card border border-border radius-lg">Loading...</div>
        ) : rawConfigs.length === 0 ? (
          <div className="text-center py-8 text-text-muted bg-bg-card border border-border radius-lg">No custom settings — everything is on shipped defaults</div>
        ) : rawConfigs.map((c) => {
          const kind = inferConfigKind(c.key, c.value)
          const isEditing = editingKey === c.key
          const preview = typeof c.value === "string" ? c.value : JSON.stringify(c.value)
          return (
            <div
              key={c.id}
              draggable={!isEditing}
              onDragStart={() => setDragKey(c.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!dragKey || dragKey === c.key) return
                setOrder((prev) => {
                  const arr = prev.length ? [...prev] : configs.map((x) => x.key)
                  const from = arr.indexOf(dragKey)
                  const to = arr.indexOf(c.key)
                  if (from < 0 || to < 0) return arr
                  const [item] = arr.splice(from, 1)
                  arr.splice(to, 0, item)
                  return arr
                })
                setDragKey(null)
              }}
              className="bg-bg-card border border-border radius-lg p-3 sm:p-4 shadow-xs flex flex-col gap-2 min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="cursor-grab text-text-muted shrink-0" title="Drag to reorder" aria-hidden="true">
                  <GripVertical size={14} />
                </span>
                <span className="flex gap-0.5 shrink-0">
                  <button onClick={() => moveKey(c.key, -1)} aria-label={`Move ${c.key} up`} className="w-6 h-6 grid place-items-center radius-sm border border-border bg-bg-base text-text-secondary hover:text-text-primary cursor-pointer">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => moveKey(c.key, 1)} aria-label={`Move ${c.key} down`} className="w-6 h-6 grid place-items-center radius-sm border border-border bg-bg-base text-text-secondary hover:text-text-primary cursor-pointer">
                    <ChevronDown size={12} />
                  </button>
                </span>
                <code className="font-mono text-xs font-semibold truncate flex-1 min-w-0" title={c.key}>{c.key}</code>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 radius-pill bg-bg-elevated text-text-secondary uppercase shrink-0">{kind}</span>
                <SourceBadge source={c.source} />
                <span className="text-[10px] text-text-muted shrink-0 hidden sm:inline">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </div>
              {!isEditing ? (
                <div className="flex items-center gap-2 min-w-0 pl-6">
                  {kind === "boolean" ? (
                    <button
                      role="switch"
                      aria-checked={c.value === true}
                      onClick={() => toggleBoolean(c)}
                      className={`relative w-10 h-5 radius-pill border-none cursor-pointer shrink-0 transition-colors ${c.value === true ? "bg-success" : "bg-bg-elevated"}`}
                      title="Toggle on/off"
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-circle bg-white transition-all ${c.value === true ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  ) : null}
                  <span className="font-mono text-[11px] text-text-secondary truncate flex-1 min-w-0" title={preview}>{preview}</span>
                  <button
                    onClick={() => startEdit(c)}
                    className="inline-flex items-center gap-1 px-2 py-1 radius-sm text-[10px] font-semibold bg-bg-elevated text-text-secondary border border-border cursor-pointer hover:text-primary shrink-0"
                  >
                    <Pencil size={10} /> Edit
                  </button>
                  {getAdminConfigDefault(c.key) ? (
                    <button
                      onClick={() => handleRestore(c.key)}
                      className="inline-flex items-center gap-1 px-2 py-1 radius-sm text-[10px] font-semibold bg-bg-elevated text-text-secondary border border-border cursor-pointer hover:text-primary shrink-0"
                      title="Remove the saved override so the shipped default applies again"
                    >
                      <RotateCcw size={10} /> Restore to default
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(c.key)}
                      className="inline-flex items-center gap-1 px-2 py-1 radius-sm text-[10px] font-semibold bg-error text-error-text border-none cursor-pointer hover:bg-error-text hover:text-text-inverse transition-all duration-fast shrink-0"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pl-6">
                  {kind === "boolean" ? (
                    <select
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="px-3 py-2 radius-md border border-border text-xs bg-bg-card text-text-primary cursor-pointer max-w-[240px]"
                    >
                      <option value="true">On (true)</option>
                      <option value="false">Off (false)</option>
                    </select>
                  ) : kind === "number" ? (
                    <AppInput type="number" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} />
                  ) : kind === "json" ? (
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={4}
                      spellCheck={false}
                      className="w-full px-3 py-2 radius-md border border-border font-mono text-[11px] bg-bg-base text-text-primary resize-y"
                    />
                  ) : (
                    <AppInput value={editDraft} onChange={(e) => setEditDraft(e.target.value)} />
                  )}
                  {editError && <p className="text-xs text-error-text">{editError}</p>}
                  <div className="flex gap-1.5">
                    <button onClick={() => commitEdit(c)} className="inline-flex items-center gap-1 px-2.5 py-1 radius-sm text-[11px] font-semibold bg-primary text-white border-none cursor-pointer">
                      <Check size={11} /> Save
                    </button>
                    <button onClick={() => { setEditingKey(null); setEditError(null) }} className="inline-flex items-center gap-1 px-2.5 py-1 radius-sm text-[11px] font-semibold bg-bg-elevated text-text-secondary border border-border cursor-pointer">
                      <X size={11} /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
