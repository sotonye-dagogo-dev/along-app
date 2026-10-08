"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Shield, Check, X } from "lucide-react"
import { ADMIN_BULK_SELECT_META } from "@/app/lib/config/admin"
import { useBulkSelection } from "@/app/lib/hooks/useBulkSelection"
import { toastService } from "@/app/lib/services/toastService"

interface AdminReview {
  id: string
  rating: number
  comment: string | null
  status: string
  createdAt: string
  reviewer: { id: string; firstName: string; lastName: string; userName: string }
  reviewee: { id: string; firstName: string; lastName: string; userName: string }
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("PENDING")
  const [bulkBusy, setBulkBusy] = useState(false)
  const bulk = useBulkSelection(reviews, (r) => r.id)

  const load = async (status?: string) => {
    setLoading(true)
    try {
      const url = status ? `/api/admin/reviews?status=${status}` : "/api/admin/reviews"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      setReviews(data.reviews ?? [])
    } catch (err) { console.error("[AdminError]", err) } finally { setLoading(false) }
  }

  useEffect(() => { load("PENDING") }, [])

  const handleStatus = async (reviewId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, status }),
      })
      if (!res.ok) throw new Error("Request failed")
      load(statusFilter || undefined)
    } catch (err) {
      console.error("[AdminError]", err)
      toastService.error("Failed to update review")
    }
  }

  const handleBulkStatus = async (status: "APPROVED" | "REJECTED") => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIds: ids, status }),
      })
      if (!res.ok) throw new Error("Request failed")
      bulk.clear()
      toastService.success(`${ids.length} review(s) ${status.toLowerCase()}`)
      load(statusFilter || undefined)
    } catch (err) {
      console.error("[AdminError]", err)
      toastService.error("Bulk update failed")
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">Reviews</h1>
          <div className="text-sm text-text-secondary truncate">User-to-user reviews moderation</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["PENDING", "APPROVED", "REJECTED", ""].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); load(s || undefined) }}
              className={`px-3 py-1.5 radius-md text-xs font-semibold border-none cursor-pointer transition-all duration-fast ${
                statusFilter === s ? "bg-primary text-text-inverse" : "bg-bg-elevated text-text-secondary hover:bg-bg-elevated"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-bg-card border border-border radius-lg px-3 py-2 text-xs min-w-0">
        <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer shrink-0">
          <input type="checkbox" checked={reviews.length > 0 && reviews.every((r) => bulk.selected.has(r.id))} onChange={() => (bulk.count === reviews.length && reviews.length > 0 ? bulk.clear() : bulk.selectAll())} className="w-4 h-4 accent-primary cursor-pointer" aria-label="Select all reviews" />
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
          <button onClick={() => handleBulkStatus("APPROVED")} disabled={bulk.count === 0 || bulkBusy} className="inline-flex items-center gap-1 px-2 py-1 radius-sm bg-success text-success-text border-none font-semibold cursor-pointer disabled:opacity-50"><Check size={10} /> Approve</button>
          <button onClick={() => handleBulkStatus("REJECTED")} disabled={bulk.count === 0 || bulkBusy} className="inline-flex items-center gap-1 px-2 py-1 radius-sm bg-error text-error-text border-none font-semibold cursor-pointer disabled:opacity-50"><X size={10} /> Reject</button>
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0">
        {loading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-text-muted">No reviews found</div>
        ) : reviews.map((r) => (
          <div key={r.id} className={`bg-bg-card border border-border radius-lg p-4 shadow-xs min-w-0 overflow-hidden ${bulk.selected.has(r.id) ? "ring-1 ring-primary" : ""}`}>
            <div className="flex items-start justify-between mb-2 gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={bulk.selected.has(r.id)} onChange={() => bulk.toggle(r.id)} aria-label="Select review" className="w-4 h-4 accent-primary cursor-pointer shrink-0" />
                <Shield size={14} className="text-text-muted shrink-0" />
                <div className="text-sm font-semibold truncate">
                  <Link href={`/profile/${r.reviewer.userName}`} className="no-underline hover:underline text-text-primary">{r.reviewer.firstName} {r.reviewer.lastName}</Link>
                  <span className="text-text-muted mx-1.5">&rarr;</span>
                  <Link href={`/profile/${r.reviewee.userName}`} className="no-underline hover:underline text-text-primary">{r.reviewee.firstName} {r.reviewee.lastName}</Link>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-warning-border">{r.rating}/5</span>
                <span className={`inline-flex px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                  r.status === "APPROVED" ? "bg-success text-success-text" :
                  r.status === "REJECTED" ? "bg-error text-error-text" :
                  "bg-warning text-warning-text"
                }`}>
                  {r.status}
                </span>
              </div>
            </div>
            {r.comment && (
              <p className="text-xs text-text-secondary mb-3 overflow-hidden text-ellipsis line-clamp-3">{r.comment}</p>
            )}
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-text-muted">{new Date(r.createdAt).toLocaleDateString()}</div>
              {r.status === "PENDING" && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleStatus(r.id, "APPROVED")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 radius-sm text-[10px] font-semibold bg-success text-success-text border-none cursor-pointer hover:bg-success-text hover:text-text-inverse transition-all duration-fast"
                  >
                    <Check size={10} /> Approve
                  </button>
                  <button
                    onClick={() => handleStatus(r.id, "REJECTED")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 radius-sm text-[10px] font-semibold bg-error text-error-text border-none cursor-pointer hover:bg-error-text hover:text-text-inverse transition-all duration-fast"
                  >
                    <X size={10} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
