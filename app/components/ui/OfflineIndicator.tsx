'use client'

import { useOnlineStatus } from '@/app/providers/OnlineStatusProvider'
import { AppEmptyState } from './AppEmptyState'

export default function OfflineIndicator() {
  const { isOnline } = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-card p-6 rounded-xl shadow-xl max-w-sm mx-4">
        <AppEmptyState preset="offline" />
      </div>
    </div>
  )
}
