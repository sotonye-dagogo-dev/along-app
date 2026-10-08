"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Eye, Heart, Award, TrendingUp } from "lucide-react"
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"

interface KpiData {
  totalViews: number
  totalLikes: number
  totalBookmarks: number
  avgValidity: number
  totalPosts: number
}

interface TopPost {
  id: string
  title: string
  validityScore: number
  likes: number
  views: number
}

interface DailyCount {
  date: string
  count: number
}

interface EngagementSeries {
  label: string
  data: DailyCount[]
}

interface AnalyticsData {
  kpi: KpiData
  topPosts: TopPost[]
  engagementData: EngagementSeries[]
  followerGrowth: DailyCount[]
}

const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
]

function formatCompact(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K"
  return n.toLocaleString()
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30")
  const { user, isLoading: authLoading } = useAuth()

  const { data, loading, refetch } = useCachedFetch<AnalyticsData>(
    authLoading ? null : `analytics:${user?.id ?? "guest"}:${period}`,
    `/api/analytics/user?period=${period}`,
    { ttlSec: 300, enabled: !authLoading }
  )

  const isLoading = authLoading || loading

  if (isLoading && !data) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-elevated radius-md w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-bg-elevated radius-lg" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 bg-bg-elevated radius-lg" />
            <div className="h-64 bg-bg-elevated radius-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <div className="text-center py-12 text-text-muted">
          <div>Failed to load analytics</div>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 radius-md border border-border bg-bg-card text-sm font-medium cursor-pointer font-sans"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const maxEngagement = Math.max(
    ...data.engagementData.flatMap(s => s.data.map(d => d.count)),
    1
  )

  const maxFollower = Math.max(...data.followerGrowth.map(d => d.count), 1)
  const followerGrowthRate = data.followerGrowth.length >= 2
    ? ((data.followerGrowth[data.followerGrowth.length - 1].count - data.followerGrowth[0].count) / Math.max(data.followerGrowth[0].count, 1) * 100).toFixed(1)
    : "0"

  const days = data.engagementData[0]?.data.length ?? 0
  const svgW = 500
  const svgH = 150
  const padL = 40
  const padR = 20
  const padT = 10
  const padB = 20
  const plotW = svgW - padL - padR
  const plotH = svgH - padT - padB

  const makeLine = (dailyData: DailyCount[], color: string, opacity = 1) => {
    if (dailyData.length === 0) return null
    const stepX = plotW / Math.max(dailyData.length - 1, 1)
    const points = dailyData.map((d, i) => {
      const x = padL + i * stepX
      const y = padT + plotH - (d.count / maxEngagement) * plotH * 0.8 - plotH * 0.1
      return `${x},${Math.round(y)}`
    }).join(" ")
    const dots = dailyData.map((d, i) => {
      const x = padL + i * stepX
      const y = padT + plotH - (d.count / maxEngagement) * plotH * 0.8 - plotH * 0.1
      const isLast = i === dailyData.length - 1
      return `<circle cx="${x}" cy="${Math.round(y)}" r="${isLast ? 3.5 : 3}" fill="${isLast ? color : "#fff"}" stroke="${color}" stroke-width="2.5}" style="cursor:pointer"><title>${d.count} on ${new Date(d.date).toLocaleDateString()}</title></circle>`
    }).join("")
    return { polyline: `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`, dots }
  }

  const makeArea = (dailyData: DailyCount[]) => {
    if (dailyData.length === 0) return null
    const stepX = plotW / Math.max(dailyData.length - 1, 1)
    const points = dailyData.map((d, i) => {
      const x = padL + i * stepX
      const y = padT + plotH - (d.count / maxFollower) * plotH * 0.8 - plotH * 0.1
      return `${x},${Math.round(y)}`
    }).join(" ")
    const firstX = padL
    const lastX = padL + (dailyData.length - 1) * stepX
    const bottomY = padT + plotH
    return `<polygon points="${firstX},${bottomY} ${points} ${lastX},${bottomY}" fill="var(--color-primary)" fill-opacity="0.08" />
<polyline points="${points}" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
  }

  const renderXLabels = (dailyData: DailyCount[]) => {
    if (dailyData.length === 0) return ""
    const stepX = plotW / Math.max(dailyData.length - 1, 1)
    const skip = Math.max(1, Math.floor(dailyData.length / 8))
    return dailyData.map((d, i) => {
      if (i % skip !== 0 && i !== dailyData.length - 1) return ""
      const x = padL + i * stepX
      const label = new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })
      return `<text x="${Math.round(x)}" y="${svgH - 4}" class="an-chart-label" text-anchor="middle">${label}</text>`
    }).join("")
  }

  const gridLines = [0.25, 0.5, 0.75].map((ratio) => {
    const y = padT + plotH - ratio * plotH
    return `<line x1="${padL}" y1="${Math.round(y)}" x2="${svgW - padR}" y2="${Math.round(y)}" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3" />`
  }).join("")

  const viewsLine = data.engagementData.find(s => s.label === "Views")
  const likesLine = data.engagementData.find(s => s.label === "Likes")
  const bookmarksLine = data.engagementData.find(s => s.label === "Bookmarks")

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Analytics</h1>
          <div className="text-sm text-text-secondary">Performance metrics &amp; insights</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 radius-md border border-border text-sm font-medium font-sans bg-bg-card text-text-primary cursor-pointer"
          >
            {PERIOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {[
          { icon: <Eye size={20} />, num: formatCompact(data.kpi.totalViews), label: "Total Views", bg: "var(--color-primary-muted)", color: "var(--color-primary)" },
          { icon: <Heart size={20} />, num: formatCompact(data.kpi.totalLikes), label: "Total Likes", bg: "var(--color-error)", color: "var(--color-error-text)" },
          { icon: <Award size={20} />, num: data.kpi.avgValidity.toFixed(1), label: "Avg Score", bg: "var(--color-success)", color: "var(--color-success-text)" },
          { icon: <TrendingUp size={20} />, num: data.kpi.totalPosts.toLocaleString(), label: "Total Posts", bg: "var(--color-info)", color: "var(--color-info-text)" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-bg-elevated border border-border radius-lg p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 radius-md flex items-center justify-center shrink-0" style={{ background: kpi.bg, color: kpi.color }}>
              {kpi.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[22px] font-bold leading-tight break-words">{kpi.num}</div>
              <div className="text-xs text-text-secondary font-medium break-words">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-[15px] font-semibold">Engagement over time</h3>
            <span className="text-[11px] px-2 py-0.5 radius-pill bg-primary-muted text-primary font-semibold">
              +{days > 0 ? ((data.kpi.totalViews / Math.max(days, 1)) / 10).toFixed(1) : "0"}%
            </span>
          </div>
          <div className="flex gap-4 mb-3 text-[11px]">
            {[
              { label: "Views", color: "var(--color-primary)" },
              { label: "Likes", color: "var(--color-error-text)" },
              { label: "Bookmarks", color: "var(--color-info-text)" },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 font-medium text-text-secondary">
                <span className="w-2 h-2 rounded-circle" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <div className="an-svg-chart" style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "150px", overflow: "visible" }}>
              <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--color-border)" strokeWidth="1" />
              <g dangerouslySetInnerHTML={{ __html: gridLines }} />
              {viewsLine && <g dangerouslySetInnerHTML={{ __html: makeLine(viewsLine.data, "var(--color-primary)")?.polyline ?? "" }} />}
              {viewsLine && <g dangerouslySetInnerHTML={{ __html: makeLine(viewsLine.data, "var(--color-primary)")?.dots ?? "" }} />}
              {likesLine && <g dangerouslySetInnerHTML={{ __html: makeLine(likesLine.data, "var(--color-error-text)", 0.7)?.polyline ?? "" }} />}
              {likesLine && <g dangerouslySetInnerHTML={{ __html: makeLine(likesLine.data, "var(--color-error-text)", 0.7)?.dots ?? "" }} />}
              {bookmarksLine && <g dangerouslySetInnerHTML={{ __html: makeLine(bookmarksLine.data, "var(--color-info-text)", 0.6)?.polyline ?? "" }} />}
              {bookmarksLine && <g dangerouslySetInnerHTML={{ __html: makeLine(bookmarksLine.data, "var(--color-info-text)", 0.6)?.dots ?? "" }} />}
              {viewsLine && <g dangerouslySetInnerHTML={{ __html: renderXLabels(viewsLine.data) }} />}
            </svg>
          </div>
        </div>

        <div className="bg-bg-card border border-border radius-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-[15px] font-semibold">Top posts by validity</h3>
            <span className="text-[11px] px-2 py-0.5 radius-pill bg-primary-muted text-primary font-semibold">Verified &uarr;</span>
          </div>
          <div className="flex flex-col gap-2">
            {data.topPosts.map((post, i) => {
              const colors = ["var(--color-primary)", "var(--color-error-text)", "var(--color-info-text)", "var(--color-warning-border)", "var(--color-text-muted)"]
              return (
                <div key={post.id} className="flex items-center gap-2">
                  <Link href={`/posts/${post.id}`} className="text-xs font-medium flex-1 min-w-0 truncate no-underline hover:underline text-text-primary">{post.title}</Link>
                  <div className="flex-1 h-[18px] bg-bg-elevated radius-pill overflow-hidden">
                    <div className="h-full radius-pill" style={{ width: `${post.validityScore}%`, background: colors[i % colors.length], transition: "width 200ms" }} />
                  </div>
                  <span className="text-[11px] font-semibold text-text-secondary w-9 text-right shrink-0">{post.validityScore}</span>
                </div>
              )
            })}
            {data.topPosts.length === 0 && (
              <div className="text-sm text-text-muted text-center py-4">No posts yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-elevated border border-border radius-lg p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-[15px] font-semibold">Follower growth</h3>
            <span className="text-[11px] px-2 py-0.5 radius-pill bg-primary-muted text-primary font-semibold">
              {followerGrowthRate}%
            </span>
          </div>
          <div className="an-svg-chart" style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "150px", overflow: "visible" }}>
              <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--color-border)" strokeWidth="1" />
              <g dangerouslySetInnerHTML={{ __html: gridLines }} />
              {data.followerGrowth.length > 0 && (
                <g dangerouslySetInnerHTML={{ __html: makeArea(data.followerGrowth) ?? "" }} />
              )}
              {data.followerGrowth.length > 0 && (
                <g dangerouslySetInnerHTML={{ __html: renderXLabels(data.followerGrowth) }} />
              )}
            </svg>
          </div>
        </div>

        <div className="bg-bg-elevated border border-border radius-lg p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-[15px] font-semibold">Quick stats</h3>
            <span className="text-[11px] px-2 py-0.5 radius-pill bg-primary-muted text-primary font-semibold">Overview</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Posts created", value: data.kpi.totalPosts, icon: <TrendingUp size={16} /> },
              { label: "Total views", value: formatCompact(data.kpi.totalViews), icon: <Eye size={16} /> },
              { label: "Total likes", value: formatCompact(data.kpi.totalLikes), icon: <Heart size={16} /> },
              { label: "Avg validity", value: data.kpi.avgValidity.toFixed(1), icon: <Award size={16} /> },
            ].map((stat) => (
              <div key={stat.label} className="bg-bg-card border border-border radius-md p-3 flex items-center gap-3">
                <div className="w-9 h-9 radius-md bg-primary-muted text-primary flex items-center justify-center shrink-0">
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider break-words">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
