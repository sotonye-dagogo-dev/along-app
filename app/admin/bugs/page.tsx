"use client"

import Link from "next/link"
import React, { useState, useEffect } from "react"
import { Bug } from "lucide-react"

interface AdminBug {
  id: string
  title: string
  description: string
  category: string
  status: string
  createdAt: string
  reporter: { id: string; firstName: string; lastName: string; userName: string } | null
  reviewer: { id: string; firstName: string; lastName: string; userName: string } | null
}

const STATUS_OPTIONS = ["OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED"]

const statusColors: Record<string, string> = {
  OPEN: "bg-error text-error-text",
  TRIAGED: "bg-warning text-warning-text",
  IN_PROGRESS: "bg-info text-info-text",
  RESOLVED: "bg-success text-success-text",
  CLOSED: "bg-bg-elevated text-text-muted",
}

export default function AdminBugsPage() {
  const [bugs, setBugs] = useState<AdminBug[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")

  const load = async (status?: string) => {
    setLoading(true)
    try {
      const url = status ? `/api/admin/bugs?status=${status}` : "/api/admin/bugs"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      setBugs(data.bugs ?? [])
    } catch (err) { console.error("[AdminError]", err) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async (bugId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/bugs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bugId, status }),
      })
      if (!res.ok) throw new Error("Request failed")
      load(statusFilter || undefined)
    } catch (err) { console.error("[AdminError]", err) }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Bugs</h1>
          <div className="text-sm text-text-secondary">Bug reports from users</div>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); load(e.target.value || undefined) }}
            className="px-3 py-1.5 radius-md border border-border text-xs font-medium font-sans bg-bg-card text-text-primary cursor-pointer"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : bugs.length === 0 ? (
          <div className="text-center py-8 text-text-muted">No bugs found</div>
        ) : bugs.map((bug) => (
          <div key={bug.id} className="bg-bg-card border border-border radius-lg p-4 shadow-xs">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bug size={14} className="text-text-muted shrink-0" />
                <h3 className="text-sm font-semibold">{bug.title}</h3>
              </div>
              <span className={`inline-flex px-2 py-0.5 radius-pill text-[10px] font-semibold ${statusColors[bug.status] ?? "bg-bg-elevated text-text-secondary"}`}>
                {bug.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-text-secondary mb-3 line-clamp-2">{bug.description}</p>
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-text-muted">
                Reported by {bug.reporter ? <Link href={`/profile/${bug.reporter.userName}`} className="no-underline hover:underline text-text-secondary">{bug.reporter.firstName} {bug.reporter.lastName}</Link> : "Anonymous"} &middot; {new Date(bug.createdAt).toLocaleDateString()}
              </div>
              <div className="flex gap-1">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(bug.id, s)}
                    className={`px-2 py-0.5 radius-sm text-[10px] font-semibold border-none cursor-pointer transition-all duration-fast ${
                      bug.status === s ? "bg-primary text-text-inverse" : "bg-bg-elevated text-text-secondary hover:bg-bg-elevated"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
