"use client"

import Link from "next/link"
import React, { useState, useEffect, useMemo } from "react"
import { Bug, Flag, ExternalLink } from "lucide-react"
import { modalService } from "@/app/lib/services/modalService"
import { toastService } from "@/app/lib/services/toastService"
import { MODERATION_CONFIG } from "@/app/lib/config"
import { ADMIN_BULK_SELECT_META } from "@/app/lib/config/admin"
import { useBulkSelection } from "@/app/lib/hooks/useBulkSelection"

interface AdminBug {
  id: string
  title: string
  description: string
  category: string
  status: string
  createdAt: string
  metadata?: { kind?: string; reason?: string; commentId?: string } | null
  post?: { id: string; title: string; userId: string } | null
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

const ACTION_CONFIRM: Record<string, { title: string; description: string }> = {
  DISMISS: { title: "Dismiss this report?", description: "The report will be closed and the reporter notified of the outcome." },
  ARCHIVE_POST: { title: MODERATION_CONFIG.adminConfirmArchiveTitle, description: MODERATION_CONFIG.adminConfirmArchiveDescription },
  REMOVE_POST: { title: MODERATION_CONFIG.adminConfirmRemoveTitle, description: MODERATION_CONFIG.adminConfirmRemoveDescription },
}

export default function AdminBugsPage() {
  const [bugs, setBugs] = useState<AdminBug[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [kindFilter, setKindFilter] = useState<"all" | "reports" | "bugs">("all")
  const [bulkBusy, setBulkBusy] = useState(false)

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

  const visible = useMemo(() => {
    if (kindFilter === "all") return bugs
    return bugs.filter((b) =>
      kindFilter === "reports" ? b.metadata?.kind === "post-report" : b.metadata?.kind !== "post-report"
    )
  }, [bugs, kindFilter])
  const bulk = useBulkSelection(visible, (b) => b.id)

  const handleBulkStatus = async (status: string) => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch("/api/admin/bugs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bugIds: ids, status }),
      })
      if (!res.ok) throw new Error("Request failed")
      bulk.clear()
      toastService.success(`${ids.length} report(s) → ${status}`)
      load(statusFilter || undefined)
    } catch (err) {
      console.error("[AdminError]", err)
      toastService.error("Bulk update failed")
    } finally {
      setBulkBusy(false)
    }
  }

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

  /** End-to-end moderation: bug status + post action in one ACID transaction,
   *  reporter notified of the outcome (anonymity kept both ways). */
  const handleModeration = (bug: AdminBug, action: "DISMISS" | "ARCHIVE_POST" | "REMOVE_POST") => {
    const confirm = ACTION_CONFIRM[action]
    modalService.confirm({
      title: confirm.title,
      description: confirm.description,
      variant: action === "DISMISS" ? "sensitive" : "destructive",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          try {
            const res = await fetch("/api/admin/bugs", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bugId: bug.id,
                status: action === "DISMISS" ? "CLOSED" : "RESOLVED",
                action,
              }),
            })
            if (!res.ok) throw new Error("Request failed")
            toastService.success(MODERATION_CONFIG.adminActionSuccess)
            load(statusFilter || undefined)
          } catch (err) {
            console.error("[AdminError]", err)
            toastService.error(MODERATION_CONFIG.adminActionError)
          }
        })()
      },
    })
  }

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">Bugs</h1>
          <div className="text-sm text-text-secondary truncate">Bug reports from users</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | "reports" | "bugs")}
            className="px-3 py-1.5 radius-md border border-border text-xs font-medium font-sans bg-bg-card text-text-primary cursor-pointer"
            aria-label="Filter by kind"
          >
            <option value="all">Bugs + Reports</option>
            <option value="reports">Post reports</option>
            <option value="bugs">Bugs only</option>
          </select>
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

      <div className="flex flex-wrap items-center gap-2 bg-bg-card border border-border radius-lg px-3 py-2 text-xs min-w-0">
        <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer shrink-0">
          <input type="checkbox" checked={visible.length > 0 && visible.every((b) => bulk.selected.has(b.id))} onChange={() => (bulk.count === visible.length && visible.length > 0 ? bulk.clear() : bulk.selectAll())} className="w-4 h-4 accent-primary cursor-pointer" aria-label="Select all reports" />
          Select all
        </label>
        <button onClick={bulk.invert} className="px-2 py-1 radius-sm border border-border bg-bg-base text-text-secondary hover:text-text-primary cursor-pointer">Invert</button>
        <button onClick={bulk.undo} disabled={!bulk.canUndo} className="px-2 py-1 radius-sm border border-border bg-bg-base text-text-secondary hover:text-text-primary cursor-pointer disabled:opacity-50">Undo select</button>
        <button onClick={bulk.clear} className="px-2 py-1 radius-sm border border-border bg-bg-base text-text-secondary hover:text-text-primary cursor-pointer">Clear</button>
        <span className="text-text-muted shrink-0" aria-live="polite">{bulk.count} selected</span>
        <span className="hidden sm:inline text-text-muted">|</span>
        <span className="inline-flex items-center gap-1 flex-wrap">
          <span className="text-text-muted">Quick:</span>
          {ADMIN_BULK_SELECT_META.quickPresets.map((p) => (
            <button key={p.id} onClick={() => bulk.selectFirstN(p.count)} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary hover:text-primary cursor-pointer border-none">{p.label}</button>
          ))}
        </span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <button onClick={() => handleBulkStatus("TRIAGED")} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary border border-border cursor-pointer disabled:opacity-50">Triage</button>
          <button onClick={() => handleBulkStatus("RESOLVED")} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-success text-success-text border-none cursor-pointer disabled:opacity-50">Resolve</button>
          <button onClick={() => handleBulkStatus("CLOSED")} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary border border-border cursor-pointer disabled:opacity-50">Close</button>
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0">
        {loading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-8 text-text-muted">No bugs found</div>
        ) : visible.map((bug) => {
          const isReport = bug.metadata?.kind === "post-report"
          return (
          <div key={bug.id} className={`bg-bg-card border border-border radius-lg p-4 shadow-xs min-w-0 overflow-hidden ${bulk.selected.has(bug.id) ? "ring-1 ring-primary" : ""}`}>
            <div className="flex items-start justify-between mb-2 gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={bulk.selected.has(bug.id)} onChange={() => bulk.toggle(bug.id)} aria-label={`Select ${bug.title}`} className="w-4 h-4 accent-primary cursor-pointer shrink-0" />
                {isReport ? <Flag size={14} className="text-warning-text shrink-0" /> : <Bug size={14} className="text-text-muted shrink-0" />}
                <h3 className="text-sm font-semibold truncate" title={bug.title}>{bug.title}</h3>
              </div>
              <span className={`inline-flex px-2 py-0.5 radius-pill text-[10px] font-semibold ${statusColors[bug.status] ?? "bg-bg-elevated text-text-secondary"}`}>
                {bug.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-text-secondary mb-3 line-clamp-2 overflow-hidden text-ellipsis">{bug.description}</p>
            {isReport && bug.post && (
              <Link
                href={`/posts/${bug.post.id}`}
                className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary no-underline hover:underline"
              >
                <ExternalLink size={12} />
                View reported post: {bug.post.title.slice(0, 60)}
              </Link>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-[10px] text-text-muted">
                Reported by {bug.reporter ? <Link href={`/profile/${bug.reporter.userName}`} className="no-underline hover:underline text-text-secondary">{bug.reporter.firstName} {bug.reporter.lastName}</Link> : "Anonymous"} &middot; {new Date(bug.createdAt).toLocaleDateString()}
              </div>
              <div className="flex gap-1 flex-wrap">
                {isReport && bug.post && bug.status !== "RESOLVED" && bug.status !== "CLOSED" ? (
                  MODERATION_CONFIG.adminActions.map((a) => (
                    <button
                      key={a.value}
                      title={a.description}
                      onClick={() => handleModeration(bug, a.value)}
                      className={`px-2 py-0.5 radius-sm text-[10px] font-semibold border-none cursor-pointer transition-all duration-fast ${
                        a.value === "REMOVE_POST"
                          ? "bg-error text-error-text hover:bg-error-text hover:text-text-inverse"
                          : "bg-bg-elevated text-text-secondary hover:bg-primary-muted hover:text-primary"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))
                ) : (
                  STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(bug.id, s)}
                      className={`px-2 py-0.5 radius-sm text-[10px] font-semibold border-none cursor-pointer transition-all duration-fast ${
                        bug.status === s ? "bg-primary text-text-inverse" : "bg-bg-elevated text-text-secondary hover:bg-bg-elevated"
                      }`}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
