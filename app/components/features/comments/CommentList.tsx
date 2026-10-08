"use client"

import Link from "next/link"
import { useState } from "react"
import { Trash2, Pencil, Flag, Check, X } from "lucide-react"
import { AppEmptyState } from "@/app/components/ui"
import { EMPTY_STATES, POST_ACTIONS_CONFIG } from "@/app/lib/config"
import { commentParser } from "@/app/lib/utils/commentParser"
import { useAuth } from "@/app/hooks/useAuth"
import { toastService } from "@/app/lib/services/toastService"
import { modalService } from "@/app/lib/services/modalService"
import { deleteCommentWithConfirm, isAdminRole } from "@/app/lib/services/postModerationService"
import { ReportDialog } from "@/app/components/features/moderation"

interface CommentUser {
  id: string
  userName: string
  firstName: string
  lastName: string
  avatar?: string | null
  avatarConfig?: unknown
}

interface Comment {
  id: string
  text: string
  createdAt: string | Date
  user: CommentUser
}

interface CommentListProps {
  comments: Comment[]
  /** Post id — required for edit/delete/report API calls. */
  postId: string
  onDeleted?: (commentId: string) => void
  onUpdated?: (comment: { id: string; text: string }) => void
  onRestored?: () => void
  /** @deprecated Use postId + cache callbacks instead; kept for compatibility. */
  onDelete?: (commentId: string) => void
}

function getTimeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

export default function CommentList({ comments, postId, onDeleted, onUpdated, onRestored, onDelete }: CommentListProps) {
  const { user: currentUser, requireAuth } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [saving, setSaving] = useState(false)
  const [reportingId, setReportingId] = useState<string | null>(null)

  if (comments.length === 0) {
    return (
      <div className="py-8">
        <AppEmptyState {...EMPTY_STATES.comments} />
      </div>
    )
  }

  const startEdit = (comment: Comment) => {
    if (!requireAuth("edit comments")) return
    setEditingId(comment.id)
    setEditText(comment.text)
  }

  const saveEdit = async (comment: Comment) => {
    const text = editText.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error("edit failed")
      onUpdated?.({ id: comment.id, text })
      setEditingId(null)
      toastService.success(POST_ACTIONS_CONFIG.commentEditSuccess)
    } catch {
      toastService.error(POST_ACTIONS_CONFIG.commentEditError)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (comment: Comment) => {
    if (!requireAuth("delete comments")) return
    // Legacy parent-managed path (no confirm/undo of its own).
    if (onDelete && !onDeleted) {
      modalService.confirm({
        title: POST_ACTIONS_CONFIG.commentDeleteTitle,
        description: POST_ACTIONS_CONFIG.commentDeleteDescription,
        variant: "destructive",
        onConfirm: () => {
          modalService.close()
          onDelete(comment.id)
        },
      })
      return
    }
    deleteCommentWithConfirm({
      postId,
      commentId: comment.id,
      commentText: comment.text,
      onDeleted: (id) => {
        onDeleted?.(id)
        onDelete?.(id)
      },
      onRestored: () => {
        // Undo re-posts the text server-side; parent refreshes the list.
        onRestored?.()
      },
    })
  }

  const isAdmin = isAdminRole((currentUser as { role?: string } | null)?.role)

  return (
    <div>
      {comments.map((comment) => {
        const initials = `${comment.user.firstName[0]}${comment.user.lastName[0]}`.toUpperCase()
        const isOwner = currentUser?.id === comment.user.id
        const canModerate = isOwner || isAdmin
        const editing = editingId === comment.id

        return (
          <div key={comment.id} className="flex gap-2.5 py-3 border-b border-border last:border-b-0">
            <Link
              href={`/profile/${comment.user.userName}`}
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-circle bg-bg-elevated flex items-center justify-center text-xs font-bold text-text-secondary shrink-0 no-underline"
            >
              {initials}
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${comment.user.userName}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-text-primary no-underline hover:underline"
              >
                {comment.user.firstName} {comment.user.lastName}
              </Link>
              {editing ? (
                <div className="mt-1.5 flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    autoFocus
                    className="w-full min-h-[56px] px-3 py-2 border border-border radius-sm text-sm font-sans resize-y bg-bg-base text-text-primary outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => void saveEdit(comment)}
                      disabled={saving || !editText.trim()}
                      className="inline-flex items-center gap-1 h-7 px-3 radius-md bg-primary text-white border-none text-xs font-semibold cursor-pointer font-sans hover:bg-primary-light disabled:opacity-60"
                    >
                      <Check size={13} /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1 h-7 px-3 radius-md border border-border bg-bg-card text-xs font-medium text-text-secondary cursor-pointer font-sans hover:bg-bg-elevated"
                    >
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-text-primary mt-0.5">
                  {commentParser(comment.text)}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                <span>{getTimeAgo(comment.createdAt)}</span>
                {isOwner && !editing && (
                  <button
                    onClick={() => startEdit(comment)}
                    className="flex items-center gap-1 border-none bg-transparent text-text-muted cursor-pointer p-0.5 hover:text-primary transition-colors duration-fast"
                    aria-label="Edit comment"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {canModerate && !editing && (
                  <button
                    onClick={() => handleDelete(comment)}
                    className="flex items-center gap-1 border-none bg-transparent text-text-muted cursor-pointer p-0.5 hover:text-error-text transition-colors duration-fast"
                    aria-label="Delete comment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {!isOwner && (
                  <button
                    onClick={() => {
                      if (!requireAuth("report comments")) return
                      setReportingId(comment.id)
                    }}
                    className="flex items-center gap-1 border-none bg-transparent text-text-muted cursor-pointer p-0.5 hover:text-error-text transition-colors duration-fast"
                    aria-label="Report comment"
                  >
                    <Flag size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <ReportDialog
        open={reportingId !== null}
        postId={postId}
        commentId={reportingId ?? undefined}
        onClose={() => setReportingId(null)}
      />
    </div>
  )
}
