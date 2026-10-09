"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Search, Shield } from "lucide-react"
import { AppInput } from "@/app/components/ui"
import { useBulkSelection } from "@/app/lib/hooks/useBulkSelection"
import { ADMIN_BULK_SELECT_META } from "@/app/lib/config/admin"
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
  role: string
  rewardTier: string
  rewardPoints: number
  verified: boolean
  isDeleted?: boolean
  deletionScheduledFor?: string | null
  _count: { posts: number }
  createdAt: string
}

const DELETION_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Deletion pending" },
  { id: "deleted", label: "Deleted" },
] as const

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [bulkBusy, setBulkBusy] = useState(false)
  const [deletionFilter, setDeletionFilter] = useState<string>("all")

  const bulk = useBulkSelection(users, (u) => u.id)

  const loadRef = useRef<AbortController | null>(null)

  const load = async (q?: string, deletion?: string) => {
    loadRef.current?.abort()
    loadRef.current = new AbortController()
    const signal = loadRef.current.signal
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      const d = deletion ?? deletionFilter
      if (d && d !== "all") params.set("deletion", d)
      const qs = params.toString()
      const url = qs ? `/api/admin/users?${qs}` : "/api/admin/users"
      const res = await fetch(url, { signal })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users ?? [])
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return
      console.error("Failed to load users")
    } finally {
      setLoading(false)
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
    load(search || undefined, deletionFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletionFilter])

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
    const run = async () => {
      setBulkBusy(true)
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: ids, action: next ? "verify" : "unverify" }),
        })
        if (!res.ok) throw new Error("bulk failed")
        bulk.clear()
        await load(search || undefined)
        toastService.success(`${ids.length} email(s) ${next ? "verified" : "unverified"}`)
      } catch {
        toastService.error("Bulk verification failed")
      } finally {
        setBulkBusy(false)
      }
    }
    if (!next) {
      modalService.confirm({
        title: `Mark ${ids.length} email(s) unverified?`,
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
    const prevRoles = new Map(users.filter((u) => bulk.selected.has(u.id)).map((u) => [u.id, u.role]))
    modalService.confirm({
      title: role === "ADMIN" ? `Make ${ids.length} user(s) admin?` : `Demote ${ids.length} user(s)?`,
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
              body: JSON.stringify({ userIds: ids, role }),
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
              message: `${ids.length} user(s) updated to ${role}`,
              undoLabel: "Undo",
              onUndo: () => undoService.execute(undoId),
            })
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
    modalService.confirm({
      title: `Suspend ${ids.length} user(s)?`,
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
              body: JSON.stringify({ userIds: ids }),
            })
            if (!res.ok) throw new Error("bulk failed")
            bulk.clear()
            await load(search || undefined)
            toastService.success(`${ids.length} user(s) suspended`)
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
    modalService.confirm({
      title: `Request deletion for ${ids.length} user(s)?`,
      description: "Accounts + posts are archived immediately and anonymized after the 7-day grace period. Likes/bookmarks are removed; anonymised posts retained. Users can reverse until then.",
      variant: "destructive",
      confirmLabel: "Request deletion",
      onConfirm: () => {
        modalService.close()
        void (async () => {
          setBulkBusy(true)
          try {
            let ok = 0
            for (const id of ids) {
              const res = await fetch("/api/admin/deletions/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request", userId: id, reason: "admin bulk deletion" }),
              })
              if (res.ok) ok += 1
            }
            bulk.clear()
            await load(search || undefined)
            if (ok === ids.length) toastService.success(`${ok} deletion request(s) started (7-day grace)`)
            else toastService.error(`${ok}/${ids.length} started — check deletions panel`)
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

  const allSelected = users.length > 0 && users.every((u) => bulk.selected.has(u.id))

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">Users</h1>
          <div className="text-sm text-text-secondary truncate">Manage registered users</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Deletion filter">
            {DELETION_FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={deletionFilter === f.id}
                onClick={() => setDeletionFilter(f.id)}
                className={`px-2.5 py-1.5 radius-md text-xs font-medium cursor-pointer border transition-colors ${
                  deletionFilter === f.id
                    ? "bg-primary-muted text-primary border-primary"
                    : "bg-bg-card text-text-secondary border-border hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-64">
            <AppInput
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={14} />}
            />
          </div>
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
          <button onClick={() => handleBulkVerify(true)} disabled={bulk.count === 0 || bulkBusy} title="Mark selected emails verified" className="px-2 py-1 radius-sm bg-success text-white border-none font-semibold cursor-pointer disabled:opacity-50">Verify emails</button>
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
                    <Link href={`/profile/${u.userName}`} className="no-underline shrink-0">
                      <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                    </Link>
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
                    u.verified ? "bg-success text-white" : "bg-warning text-warning-text"
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
                  <div className="flex gap-1 flex-wrap">
                    {u.verified ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVerifyChange(u.id, false) }}
                        title="Mark email unverified (user gets a fresh code on next request)"
                        className="px-2 py-1 radius-sm text-[10px] font-semibold bg-warning text-warning-text border-none cursor-pointer hover:opacity-80 transition-all duration-fast"
                      >
                        Unverify
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleVerifyChange(u.id, true) }}
                          title="Mark email verified (user is notified)"
                          className="px-2 py-1 radius-sm text-[10px] font-semibold bg-success text-white border-none cursor-pointer hover:opacity-80 transition-all duration-fast"
                        >
                          Verify
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleResendCode(u.id) }}
                          title="Generate + email a fresh verification code"
                          className="px-2 py-1 radius-sm text-[10px] font-semibold bg-bg-elevated text-text-secondary border border-border cursor-pointer hover:text-primary transition-all duration-fast"
                        >
                          Resend code
                        </button>
                      </>
                    )}
                    {u.role !== "ADMIN" ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRoleChange(u.id, "ADMIN") }}
                        className="px-2 py-1 radius-sm text-[10px] font-semibold bg-primary-muted text-primary border-none cursor-pointer hover:bg-primary hover:text-text-inverse transition-all duration-fast"
                      >
                        Make Admin
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRoleChange(u.id, "USER") }}
                        className="px-2 py-1 radius-sm text-[10px] font-semibold bg-bg-elevated text-text-secondary border border-border cursor-pointer hover:text-primary transition-all duration-fast"
                      >
                        Demote
                      </button>
                    )}
                    <Link href={`/profile/${u.userName}`} className="px-2 py-1 radius-sm text-[10px] font-semibold bg-bg-elevated text-text-secondary no-underline border border-border hover:text-primary transition-all duration-fast">
                      View
                    </Link>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
