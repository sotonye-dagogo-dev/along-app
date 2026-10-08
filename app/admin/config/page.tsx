"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Plus, Trash2, Sparkles } from "lucide-react"
import { AppInput, AppButton } from "@/app/components/ui"
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

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/config")
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      setConfigs(data.configs ?? [])
    } catch (err) { console.error("[AdminError]", err) } finally { setLoading(false) }
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
    if (!confirm(`Delete config "${key}"?`)) return
    try {
      const res = await fetch("/api/admin/config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) throw new Error("Request failed")
      load()
    } catch (err) { console.error("[AdminError]", err) }
  }

  const handleAdd = () => {
    if (!newKey.trim()) return
    let parsed: unknown = newValue
    try { parsed = JSON.parse(newValue) } catch { /* keep as string */ }
    handleSave(newKey.trim(), parsed)
    setNewKey("")
    setNewValue("")
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Config</h1>
          <div className="text-sm text-text-secondary">Site configuration settings</div>
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

      <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs mb-6">
        <h3 className="text-sm font-semibold mb-3">Add new config</h3>
        <div className="flex flex-wrap gap-2">
          <div className="flex-1">
            <AppInput
              placeholder="Config key..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <div className="flex-[2]">
            <AppInput
              placeholder='Value (JSON or string)...'
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          </div>
          <AppButton onClick={handleAdd}><Plus size={14} /> Add</AppButton>
        </div>
      </div>

      <div className="overflow-x-auto radius-lg border border-border bg-bg-card shadow-xs">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-bg-elevated">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Key</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Value</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Updated</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-text-muted">Loading...</td></tr>
            ) : configs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-text-muted">No configs found</td></tr>
            ) : configs.map((c) => (
              <tr key={c.id} className="hover:bg-bg-elevated transition-colors duration-fast">
                <td className="px-4 py-3 border-b border-border font-mono text-xs font-semibold">{c.key}</td>
                <td className="px-4 py-3 border-b border-border font-mono text-[11px] text-text-secondary max-w-[400px] truncate">
                  {typeof c.value === "string" ? c.value : JSON.stringify(c.value)}
                </td>
                <td className="px-4 py-3 border-b border-border text-text-muted">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 border-b border-border">
                  <button
                    onClick={() => handleDelete(c.key)}
                    className="inline-flex items-center gap-1 px-2 py-1 radius-sm text-[10px] font-semibold bg-error text-error-text border-none cursor-pointer hover:bg-error-text hover:text-text-inverse transition-all duration-fast"
                  >
                    <Trash2 size={10} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
