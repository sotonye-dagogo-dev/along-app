import { BehaviorSubject, Observable, interval, Subject } from "rxjs"
import { switchMap, share, filter, takeUntil } from "rxjs/operators"
import { memoryCache } from "@/app/lib/cache/memoryCache"
import { FEED_STREAM_CONFIG } from "@/app/lib/config/feedAlgorithm"

interface FeedPost {
  id: string
  title: string
  description?: string | null
  routes: unknown
  images: string[]
  tags: string[]
  likes: number
  dislikes: number
  comments: number
  bookmarks: number
  validityScore: number
  validityTier: string | null
  isPlatformGen?: boolean
  isArchived?: boolean
  type?: string
  createdAt: string
  user: {
    id: string
    userName: string
    firstName: string
    lastName: string
    avatar?: string | null
    avatarConfig?: unknown
  }
  _isLiked?: boolean
  _isDisliked?: boolean
  _isBookmarked?: boolean
  totalDistanceKm?: number | null
  estimatedMins?: number | null
  region?: string | null
}

interface FeedState {
  posts: FeedPost[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
}

interface InteractionEvent {
  postId: string
  type: "like" | "dislike" | "bookmark"
  value: boolean
}

const POLL_INTERVAL = FEED_STREAM_CONFIG.pollIntervalMs
const LIMIT = FEED_STREAM_CONFIG.pageSize
const FEED_FRESH_SEC = FEED_STREAM_CONFIG.freshSec
const FEED_RETENTION_SEC = FEED_STREAM_CONFIG.retentionSec
const MAX_EXCLUDE = FEED_STREAM_CONFIG.maxExcludeIds

interface CachedFeed {
  state: FeedState
  fetchedAt: number
}

/**
 * Order-preserving dedup by post id — the single invariant that keeps the
 * feed from glitching: every merge path (initial / more / poll / refresh)
 * funnels through here, so a row can never render twice no matter how the
 * score-ordered server pages overlap.
 */
export function dedupePosts(rows: FeedPost[]): FeedPost[] {
  const seen = new Set<string>()
  const out: FeedPost[] = []
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export class FeedStream {
  private polling$: Observable<FeedState>
  private destroy$ = new Subject<void>()

  private feedStateSubject = new BehaviorSubject<FeedState>({
    posts: [],
    cursor: null,
    hasMore: true,
    loading: true,
  })

  interactionCache$ = new BehaviorSubject<Map<string, Partial<FeedPost>>>(new Map())

  feedState$ = this.feedStateSubject.asObservable()

  /** Cache key for the current viewer — set on first loadInitial(). */
  private cacheKey: string | null = null
  /** Last viewer fix so refresh()/poll keep the nearby boost. */
  private lastViewerLocation: { lat: number; lng: number } | null = null
  /** Guards overlapping loadMore calls (observer can fire rapidly). */
  private loadingMore = false

  constructor() {
    this.polling$ = interval(POLL_INTERVAL).pipe(
      filter(
        () =>
          !this.feedStateSubject.value.loading &&
          (typeof document === "undefined" || !document.hidden) // pause polling on hidden tabs
      ),
      switchMap(() => this.fetchFeed()),
      share(),
    )

    this.polling$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      if ((state.posts?.length ?? 0) > 0) {
        const current = this.feedStateSubject.value
        const existingIds = new Set(current.posts.map((p) => p.id))
        const newPosts = state.posts.filter((p) => !existingIds.has(p.id))
        if (newPosts.length > 0) {
          // Prepend only genuinely new rows; keep the CURRENT cursor —
          // the poll fetches page one, so its cursor would rewind
          // pagination and resurface rows as duplicates on next loadMore.
          const merged: FeedState = {
            ...current,
            posts: dedupePosts([...newPosts, ...current.posts]),
            loading: false,
          }
          this.feedStateSubject.next(merged)
          this.persist(merged)
        }
      }
    })
  }

  private persist(state: FeedState): void {
    if (!this.cacheKey) return
    memoryCache.set<CachedFeed>(
      this.cacheKey,
      { state: { ...state, loading: false }, fetchedAt: Date.now() },
      FEED_RETENTION_SEC
    )
  }

  private rememberLocation(viewerLocation?: { lat: number; lng: number } | null): { lat: number; lng: number } | null {
    if (
      viewerLocation &&
      Number.isFinite(viewerLocation.lat) &&
      Number.isFinite(viewerLocation.lng)
    ) {
      this.lastViewerLocation = { lat: viewerLocation.lat, lng: viewerLocation.lng }
    }
    return this.lastViewerLocation
  }

  private async fetchFeed(
    cursorVal?: string,
    viewerLocation?: { lat: number; lng: number } | null,
    excludeIds?: string[],
  ): Promise<FeedState> {
    try {
      const params = new URLSearchParams()
      if (cursorVal) params.set("cursor", cursorVal)
      params.set("limit", String(LIMIT))
      // Behind-the-scenes nearby boost — best-effort only, never required.
      const fix = viewerLocation ?? this.lastViewerLocation
      if (fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng)) {
        params.set("lat", String(fix.lat))
        params.set("lng", String(fix.lng))
      }
      // Stable score-order pagination — server drops these before scoring.
      if (excludeIds && excludeIds.length > 0) {
        params.set("exclude", excludeIds.slice(0, MAX_EXCLUDE).join(","))
      }
      const res = await fetch(`/api/posts/feed?${params}`)
      if (!res.ok) return { posts: [], cursor: null, hasMore: false, loading: false }
      let data: { posts?: FeedPost[]; nextCursor?: string | null } = {}
      try {
        const text = await res.text()
        data = text ? (JSON.parse(text) as { posts?: FeedPost[]; nextCursor?: string | null }) : {}
      } catch {
        return { posts: [], cursor: null, hasMore: false, loading: false }
      }
      return {
        posts: dedupePosts(data.posts ?? []),
        cursor: data.nextCursor ?? null,
        hasMore: !!data.nextCursor,
        loading: false,
      }
    } catch {
      return { posts: [], cursor: null, hasMore: false, loading: false }
    }
  }

  /**
   * Hydrates from the in-app memory cache when available (instant paint, no
   * skeleton flash), then revalidates only if the cached feed is stale.
   */
  async loadInitial(userId?: string, viewerLocation?: { lat: number; lng: number } | null): Promise<FeedState> {
    this.cacheKey = `feed:stream:${userId ?? "anon"}`
    this.rememberLocation(viewerLocation)
    const cached = memoryCache.get<CachedFeed>(this.cacheKey)

    if (cached && cached.state.posts.length > 0) {
      const cleanCached: FeedState = { ...cached.state, posts: dedupePosts(cached.state.posts), loading: false }
      this.feedStateSubject.next(cleanCached)
      const ageSec = (Date.now() - cached.fetchedAt) / 1000
      if (ageSec < FEED_FRESH_SEC) return cleanCached
      // stale → silent background revalidation, keep showing cached feed
      const state = await this.fetchFeed(undefined, this.lastViewerLocation)
      if (state.posts.length > 0) {
        this.feedStateSubject.next(state)
        this.persist(state)
        return state
      }
      return cleanCached
    }

    this.feedStateSubject.next({ ...this.feedStateSubject.value, loading: true })
    const state = await this.fetchFeed(undefined, this.lastViewerLocation)
    this.feedStateSubject.next(state)
    this.persist(state)
    return state
  }

  async loadMore(viewerLocation?: { lat: number; lng: number } | null) {
    const current = this.feedStateSubject.value
    if (!current.hasMore || current.loading || this.loadingMore) return
    this.loadingMore = true
    this.rememberLocation(viewerLocation)
    this.feedStateSubject.next({ ...current, loading: true })
    try {
      const seenIds = current.posts.map((p) => p.id)
      const state = await this.fetchFeed(
        current.cursor ?? undefined,
        this.lastViewerLocation,
        seenIds,
      )
      const base = this.feedStateSubject.value
      const merged: FeedState = {
        // Skip any row already on screen even if the server page overlaps.
        posts: dedupePosts([...base.posts, ...state.posts.filter((p) => !seenIds.includes(p.id))]),
        cursor: state.cursor,
        hasMore: state.hasMore,
        loading: false,
      }
      this.feedStateSubject.next(merged)
      this.persist(merged)
    } finally {
      this.loadingMore = false
    }
  }

  async refresh() {
    const current = this.feedStateSubject.value
    this.feedStateSubject.next({ ...current, loading: true })
    const state = await this.fetchFeed(undefined, this.lastViewerLocation)
    // Always apply fresh state when fetch succeeded, even if empty (user may have filtered)
    // Only keep current posts if fetch failed (state has no posts AND hasMore false due to error returns)
    if (state.posts.length > 0) {
      this.feedStateSubject.next({ ...state, loading: false })
      this.persist(state)
    } else if (state.hasMore === false && state.cursor === null) {
      // fetchFeed returns empty on error — preserve current posts but clear loading
      // Check if error case by seeing if we got network failure vs legit empty feed
      // For now, preserve current to avoid flash of empty state on transient error, but ensure hasMore updated
      this.feedStateSubject.next({ ...current, loading: false })
    } else {
      this.feedStateSubject.next({ ...state, loading: false })
      this.persist(state)
    }
  }

  applyInteraction(event: InteractionEvent) {    const cache = this.interactionCache$.value
    const current = cache.get(event.postId) ?? {}
    if (event.type === "like") {
      // Mutual exclusion mirrors PostCard's reducer: liking clears a prior
      // dislike (and vice versa) so feed/profile/detail can never disagree.
      const wasDisliked = current._isDisliked ?? false
      current._isLiked = event.value
      current.likes = (current.likes ?? 0) + (event.value ? 1 : -1)
      if (event.value && wasDisliked) {
        current._isDisliked = false
        current.dislikes = (current.dislikes ?? 0) - 1
      }
    } else if (event.type === "dislike") {
      const wasLiked = current._isLiked ?? false
      current._isDisliked = event.value
      current.dislikes = (current.dislikes ?? 0) + (event.value ? 1 : -1)
      if (event.value && wasLiked) {
        current._isLiked = false
        current.likes = (current.likes ?? 0) - 1
      }
    } else if (event.type === "bookmark") {
      current._isBookmarked = event.value
    }
    cache.set(event.postId, current)
    this.interactionCache$.next(new Map(cache))
  }
  /** Removes a post from the in-memory feed (delete/archive). Persisted. */
  removePost(postId: string) {
    const current = this.feedStateSubject.value
    const posts = current.posts.filter((p) => p.id !== postId)
    if (posts.length === current.posts.length) return
    const next = { ...current, posts }
    this.feedStateSubject.next(next)
    this.persist(next)
  }

  /**
   * Pins a just-created post to the top of the feed (optimistic first
   * paint). Dedupes by id so a retry/refresh can never duplicate it; the
   * next server refresh re-orders it to its rightful score position.
   * Never throws — falls back to a silent no-op.
   */
  prependPost(post: FeedPost) {
    try {
      if (!post || typeof post.id !== "string") return
      const current = this.feedStateSubject.value
      if (current.posts.some((p) => p.id === post.id)) return
      const next: FeedState = {
        ...current,
        posts: dedupePosts([post, ...current.posts]),
        loading: false,
      }
      this.feedStateSubject.next(next)
      this.persist(next)
    } catch {
      /* optimistic only — refresh heals */
    }
  }

  /** Patches a post in place (e.g. isArchived flag, edited title). Persisted. */
  updatePost(postId: string, patch: Partial<FeedPost>) {
    const current = this.feedStateSubject.value
    let changed = false
    const posts = current.posts.map((p) => {
      if (p.id !== postId) return p
      changed = true
      return { ...p, ...patch }
    })
    if (!changed) return
    const next = { ...current, posts }
    this.feedStateSubject.next(next)
    this.persist(next)
  }

  destroy() {
    this.destroy$.next()
    this.destroy$.complete()
    this.feedStateSubject.complete()
  }
}

export const feedStream = new FeedStream()
