"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { GlobalConfirmModal } from "@/app/components/ui/GlobalConfirmModal"

interface AdminPost {
  id: string
  title: string
  validityScore: number
  validityTier: string | null
  likes: number
  comments: number
  views: number
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    userName: string
    avatar: string | null
  }
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/posts")
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch (err) { console.error("[AdminError]", err) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (postId: string) => {
    try {
      const res = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      })
      if (!res.ok) throw new Error("Request failed")
      load()
    } catch (err) { console.error("[AdminError]", err) }
  }

  return (
    <>
      <GlobalConfirmModal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); setConfirmDeleteId(null) }}
        variant="destructive"
        title="Delete Post"
        description="Delete this post? This action cannot be undone."
      />

      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Posts</h1>
          <div className="text-sm text-text-secondary">Manage all posts</div>
        </div>
      </div>

      <div className="overflow-x-auto radius-lg border border-border bg-bg-card shadow-xs">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-bg-elevated">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Post</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Author</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Validity</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Likes</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Views</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Date</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-muted">Loading...</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-muted">No posts found</td></tr>
            ) : posts.map((p) => (
              <tr key={p.id} className="hover:bg-bg-elevated transition-colors duration-fast">
                <td className="px-4 py-3 border-b border-border">
                  <Link href={`/posts/${p.id}`} className="text-xs font-semibold text-text-primary no-underline hover:text-primary">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 border-b border-border">
                  <Link href={`/profile/${p.user.userName}`} className="text-text-secondary no-underline hover:underline">{p.user.firstName} {p.user.lastName}</Link>
                </td>
                <td className="px-4 py-3 border-b border-border">
                  <span className={`inline-flex px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                    p.validityTier === "trusted" ? "bg-success text-success-text" :
                    p.validityTier === "verified" ? "bg-info text-info-text" :
                    "bg-bg-elevated text-text-secondary"
                  }`}>
                    {p.validityScore}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-border">{p.likes}</td>
                <td className="px-4 py-3 border-b border-border">{p.views}</td>
                <td className="px-4 py-3 border-b border-border text-text-muted">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 border-b border-border">
                  <button
                    onClick={() => setConfirmDeleteId(p.id)}
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
