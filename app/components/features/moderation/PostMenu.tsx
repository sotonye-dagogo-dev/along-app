"use client"

import { useState, useCallback } from "react"
import { MoreHorizontal } from "lucide-react"
import { AppDropdown } from "@/app/components/ui"
import { POST_ACTIONS_CONFIG } from "@/app/lib/config"
import { useTranslation } from "@/app/providers/I18nProvider"
import { toastService } from "@/app/lib/services/toastService"
import {
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
  /** Retained for call-site compatibility; intentionally ignored — management
   *  actions are owner-only and admins moderate via /admin/posts. */
  viewerRole?: string | null
  requireAuth: (action: string) => boolean
  onEdit?: (post: PostMenuPost) => void
  onDeleted?: (postId: string) => void
  onRestored?: (oldId: string, newId: string) => void
  onArchivedChanged?: (postId: string, archived: boolean) => void
}

/**
 * Shared post overflow menu (feed cards AND individual post views): Copy link,
 * Report, plus owner-only Edit / Archive / Delete. Ownership is the sole
 * gate for management actions — admins moderate from /admin/posts instead,
 * so an admin viewing someone else's post sees exactly what any other
 * viewer sees (Copy link + Report). Destructive actions route through the
 * global confirm modal + global undo toast. All copy is metadata-driven
 * via POST_ACTIONS_CONFIG.
 */
export function PostMenu({
  post,
  title,
  viewerId,
  requireAuth,
  onEdit,
  onDeleted,
  onRestored,
  onArchivedChanged,
}: PostMenuProps) {
  const [reportOpen, setReportOpen] = useState(false)
  const { tf } = useTranslation()
  const isOwner = !!viewerId && viewerId === post.user.id
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
    if (!isOwner) return
    if (!requireAuth(archived ? "restore posts" : "archive posts")) return
    archivePostWithConfirm({
      postId: post.id,
      archived,
      onChanged: onArchivedChanged,
    })
  }, [requireAuth, archived, isOwner, post.id, onArchivedChanged])

  const handleDelete = useCallback(() => {
    if (!isOwner) return
    if (!requireAuth("delete posts")) return
    deletePostWithConfirm({
      postId: post.id,
      snapshot: post,
      onDeleted,
      onRestored,
    })
  }, [requireAuth, isOwner, post, onDeleted, onRestored])

  // Labels stay metadata-driven (config) with pidgin i18n overrides — the
  // config value is the fallback so new actions never render raw keys.
  const items: { label: string; variant?: "default" | "destructive"; onClick: () => void }[] = [
    { label: tf("post.copyLink", POST_ACTIONS_CONFIG.copyLinkLabel), onClick: () => void handleCopyLink() },
  ]
  // Report is for other people's posts; owners manage their own via edit/archive/delete.
  if (!isOwner) {
    items.push({ label: tf("post.report", POST_ACTIONS_CONFIG.reportLabel), variant: "destructive", onClick: openReport })
  }
  // Owner-only management: archive/delete never render for non-owners
  // (including admins — admin moderation lives on /admin/posts). The
  // handlers above additionally no-op without ownership as defence in depth.
  if (isOwner && onEdit) {
    items.push({ label: tf("post.edit", POST_ACTIONS_CONFIG.editLabel), onClick: handleEdit })
  }
  if (isOwner) {
    items.push({
      label: archived ? tf("post.unarchive", POST_ACTIONS_CONFIG.unarchiveLabel) : tf("post.archive", POST_ACTIONS_CONFIG.archiveLabel),
      onClick: handleArchiveToggle,
    })
    items.push({ label: tf("post.delete", POST_ACTIONS_CONFIG.deleteLabel), variant: "destructive", onClick: handleDelete })
  }

  return (
    <>
      <AppDropdown
        align="end"
        ariaLabel={tf("common.moreOptions", "More options")}
        trigger={
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-circle flex items-center justify-center text-text-muted hover:bg-bg-elevated transition-colors duration-fast"
          >
            <MoreHorizontal size={16} />
          </span>
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
