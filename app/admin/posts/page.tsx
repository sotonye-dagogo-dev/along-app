"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Trash2, Archive, ArchiveRestore, Flag, Pencil, Eye } from "lucide-react"
import { modalService } from "@/app/lib/services/modalService"
import { toastService } from "@/app/lib/services/toastService"
import { undoService } from "@/app/lib/services/undoService"
import { AppModal, AppInput, AppTextarea, AppButton, AppTableRowActions, type TableRowAction } from "@/app/components/ui"
import { POST_ACTIONS_CONFIG, MODERATION_CONFIG } from "@/app/lib/config"
import { ADMIN_BULK_SELECT_META, ADMIN_TABLE_SORT_META } from "@/app/lib/config/admin"
import { useBulkSelection } from "@/app/lib/hooks/useBulkSelection"

interface AdminPost {
  id: string
  title: string
  description?: string | null
  tags?: string[]
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
  const [bulkBusy, setBulkBusy] = useState(false)
  // Bulk-safe cursor pagination (append-only) + config-driven sort.
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sortId, setSortId] = useState(ADMIN_TABLE_SORT_META.posts.defaultId)
  const bulk = useBulkSelection(posts, (p) => p.id)
  // Admin edit state — title/description/tags only (nature-preserving, see PUT /api/admin/posts).
  const [editing, setEditing] = useState<AdminPost | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editTags, setEditTags] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const loadingMoreRef = React.useRef(false)
  const load = useCallback(async (cursor: string | null = null) => {
    if (cursor) {
      if (loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    try {
      const sortOpt = ADMIN_TABLE_SORT_META.posts.options.find((o) => o.id === sortId)
        ?? ADMIN_TABLE_SORT_META.posts.options[0]
      const params = new URLSearchParams({ sort: sortOpt.sort, dir: sortOpt.dir, limit: "20" })
      if (cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/admin/posts?${params.toString()}`)
      if (!res.ok) throw new Error("Request failed")
      const data = await res.json()
      const fresh = (data.posts ?? []) as AdminPost[]
      setPosts((prev) => {
        if (!cursor) return fresh
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...fresh.filter((p) => !seen.has(p.id))]
      })
      setNextCursor(data.nextCursor ?? null)
    } catch (err) { console.error("[AdminError]", err) } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [sortId])

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
            const snapshot = payload?.snapshot ?? payload?.snapshots?.[0]
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

  const handleBulkDelete = () => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    modalService.confirm({
      title: `Delete ${ids.length} post(s)?`,
      description: "This removes the selected posts. This can be undone right after.",
      variant: "destructive",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setBulkBusy(true)
          try {
            const res = await fetch("/api/admin/posts", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postIds: ids }),
            })
            const payload = await res.json().catch(() => null)
            if (!res.ok) throw new Error("bulk failed")
            setPosts((prev) => prev.filter((p) => !bulk.selected.has(p.id)))
            bulk.clear()
            const snapshots: Record<string, unknown>[] = payload?.snapshots ?? []
            if (snapshots.length > 0) {
              const undoId = `admin-posts-bulk-delete:${Date.now()}`
              undoService.register({
                id: undoId,
                label: "Undo bulk post deletion",
                onUndo: () => {
                  void (async () => {
                    try {
                      for (const s of snapshots) {
                        const { title, routes, images, tags, description, type, quotedPostId, region, startLat, startLng, endLat, endLng, waypoints, totalDistanceKm, estimatedMins } = s as Record<string, unknown>
                        await fetch("/api/posts", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title, routes, images, tags, description, type, quotedPostId, region, startLat, startLng, endLat, endLng, waypoints, totalDistanceKm, estimatedMins }),
                        })
                      }
                      toastService.success("Posts restored")
                      load()
                    } catch {
                      toastService.error(POST_ACTIONS_CONFIG.deleteError)
                    }
                  })()
                },
              })
              toastService.undo({
                message: `${ids.length} post(s) deleted`,
                undoLabel: "Undo",
                onUndo: () => undoService.execute(undoId),
              })
            } else {
              toastService.success(`${ids.length} post(s) deleted`)
            }
          } catch (err) {
            console.error("[AdminError]", err)
            toastService.error(POST_ACTIONS_CONFIG.deleteError)
          } finally {
            setBulkBusy(false)
          }
        })()
      },
    })
  }

  const handleBulkArchive = (archiving: boolean) => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    void (async () => {
      setBulkBusy(true)
      try {
        const res = await fetch("/api/admin/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postIds: ids, isArchived: archiving }),
        })
        if (!res.ok) throw new Error("bulk failed")
        setPosts((prev) => prev.map((p) => (bulk.selected.has(p.id) ? { ...p, isArchived: archiving } : p)))
        bulk.clear()
        toastService.success(archiving ? `${ids.length} post(s) archived` : `${ids.length} post(s) restored`)
      } catch (err) {
        console.error("[AdminError]", err)
        toastService.error(archiving ? POST_ACTIONS_CONFIG.archiveError : POST_ACTIONS_CONFIG.unarchiveError)
      } finally {
        setBulkBusy(false)
      }
    })()
  }

  const openEdit = (post: AdminPost) => {
    setEditing(post)
    setEditTitle(post.title ?? "")
    setEditDescription(post.description ?? "")
    setEditTags(Array.isArray(post.tags) ? post.tags.join(", ") : "")
    setEditError(null)
  }

  const saveEdit = () => {
    if (!editing || editSaving) return
    const title = editTitle.trim()
    if (title.length < 3 || title.length > 200) {
      setEditError("Title must be 3–200 characters.")
      return
    }
    if (editDescription.length > 5000) {
      setEditError("Description must be under 5000 characters.")
      return
    }
    const tags = editTags.split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 10)
    setEditSaving(true)
    setEditError(null)
    void (async () => {
      try {
        const res = await fetch("/api/admin/posts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: editing.id,
            title,
            description: editDescription.trim(),
            tags,
          }),
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok) throw new Error((payload as { error?: string } | null)?.error || "Request failed")
        setPosts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, title, description: editDescription.trim() || null, tags } : p)))
        setEditing(null)
        toastService.success(POST_ACTIONS_CONFIG.editSuccess)
      } catch (err) {
        console.error("[AdminError]", err)
        setEditError(POST_ACTIONS_CONFIG.editError)
      } finally {
        setEditSaving(false)
      }
    })()
  }

  const handleArchiveToggle = (post: AdminPost) => {    const archiving = !post.isArchived
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

  const allSelected = posts.length > 0 && posts.every((p) => bulk.selected.has(p.id))

  /** Compact dropdown keeps 3 actions from elongating the row; colors preserved per item. */
  const buildPostRowActions = (p: AdminPost): TableRowAction[] => {
    try {
      return [
        {
          id: "edit",
          label: "Edit",
          icon: Pencil,
          title: `Edit ${p.title}`,
          className: "bg-bg-elevated text-text-secondary",
          onSelect: () => openEdit(p),
        },
        {
          id: p.isArchived ? "restore" : "archive",
          label: p.isArchived ? "Restore" : "Hide",
          icon: p.isArchived ? ArchiveRestore : Archive,
          title: p.isArchived ? "Restore post" : "Archive post",
          className: "bg-bg-elevated text-text-secondary",
          onSelect: () => handleArchiveToggle(p),
        },
        {
          id: "view",
          label: "View",
          icon: Eye,
          title: "View post",
          className: "bg-bg-elevated text-text-secondary",
          href: `/posts/${p.id}`,
        },
        {
          id: "delete",
          label: "Delete",
          icon: Trash2,
          variant: "destructive",
          title: "Delete post",
          className: "bg-error text-error-text",
          onSelect: () => handleDelete(p),
        },
      ]
    } catch {
      return []
    }
  }

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">Posts</h1>
          <div className="text-sm text-text-secondary truncate">Manage all posts</div>
        </div>
        <select
          value={sortId}
          onChange={(e) => setSortId(e.target.value)}
          className="px-3 py-1.5 radius-md border border-border text-xs font-medium font-sans bg-bg-card text-text-primary cursor-pointer"
          aria-label="Sort posts"
        >
          {ADMIN_TABLE_SORT_META.posts.options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-bg-card border border-border radius-lg px-3 py-2 text-xs min-w-0">
        <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer shrink-0">
          <input type="checkbox" checked={allSelected} onChange={() => (allSelected ? bulk.clear() : bulk.selectAll())} className="w-4 h-4 accent-primary cursor-pointer" aria-label="Select all posts" />
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
          <button onClick={() => handleBulkArchive(true)} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary border border-border cursor-pointer disabled:opacity-50">Archive</button>
          <button onClick={() => handleBulkArchive(false)} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary border border-border cursor-pointer disabled:opacity-50">Restore</button>
          <button onClick={handleBulkDelete} disabled={bulk.count === 0 || bulkBusy} className="inline-flex items-center gap-1 px-2 py-1 radius-sm bg-error text-error-text border-none font-semibold cursor-pointer disabled:opacity-50"><Trash2 size={10} /> Delete</button>
        </span>
      </div>

      <div className="overflow-x-auto radius-lg border border-border bg-bg-card shadow-xs max-w-full">
        <table className="w-full border-collapse text-xs min-w-[760px]">
          <thead>
            <tr className="bg-bg-elevated">
              <th className="px-3 py-3 w-10 border-b border-border-strong"><span className="sr-only">Select</span></th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Post</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Author</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Validity</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Likes</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Views</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-text-muted">Loading...</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-text-muted">No posts found</td></tr>
            ) : posts.map((p) => {
              const checked = bulk.selected.has(p.id)
              return (
              <tr key={p.id} className={`hover:bg-bg-elevated transition-colors duration-fast ${checked ? "bg-primary-muted/40" : ""}`}>
                <td className="px-3 py-3 border-b border-border">
                  <input type="checkbox" checked={checked} onChange={() => bulk.toggle(p.id)} aria-label={`Select ${p.title}`} className="w-4 h-4 accent-primary cursor-pointer" />
                </td>
                <td className="px-4 py-3 border-b border-border max-w-[260px]">
                  <Link href={`/posts/${p.id}`} className="text-xs font-semibold text-text-primary no-underline hover:text-primary block truncate" title={p.title}>
                    {p.title}
                  </Link>
                  <span className="block mt-1 flex items-center gap-1 flex-wrap">
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
                <td className="px-4 py-3 border-b border-border whitespace-nowrap max-w-[160px] truncate">
                  <Link href={`/profile/${p.user.userName}`} className="text-text-secondary no-underline hover:underline">{p.user.firstName} {p.user.lastName}</Link>
                </td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
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
                <td className="px-4 py-3 border-b border-border text-text-muted whitespace-nowrap">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
                  <AppTableRowActions actions={buildPostRowActions(p)} align="end" ariaLabel={`Actions for ${p.title}`} />
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void load(nextCursor)}
            disabled={loadingMore}
            className="px-4 py-2 radius-md border border-border bg-bg-card text-xs font-semibold text-text-primary cursor-pointer disabled:opacity-50"
          >
            {loadingMore ? "Loading more…" : "View more"}
          </button>
        </div>
      )}

      <AppModal
        open={editing !== null}
        onClose={() => (editSaving ? undefined : setEditing(null))}
        title="Edit post"
        subtitle={editing ? `Correcting "${editing.title.slice(0, 60)}" — title, description and tags only. Route content and post type are never changed.` : undefined}
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setEditing(null)} disabled={editSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={saveEdit} loading={editSaving}>
              Save changes
            </AppButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <AppInput
            label="Title"
            value={editTitle}
            maxLength={200}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Post title"
          />
          <AppTextarea
            label="Description"
            value={editDescription}
            rows={4}
            maxLength={5000}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Optional description"
          />
          <AppInput
            label="Tags (comma separated, up to 10)"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="e.g. lekki, traffic, morning"
          />
          {editError && (
            <p className="text-xs text-error-text" role="alert">{editError}</p>
          )}
        </div>
      </AppModal>
    </div>
  )
}
