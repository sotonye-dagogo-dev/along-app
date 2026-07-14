"use client"

import React, { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { AppInput, AppButton } from "@/app/components/ui"

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
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Config</h1>
          <div className="text-sm text-text-secondary">Site configuration settings</div>
        </div>
      </div>

      <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs mb-6">
        <h3 className="text-sm font-semibold mb-3">Add new config</h3>
        <div className="flex gap-2">
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
