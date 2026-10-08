"use client"

import { useState, useCallback } from "react"
import { AppModal } from "@/app/components/ui"
import { POST_ACTIONS_CONFIG, MODERATION_CONFIG } from "@/app/lib/config"
import { toastService } from "@/app/lib/services/toastService"

interface ReportDialogProps {
  open: boolean
  postId: string
  postTitle?: string
  /** When reporting a comment, its id rides in metadata (no schema change). */
  commentId?: string
  onClose: () => void
  onSubmitted?: () => void
}

/**
 * Config-driven report dialog (shared by feed cards, detail views, comments).
 * Posts to the dedicated /api/reports endpoint: deduped server-side (ACID),
 * reporter gets a receipt notification, admins get a triage notification.
 * Reporter identity is never exposed to the reported author.
 */
export function ReportDialog({ open, postId, postTitle, commentId, onClose, onSubmitted }: ReportDialogProps) {
  const [reason, setReason] = useState(POST_ACTIONS_CONFIG.reportReasons[0]?.value ?? "other")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(async () => {
    if (!reason) {
      toastService.error(POST_ACTIONS_CONFIG.reportEmptyError)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          reason,
          ...(details.trim() ? { details: details.trim() } : {}),
          ...(commentId ? { commentId } : {}),
        }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 409) {
        toastService.info((payload?.error as string | undefined) ?? MODERATION_CONFIG.duplicateError)
        onClose()
        return
      }
      if (!res.ok) throw new Error("report failed")
      onClose()
      setReason(POST_ACTIONS_CONFIG.reportReasons[0]?.value ?? "other")
      setDetails("")
      toastService.success((payload?.message as string | undefined) ?? MODERATION_CONFIG.reportReceived)
      onSubmitted?.()
    } catch {
      toastService.error(POST_ACTIONS_CONFIG.reportError)
    } finally {
      setSubmitting(false)
    }
  }, [reason, details, postId, commentId, onClose, onSubmitted])

  return (
    <AppModal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{POST_ACTIONS_CONFIG.reportTitle}</h3>
          <p className="text-xs text-text-secondary mt-1">{POST_ACTIONS_CONFIG.reportSubtitle(postTitle ?? "")}</p>
        </div>
        <div>
          <label htmlFor={`report-reason-${postId}`} className="block text-sm font-medium mb-1 text-text-primary">
            {POST_ACTIONS_CONFIG.reportReasonLabel}
          </label>
          <select
            id={`report-reason-${postId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-10 px-3 border border-border radius-sm text-sm font-sans bg-bg-base text-text-primary outline-none focus:border-primary"
          >
            {POST_ACTIONS_CONFIG.reportReasons.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`report-details-${postId}`} className="block text-sm font-medium mb-1 text-text-primary">
            {POST_ACTIONS_CONFIG.reportDetailsLabel}
          </label>
          <textarea
            id={`report-details-${postId}`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={POST_ACTIONS_CONFIG.reportDetailsPlaceholder}
            rows={3}
            maxLength={1000}
            className="w-full min-h-[72px] px-3 py-2 border border-border radius-sm text-sm font-sans resize-y bg-bg-base text-text-primary outline-none focus:border-primary placeholder:text-text-muted"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 radius-md border border-border bg-bg-card text-sm font-medium text-text-secondary cursor-pointer font-sans hover:bg-bg-elevated transition-colors duration-fast"
          >
            {POST_ACTIONS_CONFIG.reportCancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="h-9 px-4 radius-md bg-error-text text-text-inverse border-none text-sm font-semibold cursor-pointer font-sans hover:opacity-90 transition-opacity duration-fast disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : POST_ACTIONS_CONFIG.reportSubmitLabel}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
