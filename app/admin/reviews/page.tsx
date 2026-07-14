"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Shield, Check, X } from "lucide-react"

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
    } catch (err) { console.error("[AdminError]", err) }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Reviews</h1>
          <div className="text-sm text-text-secondary">User-to-user reviews moderation</div>
        </div>
        <div className="flex gap-2">
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

      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-text-muted">No reviews found</div>
        ) : reviews.map((r) => (
          <div key={r.id} className="bg-bg-card border border-border radius-lg p-4 shadow-xs">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-text-muted shrink-0" />
                <div className="text-sm font-semibold">
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
              <p className="text-xs text-text-secondary mb-3">{r.comment}</p>
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
    </>
  )
}
