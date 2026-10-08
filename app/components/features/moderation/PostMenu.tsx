"use client"

import { useState, useCallback } from "react"
import { MoreHorizontal } from "lucide-react"
import { AppDropdown } from "@/app/components/ui"
import { POST_ACTIONS_CONFIG } from "@/app/lib/config"
import { toastService } from "@/app/lib/services/toastService"
import {
  isAdminRole,
  deletePostWithConfirm,
  archivePostWithConfirm,
  type PostSnapshot,
} from "@/app/lib/services/postModerationService"
import { ReportDialog } from "./ReportDialog"

export interface PostMenuPost extends PostSnapshot {
  user: { id: string };
}

interface PostMenuProps {
  post: PostMenuPost
  title: string
  viewerId?: string | null
  viewerRole?: string | null
  requireAuth: (action: string) => boolean
  onEdit?: (post: PostMenuPost) => void
  onDeleted?: (postId: string) => void
  onRestored?: (oldId: string, newId: string) => void
  onArchivedChanged?: (postId: string, archived: boolean) => void
}

/**
 * Shared post overflow menu (feed cards AND individual post views): Copy link,
 * Report, plus owner/admin Edit / Archive / Delete. Destructive actions route
 * through the global confirm modal + global undo toast. All copy is
 * metadata-driven via POST_ACTIONS_CONFIG.
 */
export function PostMenu({
  post,
  title,
  viewerId,
  viewerRole,
  requireAuth,
  onEdit,
  onDeleted,
  onRestored,
  onArchivedChanged,
}: PostMenuProps) {
  const [reportOpen, setReportOpen] = useState(false)
  const isOwner = !!viewerId && viewerId === post.user.id
  const isAdmin = isAdminRole(viewerRole)
  const archived = (post as { isArchived?: boolean }).isArchived ?? false

  const postUrl = useCallback(() => {
    if (typeof window === "undefined") return `/posts/${post.id}`
    return `${window.location.origin}/posts/${post.id}`
  }, [post.id])

  const handleCopyLink = useCallback(async () => {
    const url = postUrl()
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement("textarea")
        ta.value = url
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      toastService.success(POST_ACTIONS_CONFIG.copySuccess)
    } catch {
      toastService.error(POST_ACTIONS_CONFIG.copyError)
    }
  }, [postUrl])

  const openReport = useCallback(() => {
    if (!requireAuth("report posts")) return
    setReportOpen(true)
  }, [requireAuth])

  const handleEdit = useCallback(() => {
    if (!requireAuth("edit posts")) return
    onEdit?.(post)
  }, [requireAuth, onEdit, post])

  const handleArchiveToggle = useCallback(() => {
    if (!requireAuth(archived ? "restore posts" : "archive posts")) return
    archivePostWithConfirm({
      postId: post.id,
      archived,
      isAdmin: isAdmin && !isOwner,
      adminEndpoint: isAdmin && !isOwner,
      onChanged: onArchivedChanged,
    })
  }, [requireAuth, archived, isAdmin, isOwner, post.id, onArchivedChanged])

  const handleDelete = useCallback(() => {
    if (!requireAuth("delete posts")) return
    deletePostWithConfirm({
      postId: post.id,
      snapshot: post,
      isAdmin: isAdmin && !isOwner,
      adminEndpoint: isAdmin && !isOwner,
      onDeleted,
      onRestored,
    })
  }, [requireAuth, isAdmin, isOwner, post, onDeleted, onRestored])

  const items: { label: string; variant?: "default" | "destructive"; onClick: () => void }[] = [
    { label: POST_ACTIONS_CONFIG.copyLinkLabel, onClick: () => void handleCopyLink() },
  ]
  // Report is for other people's posts; owners manage their own via edit/archive/delete.
  if (!isOwner) {
    items.push({ label: POST_ACTIONS_CONFIG.reportLabel, variant: "destructive", onClick: openReport })
  }
  if (isOwner && onEdit) {
    items.push({ label: POST_ACTIONS_CONFIG.editLabel, onClick: handleEdit })
  }
  if (isOwner || isAdmin) {
    items.push({
      label: archived ? POST_ACTIONS_CONFIG.unarchiveLabel : POST_ACTIONS_CONFIG.archiveLabel,
      onClick: handleArchiveToggle,
    })
    items.push({ label: POST_ACTIONS_CONFIG.deleteLabel, variant: "destructive", onClick: handleDelete })
  }

  return (
    <>
      <AppDropdown
        align="end"
        trigger={
          <button
            className="w-7 h-7 rounded-circle flex items-center justify-center text-text-muted hover:bg-bg-elevated transition-colors duration-fast"
            aria-label="More options"
          >
            <MoreHorizontal size={16} />
          </button>
        }
        items={items}
      />
      <ReportDialog
        open={reportOpen}
        postId={post.id}
        postTitle={title}
        onClose={() => setReportOpen(false)}
      />
    </>
  )
}
