"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Plus, Trash2, Sparkles, GripVertical, ChevronUp, ChevronDown, Pencil, Check, X } from "lucide-react"
import { AppInput, AppButton } from "@/app/components/ui"
import { inferConfigKind } from "@/app/lib/config/admin"
import { toastService } from "@/app/lib/services/toastService"
import { modalService } from "@/app/lib/services/modalService"
import {
  EARLY_ADOPTER_CONFIG_KEY,
  EARLY_ADOPTER_CONFIG_META,
  normalizeEarlyAdopterConfig,
} from "@/app/lib/config/earlyAdopter"

interface SiteConfigItem {
  id: string
  key: string
  value: unknown
  createdAt: string
  updatedAt: string
}

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<SiteConfigItem[]>([])
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

  const handleSave = async (key: string, value: unknown) => {
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) throw new Error("Request failed")
      load()
    } catch (err) { console.error("[AdminError]", err) }
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
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{EARLY_ADOPTER_CONFIG_META.title}</h3>
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
          <div>
            <AppButton onClick={handleEarlyAdopterSave} disabled={!eaDirty || eaSaving}>
              {eaSaving ? "Saving..." : "Save badge settings"}
            </AppButton>
          </div>
        </div>
      </div>

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
        <div className="text-xs text-text-muted">Drag cards or use arrows to reorder (display order only).</div>
        {loading ? (
          <div className="text-center py-8 text-text-muted bg-bg-card border border-border radius-lg">Loading...</div>
        ) : orderedConfigs.length === 0 ? (
          <div className="text-center py-8 text-text-muted bg-bg-card border border-border radius-lg">No configs found</div>
        ) : orderedConfigs.map((c) => {
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
                  <button
                    onClick={() => handleDelete(c.key)}
                    className="inline-flex items-center gap-1 px-2 py-1 radius-sm text-[10px] font-semibold bg-error text-error-text border-none cursor-pointer hover:bg-error-text hover:text-text-inverse transition-all duration-fast shrink-0"
                  >
                    <Trash2 size={10} /> Delete
                  </button>
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
