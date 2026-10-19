"use client";

import { createContext, useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toastService } from "@/app/lib/services/toastService";
import {
  readAuthSnapshot,
  writeAuthSnapshot,
  clearAuthSnapshot,
} from "@/app/lib/config/authOffline";
import { AUTH_SESSION_CONFIG } from "@/app/lib/config/authSession";

// Layout effect on the client, no-op on the server: the offline snapshot is
// applied after hydration but before paint, so the signed-in identity shows
// on first paint (no guest-banner flash) without a server/client markup
// divergence (React #418 structural mismatch from a sync useState initializer).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type User = {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  /** DiceBear/custom avatar config (selected by /api/auth/me; drives AppAvatar). */
  avatarConfig?: { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | null;
  bio?: string;
  location?: string;
  verified?: boolean;
  role: string;
  rewardPoints?: number;
  rewardTier?: string;
  inviteCode?: string;
  createdAt: string;
  updatedAt: string;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  requireAuth: (action: string) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start guest/anonymous on the server and on the client's first render —
  // identical markup, no hydration mismatch. The last server-confirmed
  // session is applied in the isomorphic layout effect below (post-hydration,
  // pre-paint), so an offline reload still boots signed-in with no
  // guest-banner flash. Display-only: APIs validate the httpOnly cookie.
  const [user, setUser] = useState<User | null>(null);
  // Booting from a snapshot means we are *not* loading the identity — only
  // revalidating it. Starting unblocked keeps offline first paint signed-in.
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const fetchingRef = useRef(false);
  // One scheduled 429 retry at a time; last online/visibility revalidation
  // timestamp (PWA resume storms must not stampede /api/auth/me + refresh).
  // Chained 429 retries back off exponentially so our own retry cadence can
  // never keep the refresh bucket permanently maxed.
  const refreshRetryTimerRef = useRef<number | null>(null);
  const refreshRetryScheduledRef = useRef(false);
  const refreshRetryAttemptsRef = useRef(0);
  const lastRevalidateRef = useRef<number>(Date.now());

  useIsoLayoutEffect(() => {
    const snapshot = readAuthSnapshot() as User | null;
    if (snapshot) setUser(snapshot);
    setIsLoading(snapshot === null);
  }, []);

  const fetchUser = useCallback(async (retried = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        // Healthy again — clear any 429 backoff.
        refreshRetryAttemptsRef.current = 0;
        try {
          const data = await res.json();
          // `{ user }` envelope (incl. the guest `{ user: null }` response)
          // or a bare user object — never `data.user ?? data`, which would
          // promote the whole envelope to a "user" when user is null.
          const next = (
            data && typeof data === "object" && "user" in data ? data.user : data
          ) as User | null;
          if (next && typeof next === "object" && "id" in next) {
            setUser(next);
            // Server-confirmed — refresh the offline snapshot.
            writeAuthSnapshot({
              id: next.id,
              userName: next.userName,
              firstName: next.firstName,
              lastName: next.lastName,
              email: next.email,
              avatar: next.avatar,
              avatarConfig: next.avatarConfig ?? null,
              role: next.role,
            });
          } else {
            // Server-confirmed signed-out (guest) — drop any stale snapshot.
            setUser(null);
            clearAuthSnapshot();
          }
        } catch {
          // Non-JSON response (e.g. gateway timeout HTML) — transient, keep session.
          console.warn("[AuthProvider] /api/auth/me non-JSON — transient, session kept");
        }
      } else if (res.status === 401 && !retried) {
        try {
          const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
          if (refreshRes.ok) {
            refreshRetryAttemptsRef.current = 0;
            fetchingRef.current = false;
            return fetchUser(true);
          }
          // Refresh explicitly rejected (401) — session genuinely invalid.
          if (refreshRes.status === 401) {
            setUser(null);
            clearAuthSnapshot();
          } else if (refreshRes.status === 429 && !refreshRetryScheduledRef.current) {
            // Rate-limited (PWA resume / flapping network): the session is
            // NOT invalid — keep it and retry after backoff instead of
            // degrading the user to guest. Server Retry-After wins when
            // present; exponential growth guarantees our own retries can never
            // keep the refresh bucket permanently maxed (3/min threshold).
            refreshRetryScheduledRef.current = true;
            const attempt = refreshRetryAttemptsRef.current;
            refreshRetryAttemptsRef.current = attempt + 1;
            const retryAfterSec = Number(refreshRes.headers.get("Retry-After"));
            const backoffMs = Math.min(
              AUTH_SESSION_CONFIG.client.refreshRetryDelayMs * 2 ** Math.min(attempt, 5),
              300_000,
            );
            const delayMs =
              Number.isFinite(retryAfterSec) && retryAfterSec > 0
                ? Math.min(Math.max(retryAfterSec * 1000, backoffMs), 300_000)
                : backoffMs;
            if (typeof window !== "undefined") {
              refreshRetryTimerRef.current = window.setTimeout(() => {
                refreshRetryScheduledRef.current = false;
                refreshRetryTimerRef.current = null;
                void fetchUser();
              }, delayMs);
            }
          }
          // Otherwise (5xx / network): transient — keep last-known session so
          // users are never randomly logged out by a blip or offline restore.
        } catch {
          // Network failure — keep session, do not log out.
        }
      } else if (res.status === 401) {
        // Second 401 (already retried) — genuinely unauthenticated.
        setUser(null);
        clearAuthSnapshot();
      } else if (res.status === 504 || res.status === 502 || res.status === 503) {
        // Transient server error — don't clear user aggressively, keep guest state quiet
        // Log but don't treat as auth failure
        console.warn(`[AuthProvider] /api/auth/me ${res.status} — transient`);
      } else if (res.status >= 500) {
        console.warn(`[AuthProvider] /api/auth/me ${res.status} — transient, session kept`);
      } else {
        setUser(null);
        clearAuthSnapshot();
      }
    } catch {
      // Network failure (offline / airplane mode) — keep last-known session.
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUser();
    lastRevalidateRef.current = Date.now();
  }, [fetchUser]);

  // Revalidate the session when connectivity returns or the PWA/tab becomes
  // visible again — an installed PWA resumed after long idle re-establishes
  // its session BEFORE the next API call 401s. Throttled to one revalidation
  // per config interval; a pending 429 retry timer is left alone (its own
  // cadence), and every failure path in fetchUser already keeps the session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const revalidate = () => {
      const now = Date.now();
      if (now - lastRevalidateRef.current < AUTH_SESSION_CONFIG.client.revalidateMinIntervalMs) return;
      lastRevalidateRef.current = now;
      void fetchUser();
    };
    const onOnline = () => revalidate();
    const onVisibility = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchUser]);

  // Cancel a pending 429 retry on unmount.
  useEffect(() => {
    return () => {
      if (refreshRetryTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(refreshRetryTimerRef.current);
      }
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchUser();
  }, [fetchUser]);

  const requireAuth = useCallback(
    (action: string): boolean => {
      if (user) return true;
      toastService.info(`Sign in to ${action}`);
      return false;
    },
    [user],
  );

  const logout = useCallback(async () => {
    clearAuthSnapshot();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isGuest: !isLoading && !user,
        refresh,
        logout,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
