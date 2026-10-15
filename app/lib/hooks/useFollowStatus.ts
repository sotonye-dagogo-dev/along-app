"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { memoryCache } from "@/app/lib/cache/memoryCache";
import { POST_FOLLOW_CONFIG } from "@/app/lib/config/postFollow";

export interface FollowStatus {
  /** True when the viewer follows the author. Null while loading/unknown. */
  following: boolean | null;
  /** Re-read status from the server (e.g. after follow/unfollow elsewhere). */
  refresh: () => void;
  /** Optimistically mark as followed (mirrors into the cache). */
  markFollowed: () => void;
}

/**
 * Shared follow-status hook (Sprint 59) — cached read-through of
 * `GET /api/users/[id]/follow` so every post card can decide whether its
 * inline follow affordance should render.
 *
 * - Guests / own posts / missing ids: no fetch, `following: false`-ish
 *   (null → treated as not-following by callers that also hide on own).
 * - Memory-cached per author (`statusCacheTtlSec`) + in-flight dedup so a
 *   feed of N cards by the same author issues one request.
 * - Never throws, never surfaces errors: on failure the affordance simply
 *   renders the safe default (follow button), and a tap re-checks server-side.
 */
export function useFollowStatus(
  authorId: string | null | undefined,
  viewerId: string | null | undefined,
): FollowStatus {
  const normalizedAuthor = typeof authorId === "string" && authorId.length > 0 ? authorId : null;
  const isOwn = !!normalizedAuthor && !!viewerId && normalizedAuthor === viewerId;
  const shouldFetch = !!normalizedAuthor && !!viewerId && !isOwn;
  const [following, setFollowing] = useState<boolean | null>(null);
  const seqRef = useRef(0);

  const read = useCallback(
    async (signal?: AbortSignal) => {
      if (!shouldFetch || !normalizedAuthor) {
        setFollowing(null);
        return;
      }
      const cacheKey = `follow-status:${normalizedAuthor}:${viewerId}`;
      try {
        const cached = memoryCache.get<boolean>(cacheKey);
        if (cached !== null && cached !== undefined) {
          setFollowing(cached);
          return;
        }
      } catch {
        /* cache read is best-effort */
      }
      const seq = ++seqRef.current;
      try {
        const res = await fetch(POST_FOLLOW_CONFIG.statusPath(normalizedAuthor), {
          method: "GET",
          signal,
        });
        if (!res.ok) return; // silent — safe default (show follow) stays
        const data = (await res.json().catch(() => null)) as { following?: unknown } | null;
        if (seq !== seqRef.current) return;
        if (data && typeof data.following === "boolean") {
          setFollowing(data.following);
          try {
            memoryCache.set(cacheKey, data.following, POST_FOLLOW_CONFIG.statusCacheTtlSec);
          } catch {
            /* cache write is best-effort */
          }
        }
      } catch {
        // silent — offline/aborted keeps the safe default
      }
    },
    [shouldFetch, normalizedAuthor, viewerId],
  );

  useEffect(() => {
    if (!shouldFetch) {
      setFollowing(null);
      return;
    }
    const controller = new AbortController();
    void read(controller.signal);
    return () => controller.abort();
  }, [shouldFetch, read]);

  const refresh = useCallback(() => {
    if (!normalizedAuthor || !viewerId) return;
    try {
      memoryCache.del(`follow-status:${normalizedAuthor}:${viewerId}`);
    } catch {
      /* best-effort */
    }
    void read();
  }, [normalizedAuthor, viewerId, read]);

  const markFollowed = useCallback(() => {
    setFollowing(true);
    if (!normalizedAuthor || !viewerId) return;
    try {
      memoryCache.set(
        `follow-status:${normalizedAuthor}:${viewerId}`,
        true,
        POST_FOLLOW_CONFIG.statusCacheTtlSec,
      );
    } catch {
      /* best-effort */
    }
  }, [normalizedAuthor, viewerId]);

  return { following, refresh, markFollowed };
}
