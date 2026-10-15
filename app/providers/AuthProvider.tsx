"use client";

import { createContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toastService } from "@/app/lib/services/toastService";
import {
  readAuthSnapshot,
  writeAuthSnapshot,
  clearAuthSnapshot,
} from "@/app/lib/config/authOffline";

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
  // Hydrate synchronously from the last server-confirmed session so an
  // offline reload keeps the signed-in identity (no guest-banner flash) even
  // before /api/auth/me can respond. Display-only: APIs still validate the
  // httpOnly cookie server-side.
  const [user, setUser] = useState<User | null>(() => readAuthSnapshot() as User | null);
  // When we boot from a snapshot we are *not* loading the identity — only
  // revalidating it. Starting unblocked keeps offline first paint signed-in.
  const [isLoading, setIsLoading] = useState<boolean>(() => readAuthSnapshot() === null);
  const router = useRouter();
  const fetchingRef = useRef(false);

  const fetchUser = useCallback(async (retried = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        try {
          const data = await res.json();
          const next = (data.user ?? data) as User;
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
        } catch {
          // Non-JSON response (e.g. gateway timeout HTML) — transient, keep session.
          console.warn("[AuthProvider] /api/auth/me non-JSON — transient, session kept");
        }
      } else if (res.status === 401 && !retried) {
        try {
          const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
          if (refreshRes.ok) {
            fetchingRef.current = false;
            return fetchUser(true);
          }
          // Refresh explicitly rejected (401) — session genuinely invalid.
          if (refreshRes.status === 401) {
            setUser(null);
            clearAuthSnapshot();
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
  }, [fetchUser]);

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
