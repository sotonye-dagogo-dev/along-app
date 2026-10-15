'use client'

import Link from 'next/link'
import { LogIn, UserPlus } from 'lucide-react'
import { useTranslation } from '@/app/providers/I18nProvider'
import { useOnlineStatus } from '@/app/providers/OnlineStatusProvider'
import { readAuthSnapshot } from '@/app/lib/config/authOffline'
import { useMemo } from 'react'

export default function GuestBanner() {
  const { t } = useTranslation()
  const { isOnline } = useOnlineStatus()
  // Belt-and-suspenders: AuthProvider hydrates from the snapshot, but on the
  // very first offline paint the context may still be revalidating. When
  // offline with a last-known session, the user never signed out — suppress
  // the guest banner so it doesn't accuse them of browsing as a guest.
  const hasOfflineSession = useMemo(() => {
    if (isOnline) return false
    return readAuthSnapshot() !== null
  }, [isOnline])
  if (hasOfflineSession) return null
  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-text-primary">
          <span className="font-semibold">{t("guest.banner")}</span>
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5"
          >
            <LogIn size={14} /> {t("guest.signIn")}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1 text-xs font-medium bg-primary text-text-inverse px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            <UserPlus size={14} /> {t("guest.signUp")}
          </Link>
        </div>
      </div>
    </div>
  )
}
