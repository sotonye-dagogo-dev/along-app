import { BehaviorSubject, Observable, interval, Subject } from "rxjs"
import { switchMap, share, filter, takeUntil } from "rxjs/operators"

interface FeedPost {
  id: string
  title: string
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

const POLL_INTERVAL = 30000 // 30s
const LIMIT = 10

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

  constructor() {
    this.polling$ = interval(POLL_INTERVAL).pipe(
      filter(() => !this.feedStateSubject.value.loading),
      switchMap(() => this.fetchFeed()),
      share(),
    )

    this.polling$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      if ((state.posts?.length ?? 0) > 0) {
        const current = this.feedStateSubject.value
        const existingIds = new Set(current.posts.map((p) => p.id))
        const newPosts = state.posts.filter((p) => !existingIds.has(p.id))
        if (newPosts.length > 0) {
          this.feedStateSubject.next({
            ...current,
            posts: [...newPosts, ...current.posts],
            cursor: state.cursor,
            hasMore: state.hasMore,
          })
        }
      }
    })
  }

    private async fetchFeed(cursorVal?: string): Promise<FeedState> {
    try {
      const params = new URLSearchParams()
      if (cursorVal) params.set("cursor", cursorVal)
      params.set("limit", String(LIMIT))
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
        posts: data.posts ?? [],
        cursor: data.nextCursor ?? null,
        hasMore: !!data.nextCursor,
        loading: false,
      }
    } catch {
      return { posts: [], cursor: null, hasMore: false, loading: false }
    }
  }

  async loadInitial() {
    this.feedStateSubject.next({ ...this.feedStateSubject.value, loading: true })
    const state = await this.fetchFeed()
    this.feedStateSubject.next(state)
    return state
  }

  async loadMore() {
    const current = this.feedStateSubject.value
    if (!current.hasMore || current.loading) return
    this.feedStateSubject.next({ ...current, loading: true })
    const state = await this.fetchFeed(current.cursor ?? undefined)
    this.feedStateSubject.next({
      posts: [...current.posts, ...state.posts],
      cursor: state.cursor,
      hasMore: state.hasMore,
      loading: false,
    })
  }

  async refresh() {
    const current = this.feedStateSubject.value
    this.feedStateSubject.next({ ...current, loading: true })
    const state = await this.fetchFeed()
    if (state.posts.length > 0) {
      this.feedStateSubject.next({ ...state, loading: false })
    } else {
      this.feedStateSubject.next({ ...current, loading: false })
    }
  }

  applyInteraction(event: InteractionEvent) {
    const cache = this.interactionCache$.value
    const current = cache.get(event.postId) ?? {}
    if (event.type === "like") {
      current._isLiked = event.value
      current.likes = (current.likes ?? 0) + (event.value ? 1 : -1)
    } else if (event.type === "dislike") {
      current.dislikes = (current.dislikes ?? 0) + (event.value ? 1 : -1)
    } else if (event.type === "bookmark") {
      current._isBookmarked = event.value
    }
    cache.set(event.postId, current)
    this.interactionCache$.next(new Map(cache))
  }

  destroy() {
    this.destroy$.next()
    this.destroy$.complete()
    this.feedStateSubject.complete()
  }
}

export const feedStream = new FeedStream()
