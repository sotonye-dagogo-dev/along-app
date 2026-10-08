"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Trash2, Archive, ArchiveRestore, Flag } from "lucide-react"
import { modalService } from "@/app/lib/services/modalService"
import { toastService } from "@/app/lib/services/toastService"
import { undoService } from "@/app/lib/services/undoService"
import { POST_ACTIONS_CONFIG, MODERATION_CONFIG } from "@/app/lib/config"

interface AdminPost {
  id: string
  title: string
  type?: string
  validityScore: number
  validityTier: string | null
  likes: number
  comments: number
  views: number
  isArchived?: boolean
  createdAt: string
  _count?: { bugReports: number }
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/posts")
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch (err) { console.error("[AdminError]", err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = (post: AdminPost) => {
    modalService.confirm({
      title: POST_ACTIONS_CONFIG.adminDeleteTitle,
      description: POST_ACTIONS_CONFIG.adminDeleteDescription,
      variant: "destructive",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          try {
            const res = await fetch("/api/admin/posts", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postId: post.id }),
            })
            const payload = await res.json().catch(() => null)
            if (!res.ok) throw new Error("Request failed")
            setPosts((prev) => prev.filter((p) => p.id !== post.id))
            // Global undo: the API returns a snapshot; restore replays it.
            const snapshot = payload?.snapshot
            if (snapshot) {
              const undoId = `admin-post-delete:${post.id}:${Date.now()}`
              undoService.register({
                id: undoId,
                label: "Undo post deletion",
                onUndo: () => {
                  void (async () => {
                    try {
                      const { title, routes, images, tags, description, type, quotedPostId, region, startLat, startLng, endLat, endLng, waypoints, totalDistanceKm, estimatedMins } = snapshot as Record<string, unknown>
                      const restore = await fetch("/api/posts", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title, routes, images, tags, description, type, quotedPostId, region, startLat, startLng, endLat, endLng, waypoints, totalDistanceKm, estimatedMins }),
                      })
                      if (!restore.ok) throw new Error("restore failed")
                      toastService.success(POST_ACTIONS_CONFIG.restoreSuccess)
                      load()
                    } catch {
                      toastService.error(POST_ACTIONS_CONFIG.deleteError)
                    }
                  })()
                },
              })
              toastService.undo({
                message: POST_ACTIONS_CONFIG.deleteUndoMessage,
                undoLabel: POST_ACTIONS_CONFIG.deleteUndoLabel,
                onUndo: () => undoService.execute(undoId),
              })
            } else {
              toastService.success(POST_ACTIONS_CONFIG.deleteSuccess)
            }
          } catch (err) {
            console.error("[AdminError]", err)
            toastService.error(POST_ACTIONS_CONFIG.deleteError)
          }
        })()
      },
    })
  }

  const handleArchiveToggle = (post: AdminPost) => {
    const archiving = !post.isArchived
    modalService.confirm({
      title: archiving ? MODERATION_CONFIG.adminConfirmArchiveTitle : POST_ACTIONS_CONFIG.unarchiveTitle,
      description: archiving ? MODERATION_CONFIG.adminConfirmArchiveDescription : POST_ACTIONS_CONFIG.unarchiveDescription,
      variant: "sensitive",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          try {
            const res = await fetch("/api/admin/posts", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postId: post.id, isArchived: archiving }),
            })
            if (!res.ok) throw new Error("Request failed")
            setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, isArchived: archiving } : p)))
            toastService.success(archiving ? POST_ACTIONS_CONFIG.archiveSuccess : POST_ACTIONS_CONFIG.unarchiveSuccess)
          } catch (err) {
            console.error("[AdminError]", err)
            toastService.error(archiving ? POST_ACTIONS_CONFIG.archiveError : POST_ACTIONS_CONFIG.unarchiveError)
          }
        })()
      },
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
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
                  <span className="block mt-1 flex items-center gap-1">
                    {p.isArchived && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-px radius-pill text-[10px] font-semibold bg-bg-elevated text-text-secondary border border-border">
                        <Archive size={9} /> Archived
                      </span>
                    )}
                    {(p._count?.bugReports ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-px radius-pill text-[10px] font-semibold bg-warning text-warning-text border border-warning-border">
                        <Flag size={9} /> {p._count?.bugReports} report{(p._count?.bugReports ?? 0) === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
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
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => handleArchiveToggle(p)}
                      className="inline-flex items-center gap-1 px-2 py-1 radius-sm text-[10px] font-semibold bg-bg-elevated text-text-secondary border border-border cursor-pointer hover:border-primary-muted hover:text-primary transition-all duration-fast"
                    >
                      {p.isArchived ? <ArchiveRestore size={10} /> : <Archive size={10} />}
                      {p.isArchived ? "Restore" : "Hide"}
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="inline-flex items-center gap-1 px-2 py-1 radius-sm text-[10px] font-semibold bg-error text-error-text border-none cursor-pointer hover:bg-error-text hover:text-text-inverse transition-all duration-fast"
                    >
                      <Trash2 size={10} /> Delete
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
