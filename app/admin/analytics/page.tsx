"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { RefreshCw, Users, FileText, Heart, Shield, Bug, UserPlus, ArrowLeft } from "lucide-react"
import { ADMIN_DASHBOARD_PERIODS, formatDelta } from "@/app/lib/config/admin"
import {
  ADMIN_ANALYTICS_CONFIG,
  chartBarColor,
  chartSeriesColor,
  formatChartDate,
} from "@/app/lib/config/charts"
import { SvgChartContainer, ChartTooltipWrapper, AppUserLabel } from "@/app/components/ui"

interface AnalyticsPayload {
  period: number
  kpis: {
    totalUsers: number
    postsInPeriod: number
    likesInPeriod: number
    avgValidity: number
    openBugs: number
    signupsInPeriod: number
  }
  deltas: Record<string, number | null>
  series: {
    signups: { date: string; count: number }[]
    posts: { date: string; count: number }[]
    likes: { date: string; count: number }[]
  }
  validityBuckets: { id: string; label: string; count: number }[]
  roles: { id: string; label: string; count: number }[]
  tiers: { id: string; label: string; count: number }[]
  topPosts: { id: string; title: string; validityScore: number; likes: number; views: number }[]
  topContributors: { id: string; userName: string; firstName: string; lastName: string; avatar?: string | null; avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null; verified?: boolean; posts: number }[]
  zeroResultQueries: { query: string; count: number; terms: string[]; lastSeen: string | null }[]
}

const svgW = 500
const svgH = 160
const padL = 40
const padR = 20
const padT = 10
const padB = 28
const plotW = svgW - padL - padR
const plotH = svgH - padT - padB

function linePoints(data: { count: number }[], max: number): string {
  const stepX = plotW / Math.max(data.length - 1, 1)
  return data
    .map((d, i) => {
      const x = padL + i * stepX
      const y = padT + plotH - (d.count / Math.max(max, 1)) * (plotH - 20) - 10
      return `${Math.round(x)},${Math.round(y)}`
    })
    .join(" ")
}

function SectionCard({
  title,
  description,
  linkHref,
  linkLabel,
  children,
}: {
  title: string
  description: string
  linkHref: string
  linkLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-bg-card border border-border radius-lg p-4 sm:p-5 shadow-md min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-1 gap-2 min-w-0">
        <h3 className="text-base font-semibold truncate">{title}</h3>
        <Link href={linkHref} className="text-xs text-primary font-medium cursor-pointer flex items-center gap-1 no-underline shrink-0">
          {linkLabel} <span>&rarr;</span>
        </Link>
      </div>
      <p className="text-xs text-text-muted mb-4 truncate">{description}</p>
      {children}
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<string>(ADMIN_DASHBOARD_PERIODS.defaultPeriod)

  const load = async (p?: string) => {
    setLoading(true)
    setError(false)
    try {
      const active = p ?? period
      const res = await fetch(`/api/admin/analytics?period=${encodeURIComponent(active)}`)
      if (res.ok) setData(await res.json())
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(period) }, [period])

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-elevated radius-md w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-24 bg-bg-elevated radius-lg" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-64 bg-bg-elevated radius-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if ((!data && error) || (!data && !loading)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-text-muted text-sm">{ADMIN_ANALYTICS_CONFIG.loadError}</div>
        <button onClick={() => load()} className="px-4 py-2 radius-md bg-primary text-white text-xs font-medium border-none cursor-pointer hover:bg-primary-light transition-colors">
          {ADMIN_ANALYTICS_CONFIG.retryLabel}
        </button>
      </div>
    )
  }

  if (!data) return null

  const periodLabel =
    ADMIN_DASHBOARD_PERIODS.options.find((o) => Number(o.value) === data.period)?.label ??
    `Last ${data.period} days`

  const kpiCards = [
    { id: "totalUsers", label: "Total Users", value: data.kpis.totalUsers.toLocaleString(), raw: data.kpis.totalUsers, icon: <Users size={18} />, bg: "var(--color-primary-muted)", color: "var(--color-primary)", hint: ADMIN_ANALYTICS_CONFIG.kpis[0].hint },
    { id: "postsInPeriod", label: "Posts", value: data.kpis.postsInPeriod.toLocaleString(), raw: data.kpis.postsInPeriod, icon: <FileText size={18} />, bg: "var(--color-info)", color: "var(--color-info-text)", hint: ADMIN_ANALYTICS_CONFIG.kpis[1].hint },
    { id: "likesInPeriod", label: "Likes", value: data.kpis.likesInPeriod.toLocaleString(), raw: data.kpis.likesInPeriod, icon: <Heart size={18} />, bg: "var(--color-error)", color: "var(--color-error-text)", hint: ADMIN_ANALYTICS_CONFIG.kpis[2].hint },
    { id: "avgValidity", label: "Avg Validity", value: data.kpis.avgValidity.toString(), raw: data.kpis.avgValidity, icon: <Shield size={18} />, bg: "var(--color-success)", color: "var(--color-success-text)", hint: ADMIN_ANALYTICS_CONFIG.kpis[3].hint },
    { id: "openBugs", label: "Open Bugs", value: data.kpis.openBugs.toString(), raw: data.kpis.openBugs, icon: <Bug size={18} />, bg: "var(--color-error)", color: "var(--color-error-text)", hint: ADMIN_ANALYTICS_CONFIG.kpis[4].hint },
    { id: "signupsInPeriod", label: "New Signups", value: data.kpis.signupsInPeriod.toLocaleString(), raw: data.kpis.signupsInPeriod, icon: <UserPlus size={18} />, bg: "var(--color-primary-muted)", color: "var(--color-primary)", hint: ADMIN_ANALYTICS_CONFIG.kpis[5].hint },
  ]

  const maxGrowth = Math.max(...data.series.signups.map((d) => d.count), ...data.series.posts.map((d) => d.count), 1)
  const maxLikes = Math.max(...data.series.likes.map((d) => d.count), 1)
  const maxBucket = Math.max(...data.validityBuckets.map((b) => b.count), 1)
  const maxRole = Math.max(...data.roles.map((r) => r.count), 1)
  const maxTier = Math.max(...data.tiers.map((t) => t.count), 1)

  const growthColumns = data.series.signups.map((d, i) => ({
    title: formatChartDate(d.date),
    lines: [
      { label: "Signups", value: d.count, color: chartSeriesColor("signups") },
      { label: "Posts", value: data.series.posts[i]?.count ?? 0, color: chartSeriesColor("posts") },
    ],
  }))
  const likesColumns = data.series.likes.map((d) => ({
    title: formatChartDate(d.date),
    lines: [{ label: "Likes", value: d.count, color: chartSeriesColor("likes") }],
  }))

  const growth = ADMIN_ANALYTICS_CONFIG.sections[0]
  const engagement = ADMIN_ANALYTICS_CONFIG.sections[1]
  const validity = ADMIN_ANALYTICS_CONFIG.sections[2]
  const audience = ADMIN_ANALYTICS_CONFIG.sections[3]
  const lists = ADMIN_ANALYTICS_CONFIG.lists

  return (
    <div className="min-w-0 flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <Link href={ADMIN_ANALYTICS_CONFIG.backHref} className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary no-underline mb-1">
            <ArrowLeft size={12} /> {ADMIN_ANALYTICS_CONFIG.backLabel}
          </Link>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">{ADMIN_ANALYTICS_CONFIG.title}</h1>
          <div className="text-sm text-text-secondary truncate">{ADMIN_ANALYTICS_CONFIG.subtitle} &middot; {periodLabel}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="admin-analytics-period" className="sr-only">{ADMIN_ANALYTICS_CONFIG.periodAriaLabel}</label>
          <select
            id="admin-analytics-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label={ADMIN_ANALYTICS_CONFIG.periodAriaLabel}
            className="px-3 py-2 radius-md border border-border bg-bg-card text-xs font-medium text-text-secondary hover:text-text-primary cursor-pointer"
          >
            {ADMIN_DASHBOARD_PERIODS.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 radius-md border border-border bg-bg-card text-xs font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-fast cursor-pointer"
          >
            <RefreshCw size={14} />
            {ADMIN_ANALYTICS_CONFIG.refreshLabel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 min-w-0">
        {kpiCards.map((stat) => {
          const trend = formatDelta(data.deltas[stat.id] ?? null, stat.raw)
          return (
            <div key={stat.id} className="bg-bg-card border border-border radius-lg p-4 shadow-xs flex flex-col gap-1.5 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-medium text-text-secondary truncate">{stat.label}</span>
                <span className="w-9 h-9 radius-md flex items-center justify-center shrink-0" style={{ background: stat.bg, color: stat.color }}>
                  {stat.icon}
                </span>
              </div>
              <ChartTooltipWrapper
                title={stat.label}
                lines={[
                  { label: "Current", value: stat.value },
                  { label: "Trend vs previous period", value: trend.label },
                  { label: "About", value: stat.hint },
                ]}
                className="text-[22px] font-bold leading-tight truncate"
              >
                <span className="truncate">{stat.value}</span>
              </ChartTooltipWrapper>
              <div className="text-[11px] font-semibold text-text-muted truncate">{trend.label} vs prev</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 min-w-0">
        <SectionCard title={growth.title} description={growth.description} linkHref={growth.linkHref} linkLabel={growth.linkLabel}>
          {data.series.signups.length === 0 ? (
            <div className="text-sm text-text-muted text-center py-4">{growth.empty}</div>
          ) : (
            <SvgChartContainer title={growth.title} columns={growthColumns} count={growthColumns.length}>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "160px", overflow: "visible" }}>
                <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--color-border)" strokeWidth="1" />
                <polyline points={linePoints(data.series.signups, maxGrowth)} fill="none" stroke={chartSeriesColor("signups")} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={linePoints(data.series.posts, maxGrowth)} fill="none" stroke={chartSeriesColor("posts")} strokeWidth="2.5" strokeDasharray="6 3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                {data.series.signups.map((d, i) => {
                  const stepX = plotW / Math.max(data.series.signups.length - 1, 1)
                  const x = padL + i * stepX
                  const y = padT + plotH - (d.count / maxGrowth) * (plotH - 20) - 10
                  return (
                    <circle key={d.date} cx={Math.round(x)} cy={Math.round(y)} r={3.5} fill="#fff" stroke={chartSeriesColor("signups")} strokeWidth="2.5">
                      <title>{`${d.count} signups, ${data.series.posts[i]?.count ?? 0} posts on ${formatChartDate(d.date)}`}</title>
                    </circle>
                  )
                })}
              </svg>
            </SvgChartContainer>
          )}
          <div className="flex gap-4 mt-2 text-[11px]">
            {[
              { label: "Signups", color: chartSeriesColor("signups") },
              { label: "Posts", color: chartSeriesColor("posts") },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 font-medium text-text-secondary">
                <span className="w-2 h-2 rounded-circle" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={engagement.title} description={engagement.description} linkHref={engagement.linkHref} linkLabel={engagement.linkLabel}>
          {data.series.likes.length === 0 ? (
            <div className="text-sm text-text-muted text-center py-4">{engagement.empty}</div>
          ) : (
            <SvgChartContainer title={engagement.title} columns={likesColumns} count={likesColumns.length}>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "160px", overflow: "visible" }}>
                <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="var(--color-border)" strokeWidth="1" />
                <polyline points={linePoints(data.series.likes, maxLikes)} fill="none" stroke={chartSeriesColor("likes")} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {data.series.likes.map((d, i) => {
                  const stepX = plotW / Math.max(data.series.likes.length - 1, 1)
                  const x = padL + i * stepX
                  const y = padT + plotH - (d.count / maxLikes) * (plotH - 20) - 10
                  return (
                    <circle key={d.date} cx={Math.round(x)} cy={Math.round(y)} r={3.5} fill="#fff" stroke={chartSeriesColor("likes")} strokeWidth="2.5">
                      <title>{`${d.count} likes on ${formatChartDate(d.date)}`}</title>
                    </circle>
                  )
                })}
              </svg>
            </SvgChartContainer>
          )}
        </SectionCard>

        <SectionCard title={validity.title} description={validity.description} linkHref={validity.linkHref} linkLabel={validity.linkLabel}>
          <div className="flex flex-col gap-2.5">
            {data.validityBuckets.map((b, i) => (
              <ChartTooltipWrapper
                key={b.id}
                title={`Scores ${b.label}`}
                lines={[{ label: "Posts", value: b.count, color: chartBarColor(i) }]}
                className="flex items-center gap-2.5 min-w-0 w-full"
              >
                <span className="text-xs font-medium w-14 shrink-0 text-text-secondary">{b.label}</span>
                <div className="flex-1 min-w-[60px] h-5 bg-bg-elevated radius-pill overflow-hidden">
                  <div className="h-full radius-pill" style={{ width: `${maxBucket === 0 ? 0 : Math.round((b.count / maxBucket) * 100)}%`, background: chartBarColor(i), transition: "width 200ms" }} />
                </div>
                <span className="text-xs font-semibold text-text-secondary w-10 text-right shrink-0">{b.count}</span>
              </ChartTooltipWrapper>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={audience.title} description={audience.description} linkHref={audience.linkHref} linkLabel={audience.linkLabel}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">By role</div>
          <div className="flex flex-col gap-2 mb-4">
            {data.roles.map((r, i) => (
              <ChartTooltipWrapper
                key={r.id}
                title={r.label}
                lines={[{ label: "Accounts", value: r.count, color: chartBarColor(i) }]}
                className="flex items-center gap-2.5 min-w-0 w-full"
              >
                <span className="text-xs font-medium w-20 shrink-0 truncate text-text-primary">{r.label}</span>
                <div className="flex-1 min-w-[60px] h-5 bg-bg-elevated radius-pill overflow-hidden">
                  <div className="h-full radius-pill" style={{ width: `${maxRole === 0 ? 0 : Math.round((r.count / maxRole) * 100)}%`, background: chartBarColor(i), transition: "width 200ms" }} />
                </div>
                <span className="text-xs font-semibold text-text-secondary w-10 text-right shrink-0">{r.count}</span>
              </ChartTooltipWrapper>
            ))}
            {data.roles.length === 0 && <div className="text-sm text-text-muted">{audience.empty}</div>}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">By tier</div>
          <div className="flex flex-col gap-2">
            {data.tiers.map((t, i) => (
              <ChartTooltipWrapper
                key={t.id}
                title={`${t.label} tier`}
                lines={[{ label: "Accounts", value: t.count, color: chartBarColor(i + 2) }]}
                className="flex items-center gap-2.5 min-w-0 w-full"
              >
                <span className="text-xs font-medium w-20 shrink-0 truncate text-text-primary">{t.label}</span>
                <div className="flex-1 min-w-[60px] h-5 bg-bg-elevated radius-pill overflow-hidden">
                  <div className="h-full radius-pill" style={{ width: `${maxTier === 0 ? 0 : Math.round((t.count / maxTier) * 100)}%`, background: chartBarColor(i + 2), transition: "width 200ms" }} />
                </div>
                <span className="text-xs font-semibold text-text-secondary w-10 text-right shrink-0">{t.count}</span>
              </ChartTooltipWrapper>
            ))}
            {data.tiers.length === 0 && <div className="text-sm text-text-muted">{audience.empty}</div>}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 min-w-0">
        <div className="bg-bg-card border border-border radius-lg p-4 sm:p-5 shadow-md min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4 gap-2 min-w-0">
            <h3 className="text-base font-semibold truncate">{lists.topPostsTitle}</h3>
            <Link href={lists.topPostsLinkHref} className="text-xs text-primary font-medium cursor-pointer flex items-center gap-1 no-underline shrink-0">
              {lists.topPostsLinkLabel} <span>&rarr;</span>
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {data.topPosts.map((post, i) => (
              <ChartTooltipWrapper
                key={post.id}
                title={post.title}
                lines={[
                  { label: "Validity score", value: post.validityScore, color: chartBarColor(i) },
                  { label: "Likes", value: post.likes, color: chartSeriesColor("likes") },
                  { label: "Views", value: post.views, color: chartSeriesColor("views") },
                ]}
                className="flex items-center gap-2.5 min-w-0 w-full"
              >
                <Link href={`/posts/${post.id}`} className="text-xs font-medium flex-1 min-w-0 truncate no-underline hover:underline text-text-primary" title={post.title}>{post.title}</Link>
                <div className="flex-1 min-w-[60px] h-5 bg-bg-elevated radius-pill overflow-hidden">
                  <div className="h-full radius-pill" style={{ width: `${post.validityScore}%`, background: chartBarColor(i), transition: "width 200ms" }} />
                </div>
                <span className="text-xs font-semibold text-text-secondary w-10 text-right shrink-0">{post.validityScore}</span>
              </ChartTooltipWrapper>
            ))}
            {data.topPosts.length === 0 && <div className="text-sm text-text-muted text-center py-4">{lists.topPostsEmpty}</div>}
          </div>
        </div>

        <div className="bg-bg-card border border-border radius-lg p-4 sm:p-5 shadow-md min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4 gap-2 min-w-0">
            <h3 className="text-base font-semibold truncate">{lists.topContributorsTitle}</h3>
            <Link href={lists.topContributorsLinkHref} className="text-xs text-primary font-medium cursor-pointer flex items-center gap-1 no-underline shrink-0">
              {lists.topContributorsLinkLabel} <span>&rarr;</span>
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {data.topContributors.map((c) => (
              <ChartTooltipWrapper
                key={c.id}
                title={`${c.firstName} ${c.lastName}`}
                lines={[{ label: "Posts", value: c.posts, color: chartSeriesColor("posts") }]}
                className="flex items-center gap-2.5 min-w-0 w-full"
              >
                <AppUserLabel
                  user={{
                    firstName: c.firstName,
                    lastName: c.lastName,
                    userName: c.userName,
                    avatar: c.avatar ?? undefined,
                    avatarConfig: c.avatarConfig ?? undefined,
                    isVerified: c.verified ?? false,
                  }}
                  size="sm"
                  showHandle={false}
                  linkToProfile={true}
                />
                <span className="ml-auto text-xs font-semibold text-text-secondary shrink-0">{c.posts} {lists.topContributorsPostsHint}</span>
              </ChartTooltipWrapper>
            ))}
            {data.topContributors.length === 0 && <div className="text-sm text-text-muted text-center py-4">{lists.topContributorsEmpty}</div>}
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border radius-lg p-4 sm:p-5 shadow-md min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-1 gap-2 min-w-0">
          <h3 className="text-base font-semibold truncate">{lists.zeroResultsTitle}</h3>
        </div>
        <p className="text-xs text-text-muted mb-1 truncate">{lists.zeroResultsDescription}</p>
        <p className="text-[11px] text-text-muted mb-4">{lists.zeroResultsHint}</p>
        {(data.zeroResultQueries ?? []).length === 0 ? (
          <div className="text-sm text-text-muted text-center py-4">{lists.zeroResultsEmpty}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {(data.zeroResultQueries ?? []).map((q) => (
              <div key={q.query} className="flex items-center gap-2.5 min-w-0 w-full">
                <span className="font-mono text-xs font-semibold flex-1 min-w-0 truncate" title={q.query}>“{q.query}”</span>
                {q.terms.length > 0 && (
                  <span className="hidden sm:inline font-mono text-[11px] text-text-muted truncate max-w-[220px]" title={q.terms.join(", ")}>
                    {q.terms.join(", ")}
                  </span>
                )}
                <span className="text-xs font-semibold text-text-secondary w-14 text-right shrink-0">×{q.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
