"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import { Search, Shield, Check, XCircle, Mail, Eye, UserCog, UserMinus, Trash2, Undo2 } from "lucide-react"
import { AppInput, AppTableRowActions, AppAvatar, type TableRowAction } from "@/app/components/ui"
import { useBulkSelection } from "@/app/lib/hooks/useBulkSelection"
import {
  ADMIN_BULK_SELECT_META,
  ADMIN_PAGINATION_META,
  ADMIN_TABLE_SORT_META,
  ADMIN_USER_DELETION_META,
  ADMIN_USER_FILTERS,
  allowedUserRowActions,
  deletionQueryForFilter,
  parseAdminUserFilter,
  type AdminUserFilterId,
} from "@/app/lib/config/admin"
import { modalService } from "@/app/lib/services/modalService"
import { toastService } from "@/app/lib/services/toastService"
import { undoService } from "@/app/lib/services/undoService"

interface AdminUser {
  id: string
  userName: string
  firstName: string
  lastName: string
  email: string
  avatar: string | null
  avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null
  role: string
  rewardTier: string
  rewardPoints: number
  verified: boolean
  isDeleted?: boolean
  deletionScheduledFor?: string | null
  _count: { posts: number }
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [bulkBusy, setBulkBusy] = useState(false)
  const [deletionFilter, setDeletionFilter] = useState<AdminUserFilterId>("all")
  const [rowDeletionBusy, setRowDeletionBusy] = useState<string | null>(null)
  // Bulk-safe cursor pagination (append-only; selection Set survives view-more)
  // + config-driven asc/desc sort (?sort=&dir= validated server-side).
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sortId, setSortId] = useState(ADMIN_TABLE_SORT_META.users.defaultId)

  const bulk = useBulkSelection(users, (u) => u.id)

  /**
   * Split the current bulk selection into live vs fully-deleted accounts.
   * Deleted accounts are view-only, so verify / role / suspend bulk actions
   * skip them with honest feedback (server enforces the same rule).
   */
  const splitLiveSelection = (ids: string[]): { live: string[]; deleted: string[] } => {
    try {
      const byId = new Map(users.map((u) => [u.id, u]))
      const live: string[] = []
      const deleted: string[] = []
      for (const id of ids) {
        const u = byId.get(id)
        if (u?.isDeleted) deleted.push(id)
        else live.push(id)
      }
      return { live, deleted }
    } catch {
      return { live: ids, deleted: [] }
    }
  }

  const noteSkippedDeleted = (deletedCount: number) => {
    if (deletedCount > 0) {
      toastService.error(
        `${deletedCount} deleted account(s) skipped — deleted accounts are view-only.`
      )
    }
  }

  const loadRef = useRef<AbortController | null>(null)

  const load = async (q?: string, deletion?: string, append = false, cursor: string | null = null) => {
    if (append) {
      if (!cursor || loadingMore) return
      setLoadingMore(true)
    } else {
      loadRef.current?.abort()
      loadRef.current = new AbortController()
      setLoading(true)
    }
    const signal = loadRef.current?.signal
    try {
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      const d = deletion ?? deletionFilter
      const query = deletionQueryForFilter(parseAdminUserFilter(d))
      if (query) params.set("deletion", query)
      const sortOpt = ADMIN_TABLE_SORT_META.users.options.find((o) => o.id === sortId)
        ?? ADMIN_TABLE_SORT_META.users.options[0]
      params.set("sort", sortOpt.sort)
      params.set("dir", sortOpt.dir)
      params.set("limit", String(ADMIN_PAGINATION_META.defaultLimit))
      if (append && cursor) params.set("cursor", cursor)
      const qs = params.toString()
      const url = qs ? `/api/admin/users?${qs}` : "/api/admin/users"
      const res = await fetch(url, { signal })
      if (res.ok) {
        const data = await res.json()
        const fresh = (data.users ?? []) as AdminUser[]
        setUsers((prev) => {
          if (!append) return fresh
          const seen = new Set(prev.map((u) => u.id))
          return [...prev, ...fresh.filter((u) => !seen.has(u.id))]
        })
        setNextCursor(data.nextCursor ?? null)
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return
      console.error("Failed to load users")
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return () => { loadRef.current?.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { if (search) load(search); else load() }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    bulk.clear()
    load(search || undefined, deletionFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletionFilter, sortId])

  /** First-N quick presets = earliest N signups (createdAt asc), not the on-screen order. */
  const handleSelectFirstNBySignup = async (n: number) => {
    try {
      setBulkBusy(true)
      const res = await fetch(`/api/admin/users?order=oldest&limit=${n}`)
      if (!res.ok) throw new Error("fetch failed")
      const data = await res.json()
      const ids = ((data.users ?? []) as AdminUser[]).slice(0, n).map((u) => u.id)
      // Ensure listed rows exist locally where possible, then select the ids.
      bulk.selectIds(ids)
      toastService.success(`Selected first ${ids.length} signups`)
    } catch {
      // Fallback: first N of the current list (non-breaking).
      bulk.selectFirstN(n)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      if (res.ok) load(search || undefined)
      else toastService.error("Failed to update role")
    } catch (err) {
      console.error("Failed to update role", err)
      toastService.error("Failed to update role")
    }
  }

  /** Admin email-verification actions (verify / unverify / resend code). */
  const handleVerifyChange = async (userId: string, next: boolean) => {
    const apply = async () => {
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action: next ? "verify" : "unverify" }),
        })
        if (!res.ok) throw new Error("verify failed")
        const data = await res.json().catch(() => ({})) as { previous?: { id: string; verified: boolean }[] }
        const prev = data.previous?.[0]
        await load(search || undefined)
        toastService.success(next ? "Email marked verified" : "Email marked unverified")
        if (prev) {
          const undoId = `admin-user-verify:${userId}:${Date.now()}`
          undoService.register({
            id: undoId,
            label: "Undo verification change",
            onUndo: () => {
              void (async () => {
                await fetch("/api/admin/users", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId, action: prev.verified ? "verify" : "unverify" }),
                })
                toastService.success("Verification restored")
                load(search || undefined)
              })()
            },
          })
          toastService.undo({
            message: next ? "Email marked verified" : "Email marked unverified",
            undoLabel: "Undo",
            onUndo: () => undoService.execute(undoId),
          })
        }
      } catch {
        toastService.error("Verification update failed")
      }
    }
    if (!next) {
      modalService.confirm({
        title: "Mark email unverified?",
        description: "The user will need a fresh verification code to confirm their address.",
        variant: "sensitive",
        confirmLabel: "Mark unverified",
        onConfirm: () => { modalService.close(); void apply() },
      })
    } else {
      void apply()
    }
  }

  const handleResendCode = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "resend-verification" }),
      })
      if (!res.ok) throw new Error("resend failed")
      const data = await res.json().catch(() => ({})) as { emailed?: number; errors?: string[] }
      if (data.emailed) toastService.success(`Verification code sent (${data.emailed})`)
      else if (data.errors?.length) toastService.error(data.errors[0])
      else toastService.success("Nothing to send — already verified")
    } catch {
      toastService.error("Failed to resend code")
    }
  }

  const handleBulkVerify = (next: boolean) => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    const { live, deleted } = splitLiveSelection(ids)
    if (live.length === 0) {
      noteSkippedDeleted(deleted.length)
      return
    }
    const run = async () => {
      setBulkBusy(true)
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: live, action: next ? "verify" : "unverify" }),
        })
        if (!res.ok) throw new Error("bulk failed")
        bulk.clear()
        await load(search || undefined)
        toastService.success(`${live.length} email(s) ${next ? "verified" : "unverified"}`)
        noteSkippedDeleted(deleted.length)
      } catch {
        toastService.error("Bulk verification failed")
      } finally {
        setBulkBusy(false)
      }
    }
    if (!next) {
      modalService.confirm({
        title: `Mark ${live.length} email(s) unverified?`,
        description: "Affected users will need fresh verification codes.",
        variant: "sensitive",
        confirmLabel: "Mark unverified",
        onConfirm: () => { modalService.close(); void run() },
      })
    } else {
      void run()
    }
  }

  const handleBulkRole = (role: string) => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    const { live, deleted } = splitLiveSelection(ids)
    if (live.length === 0) {
      noteSkippedDeleted(deleted.length)
      return
    }
    const prevRoles = new Map(users.filter((u) => live.includes(u.id)).map((u) => [u.id, u.role]))
    modalService.confirm({
      title: role === "ADMIN" ? `Make ${live.length} user(s) admin?` : `Demote ${live.length} user(s)?`,
      description: role === "ADMIN"
        ? "Selected users will gain admin privileges."
        : "Selected users will be demoted to regular users.",
      variant: "sensitive",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setBulkBusy(true)
          try {
            const res = await fetch("/api/admin/users", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userIds: live, role }),
            })
            if (!res.ok) throw new Error("bulk failed")
            bulk.clear()
            await load(search || undefined)
            const undoId = `admin-users-role:${Date.now()}`
            undoService.register({
              id: undoId,
              label: "Undo bulk role change",
              onUndo: () => {
                void (async () => {
                  // Restore each previous role individually (non-breaking loop).
                  for (const [id, prevRole] of prevRoles) {
                    await fetch("/api/admin/users", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: id, role: prevRole }),
                    })
                  }
                  toastService.success("Roles restored")
                  load(search || undefined)
                })()
              },
            })
            toastService.undo({
              message: `${live.length} user(s) updated to ${role}`,
              undoLabel: "Undo",
              onUndo: () => undoService.execute(undoId),
            })
            noteSkippedDeleted(deleted.length)
          } catch {
            toastService.error("Bulk update failed")
          } finally {
            setBulkBusy(false)
          }
        })()
      },
    })
  }

  const handleBulkSuspend = () => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    const { live, deleted } = splitLiveSelection(ids)
    if (live.length === 0) {
      noteSkippedDeleted(deleted.length)
      return
    }
    modalService.confirm({
      title: `Suspend ${live.length} user(s)?`,
      description: "Selected users will be demoted and unverified. This can be undone.",
      variant: "destructive",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setBulkBusy(true)
          try {
            const res = await fetch("/api/admin/users", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userIds: live }),
            })
            if (!res.ok) throw new Error("bulk failed")
            bulk.clear()
            await load(search || undefined)
            toastService.success(`${live.length} user(s) suspended`)
            noteSkippedDeleted(deleted.length)
          } catch {
            toastService.error("Bulk suspend failed")
          } finally {
            setBulkBusy(false)
          }
        })()
      },
    })
  }

  /** Safe bulk deletion: starts the 7-day archived grace flow per user (posts anonymized on finalize). */
  const handleBulkDelete = () => {
    const ids = [...bulk.selected]
    if (ids.length === 0) return
    const { live, deleted } = splitLiveSelection(ids)
    if (live.length === 0) {
      noteSkippedDeleted(deleted.length)
      return
    }
    modalService.confirm({
      title: `Request deletion for ${live.length} user(s)?`,
      description: ADMIN_USER_DELETION_META.requestDescription,
      variant: "destructive",
      confirmLabel: ADMIN_USER_DELETION_META.requestConfirmLabel,
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setBulkBusy(true)
          try {
            let ok = 0
            for (const id of live) {
              const res = await fetch("/api/admin/deletions/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request", userId: id, reason: "admin bulk deletion" }),
              })
              if (res.ok) ok += 1
            }
            bulk.clear()
            await load(search || undefined)
            if (ok === live.length) toastService.success(`${ok} deletion request(s) started (7-day grace)`)
            else toastService.error(`${ok}/${live.length} started — check deletions panel`)
            noteSkippedDeleted(deleted.length)
          } catch {
            toastService.error("Bulk deletion failed")
          } finally {
            setBulkBusy(false)
          }
        })()
      },
    })
  }

  const tierColors: Record<string, string> = {
    BRONZE: "bg-bg-elevated text-text-secondary",
    SILVER: "bg-bg-elevated text-text-primary",
    GOLD: "bg-warning text-warning-text",
    PLATINUM: "bg-info text-info-text",
  }

  /**
   * Per-user deletion trio (non-breaking additive):
   * - Request deletion → 7-day grace (reversible, undo toast reverses it).
   * - Reverse request → restores the archived account.
   * - Delete now → destructive safe deletion: same anonymize pipeline, grace
   *   skipped, explicit irreversibility warning, no fake undo (recovery is
   *   off-platform from backups — see ADMIN_USER_DELETION_META).
   */
  const handleRequestDeletion = (u: AdminUser) => {
    modalService.confirm({
      title: ADMIN_USER_DELETION_META.requestTitle,
      description: `${ADMIN_USER_DELETION_META.requestDescription} (@${u.userName}).`,
      variant: "destructive",
      confirmLabel: ADMIN_USER_DELETION_META.requestConfirmLabel,
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setRowDeletionBusy(u.id)
          try {
            const res = await fetch("/api/admin/deletions/finalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "request", userId: u.id, reason: "admin single-user deletion" }),
            })
            const data = await res.json().catch(() => ({})) as { error?: string }
            if (!res.ok) throw new Error(data.error ?? "Request failed")
            await load(search || undefined)
            const undoId = `admin-user-delete-request:${u.id}:${Date.now()}`
            undoService.register({
              id: undoId,
              label: "Undo deletion request",
              onUndo: () => {
                void (async () => {
                  await fetch("/api/admin/deletions/finalize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "cancel", userId: u.id }),
                  })
                  toastService.success(ADMIN_USER_DELETION_META.cancelSuccess)
                  load(search || undefined)
                })()
              },
            })
            toastService.undo({
              message: `${ADMIN_USER_DELETION_META.requestUndoMessage} (@${u.userName})`,
              undoLabel: ADMIN_USER_DELETION_META.requestUndoLabel,
              onUndo: () => undoService.execute(undoId),
            })
          } catch (e) {
            toastService.error(e instanceof Error ? e.message : "Deletion request failed")
          } finally {
            setRowDeletionBusy(null)
          }
        })()
      },
    })
  }

  const handleCancelDeletion = (u: AdminUser) => {
    modalService.confirm({
      title: ADMIN_USER_DELETION_META.cancelTitle,
      description: `${ADMIN_USER_DELETION_META.cancelDescription} (@${u.userName}).`,
      variant: "sensitive",
      confirmLabel: ADMIN_USER_DELETION_META.cancelConfirmLabel,
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setRowDeletionBusy(u.id)
          try {
            const res = await fetch("/api/admin/deletions/finalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "cancel", userId: u.id }),
            })
            const data = await res.json().catch(() => ({})) as { error?: string }
            if (!res.ok) throw new Error(data.error ?? "Reverse failed")
            await load(search || undefined)
            toastService.success(ADMIN_USER_DELETION_META.cancelSuccess)
          } catch (e) {
            toastService.error(e instanceof Error ? e.message : "Reverse failed")
          } finally {
            setRowDeletionBusy(null)
          }
        })()
      },
    })
  }

  const handleDeleteNow = (u: AdminUser) => {
    modalService.confirm({
      title: ADMIN_USER_DELETION_META.deleteNowTitle,
      description: `${ADMIN_USER_DELETION_META.deleteNowDescription} (@${u.userName}, ${u.email}).`,
      variant: "destructive",
      confirmLabel: ADMIN_USER_DELETION_META.deleteNowConfirmLabel,
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setRowDeletionBusy(u.id)
          try {
            const res = await fetch("/api/admin/deletions/finalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "deleteNow", userId: u.id, reason: "admin immediate deletion" }),
            })
            const data = await res.json().catch(() => ({})) as { error?: string }
            if (!res.ok) throw new Error(data.error ?? "Delete failed")
            await load(search || undefined)
            toastService.success(
              `${ADMIN_USER_DELETION_META.deleteNowSuccess} (@${u.userName}). ${ADMIN_USER_DELETION_META.deleteNowRecoveryNote}`
            )
          } catch (e) {
            toastService.error(e instanceof Error ? e.message : "Delete failed")
          } finally {
            setRowDeletionBusy(null)
          }
        })()
      },
    })
  }

  const allSelected = users.length > 0 && users.every((u) => bulk.selected.has(u.id))

  /**
   * Metadata-driven row actions: deleted accounts collapse to view-only
   * (verify / resend / role changes cannot revive anonymized data). Colors
   * from the old inline buttons are preserved as dropdown item classNames.
   */
  const buildRowActions = (u: AdminUser): TableRowAction[] => {
    const allowed = new Set<string>(allowedUserRowActions(u))
    const busy = rowDeletionBusy === u.id
    const busyLabel = (label: string) => (busy ? "Working…" : label)
    const actions: TableRowAction[] = []
    try {
      if (u.isDeleted) {
        return [
          {
            id: "view",
            label: "View",
            icon: Eye,
            title: "View deleted profile (generic deleted-user page)",
            className: "bg-bg-elevated text-text-secondary",
            href: `/profile/${encodeURIComponent(u.userName)}`,
          },
        ]
      }
      if (u.verified && allowed.has("unverify")) {
        actions.push({
          id: "unverify",
          label: "Unverify",
          icon: XCircle,
          title: "Mark email unverified (user gets a fresh code on next request)",
          className: "bg-warning text-warning-text",
          onSelect: () => handleVerifyChange(u.id, false),
        })
      }
      if (!u.verified && allowed.has("verify")) {
        actions.push({
          id: "verify",
          label: "Verify",
          icon: Check,
          title: "Mark email verified (user is notified)",
          className: "bg-success text-success-text",
          onSelect: () => handleVerifyChange(u.id, true),
        })
      }
      if (!u.verified && allowed.has("resend")) {
        actions.push({
          id: "resend",
          label: "Resend code",
          icon: Mail,
          title: "Generate + email a fresh verification code",
          className: "bg-bg-elevated text-text-secondary",
          onSelect: () => handleResendCode(u.id),
        })
      }
      if (u.role !== "ADMIN" && allowed.has("makeAdmin")) {
        actions.push({
          id: "makeAdmin",
          label: "Make admin",
          icon: UserCog,
          title: "Grant admin privileges",
          className: "bg-primary-muted text-primary",
          onSelect: () => handleRoleChange(u.id, "ADMIN"),
        })
      }
      if (u.role === "ADMIN" && allowed.has("demote")) {
        actions.push({
          id: "demote",
          label: "Demote",
          icon: UserMinus,
          title: "Demote to regular user",
          className: "bg-bg-elevated text-text-secondary",
          onSelect: () => handleRoleChange(u.id, "USER"),
        })
      }
      actions.push({
        id: "view",
        label: "View",
        icon: Eye,
        title: "View profile",
        className: "bg-bg-elevated text-text-secondary",
        href: `/profile/${encodeURIComponent(u.userName)}`,
      })
      if (!u.isDeleted && !u.deletionScheduledFor && allowed.has("requestDeletion")) {
        actions.push({
          id: "requestDeletion",
          label: busyLabel("Request deletion"),
          icon: Trash2,
          title: "Request deletion — 7-day grace, reversible (undo available)",
          className: "bg-warning text-warning-text",
          disabled: busy,
          disabledReason: "Request in progress…",
          onSelect: () => handleRequestDeletion(u),
        })
        actions.push({
          id: "deleteNow",
          label: busyLabel("Delete now"),
          icon: Trash2,
          variant: "destructive",
          title: "Delete now — skips grace, anonymizes immediately (irreversible in-app)",
          className: "bg-error text-error-text",
          disabled: busy,
          disabledReason: "Request in progress…",
          onSelect: () => handleDeleteNow(u),
        })
      }
      if (!u.isDeleted && u.deletionScheduledFor && allowed.has("cancelDeletion")) {
        actions.push({
          id: "cancelDeletion",
          label: busyLabel("Reverse deletion"),
          icon: Undo2,
          title: "Reverse the pending request — restores the account",
          className: "bg-success text-success-text",
          disabled: busy,
          disabledReason: "Request in progress…",
          onSelect: () => handleCancelDeletion(u),
        })
        actions.push({
          id: "deleteNow",
          label: busyLabel("Delete now"),
          icon: Trash2,
          variant: "destructive",
          title: "Delete now — skips remaining grace, anonymizes immediately (irreversible in-app)",
          className: "bg-error text-error-text",
          disabled: busy,
          disabledReason: "Request in progress…",
          onSelect: () => handleDeleteNow(u),
        })
      }
    } catch {
      /* fall through with whatever was built — never break the row */
    }
    return actions.length > 0
      ? actions
      : [
          {
            id: "view",
            label: "View",
            icon: Eye,
            className: "bg-bg-elevated text-text-secondary",
            href: `/profile/${encodeURIComponent(u.userName)}`,
          },
        ]
  }

  const filterCounts = useMemo(() => {
    try {
      let active = 0
      let pending = 0
      let deleted = 0
      for (const u of users) {
        if (u.isDeleted) deleted += 1
        else if (u.deletionScheduledFor) pending += 1
        else active += 1
      }
      return { all: users.length, active, pending, deleted }
    } catch {
      return { all: users.length, active: 0, pending: 0, deleted: 0 }
    }
  }, [users])

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">Users</h1>
          <div className="text-sm text-text-secondary truncate">Manage registered users</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Deletion filter">
            {ADMIN_USER_FILTERS.options.map((f) => {
              const count =
                f.id === "active" ? filterCounts.active
                : f.id === "pending" ? filterCounts.pending
                : f.id === "deleted" ? filterCounts.deleted
                : filterCounts.all
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={deletionFilter === f.id}
                  title={f.description}
                  onClick={() => setDeletionFilter(parseAdminUserFilter(f.id))}
                  className={`px-2.5 py-1.5 radius-md text-xs font-medium cursor-pointer border transition-colors ${
                    deletionFilter === f.id
                      ? "bg-primary-muted text-primary border-primary"
                      : "bg-bg-card text-text-secondary border-border hover:text-text-primary"
                  }`}
                >
                  {f.label}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
          <div className="w-full sm:w-64">
            <AppInput
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={14} />}
            />
          </div>
          <select
            value={sortId}
            onChange={(e) => setSortId(e.target.value)}
            className="px-3 py-1.5 radius-md border border-border text-xs font-medium font-sans bg-bg-card text-text-primary cursor-pointer"
            aria-label="Sort users"
          >
            {ADMIN_TABLE_SORT_META.users.options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-bg-card border border-border radius-lg px-3 py-2 text-xs min-w-0">
        <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => (allSelected ? bulk.clear() : bulk.selectAll())}
            className="w-4 h-4 accent-primary cursor-pointer"
            aria-label="Select all users"
          />
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
            <button key={p.id} onClick={() => handleSelectFirstNBySignup(p.count)} title="Earliest signups first" className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary hover:text-primary cursor-pointer border-none">
              {p.label}
            </button>
          ))}
        </span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <button onClick={() => handleBulkRole("ADMIN")} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-primary-muted text-primary border-none font-semibold cursor-pointer disabled:opacity-50">Make admin</button>
          <button onClick={() => handleBulkRole("USER")} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-bg-elevated text-text-secondary border border-border cursor-pointer disabled:opacity-50">Demote</button>
          <button onClick={() => handleBulkVerify(true)} disabled={bulk.count === 0 || bulkBusy} title="Mark selected emails verified" className="px-2 py-1 radius-sm bg-success text-success-text border border-success-border font-semibold cursor-pointer disabled:opacity-50">Verify emails</button>
          <button onClick={handleBulkSuspend} disabled={bulk.count === 0 || bulkBusy} className="px-2 py-1 radius-sm bg-error text-error-text border-none font-semibold cursor-pointer disabled:opacity-50">Suspend</button>
          <button onClick={handleBulkDelete} disabled={bulk.count === 0 || bulkBusy} title="Safe deletion: 7-day grace, posts anonymized" className="px-2 py-1 radius-sm bg-error text-error-text border border-error-border font-semibold cursor-pointer disabled:opacity-50">Delete (safe)</button>
        </span>
      </div>

      <div className="overflow-x-auto radius-lg border border-border bg-bg-card shadow-xs max-w-full">
        <table className="w-full border-collapse text-xs min-w-[880px]">
          <thead>
            <tr className="bg-bg-elevated">
              <th className="px-3 py-3 w-10 border-b border-border-strong"><span className="sr-only">Select</span></th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">User</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Email</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Role</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Email status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Tier</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Posts</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Joined</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-text-muted">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-text-muted">No users found</td></tr>
            ) : users.map((u) => {
              const checked = bulk.selected.has(u.id)
              return (
              <tr key={u.id} className={`hover:bg-bg-elevated transition-colors duration-fast cursor-pointer ${checked ? "bg-primary-muted/40" : ""}`}>
                <td className="px-3 py-3 border-b border-border" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => bulk.toggle(u.id)}
                    aria-label={`Select ${u.userName}`}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 border-b border-border max-w-[220px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AppAvatar
                      src={u.avatar ?? undefined}
                      alt={`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.userName}
                      size={32}
                      config={u.avatarConfig ?? undefined}
                      verified={u.verified}
                      userName={u.userName}
                    />
                    <div className="min-w-0">
                      <Link href={`/profile/${u.userName}`} className="text-xs font-semibold no-underline hover:underline text-text-primary block truncate">{u.firstName} {u.lastName}</Link>
                      <Link href={`/profile/${u.userName}`} className="text-[10px] text-text-muted no-underline hover:underline block truncate">@{u.userName}</Link>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-text-primary max-w-[200px] truncate" title={u.email}>{u.email}</td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                    u.role === "ADMIN" ? "bg-error text-error-text" : "bg-bg-elevated text-text-secondary"
                  }`}>
                    {u.role === "ADMIN" && <Shield size={10} />}
                    {u.role}
                  </span>
                  {u.isDeleted && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 radius-pill text-[10px] font-semibold bg-bg-elevated text-text-muted">Deleted</span>
                  )}
                  {!u.isDeleted && u.deletionScheduledFor && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 radius-pill text-[10px] font-semibold bg-warning text-warning-text" title={`Scheduled: ${new Date(u.deletionScheduledFor).toLocaleDateString()}`}>Deletion pending</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                    u.verified ? "bg-success text-success-text border border-success-border" : "bg-warning text-warning-text border border-warning-border"
                  }`}>
                    {u.verified ? "Verified" : "Unverified"}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 radius-pill text-[10px] font-semibold ${tierColors[u.rewardTier] ?? "bg-bg-elevated text-text-secondary"}`}>
                    {u.rewardTier}
                  </span>
                </td>                <td className="px-4 py-3 border-b border-border">{u._count.posts}</td>
                <td className="px-4 py-3 border-b border-border text-text-muted whitespace-nowrap">
                  {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
                  <AppTableRowActions actions={buildRowActions(u)} align="end" ariaLabel={`Actions for ${u.userName}`} />
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
            onClick={() => void load(search || undefined, deletionFilter, true, nextCursor)}
            disabled={loadingMore}
            className="px-4 py-2 radius-md border border-border bg-bg-card text-xs font-semibold text-text-primary cursor-pointer disabled:opacity-50"
          >
            {loadingMore ? "Loading more…" : `View more (${bulk.count} selected kept)`}
          </button>
        </div>
      )}
    </div>
  )
}
