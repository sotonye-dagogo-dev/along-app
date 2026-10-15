"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, ThumbsDown, MessageCircle, UserPlus, AtSign, Star, Award, CheckCircle, Sparkles, ClipboardList, Reply, Route as RouteIcon, Bell, ShieldCheck } from "lucide-react"
import { AppAvatar, AppEmptyState, ViewMoreButton } from "@/app/components/ui"
import { EMPTY_STATES } from "@/app/lib/config"
import { AVATAR_DISPLAY_CONFIG, asAvatarConfig } from "@/app/lib/config/avatar"
import { resolveNotificationRoute } from "@/app/lib/config/notificationRoutes"
import { useAuth } from "@/app/hooks/useAuth"
import { useCachedFetch } from "@/app/lib/hooks/useCachedFetch"
import { PushManager } from "@/app/components/pwa/PushManager"
import { CachedDataNotice } from "@/app/components/pwa/OfflineBanner"

interface NotificationItem {
  id: string
  type:
    | "LIKE"
    | "DISLIKE"
    | "COMMENT"
    | "FOLLOW"
    | "MENTION"
    | "REWARD"
    | "BADGE"
    | "VERIFIED"
    | "WELCOME"
    | "ROUTE_REQUEST"
    | "ROUTE_RESPONSE"
    | "NEW_ROUTE"
    | "REPORT"
    | "MODERATION"
    | "ACCOUNT_DELETION_REQUESTED"
    | "ACCOUNT_DELETION_CANCELLED"
    | "ACCOUNT_DELETION_COMPLETED"
  message: string
  createdAt: string
  actor: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar?: string | null
    avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null
  }
  post?: { id: string; title: string } | null
  commentId?: string | null
  recipients: { read: boolean }[]
}

function getTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  LIKE: { icon: Heart, color: "#EF4444" },
  DISLIKE: { icon: ThumbsDown, color: "#64748B" },
  COMMENT: { icon: MessageCircle, color: "#3B82F6" },
  FOLLOW: { icon: UserPlus, color: "#10B981" },
  MENTION: { icon: AtSign, color: "#8B5CF6" },
  VERIFIED: { icon: CheckCircle, color: "#10B981" },
  REWARD: { icon: Star, color: "#F59E0B" },
  BADGE: { icon: Award, color: "#F59E0B" },
  WELCOME: { icon: Sparkles, color: "#1677FF" },
  ROUTE_REQUEST: { icon: ClipboardList, color: "#F97316" },
  ROUTE_RESPONSE: { icon: Reply, color: "#10B981" },
  NEW_ROUTE: { icon: RouteIcon, color: "#00A862" },
  REPORT: { icon: ShieldCheck, color: "#F59E0B" },
  MODERATION: { icon: ShieldCheck, color: "#1677FF" },
}

interface NotificationsResponse {
  notifications: NotificationItem[]
  unreadCount: number
  nextCursor?: string | null
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "rewards">("all")
  const { user, isLoading: authLoading } = useAuth()

  const params = new URLSearchParams()
  if (activeTab !== "all") params.set("filter", activeTab)
  const query = params.toString()

  const { data, loading, mutate } = useCachedFetch<NotificationsResponse>(
    authLoading ? null : `notifications:${user?.id ?? "guest"}:${activeTab}`,
    `/api/notifications${query ? `?${query}` : ""}`,
    { ttlSec: 30, enabled: !authLoading }
  )

  // Cursor "View more" — appended windows live outside the cached first page
  // (cache stays first-page-only per the API contract); tab switches reset.
  const [more, setMore] = useState<NotificationItem[]>([])
  const [moreCursor, setMoreCursor] = useState<string | null | undefined>(undefined)
  const [loadingMore, setLoadingMore] = useState(false)
  useEffect(() => {
    setMore([])
    setMoreCursor(undefined)
  }, [activeTab])

  const notifications = [...(data?.notifications ?? []), ...more]
  const unreadCount = data?.unreadCount ?? 0
  const isLoading = authLoading || loading
  const nextCursor = moreCursor !== undefined ? moreCursor : (data?.nextCursor ?? null)

  const handleViewMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (activeTab !== "all") params.set("filter", activeTab)
      params.set("cursor", nextCursor)
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        headers: { Accept: "application/json" },
      })
      const payload = (await res.json().catch(() => null)) as NotificationsResponse | null
      if (!res.ok || !payload) throw new Error("view more failed")
      setMore((prev) => {
        const seen = new Set([...(data?.notifications ?? []), ...prev].map((n) => n.id))
        return [...prev, ...(payload.notifications ?? []).filter((n) => !seen.has(n.id))]
      })
      setMoreCursor(payload.nextCursor ?? null)
    } catch {
      // Silent — the button stays so the user can retry.
    } finally {
      setLoadingMore(false)
    }
  }

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setMore((prev) => prev.map((n) => ({ ...n, recipients: n.recipients.map((r) => ({ ...r, read: true })) })))
      mutate((prev) => ({
        notifications: (prev?.notifications ?? []).map((n) => ({
          ...n,
          recipients: n.recipients.map((r) => ({ ...r, read: true })),
        })),
        unreadCount: 0,
      }))
    } catch {
      console.error("Failed to mark all read")
    }
  }

  /** Called when a row marks itself read — keep state + cache in sync. */
  const handleMarkedRead = (id: string) => {
    setMore((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, recipients: n.recipients.map((r) => ({ ...r, read: true })) } : n
      )
    )
    mutate((prev) => {
      if (!prev) return { notifications: [], unreadCount: 0 }
      const target = prev.notifications.find((n) => n.id === id)
      const wasUnread = target?.recipients.some((r) => !r.read) ?? false
      return {
        notifications: prev.notifications.map((n) =>
          n.id === id
            ? { ...n, recipients: n.recipients.map((r) => ({ ...r, read: true })) }
            : n
        ),
        unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
      }
    })
  }

  const unreadNotifications = notifications.filter(
    (n) => n.recipients.some((r) => !r.read)
  )
  const filteredNotifications =
    activeTab === "unread"
      ? unreadNotifications
      : activeTab === "rewards"
        ? notifications.filter((n) =>
            ["REWARD", "BADGE", "VERIFIED"].includes(n.type)
          )
        : notifications

  const recentNotifications = filteredNotifications.filter((n) => {
    const diff = Date.now() - new Date(n.createdAt).getTime()
    return diff < 24 * 60 * 60 * 1000
  })
  const earlierNotifications = filteredNotifications.filter((n) => {
    const diff = Date.now() - new Date(n.createdAt).getTime()
    return diff >= 24 * 60 * 60 * 1000
  })

  return (
    <div className="max-w-[640px] mx-auto px-4">
      <div className="flex items-center justify-between py-4 border-b border-border">
        <h1 className="text-[22px] font-semibold tracking-tight">Notifications</h1>
        <button
          onClick={markAllRead}
          className="inline-flex items-center gap-1 px-3 py-1.5 radius-md border-none bg-transparent text-xs font-medium text-text-secondary cursor-pointer font-sans hover:text-primary hover:bg-primary-muted transition-colors duration-fast"
        >
          Mark all as read
        </button>
      </div>

      <div className="pt-3">
        <PushManager />
        <CachedDataNotice compact />
      </div>

      <div className="flex border-b border-border">
        {(["all", "unread", "rewards"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-center border-none bg-transparent text-sm font-medium cursor-pointer font-sans relative transition-colors duration-fast ${
              activeTab === tab ? "text-primary" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "unread" && unreadCount > 0 && (
              <span className="inline-block ml-1 px-1.5 py-0.5 radius-pill text-[10px] font-semibold bg-error text-error-text border border-error-border align-top leading-tight">
                {unreadCount}
              </span>
            )}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-[30%] right-[30%] h-0.5 bg-primary radius-pill rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2 py-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
              <div className="w-10 h-10 rounded-circle bg-bg-elevated shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-bg-elevated radius-md w-3/4 mb-1" />
                <div className="h-2 bg-bg-elevated radius-md w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-8">
          {activeTab === "rewards" ? (
            <AppEmptyState
              icon={EMPTY_STATES.notifications.icon}
              title="No reward notifications yet"
              description="Earn points by sharing routes, validating others' posts, and building trust scores."
              actionLabel="Explore Routes"
              actionHref="/explore"
            />
          ) : (
            <AppEmptyState {...EMPTY_STATES.notifications} />
          )}
        </div>
      ) : (
        <>
          {recentNotifications.length > 0 && (
            <>
              <div className="px-4 py-2 text-[11px] font-semibold tracking-wider uppercase text-text-muted bg-bg-elevated border-b border-border">
                Recent
              </div>
              {recentNotifications.map((n) => (
                <NotificationRow key={n.id} notification={n} onMarkedRead={handleMarkedRead} />
              ))}
            </>
          )}
          {earlierNotifications.length > 0 && (
            <>
              <div className="px-4 py-2 text-[11px] font-semibold tracking-wider uppercase text-text-muted bg-bg-elevated border-b border-border">
                Earlier
              </div>
              {earlierNotifications.map((n) => (
                <NotificationRow key={n.id} notification={n} onMarkedRead={handleMarkedRead} />
              ))}
            </>
          )}
          <ViewMoreButton
            onViewMore={() => void handleViewMore()}
            loading={loadingMore}
            shown={filteredNotifications.length}
            total={null}
            hasMore={nextCursor !== null}
          />
        </>
      )}
    </div>
  )
}

function NotificationRow({
  notification,
  onMarkedRead,
}: {
  notification: NotificationItem
  onMarkedRead: (id: string) => void
}) {
  const router = useRouter()
  const typeConfig = TYPE_ICONS[notification.type]
  const TypeIcon = typeConfig?.icon ?? Bell
  const isUnread = notification.recipients.some((r) => !r.read)

  const handleOpen = () => {
    if (isUnread) {
      // Optimistic read — update state + cache before navigating away;
      // a failed PATCH heals on the next TTL revalidation.
      onMarkedRead(notification.id)
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      }).catch(() => undefined)
    }
    // Config-driven deep routing: post → /posts/:id (+?comment= anchor),
    // follow → actor profile, reports/queue → /notifications or admin queue,
    // never a misleading profile fallback.
    router.push(
      resolveNotificationRoute({
        type: notification.type,
        postId: notification.post?.id ?? null,
        commentId: notification.commentId ?? null,
        actorUserName: notification.actor.userName,
      })
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleOpen()
        }
      }}
      className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-fast border-b border-border hover:bg-bg-elevated ${isUnread ? "bg-primary-muted hover:bg-[rgba(0,98,59,0.08)]" : ""}`}
    >
      <div className="relative w-10 h-10 shrink-0">
        {/* Canonical avatar (AppAvatar, config-driven size) — same face as
            feed/profile/leaderboard; type badge overlays bottom-right. */}
        <AppAvatar
          src={notification.actor.avatar ?? undefined}
          alt={`${notification.actor.firstName} ${notification.actor.lastName}`}
          size={AVATAR_DISPLAY_CONFIG.sizes.notification as 40}
          config={asAvatarConfig(notification.actor.avatarConfig)}
          linkToProfile={false}
        />
        <Link
          href={`/profile/${notification.actor.userName}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 rounded-circle"
          aria-label={`View ${notification.actor.userName}'s profile`}
        >
          <span className="sr-only">{notification.actor.userName}</span>
        </Link>
        {typeConfig && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-circle flex items-center justify-center border-2 border-bg-base" style={{ background: typeConfig.color }}>
            <TypeIcon size={10} className="text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary leading-relaxed">
          <strong className="font-semibold cursor-pointer hover:underline">
            <Link href={`/profile/${notification.actor.userName}`} onClick={(e) => e.stopPropagation()} className="text-text-primary no-underline hover:underline">
              {notification.actor.firstName} {notification.actor.lastName}
            </Link>
          </strong>
          {" "}
          {notification.message.replace(`${notification.actor.firstName} ${notification.actor.lastName}`, "").trim()}
        </div>
        <div className="text-xs text-text-muted mt-0.5">{getTimeAgo(notification.createdAt)}</div>
        {notification.post?.title && (
          <div className="text-xs text-text-secondary mt-1 px-2 py-1 bg-bg-elevated radius-md border border-border break-words">
            {notification.post.title}
          </div>
        )}
      </div>
      {isUnread && <div className="w-2 h-2 rounded-circle bg-primary shrink-0 mt-1.5" />}
    </div>
  )
}
