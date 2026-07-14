'use client'

import { useContext, useEffect, useRef } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { subscribeToPush } from '@/app/lib/utils/pushClient'

export function PushProvider({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext)
  const subscribed = useRef(false)

  useEffect(() => {
    if (auth?.isAuthenticated && !subscribed.current && 'serviceWorker' in navigator) {
      subscribed.current = true
      subscribeToPush().catch(() => {})
    }
    if (!auth?.isAuthenticated) {
      subscribed.current = false
    }
  }, [auth?.isAuthenticated, auth?.user])

  return children
}
