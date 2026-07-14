"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Search, Shield } from "lucide-react"
import { AppInput } from "@/app/components/ui"

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
  _count: { posts: number }
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const loadRef = useRef<AbortController | null>(null)

  const load = async (q?: string) => {
    loadRef.current?.abort()
    loadRef.current = new AbortController()
    const signal = loadRef.current.signal
    setLoading(true)
    try {
      const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : "/api/admin/users"
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

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      if (res.ok) load(search || undefined)
    } catch (err) {
      console.error("Failed to update role", err)
    }
  }

  const tierColors: Record<string, string> = {
    BRONZE: "bg-bg-elevated text-text-secondary",
    SILVER: "bg-bg-elevated text-text-primary",
    GOLD: "bg-warning text-warning-text",
    PLATINUM: "bg-info text-info-text",
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Users</h1>
          <div className="text-sm text-text-secondary">Manage registered users</div>
        </div>
        <div className="w-64">
          <AppInput
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={14} />}
          />
        </div>
      </div>

      <div className="overflow-x-auto radius-lg border border-border bg-bg-card shadow-xs">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-bg-elevated">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">User</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Email</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Role</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Tier</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Posts</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Joined</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-strong">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-muted">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-muted">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-bg-elevated transition-colors duration-fast cursor-pointer">
                <td className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <Link href={`/profile/${u.userName}`} className="no-underline">
                      <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                    </Link>
                    <div>
                      <Link href={`/profile/${u.userName}`} className="text-xs font-semibold no-underline hover:underline text-text-primary">{u.firstName} {u.lastName}</Link>
                      <Link href={`/profile/${u.userName}`} className="text-[10px] text-text-muted no-underline hover:underline block">@{u.userName}</Link>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-text-primary">{u.email}</td>
                <td className="px-4 py-3 border-b border-border">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                    u.role === "ADMIN" ? "bg-error text-error-text" : "bg-bg-elevated text-text-secondary"
                  }`}>
                    {u.role === "ADMIN" && <Shield size={10} />}
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-border">
                  <span className={`inline-flex items-center px-2 py-0.5 radius-pill text-[10px] font-semibold ${tierColors[u.rewardTier] ?? "bg-bg-elevated text-text-secondary"}`}>
                    {u.rewardTier}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-border">{u._count.posts}</td>
                <td className="px-4 py-3 border-b border-border text-text-muted">
                  {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3 border-b border-border">
                  <div className="flex gap-1">
                    {u.role !== "ADMIN" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRoleChange(u.id, "ADMIN") }}
                        className="px-2 py-1 radius-sm text-[10px] font-semibold bg-primary-muted text-primary border-none cursor-pointer hover:bg-primary hover:text-text-inverse transition-all duration-fast"
                      >
                        Make Admin
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
