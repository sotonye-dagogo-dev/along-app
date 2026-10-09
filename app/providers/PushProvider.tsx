'use client'

import { useContext, useEffect, useRef } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { getPushSupport, subscribeToPush } from '@/app/lib/utils/pushClient'

/**
 * Opportunistic background subscribe — only when the browser permission is
 * ALREADY granted (never prompts on load; the PushManager notice owns the
 * user-gesture flow). Fully environment-guarded so unsupported browsers,
 * insecure contexts, and SSR never throw.
 */
export function PushProvider({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext)
  const subscribed = useRef(false)

  useEffect(() => {
    if (!auth?.isAuthenticated || subscribed.current) return
    let cancelled = false
    void (async () => {
      try {
        if (typeof window === "undefined") return;
        if (!getPushSupport().supported) return;
        let permission: NotificationPermission | null = null;
        try {
          permission = typeof Notification !== "undefined" ? Notification.permission : null;
        } catch {
          return;
        }
        // Only auto-subscribe when already granted — requesting permission
        // outside a user gesture is ignored or throws on most browsers.
        if (permission !== "granted") return;
        if (!("serviceWorker" in navigator)) return;
        subscribed.current = true
        await subscribeToPush().catch(() => {});
      } catch {
        subscribed.current = false
      }
      if (cancelled) subscribed.current = false
    })()
    return () => { cancelled = true }
  }, [auth?.isAuthenticated, auth?.user])

  useEffect(() => {
    if (!auth?.isAuthenticated) {
      subscribed.current = false
    }
  }, [auth?.isAuthenticated])

  return children
}
