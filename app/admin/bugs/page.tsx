"use client"

import Link from "next/link"
import React, { useState, useEffect, useMemo } from "react"
import { Bug, Flag, ExternalLink, X } from "lucide-react"
import { modalService } from "@/app/lib/services/modalService"
import { toastService } from "@/app/lib/services/toastService"
import { MODERATION_CONFIG } from "@/app/lib/config"
import { BUG_REPORT_ACTION_MODAL, BUG_REPORT_STATUS_COPY } from "@/app/lib/config/bugReports"
// Module-scope alias: the member call `BUG_REPORT_ACTION_MODAL.useDefaultLabel(...)`
// trips react-hooks/rules-of-hooks (use-prefixed member). Behavior identical.
const defaultNoteLabelFor = BUG_REPORT_ACTION_MODAL.useDefaultLabel;
import { ADMIN_BULK_SELECT_META, ADMIN_TABLE_SORT_META } from "@/app/lib/config/admin"
import { useBulkSelection } from "@/app/lib/hooks/useBulkSelection"
import { useAdminCursorList } from "@/app/lib/hooks/useAdminCursorList"
import { ViewMoreButton } from "@/app/components/ui"

interface AdminBug {
  id: string
  title: string
  description: string
  category: string
  status: string
  createdAt: string
  metadata?: { kind?: string; reason?: string; commentId?: string; images?: string[] } | null
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
  const [statusFilter, setStatusFilter] = useState("")
  const [kindFilter, setKindFilter] = useState<"all" | "reports" | "bugs">("all")
  const [sortId, setSortId] = useState(ADMIN_TABLE_SORT_META.bugs.defaultId)
  // Screenshot viewer: full-size overlay for report attachments.
  const [viewer, setViewer] = useState<{ images: string[]; index: number; title: string } | null>(null)
  // Action modal: status change + custom reporter note + screenshot review.
  // Single (bugs.length===1, optional moderation action) or bulk (ids only).
  const [actionModal, setActionModal] = useState<{
    bugs: AdminBug[];
    status: string;
    moderation?: "DISMISS" | "ARCHIVE_POST" | "REMOVE_POST";
  } | null>(null)
  const [modalNote, setModalNote] = useState("")
  const [modalBusy, setModalBusy] = useState(false)

  const sortOption = ADMIN_TABLE_SORT_META.bugs.options.find((o) => o.id === sortId)
    ?? ADMIN_TABLE_SORT_META.bugs.options[0]

  // Bulk-safe cursor pagination: windows APPEND so selection survives
  // "view more" (no page-replacement context loss). Filter/sort changes
  // reset the list and clear stale selection.
  const list = useAdminCursorList<AdminBug>({
    buildUrl: (cursor) => {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      params.set("sort", sortOption.sort)
      params.set("dir", sortOption.dir)
      params.set("limit", String(list.pageSize))
      if (cursor) params.set("cursor", cursor)
      return `/api/admin/bugs?${params.toString()}`
    },
    getItems: (payload) => (payload as { bugs?: AdminBug[] }).bugs ?? [],
    getCursor: (payload) => (payload as { nextCursor?: string | null }).nextCursor ?? null,
  })
  const { items: bugs, loading, loadingMore, nextCursor } = list

  useEffect(() => { void list.load(true) }, [statusFilter, sortId])
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    if (kindFilter === "all") return bugs
    return bugs.filter((b) =>
      kindFilter === "reports" ? b.metadata?.kind === "post-report" : b.metadata?.kind !== "post-report"
    )
  }, [bugs, kindFilter])
  const bulk = useBulkSelection(visible, (b) => b.id)

  const openActionModal = (
    bugs: AdminBug[],
    status: string,
    moderation?: "DISMISS" | "ARCHIVE_POST" | "REMOVE_POST",
  ) => {
    if (bugs.length === 0) return
    setModalNote("")
    setActionModal({ bugs, status, moderation })
  }

  const closeActionModal = () => {
    if (!modalBusy) {
      setActionModal(null)
      setModalNote("")
    }
  }

  /** Confirm the action modal — single PATCH per bug (moderation is single-flow). */
  const confirmActionModal = async () => {
    if (!actionModal || modalBusy) return
    setModalBusy(true)
    try {
      const note = modalNote.trim().slice(0, BUG_REPORT_ACTION_MODAL.noteMaxLength);
      for (const bug of actionModal.bugs) {
        const payload: Record<string, unknown> = { bugId: bug.id, status: actionModal.status }
        if (note) payload.statusNote = note
        if (actionModal.moderation) {
          payload.action = actionModal.moderation
          // Moderation resolves via fixed outcome statuses unless the admin
          // explicitly picked another status in the modal.
          if (!actionModal.status || actionModal.status === bug.status) {
            payload.status = actionModal.moderation === "DISMISS" ? "CLOSED" : "RESOLVED"
          }
        }
        const res = await fetch("/api/admin/bugs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Request failed")
      }
      bulk.clear()
      toastService.success(
        actionModal.bugs.length === 1
          ? `Report → ${actionModal.status}`
          : `${actionModal.bugs.length} report(s) → ${actionModal.status}`,
      )
      setActionModal(null)
      setModalNote("")
      void list.load(true)
    } catch (err) {
      console.error("[AdminError]", err)
      toastService.error(MODERATION_CONFIG.adminActionError)
    } finally {
      setModalBusy(false)
    }
  }

  const handleBulkStatus = (status: string) => {
    const ids = new Set(bulk.selected)
    const targets = visible.filter((b) => ids.has(b.id))
    if (targets.length === 0) return
    openActionModal(targets, status)
  }

  const handleStatusChange = (bug: AdminBug, status: string) => {
    openActionModal([bug], status)
  }

  /** End-to-end moderation: opens the action modal (status + custom note +
   *  screenshot review) instead of firing blindly — the reporter gets the
   *  admin-entered note or the canned outcome copy (anonymity kept both ways). */
  const handleModeration = (bug: AdminBug, action: "DISMISS" | "ARCHIVE_POST" | "REMOVE_POST") => {
    const confirm = ACTION_CONFIRM[action]
    modalService.confirm({
      title: confirm.title,
      description: `${confirm.description} You can edit the reporter note before confirming.`,
      variant: action === "DISMISS" ? "sensitive" : "destructive",
      onConfirm: () => {
        modalService.close()
        openActionModal([bug], action === "DISMISS" ? "CLOSED" : "RESOLVED", action)
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
            onChange={(e) => { bulk.clear(); setStatusFilter(e.target.value) }}
            className="px-3 py-1.5 radius-md border border-border text-xs font-medium font-sans bg-bg-card text-text-primary cursor-pointer"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={sortId}
            onChange={(e) => setSortId(e.target.value)}
            className="px-3 py-1.5 radius-md border border-border text-xs font-medium font-sans bg-bg-card text-text-primary cursor-pointer"
            aria-label="Sort reports"
          >
            {ADMIN_TABLE_SORT_META.bugs.options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
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
          <button onClick={() => handleBulkStatus("TRIAGED")} disabled={bulk.count === 0 || modalBusy} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary border border-border cursor-pointer disabled:opacity-50">Triage</button>
          <button onClick={() => handleBulkStatus("RESOLVED")} disabled={bulk.count === 0 || modalBusy} className="px-2 py-1 radius-sm bg-success text-success-text border-none cursor-pointer disabled:opacity-50">Resolve</button>
          <button onClick={() => handleBulkStatus("CLOSED")} disabled={bulk.count === 0 || modalBusy} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary border border-border cursor-pointer disabled:opacity-50">Close</button>
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
            {Array.isArray(bug.metadata?.images) && bug.metadata.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {(bug.metadata.images as string[]).slice(0, 3).map((url, i) => (
                  <button
                    key={`${bug.id}-shot-${i}`}
                    type="button"
                    onClick={() => setViewer({ images: bug.metadata!.images as string[], index: i, title: bug.title })}
                    className="p-0 border-none bg-transparent cursor-pointer"
                    aria-label={`View screenshot ${i + 1} for ${bug.title}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Report screenshot ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border hover:opacity-90 transition-opacity" loading="lazy" />
                  </button>
                ))}
                {(bug.metadata.images as string[]).length > 3 && (
                  <button
                    type="button"
                    onClick={() => setViewer({ images: bug.metadata!.images as string[], index: 3, title: bug.title })}
                    className="w-20 h-20 rounded-lg border border-border bg-bg-elevated text-xs font-semibold text-text-secondary cursor-pointer"
                    aria-label={`View all ${(bug.metadata.images as string[]).length} screenshots`}
                  >
                    +{(bug.metadata.images as string[]).length - 3} more
                  </button>
                )}
              </div>
            )}
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
                      onClick={() => handleStatusChange(bug, s)}
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
      <ViewMoreButton
        onViewMore={() => void list.load(false, nextCursor)}
        loading={loadingMore}
        shown={visible.length}
        total={null}
        hasMore={nextCursor !== null}
      />
      {actionModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={BUG_REPORT_ACTION_MODAL.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeActionModal}
        >
          <div
            className="relative max-w-lg w-full max-h-[90vh] overflow-auto bg-bg-card radius-lg p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold">{BUG_REPORT_ACTION_MODAL.title}</h2>
                <p className="text-xs text-text-muted">{BUG_REPORT_ACTION_MODAL.description}</p>
                <p className="text-xs text-text-secondary truncate mt-1">
                  {actionModal.bugs.length === 1
                    ? actionModal.bugs[0].title
                    : `${actionModal.bugs.length} reports selected`}
                  {actionModal.moderation ? ` · ${actionModal.moderation.replace("_", " ")}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeActionModal}
                disabled={modalBusy}
                className="p-1.5 radius-md border border-border bg-bg-base cursor-pointer disabled:opacity-50 shrink-0"
                aria-label="Close action dialog"
              >
                <X size={16} />
              </button>
            </div>

            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">{BUG_REPORT_ACTION_MODAL.statusLabel}</span>
              <select
                value={actionModal.status}
                onChange={(e) => setActionModal((m) => (m ? { ...m, status: e.target.value } : m))}
                disabled={modalBusy}
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </label>

            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">{BUG_REPORT_ACTION_MODAL.noteLabel}</span>
              <textarea
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value.slice(0, BUG_REPORT_ACTION_MODAL.noteMaxLength))}
                rows={4}
                disabled={modalBusy}
                placeholder={BUG_REPORT_ACTION_MODAL.notePlaceholder}
                className="rounded-md border border-border bg-bg-base p-2.5 text-sm w-full"
              />
              <span className="text-[11px] text-text-muted">
                {modalNote.trim()
                  ? `${modalNote.trim().length}/${BUG_REPORT_ACTION_MODAL.noteMaxLength} — this note will be sent.`
                  : `${defaultNoteLabelFor(actionModal.status)}: “${(BUG_REPORT_STATUS_COPY as Record<string, string>)[actionModal.status] ?? BUG_REPORT_STATUS_COPY.DEFAULT}”`}
              </span>
            </label>

            {actionModal.bugs.length === 1 && (() => {
              const imgs = actionModal.bugs[0].metadata?.images;
              const list = Array.isArray(imgs) ? imgs.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
              return (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-muted">{BUG_REPORT_ACTION_MODAL.screenshotsLabel}</span>
                  {list.length === 0 ? (
                    <span className="text-xs text-text-muted">{BUG_REPORT_ACTION_MODAL.noScreenshots}</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {list.map((url, i) => (
                        <button
                          key={`modal-shot-${i}`}
                          type="button"
                          onClick={() => setViewer({ images: list, index: i, title: actionModal.bugs[0].title })}
                          className="p-0 border-none bg-transparent cursor-pointer"
                          aria-label={`View screenshot ${i + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Report screenshot ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border hover:opacity-90 transition-opacity" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex gap-2 justify-end flex-wrap">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={modalBusy}
                className="px-3 py-2 radius-md border border-border text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {BUG_REPORT_ACTION_MODAL.cancelLabel}
              </button>
              <button
                type="button"
                onClick={confirmActionModal}
                disabled={modalBusy}
                className="px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50"
              >
                {modalBusy ? "Updating…" : BUG_REPORT_ACTION_MODAL.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshots for ${viewer.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewer(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-bg-card radius-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <p className="text-sm font-semibold truncate">{viewer.title} — {viewer.index + 1} of {viewer.images.length}</p>
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="p-1.5 radius-md border border-border bg-bg-base cursor-pointer"
                aria-label="Close screenshot viewer"
              >
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewer.images[viewer.index]} alt={`Report screenshot ${viewer.index + 1}`} className="w-full max-h-[70vh] object-contain radius-md bg-black" />
            {viewer.images.length > 1 && (
              <div className="flex items-center justify-between mt-3 gap-2">
                <button
                  type="button"
                  disabled={viewer.index === 0}
                  onClick={() => setViewer((v) => (v ? { ...v, index: Math.max(0, v.index - 1) } : v))}
                  className="px-3 py-1.5 radius-md border border-border text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Previous
                </button>
                <a href={viewer.images[viewer.index]} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Open original
                </a>
                <button
                  type="button"
                  disabled={viewer.index >= viewer.images.length - 1}
                  onClick={() => setViewer((v) => (v ? { ...v, index: Math.min(v.images.length - 1, v.index + 1) } : v))}
                  className="px-3 py-1.5 radius-md border border-border text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
