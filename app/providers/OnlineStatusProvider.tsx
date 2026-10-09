'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { offlineQueue } from '@/app/lib/services/offlineQueue'
import { toastService } from '@/app/lib/services/toastService'
import { PWA_HEARTBEAT, PWA_TOAST_COPY, PWA_SYNC_TAGS } from '@/app/lib/config/pwa'

interface OnlineStatusContextValue {
  isOnline: boolean
  /** Last time connectivity was confirmed (epoch ms). */
  lastOnlineAt: number | null
  /** Actively re-check connectivity (heartbeat + queue flush). */
  recheck: () => Promise<boolean>
}

const OnlineStatusContext = createContext<OnlineStatusContextValue>({
  isOnline: true,
  lastOnlineAt: null,
  recheck: async () => true,
})

export function useOnlineStatus() {
  return useContext(OnlineStatusContext)
}

/**
 * Returns true when a network-dependent task may proceed. When offline it
 * toasts once and returns false so callers can bail out early — no silent
 * failures, no queue-then-confusion for actions that truly need the network
 * (auth, uploads, payments).
 */
export function useRequireOnline() {
  const { isOnline } = useOnlineStatus()
  return useCallback(
    (actionLabel = 'do that') => {
      if (isOnline) return true
      toastService.info(`You are offline — ${actionLabel} needs a connection. Please try again when back online.`)
      return false
    },
    [isOnline],
  )
}

async function heartbeat(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PWA_HEARTBEAT.timeoutMs)
    const res = await fetch(`${PWA_HEARTBEAT.url}?t=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: ctrl.signal,
    }).catch(() =>
      fetch(`/favicon.ico?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal }),
    )
    clearTimeout(timer)
    return !!res && res.ok
  } catch {
    return false
  }
}

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null)
  const onlineRef = useRef(true)
  const firstPaint = useRef(true)

  const goOnline = useCallback(() => {
    const wasOffline = !onlineRef.current
    onlineRef.current = true
    setIsOnline(true)
    setLastOnlineAt(Date.now())
    offlineQueue.flush().catch(() => {})
    // Background-sync registration (best-effort, non-blocking)
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg) => {
          const syncReg = reg as unknown as { sync?: { register: (t: string) => Promise<void> } }
          syncReg.sync?.register(PWA_SYNC_TAGS.offlineQueue).catch(() => {})
        }).catch(() => {})
      }
    } catch {}
    if (wasOffline && !firstPaint.current) {
      toastService.success(PWA_TOAST_COPY.backOnline)
    }
  }, [])

  const goOffline = useCallback(() => {
    if (!onlineRef.current) return
    onlineRef.current = false
    setIsOnline(false)
    if (!firstPaint.current) {
      toastService.info(PWA_TOAST_COPY.wentOffline)
    }
  }, [])

  const recheck = useCallback(async () => {
    const ok = await heartbeat()
    if (ok) goOnline()
    else goOffline()
    return ok
  }, [goOnline, goOffline])

  useEffect(() => {
    firstPaint.current = false
    setIsOnline(navigator.onLine)
    onlineRef.current = navigator.onLine
    if (navigator.onLine) setLastOnlineAt(Date.now())

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    // SW-asked flush (background sync) + message channel
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'FLUSH_OFFLINE_QUEUE') offlineQueue.flush().catch(() => {})
    }
    navigator.serviceWorker?.addEventListener?.('message', onMessage)

    // Heartbeat catches captive portals / flaky networks navigator.onLine misses.
    const timer = setInterval(() => {
      void heartbeat().then((ok) => {
        if (ok && !onlineRef.current) goOnline()
        else if (!ok && onlineRef.current && !navigator.onLine) goOffline()
      })
    }, PWA_HEARTBEAT.intervalMs)

    // Flush queued mutations whenever the tab regains focus while online.
    const onFocus = () => {
      if (navigator.onLine) offlineQueue.flush().catch(() => {})
    }
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('focus', onFocus)
      clearInterval(timer)
    }
  }, [goOnline, goOffline])

  return (
    <OnlineStatusContext.Provider value={{ isOnline, lastOnlineAt, recheck }}>
      {children}
    </OnlineStatusContext.Provider>
  )
}
