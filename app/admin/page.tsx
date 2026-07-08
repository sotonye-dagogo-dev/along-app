"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { RefreshCw, Users, FileText, Shield, Bug, ChevronUp, ChevronDown, Eye } from "lucide-react"

interface AdminStats {
  totalUsers: number
  postsToday: number
  avgValidity: number
  openBugs: number
  signups7d: { date: string; count: number }[]
  topPosts: { id: string; title: string; validityScore: number }[]
  recentUsers: { id: string; userName: string; firstName: string; lastName: string; email: string; role: string; rewardTier: string; _count: { posts: number }; createdAt: string }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        setStats(await res.json())
      } else {
        setError(true)
      }
    } catch { setError(true) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-elevated radius-md w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-bg-elevated radius-lg" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="h-64 bg-bg-elevated radius-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!stats && error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-text-muted text-sm">Failed to load dashboard data</div>
        <button onClick={load} className="px-4 py-2 radius-md bg-primary text-white text-xs font-medium border-none cursor-pointer hover:bg-primary-light transition-colors">
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  const svgW = 500
  const svgH = 160
  const padL = 40
  const padR = 20
  const padT = 10
  const padB = 30
  const plotW = svgW - padL - padR
  const plotH = svgH - padT - padB

  const maxSignup = Math.max(...stats.signups7d.map(d => d.count), 1)
  const stepX = plotW / Math.max(stats.signups7d.length - 1, 1)

  const chartPoints = stats.signups7d.map((d, i) => {
    const x = padL + i * stepX
    const y = padT + plotH - (d.count / maxSignup) * (plotH - 20) - 10
    return `${Math.round(x)},${Math.round(y)}`
  })

  const barColors = ["var(--color-primary)", "var(--color-warning-border)", "var(--color-primary)", "var(--color-info-text)", "var(--color-warning-border)"]

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Dashboard</h1>
          <div className="text-sm text-text-secondary">Admin overview &middot; Last 7 days</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 radius-md border border-border bg-bg-card text-xs font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-fast cursor-pointer"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 max-lg:grid-cols-2 gap-4">
        {[
          {
            label: "Total Users",
            value: stats.totalUsers.toLocaleString(),
            delta: "+8.2%",
            up: true,
            icon: <Users size={18} />,
            bg: "var(--color-primary-muted)",
            color: "var(--color-primary)",
          },
          {
            label: "Posts Today",
            value: stats.postsToday.toLocaleString(),
            delta: "+12.1%",
            up: true,
            icon: <FileText size={18} />,
            bg: "var(--color-info)",
            color: "var(--color-info-text)",
          },
          {
            label: "Avg Validity Score",
            value: stats.avgValidity.toString(),
            delta: "+3.7%",
            up: true,
            icon: <Shield size={18} />,
            bg: "var(--color-success)",
            color: "var(--color-success-text)",
          },
          {
            label: "Open Bug Reports",
            value: stats.openBugs.toString(),
            delta: `${stats.openBugs} open`,
            up: false,
            icon: <Bug size={18} />,
            bg: "var(--color-error)",
            color: "var(--color-error-text)",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card border border-border radius-lg p-5 shadow-xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">{stat.label}</span>
              <span className="w-9 h-9 radius-md flex items-center justify-center shrink-0" style={{ background: stat.bg, color: stat.color }}>
                {stat.icon}
              </span>
            </div>
            <div className="text-[28px] font-bold leading-tight">{stat.value}</div>
            <div className={`text-xs font-semibold inline-flex items-center gap-1 ${stat.up ? "text-success-text" : "text-error-text"}`}>
              {stat.up ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {stat.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
        <div className="bg-bg-card border border-border radius-lg p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Signups (7 days)</h3>
            <span className="text-xs text-primary font-medium cursor-pointer flex items-center gap-1">
              View all <span>&rarr;</span>
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "160px", overflow: "visible" }}>
              <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--color-border)" strokeWidth="1" />
              {[0.25, 0.5, 0.75].map(ratio => {
                const y = padT + plotH - ratio * plotH
                return (
                  <line key={ratio} x1={padL} y1={Math.round(y)} x2={svgW - padR} y2={Math.round(y)} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4" />
                )
              })}
              {chartPoints.length > 1 && (
                <polyline points={chartPoints.join(" ")} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {stats.signups7d.map((d, i) => {
                const x = padL + i * stepX
                const y = padT + plotH - (d.count / maxSignup) * (plotH - 20) - 10
                const isLast = i === stats.signups7d.length - 1
                return (
                  <circle key={d.date} cx={Math.round(x)} cy={Math.round(y)} r={isLast ? 4 : 3.5} fill={isLast ? "var(--color-primary)" : "#fff"} stroke="var(--color-primary)" strokeWidth="2.5" />
                )
              })}
              {stats.signups7d.map((d, i) => {
                const x = padL + i * stepX
                const label = new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })
                return (
                  <text key={d.date} x={Math.round(x)} y={svgH - 6} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">{label}</text>
                )
              })}
              {[Math.round(maxSignup * 0.25), Math.round(maxSignup * 0.5), Math.round(maxSignup * 0.75)].map((val, i) => {
                const y = padT + plotH - (i + 1) * 0.25 * plotH
                return (
                  <text key={val} x={padL - 5} y={Math.round(y) + 3} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">{val}</text>
                )
              })}
            </svg>
          </div>
        </div>

        <div className="bg-bg-card border border-border radius-lg p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Top Routes by Validity</h3>
            <span className="text-xs text-primary font-medium cursor-pointer flex items-center gap-1">
              View all <span>&rarr;</span>
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {stats.topPosts.map((post, i) => (
              <div key={post.id} className="flex items-center gap-2.5">
                <Link href={`/posts/${post.id}`} className="text-xs font-medium w-[140px] shrink-0 truncate no-underline hover:underline text-text-primary">{post.title}</Link>
                <div className="flex-1 h-5 bg-bg-elevated radius-pill overflow-hidden">
                  <div
                    className="h-full radius-pill"
                    style={{ width: `${post.validityScore}%`, background: barColors[i % barColors.length], transition: "width 200ms" }}
                  />
                </div>
                <span className="text-xs font-semibold text-text-secondary w-10 text-right shrink-0">{post.validityScore}</span>
              </div>
            ))}
            {stats.topPosts.length === 0 && (
              <div className="text-sm text-text-muted text-center py-4">No posts yet</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
          <Users size={18} className="text-text-secondary" />
          Users
        </h3>
        <div className="overflow-x-auto radius-lg border border-border bg-bg-card shadow-xs">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-bg-elevated">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">
                  <span className="inline-flex items-center gap-1 cursor-pointer hover:text-text-primary">User <Eye size={12} /></span>
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">Email</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">Role</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">Tier</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">Posts</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">Joined</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-text-muted text-sm">No recent users</td></tr>
              ) : stats.recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-bg-elevated transition-colors duration-fast cursor-pointer">
                  <td className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <Link href={`/profile/${u.userName}`} className="no-underline">
                        <div className="w-8 h-8 rounded-circle bg-primary-muted flex items-center justify-center text-sm font-bold shrink-0 text-primary">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                      </Link>
                      <div>
                        <Link href={`/profile/${u.userName}`} className="text-xs font-semibold no-underline hover:underline text-text-primary">{u.firstName} {u.lastName}</Link>
                        <div className="text-[10px] text-text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-text-primary">{u.email}</td>
                  <td className="px-4 py-3 border-b border-border">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                      u.role === "ADMIN" ? "bg-error text-error-text" : u.role === "MOD" ? "bg-info text-info-text" : "bg-bg-elevated text-text-secondary"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                      u.rewardTier === "GOLD" ? "bg-warning text-warning-text" : "bg-bg-elevated text-text-secondary"
                    }`}>
                      {u.rewardTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-border">{u._count.posts}</td>
                  <td className="px-4 py-3 border-b border-border text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 border-b border-border">
                    <div className="relative inline-block">
                      <Link href="/admin/users" className="w-8 h-8 radius-md border-none bg-transparent text-text-muted hover:bg-bg-elevated hover:text-text-primary cursor-pointer grid place-items-center transition-colors duration-fast no-underline">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                          <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
                        </svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
