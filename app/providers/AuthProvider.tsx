"use client";

import { createContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toastService } from "@/app/lib/services/toastService";

type User = {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
          setUser(data.user ?? data);
        } catch {
          // Non-JSON response (e.g. gateway timeout HTML) — treat as not authenticated
          setUser(null);
        }
      } else if (res.status === 401 && !retried) {
        try {
          const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
          if (refreshRes.ok) {
            fetchingRef.current = false;
            return fetchUser(true);
          }
        } catch {
          // refresh failed due to network / HTML error page
        }
        setUser(null);
      } else if (res.status === 504 || res.status === 502 || res.status === 503) {
        // Transient server error — don't clear user aggressively, keep guest state quiet
        // Log but don't treat as auth failure
        console.warn(`[AuthProvider] /api/auth/me ${res.status} — transient`);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
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
